import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { chunkText, getStore, saveStore, serializePublicState } from './server/store.ts';
import {
  ensureMaterialEmbeddings,
  generateAdaptiveQuiz,
  generateAdaptiveStudyPlan,
  generateSmartNote,
  retrieveRelevantChunks,
  solveDoubtWithRAG,
  synthesizeTutorSpeech,
  transcribeStudentAudio,
} from './server/gemini.ts';
import type {
  DoubtMessage,
  ExplanationDepth,
  FeedbackEvent,
  LanguageCode,
  LearningStyle,
  QuizAttempt,
  QuizSet,
  SmartNote,
  StudyBlock,
  StudyMaterialInternal,
} from './src/types.ts';
import { SUPPORTED_LANGUAGES } from './src/types.ts';

const VALID_LANGUAGES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));
const VALID_STYLES = new Set<string>(['visual_analogies', 'step_by_step', 'concise_exam', 'socratic']);
const VALID_DEPTHS = new Set<string>(['foundational', 'balanced', 'rigorous']);
const VALID_FEEDBACK = new Set<string>(['helpful', 'needs_simpler', 'needs_deeper', 'more_examples']);
const VALID_VOICE_PITCHES = new Set<string>(['low', 'standard', 'bright']);
const VALID_VOICE_PERSONAS = new Set<string>(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);
const VALID_AUDIO_MIMES = new Set<string>([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
]);

function formatErrorMessage(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : 'Unexpected server error';
  if (msg.includes('GEMINI_API_KEY') || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
    return { status: 403, message: 'Gemini API key issue. Please verify your API key in Settings > Secrets.' };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return { status: 429, message: 'AI quota temporarily reached. Please wait a moment or check Settings > Secrets.' };
  }
  return { status: 500, message: msg };
}

function updateSubjectMastery(subject: string, deltaMastery: number, extraHours = 0, extraDoubt = 0) {
  const store = getStore();
  const existing = store.profile.subjectMastery.find(
    (s) => s.subject.toLowerCase() === subject.toLowerCase()
  );
  if (existing) {
    existing.mastery = Math.max(15, Math.min(100, Math.round(existing.mastery + deltaMastery)));
    existing.hoursLogged = Number((existing.hoursLogged + extraHours).toFixed(1));
    existing.doubtsResolved += extraDoubt;
  } else if (subject && subject !== 'All Subjects') {
    store.profile.subjectMastery.push({
      subject,
      mastery: Math.max(40, Math.min(95, 65 + deltaMastery)),
      hoursLogged: Number(Math.max(0.2, extraHours).toFixed(1)),
      doubtsResolved: extraDoubt,
      nextRevisionDays: 2,
    });
  }
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Hydrate initial state
  app.get('/api/state', (_req, res) => {
    const store = getStore();
    res.json(serializePublicState(store));
  });

  // Update student profile & personalization preferences
  app.patch('/api/profile', (req, res) => {
    const store = getStore();
    const {
      name,
      program,
      preferredLanguage,
      learningStyle,
      explanationDepth,
      dailyGoalMinutes,
      voicePreferences,
    } = req.body ?? {};

    if (typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 60) {
      store.profile.name = name.trim();
    }
    if (typeof program === 'string' && program.trim().length >= 1 && program.trim().length <= 100) {
      store.profile.program = program.trim();
    }
    if (typeof preferredLanguage === 'string' && VALID_LANGUAGES.has(preferredLanguage)) {
      store.profile.preferredLanguage = preferredLanguage as LanguageCode;
      if (!store.profile.voicePreferences.enabledLanguages.includes(preferredLanguage as LanguageCode)) {
        store.profile.voicePreferences.enabledLanguages.push(preferredLanguage as LanguageCode);
      }
    }
    if (typeof learningStyle === 'string' && VALID_STYLES.has(learningStyle)) {
      store.profile.learningStyle = learningStyle as LearningStyle;
    }
    if (typeof explanationDepth === 'string' && VALID_DEPTHS.has(explanationDepth)) {
      store.profile.explanationDepth = explanationDepth as ExplanationDepth;
    }
    if (typeof dailyGoalMinutes === 'number' && Number.isFinite(dailyGoalMinutes)) {
      store.profile.dailyGoalMinutes = Math.max(30, Math.min(480, Math.round(dailyGoalMinutes)));
    }
    if (voicePreferences && typeof voicePreferences === 'object') {
      const vp = store.profile.voicePreferences;
      if (Array.isArray(voicePreferences.enabledLanguages)) {
        const filtered: LanguageCode[] = Array.from(
          new Set<LanguageCode>(
            (voicePreferences.enabledLanguages as unknown[]).filter(
              (code): code is LanguageCode => typeof code === 'string' && VALID_LANGUAGES.has(code)
            )
          )
        );
        if (filtered.length > 0) {
          vp.enabledLanguages = filtered;
          if (!filtered.includes(store.profile.preferredLanguage)) {
            store.profile.preferredLanguage = filtered[0];
          }
        }
      }
      if (typeof voicePreferences.voicePersona === 'string' && VALID_VOICE_PERSONAS.has(voicePreferences.voicePersona)) {
        vp.voicePersona = voicePreferences.voicePersona as typeof vp.voicePersona;
      }
      if (typeof voicePreferences.playbackSpeed === 'number' && Number.isFinite(voicePreferences.playbackSpeed)) {
        vp.playbackSpeed = Number(Math.max(0.75, Math.min(1.75, voicePreferences.playbackSpeed)).toFixed(2));
      }
      if (typeof voicePreferences.voicePitch === 'string' && VALID_VOICE_PITCHES.has(voicePreferences.voicePitch)) {
        vp.voicePitch = voicePreferences.voicePitch as typeof vp.voicePitch;
      }
      if (typeof voicePreferences.autoSpeakAnswers === 'boolean') {
        vp.autoSpeakAnswers = voicePreferences.autoSpeakAnswers;
      }
      if (typeof voicePreferences.voiceInputAutoSend === 'boolean') {
        vp.voiceInputAutoSend = voicePreferences.voiceInputAutoSend;
      }
    }

    saveStore();
    res.json(serializePublicState(store));
  });

  // Add study material into Knowledge Vault & compute RAG embeddings
  app.post('/api/materials', async (req, res) => {
    try {
      const { title, subject, content } = req.body ?? {};
      if (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 140) {
        return res.status(400).json({ error: 'Please provide a material title between 2 and 140 characters.' });
      }
      if (typeof subject !== 'string' || subject.trim().length < 2 || subject.trim().length > 60) {
        return res.status(400).json({ error: 'Please specify a subject.' });
      }
      if (typeof content !== 'string' || content.trim().length < 30 || content.length > 40000) {
        return res.status(400).json({ error: 'Study material must be between 30 and 40,000 characters.' });
      }

      const chunks = chunkText(content.trim());
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const material: StudyMaterialInternal = {
        id: `mat_${crypto.randomBytes(5).toString('hex')}`,
        title: title.trim(),
        subject: subject.trim(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
        wordCount,
        chunkCount: chunks.length,
        hasEmbeddings: false,
        chunks,
      };

      // Compute real Gemini embeddings immediately when API key is available
      try {
        await ensureMaterialEmbeddings(material);
      } catch (embedErr) {
        console.warn('Deferred embedding computation:', embedErr instanceof Error ? embedErr.message : embedErr);
      }

      const store = getStore();
      store.materials.unshift(material);
      updateSubjectMastery(material.subject, 2, 0, 0);
      saveStore();

      res.status(201).json({ state: serializePublicState(store), materialId: material.id });
    } catch (err) {
      const { status, message } = formatErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  app.delete('/api/materials/:id', (req, res) => {
    const store = getStore();
    const idx = store.materials.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Study material not found.' });
    }
    store.materials.splice(idx, 1);
    saveStore();
    res.json(serializePublicState(store));
  });

  // AI Doubt Solver with RAG retrieval + personalization loop
  app.post('/api/doubt', async (req, res) => {
    try {
      const { question, subject, language } = req.body ?? {};
      if (typeof question !== 'string' || question.trim().length < 2 || question.trim().length > 2000) {
        return res.status(400).json({ error: 'Please enter a clear question (2–2000 characters).' });
      }

      const store = getStore();
      const chosenLang: LanguageCode =
        typeof language === 'string' && VALID_LANGUAGES.has(language)
          ? (language as LanguageCode)
          : store.profile.preferredLanguage;
      const chosenSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : 'All Subjects';

      const studentMsg: DoubtMessage = {
        id: `msg_${crypto.randomBytes(5).toString('hex')}`,
        role: 'student',
        content: question.trim(),
        language: chosenLang,
        subject: chosenSubject,
        timestamp: new Date().toISOString(),
      };

      const retrieval = await retrieveRelevantChunks(question.trim(), store.materials, chosenSubject, 3);

      const recentHistory = store.doubts.slice(-6).map((d) => ({
        role: d.role,
        content: d.content,
      }));

      const synthesis = await solveDoubtWithRAG({
        question: question.trim(),
        subject: chosenSubject,
        language: chosenLang,
        profile: store.profile,
        retrievedChunks: retrieval.chunks,
        recentHistory,
      });

      const assistantMsg: DoubtMessage = {
        id: `msg_${crypto.randomBytes(5).toString('hex')}`,
        role: 'assistant',
        content: synthesis.answer,
        language: chosenLang,
        subject: chosenSubject,
        timestamp: new Date().toISOString(),
        retrievedSources: retrieval.chunks,
        pipelineMetrics: {
          retrievalMs: retrieval.retrievalMs,
          synthesisMs: synthesis.synthesisMs,
          topSimilarity: retrieval.chunks[0]?.score ?? 0,
          chunksSearched: retrieval.chunksSearched,
          usedVectorEmbeddings: retrieval.usedVectorEmbeddings,
        },
        followUpSuggestions: synthesis.followUpSuggestions,
      };

      store.doubts.push(studentMsg, assistantMsg);
      const resolvedSubject =
        chosenSubject !== 'All Subjects'
          ? chosenSubject
          : retrieval.chunks[0]?.subject ?? 'General';
      updateSubjectMastery(resolvedSubject, 1, 0.1, 1);
      saveStore();

      res.json({ message: assistantMsg, state: serializePublicState(store) });
    } catch (err) {
      const { status, message } = formatErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  // Clear doubt conversation thread
  app.delete('/api/doubt', (_req, res) => {
    const store = getStore();
    store.doubts = [];
    saveStore();
    res.json(serializePublicState(store));
  });

  // Generate Smart Notes from Vault Material or custom topic/text
  app.post('/api/notes/generate', async (req, res) => {
    try {
      const { materialId, topic, subject, customText, language } = req.body ?? {};
      const store = getStore();
      const chosenLang: LanguageCode =
        typeof language === 'string' && VALID_LANGUAGES.has(language)
          ? (language as LanguageCode)
          : store.profile.preferredLanguage;

      let sourceTitle = typeof topic === 'string' ? topic.trim() : '';
      let sourceSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : 'General';
      let sourceContent = typeof customText === 'string' ? customText.trim() : '';
      let linkedMaterialId: string | undefined;

      if (typeof materialId === 'string' && materialId) {
        const mat = store.materials.find((m) => m.id === materialId);
        if (!mat) return res.status(404).json({ error: 'Selected study material not found.' });
        sourceTitle = sourceTitle || mat.title;
        sourceSubject = mat.subject;
        sourceContent = mat.content;
        linkedMaterialId = mat.id;
      }

      if (!sourceTitle && !sourceContent) {
        return res.status(400).json({ error: 'Choose a Vault material or provide a topic/content to synthesize.' });
      }

      const generated = await generateSmartNote({
        topicOrTitle: sourceTitle || `${sourceSubject} Study Guide`,
        subject: sourceSubject,
        sourceContent: sourceContent || `Create authoritative study notes covering: ${sourceTitle}`,
        language: chosenLang,
        profile: store.profile,
      });

      const note: SmartNote = {
        id: `note_${crypto.randomBytes(5).toString('hex')}`,
        ...generated,
        sourceMaterialId: linkedMaterialId,
        createdAt: new Date().toISOString(),
        masteryScore: 68,
        lastReviewedAt: new Date().toISOString(),
      };

      store.notes.unshift(note);
      updateSubjectMastery(sourceSubject, 2, 0.2, 0);
      saveStore();

      res.status(201).json({ note, state: serializePublicState(store) });
    } catch (err) {
      const { status, message } = formatErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  // Generate Adaptive Quiz
  app.post('/api/quiz/generate', async (req, res) => {
    try {
      const { materialId, topic, subject, customText, questionCount, language } = req.body ?? {};
      const store = getStore();
      const chosenLang: LanguageCode =
        typeof language === 'string' && VALID_LANGUAGES.has(language)
          ? (language as LanguageCode)
          : store.profile.preferredLanguage;

      let sourceTitle = typeof topic === 'string' ? topic.trim() : '';
      let sourceSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : 'General';
      let sourceContent = typeof customText === 'string' ? customText.trim() : '';
      let linkedMaterialId: string | undefined;

      if (typeof materialId === 'string' && materialId) {
        const mat = store.materials.find((m) => m.id === materialId);
        if (!mat) return res.status(404).json({ error: 'Selected study material not found.' });
        sourceTitle = sourceTitle || mat.title;
        sourceSubject = mat.subject;
        sourceContent = mat.content;
        linkedMaterialId = mat.id;
      }

      if (!sourceTitle && !sourceContent) {
        return res.status(400).json({ error: 'Select a material or enter a topic to generate a quiz.' });
      }

      const count = Math.max(3, Math.min(8, Number(questionCount) || 4));
      const generated = await generateAdaptiveQuiz({
        topicOrTitle: sourceTitle || `${sourceSubject} Practice`,
        subject: sourceSubject,
        sourceContent: sourceContent || `Generate a conceptual exam quiz about: ${sourceTitle}`,
        questionCount: count,
        language: chosenLang,
        profile: store.profile,
      });

      const quiz: QuizSet = {
        id: `quiz_${crypto.randomBytes(5).toString('hex')}`,
        title: generated.title,
        subject: sourceSubject,
        language: chosenLang,
        sourceMaterialId: linkedMaterialId,
        questions: generated.questions,
        attempts: [],
        createdAt: new Date().toISOString(),
      };

      store.quizzes.unshift(quiz);
      saveStore();

      res.status(201).json({ quiz, state: serializePublicState(store) });
    } catch (err) {
      const { status, message } = formatErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  // Record quiz attempt & update mastery + weak concepts loop
  app.post('/api/quiz/:id/attempt', (req, res) => {
    const store = getStore();
    const quiz = store.quizzes.find((q) => q.id === req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

    const { answers } = req.body ?? {};
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers array is required.' });
    }

    let score = 0;
    const weakConcepts: string[] = [];
    const masteredConcepts: string[] = [];

    quiz.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctIndex) {
        score += 1;
        masteredConcepts.push(q.conceptTag);
      } else {
        weakConcepts.push(q.conceptTag);
      }
    });

    const attempt: QuizAttempt = {
      id: `att_${crypto.randomBytes(4).toString('hex')}`,
      date: new Date().toISOString(),
      score,
      total: quiz.questions.length,
      weakConcepts: Array.from(new Set(weakConcepts)),
    };

    quiz.attempts.unshift(attempt);

    // Feed weak concepts back into student profile personalization loop
    const updatedWeak = new Set(store.profile.weakConcepts);
    for (const c of masteredConcepts) {
      if (!weakConcepts.includes(c)) updatedWeak.delete(c);
    }
    for (const c of weakConcepts) {
      updatedWeak.add(c);
    }
    store.profile.weakConcepts = Array.from(updatedWeak).slice(0, 8);

    const pct = quiz.questions.length > 0 ? score / quiz.questions.length : 0;
    updateSubjectMastery(quiz.subject, pct >= 0.75 ? 5 : pct >= 0.5 ? 2 : -2, 0.25, 0);

    // Update linked note mastery if present
    if (quiz.sourceMaterialId) {
      const linkedNote = store.notes.find((n) => n.sourceMaterialId === quiz.sourceMaterialId);
      if (linkedNote) {
        linkedNote.masteryScore = Math.round(linkedNote.masteryScore * 0.5 + pct * 100 * 0.5);
        linkedNote.lastReviewedAt = new Date().toISOString();
      }
    }

    saveStore();
    res.json({ attempt, state: serializePublicState(store) });
  });

  // Generate adaptive study plan
  app.post('/api/planner/generate', async (req, res) => {
    try {
      const { goalTitle, examDate, dailyHours, subjects, language } = req.body ?? {};
      if (typeof goalTitle !== 'string' || goalTitle.trim().length < 3 || goalTitle.trim().length > 140) {
        return res.status(400).json({ error: 'Please enter a study goal title.' });
      }
      if (!Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ error: 'Please include at least one subject.' });
      }

      const store = getStore();
      const cleanSubjects = subjects
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 8);
      const hours = Math.max(1, Math.min(12, Number(dailyHours) || 3));
      const targetDate = typeof examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(examDate)
        ? examDate
        : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const chosenLang: LanguageCode =
        typeof language === 'string' && VALID_LANGUAGES.has(language)
          ? (language as LanguageCode)
          : store.profile.preferredLanguage;

      const generated = await generateAdaptiveStudyPlan({
        goalTitle: goalTitle.trim(),
        examDate: targetDate,
        dailyHours: hours,
        subjects: cleanSubjects,
        profile: store.profile,
        language: chosenLang,
      });

      const blocks: StudyBlock[] = generated.blocks.map((b, idx) => ({
        id: `blk_${Date.now()}_${idx}`,
        ...b,
        completed: false,
      }));

      store.studyPlan = {
        id: `plan_${crypto.randomBytes(5).toString('hex')}`,
        goalTitle: goalTitle.trim(),
        examDate: targetDate,
        dailyHours: hours,
        subjects: cleanSubjects,
        strategySummary: generated.strategySummary,
        blocks,
        createdAt: new Date().toISOString(),
      };

      saveStore();
      res.status(201).json(serializePublicState(store));
    } catch (err) {
      const { status, message } = formatErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  // Toggle study plan block completion
  app.patch('/api/planner/block/:id', (req, res) => {
    const store = getStore();
    const block = store.studyPlan.blocks.find((b) => b.id === req.params.id);
    if (!block) return res.status(404).json({ error: 'Study block not found.' });

    const nextCompleted = typeof req.body?.completed === 'boolean' ? req.body.completed : !block.completed;
    const wasCompleted = block.completed;
    block.completed = nextCompleted;
    block.completedAt = nextCompleted ? new Date().toISOString() : undefined;

    if (nextCompleted && !wasCompleted) {
      const todaySlot = store.profile.weeklyStudy[store.profile.weeklyStudy.length - 1];
      if (todaySlot) {
        if (todaySlot.sessions === 0) {
          store.profile.streakDays += 1;
        }
        todaySlot.minutes += block.durationMinutes;
        todaySlot.sessions += 1;
        todaySlot.retentionIndex = Math.min(98, todaySlot.retentionIndex + 2);
      }
      store.profile.focusMinutesLogged += block.durationMinutes;
      updateSubjectMastery(block.subject, 3, block.durationMinutes / 60, 0);
    }

    saveStore();
    res.json(serializePublicState(store));
  });

  // Log completed Focus Hourglass timer minutes
  app.post('/api/focus/log', (req, res) => {
    const store = getStore();
    const { minutes, subject } = req.body ?? {};
    const mins = Math.max(1, Math.min(180, Math.round(Number(minutes) || 0)));
    if (!mins) return res.status(400).json({ error: 'Valid positive minutes required.' });

    const todaySlot = store.profile.weeklyStudy[store.profile.weeklyStudy.length - 1];
    if (todaySlot) {
      if (todaySlot.sessions === 0) {
        store.profile.streakDays += 1;
      }
      todaySlot.minutes += mins;
      todaySlot.sessions += 1;
      todaySlot.retentionIndex = Math.min(99, todaySlot.retentionIndex + 1);
    }
    store.profile.focusMinutesLogged += mins;
    if (typeof subject === 'string' && subject.trim()) {
      updateSubjectMastery(subject.trim(), 2, mins / 60, 0);
    }

    saveStore();
    res.json(serializePublicState(store));
  });

  // Closed-Loop Feedback Engine (Slide 5: "Feedback improves the next recommendation")
  app.post('/api/feedback', (req, res) => {
    const store = getStore();
    const { module, signal, detail, messageId } = req.body ?? {};
    if (typeof signal !== 'string' || !VALID_FEEDBACK.has(signal)) {
      return res.status(400).json({ error: 'Invalid feedback signal.' });
    }
    const validModules = new Set(['doubt', 'notes', 'quiz', 'planner']);
    const mod = typeof module === 'string' && validModules.has(module) ? (module as FeedbackEvent['module']) : 'doubt';

    const event: FeedbackEvent = {
      id: `fb_${crypto.randomBytes(4).toString('hex')}`,
      module: mod,
      signal: signal as FeedbackEvent['signal'],
      detail: typeof detail === 'string' ? detail.trim().slice(0, 200) : undefined,
      timestamp: new Date().toISOString(),
    };

    store.profile.feedbackHistory.push(event);
    if (store.profile.feedbackHistory.length > 30) {
      store.profile.feedbackHistory = store.profile.feedbackHistory.slice(-30);
    }

    // Automatically calibrate personalization profile based on student feedback
    if (signal === 'needs_simpler') {
      store.profile.explanationDepth = 'foundational';
      store.profile.learningStyle = 'visual_analogies';
    } else if (signal === 'needs_deeper') {
      store.profile.explanationDepth = 'rigorous';
      store.profile.learningStyle = 'step_by_step';
    } else if (signal === 'more_examples') {
      store.profile.learningStyle = 'visual_analogies';
    }

    if (typeof messageId === 'string') {
      const msg = store.doubts.find((d) => d.id === messageId);
      if (msg) {
        msg.feedback = {
          rating: signal as FeedbackEvent['signal'],
          timestamp: event.timestamp,
        };
      }
    }

    saveStore();
    res.json(serializePublicState(store));
  });

  // Voice Input Transcription via Gemini 3.5 Transcribe
  app.post('/api/voice/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType, language } = req.body ?? {};
      if (typeof audioBase64 !== 'string' || audioBase64.length < 40) {
        return res.status(400).json({ error: 'Audio recording data is required.' });
      }
      const cleanMime = typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : 'audio/webm';
      const safeMime = VALID_AUDIO_MIMES.has(cleanMime) ? cleanMime : 'audio/webm';

      const store = getStore();
      const chosenLang: LanguageCode =
        typeof language === 'string' && VALID_LANGUAGES.has(language)
          ? (language as LanguageCode)
          : store.profile.preferredLanguage;

      const transcript = await transcribeStudentAudio(audioBase64, safeMime, chosenLang);
      res.json({ transcript });
    } catch (err) {
      const { status, message } = formatErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  // Spoken Tutor Audio via Gemini 3.8 Flash Lite TTS
  app.post('/api/voice/speak', async (req, res) => {
    try {
      const { text, language, voicePersona, voicePitch } = req.body ?? {};
      if (typeof text !== 'string' || text.trim().length < 2) {
        return res.status(400).json({ error: 'Text is required for speech synthesis.' });
      }
      const store = getStore();
      const chosenLang: LanguageCode =
        typeof language === 'string' && VALID_LANGUAGES.has(language)
          ? (language as LanguageCode)
          : store.profile.preferredLanguage;
      const chosenPersona =
        typeof voicePersona === 'string' && VALID_VOICE_PERSONAS.has(voicePersona)
          ? (voicePersona as 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr')
          : store.profile.voicePreferences.voicePersona;
      const chosenPitch =
        typeof voicePitch === 'string' && VALID_VOICE_PITCHES.has(voicePitch)
          ? (voicePitch as 'low' | 'standard' | 'bright')
          : store.profile.voicePreferences.voicePitch;

      const audioBase64 = await synthesizeTutorSpeech(text.trim(), chosenLang, {
        voicePersona: chosenPersona,
        voicePitch: chosenPitch,
      });
      res.json({ audioBase64, mimeType: 'audio/wav' });
    } catch (err) {
      const { status, message } = formatErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  // Vite dev middleware or production static serving
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distDir)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`EduMate server running on http://0.0.0.0:${port}`);
  });
}

createApp().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
