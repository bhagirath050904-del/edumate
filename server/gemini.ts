import { GoogleGenAI, Type } from '@google/genai';
import type {
  LanguageCode,
  QuizQuestion,
  RetrievedChunk,
  SmartNote,
  StudentProfile,
  StudyBlock,
  StudyMaterialInternal,
} from '../src/types.ts';
import { SUPPORTED_LANGUAGES } from '../src/types.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured. Please verify your API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getLanguageName(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? 'English';
}

function getLanguageVoiceStyle(code: LanguageCode): string {
  return (
    SUPPORTED_LANGUAGES.find((l) => l.code === code)?.voiceStyle ??
    'Clear, warm university tutor explaining patiently'
  );
}

function buildPersonalizationPrompt(profile: StudentProfile, language: LanguageCode): string {
  const langName = getLanguageName(language);
  const styleDesc: Record<StudentProfile['learningStyle'], string> = {
    visual_analogies: 'Use intuitive real-world analogies and clear mental models.',
    step_by_step: 'Break reasoning into numbered, logical steps with intermediate checkpoints.',
    concise_exam: 'Keep explanations crisp, formula-first, and optimized for rapid exam recall.',
    socratic: 'Guide understanding with structured hints and a quick diagnostic question at the end.',
  };

  const depthDesc: Record<StudentProfile['explanationDepth'], string> = {
    foundational: 'Use accessible everyday language and define technical terms gently.',
    balanced: 'Balance intuitive clarity with university-level rigor.',
    rigorous: 'Use formal mathematical/scientific precision and edge-case derivations.',
  };

  const recentFeedback = profile.feedbackHistory
    .slice(-5)
    .map((f) => `- [${f.module}] ${f.signal}${f.detail ? `: ${f.detail}` : ''}`)
    .join('\n');

  return [
    `Student Profile: ${profile.name} (${profile.program}).`,
    `Target Response Language: ${langName} (respond naturally and fluently in ${langName}).`,
    `Preferred Learning Style: ${styleDesc[profile.learningStyle]}`,
    `Explanation Depth: ${depthDesc[profile.explanationDepth]}`,
    profile.weakConcepts.length > 0
      ? `Tracked Weak Concepts to reinforce when relevant: ${profile.weakConcepts.join(', ')}.`
      : '',
    recentFeedback ? `Recent Student Feedback Signals (adapt your response accordingly):\n${recentFeedback}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function lexicalOverlapScore(query: string, passage: string): number {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u3040-\u30FF\u4E00-\u9FFF]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return 0;
  const pTokens = new Set(tokenize(passage));
  let hits = 0;
  for (const t of qTokens) {
    if (pTokens.has(t)) hits++;
  }
  return hits / Math.sqrt(qTokens.size * Math.max(1, pTokens.size * 0.25));
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getAiClient();
  const vectors: number[][] = [];

  for (const text of texts) {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
    });
    const values = res.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error('Embedding model returned empty vector');
    }
    vectors.push(values);
  }
  return vectors;
}

export async function ensureMaterialEmbeddings(material: StudyMaterialInternal): Promise<boolean> {
  const missing = material.chunks.filter((c) => !c.embedding || c.embedding.length === 0);
  if (missing.length === 0) {
    material.hasEmbeddings = true;
    return true;
  }
  const vectors = await embedTexts(missing.map((c) => `${material.title} (${material.subject}): ${c.text}`));
  for (let i = 0; i < missing.length; i++) {
    missing[i].embedding = vectors[i];
  }
  material.hasEmbeddings = true;
  return true;
}

export async function retrieveRelevantChunks(
  query: string,
  materials: StudyMaterialInternal[],
  subjectFilter?: string,
  topK = 3
): Promise<{
  chunks: RetrievedChunk[];
  chunksSearched: number;
  usedVectorEmbeddings: boolean;
  retrievalMs: number;
}> {
  const start = Date.now();
  const candidates =
    subjectFilter && subjectFilter !== 'All Subjects'
      ? materials.filter((m) => m.subject.toLowerCase() === subjectFilter.toLowerCase())
      : materials;

  const pool = candidates.length > 0 ? candidates : materials;
  const allChunks = pool.flatMap((m) =>
    m.chunks.map((c) => ({
      material: m,
      chunk: c,
    }))
  );

  if (allChunks.length === 0) {
    return { chunks: [], chunksSearched: 0, usedVectorEmbeddings: false, retrievalMs: Date.now() - start };
  }

  let usedVectorEmbeddings = false;
  let queryVec: number[] | null = null;

  try {
    for (const m of pool) {
      await ensureMaterialEmbeddings(m);
    }
    const [vec] = await embedTexts([query]);
    queryVec = vec;
    usedVectorEmbeddings = true;
  } catch (err) {
    console.warn('Vector embedding retrieval fallback to lexical matching:', err instanceof Error ? err.message : err);
  }

  const scored: RetrievedChunk[] = allChunks.map(({ material, chunk }) => {
    const lexical = Math.min(1, lexicalOverlapScore(query, `${material.title} ${chunk.text}`));
    let score = lexical;
    if (queryVec && chunk.embedding && chunk.embedding.length === queryVec.length) {
      const cos = Math.max(0, cosineSimilarity(queryVec, chunk.embedding));
      score = cos * 0.85 + lexical * 0.15;
    }
    return {
      materialId: material.id,
      materialTitle: material.title,
      subject: material.subject,
      text: chunk.text,
      score: Number(Math.min(0.99, Math.max(0.05, score)).toFixed(2)),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK).filter((c) => c.score >= 0.18 || topK === 1);

  return {
    chunks: top.length > 0 ? top : scored.slice(0, Math.min(2, scored.length)),
    chunksSearched: allChunks.length,
    usedVectorEmbeddings,
    retrievalMs: Math.max(12, Date.now() - start),
  };
}

export async function solveDoubtWithRAG(params: {
  question: string;
  subject: string;
  language: LanguageCode;
  profile: StudentProfile;
  retrievedChunks: RetrievedChunk[];
  recentHistory: Array<{ role: 'student' | 'assistant'; content: string }>;
}): Promise<{ answer: string; followUpSuggestions: string[]; synthesisMs: number }> {
  const ai = getAiClient();
  const start = Date.now();

  const ragContext =
    params.retrievedChunks.length > 0
      ? params.retrievedChunks
          .map(
            (c, idx) =>
              `[Source ${idx + 1}: "${c.materialTitle}" (${c.subject}, match ${Math.round(c.score * 100)}%)]\n${c.text}`
          )
          .join('\n\n')
      : 'No direct match in the student knowledge vault; answer from authoritative academic fundamentals.';

  const historyText = params.recentHistory
    .slice(-4)
    .map((m) => `${m.role === 'student' ? 'Student' : 'EduMate'}: ${m.content.slice(0, 320)}`)
    .join('\n');

  const systemInstruction = `You are EduMate, a calm, authoritative academic study companion.
${buildPersonalizationPrompt(params.profile, params.language)}

Instructions:
- Ground your explanation in the retrieved student study material below whenever relevant, and explicitly mention the source title naturally when citing it.
- Structure the answer cleanly with Markdown headings (###), concise numbered steps, inline code ticks for equations/formulas, and one crisp checkpoint question at the end.
- Never fabricate citations. Keep the tone human, focused, and encouraging—never robotic or overly verbose.
- Also return 3 concise, useful follow-up prompts in the exact target language (${getLanguageName(params.language)}).`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Subject Focus: ${params.subject}

Retrieved Study Material (RAG Context):
${ragContext}

${historyText ? `Recent Conversation Context:\n${historyText}\n` : ''}
Student's Doubt:
${params.question}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: {
            type: Type.STRING,
            description: 'Well-structured Markdown explanation addressing the student doubt in the target language.',
          },
          followUpSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Three short, natural follow-up questions or study actions in the target language.',
          },
        },
        required: ['answer', 'followUpSuggestions'],
      },
    },
  });

  const raw = (response.text ?? '').trim();
  const parsed = JSON.parse(raw) as { answer: string; followUpSuggestions: string[] };

  return {
    answer: parsed.answer,
    followUpSuggestions: Array.isArray(parsed.followUpSuggestions) ? parsed.followUpSuggestions.slice(0, 3) : [],
    synthesisMs: Date.now() - start,
  };
}

export async function generateSmartNote(params: {
  topicOrTitle: string;
  subject: string;
  sourceContent: string;
  language: LanguageCode;
  profile: StudentProfile;
}): Promise<Omit<SmartNote, 'id' | 'createdAt' | 'masteryScore' | 'sourceMaterialId'>> {
  const ai = getAiClient();
  const langName = getLanguageName(params.language);

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Generate structured, high-retention Smart Study Notes for:
Title/Topic: ${params.topicOrTitle}
Subject: ${params.subject}

Source Study Material:
${params.sourceContent.slice(0, 9000)}`,
    config: {
      systemInstruction: `You are EduMate's Smart Notes Synthesizer.
${buildPersonalizationPrompt(params.profile, params.language)}
Produce exam-ready, structured study notes strictly in ${langName}. Keep every definition crisp, pair each concept with an unforgettable real-world analogy, extract exact formulas or core rules, provide 2-4 memory anchors, and highlight common exam pitfalls.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          keyConcepts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                definition: { type: Type.STRING },
                analogy: { type: Type.STRING },
              },
              required: ['term', 'definition', 'analogy'],
            },
          },
          formulasOrRules: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          memoryAnchors: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          commonPitfalls: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['title', 'summary', 'keyConcepts', 'formulasOrRules', 'memoryAnchors', 'commonPitfalls'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    title: string;
    summary: string;
    keyConcepts: SmartNote['keyConcepts'];
    formulasOrRules: string[];
    memoryAnchors: string[];
    commonPitfalls: string[];
  };

  return {
    title: parsed.title || params.topicOrTitle,
    subject: params.subject,
    language: params.language,
    summary: parsed.summary,
    keyConcepts: parsed.keyConcepts ?? [],
    formulasOrRules: parsed.formulasOrRules ?? [],
    memoryAnchors: parsed.memoryAnchors ?? [],
    commonPitfalls: parsed.commonPitfalls ?? [],
  };
}

export async function generateAdaptiveQuiz(params: {
  topicOrTitle: string;
  subject: string;
  sourceContent: string;
  questionCount: number;
  language: LanguageCode;
  profile: StudentProfile;
}): Promise<{ title: string; questions: QuizQuestion[] }> {
  const ai = getAiClient();
  const langName = getLanguageName(params.language);

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Create a ${params.questionCount}-question adaptive multiple-choice quiz.
Topic: ${params.topicOrTitle}
Subject: ${params.subject}

Reference Material:
${params.sourceContent.slice(0, 8000)}`,
    config: {
      systemInstruction: `You are EduMate's Adaptive Assessment Engine.
${buildPersonalizationPrompt(params.profile, params.language)}
Write strictly in ${langName}. Create conceptual and applied questions with 4 plausible options each, a zero-based correctIndex (0-3), a clear explanation, a concise conceptTag, and difficulty ('foundation', 'applied', or 'exam').`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                conceptTag: { type: Type.STRING },
                difficulty: { type: Type.STRING },
              },
              required: ['question', 'options', 'correctIndex', 'explanation', 'conceptTag', 'difficulty'],
            },
          },
        },
        required: ['title', 'questions'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    title: string;
    questions: Array<Omit<QuizQuestion, 'id'>>;
  };

  const normalizedQuestions: QuizQuestion[] = (parsed.questions ?? []).map((q, idx) => ({
    id: `q_${Date.now()}_${idx}`,
    question: q.question,
    options: Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 4) : ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
    explanation: q.explanation,
    conceptTag: q.conceptTag || params.subject,
    difficulty:
      q.difficulty === 'foundation' || q.difficulty === 'applied' || q.difficulty === 'exam'
        ? q.difficulty
        : 'applied',
  }));

  return {
    title: parsed.title || `${params.topicOrTitle} Quiz`,
    questions: normalizedQuestions,
  };
}

export async function generateAdaptiveStudyPlan(params: {
  goalTitle: string;
  examDate: string;
  dailyHours: number;
  subjects: string[];
  profile: StudentProfile;
  language: LanguageCode;
}): Promise<{ strategySummary: string; blocks: Omit<StudyBlock, 'id' | 'completed'>[] }> {
  const ai = getAiClient();
  const langName = getLanguageName(params.language);
  const today = new Date();
  const nextDays = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(today.getTime() + i * 86400000);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `Day ${i + 1}`;
    return `${i}: ${label} (${d.toISOString().slice(0, 10)})`;
  }).join(', ');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Build a focused 4-day adaptive study schedule.
Goal: ${params.goalTitle}
Target Exam Date: ${params.examDate}
Available Study Hours Per Day: ${params.dailyHours}
Subjects to Cover: ${params.subjects.join(', ')}
Day Index Mapping: ${nextDays}
Weak Concepts to Prioritize Early: ${params.profile.weakConcepts.join(', ') || 'None specified'}`,
    config: {
      systemInstruction: `You are EduMate's Study Planner.
${buildPersonalizationPrompt(params.profile, params.language)}
Write strictly in ${langName}. Generate 8 to 10 realistic study blocks across dayIndex 0..3 using interleaved practice, spaced revision, and short quiz checkpoints so the student avoids last-minute cramming. Each block durationMinutes should be between 25 and 60 minutes. blockType must be one of: concept, practice, revision, quiz. priority must be one of: high, medium, low.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strategySummary: { type: Type.STRING },
          blocks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dayIndex: { type: Type.INTEGER },
                dayLabel: { type: Type.STRING },
                date: { type: Type.STRING },
                subject: { type: Type.STRING },
                topic: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                blockType: { type: Type.STRING },
                priority: { type: Type.STRING },
              },
              required: ['dayIndex', 'dayLabel', 'date', 'subject', 'topic', 'durationMinutes', 'blockType', 'priority'],
            },
          },
        },
        required: ['strategySummary', 'blocks'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    strategySummary: string;
    blocks: Array<Omit<StudyBlock, 'id' | 'completed'>>;
  };

  const validTypes = new Set(['concept', 'practice', 'revision', 'quiz']);
  const validPriorities = new Set(['high', 'medium', 'low']);

  const blocks = (parsed.blocks ?? []).map((b) => {
    const dayIndex = Math.max(0, Math.min(3, Number(b.dayIndex) || 0));
    const d = new Date(today.getTime() + dayIndex * 86400000);
    return {
      dayIndex,
      dayLabel: b.dayLabel || (dayIndex === 0 ? 'Today' : dayIndex === 1 ? 'Tomorrow' : `Day ${dayIndex + 1}`),
      date: b.date || d.toISOString().slice(0, 10),
      subject: b.subject || params.subjects[0] || 'General',
      topic: b.topic,
      durationMinutes: Math.max(15, Math.min(90, Number(b.durationMinutes) || 40)),
      blockType: (validTypes.has(b.blockType) ? b.blockType : 'concept') as StudyBlock['blockType'],
      priority: (validPriorities.has(b.priority) ? b.priority : 'medium') as StudyBlock['priority'],
    };
  });

  return {
    strategySummary: parsed.strategySummary,
    blocks,
  };
}

export async function transcribeStudentAudio(
  base64Audio: string,
  mimeType: string,
  language: LanguageCode
): Promise<string> {
  const ai = getAiClient();
  const langName = getLanguageName(language);

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Audio,
          },
        },
        {
          text: `Transcribe this student's spoken question accurately. Expected language hint: ${langName}. Return only the verbatim transcript with proper punctuation.`,
        },
      ],
    },
  });

  return (response.text ?? '').trim();
}

export async function synthesizeTutorSpeech(
  text: string,
  language: LanguageCode,
  options?: {
    voicePersona?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
    voicePitch?: 'low' | 'standard' | 'bright';
  }
): Promise<string> {
  const ai = getAiClient();
  // Strip heavy markdown markers for natural speech delivery
  const cleanSpeechText = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#*_>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1400);

  const pitchGuidance: Record<'low' | 'standard' | 'bright', string> = {
    low: 'in a calm, deeper lower-pitched vocal register',
    standard: 'at a natural, balanced vocal pitch',
    bright: 'in a crisp, lighter higher-pitched vocal register',
  };
  const pitch = options?.voicePitch ?? 'standard';
  const voiceName = options?.voicePersona ?? 'Kore';

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: cleanSpeechText,
            speechMetadata: {
              style: `${getLanguageVoiceStyle(language)}, speaking ${pitchGuidance[pitch]}`,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Speech synthesis returned empty audio payload.');
  }
  return base64Audio;
}
