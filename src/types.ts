export type LanguageCode = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'ta' | 'te' | 'ja' | 'zh';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  voiceStyle: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', voiceStyle: 'Clear, warm university tutor explaining patiently' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', voiceStyle: 'Clear, encouraging Indian academic tutor speaking natural Hindi' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', voiceStyle: 'Clear, articulate university tutor speaking natural Spanish' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', voiceStyle: 'Clear, articulate academic tutor speaking natural French' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', voiceStyle: 'Clear, structured university tutor speaking natural German' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', voiceStyle: 'Warm, clear academic tutor speaking natural Tamil' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', voiceStyle: 'Warm, clear academic tutor speaking natural Telugu' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', voiceStyle: 'Polite, clear academic tutor speaking natural Japanese' },
  { code: 'zh', label: 'Mandarin', nativeLabel: '中文', voiceStyle: 'Clear, patient university tutor speaking natural Mandarin Chinese' },
];

export type LearningStyle = 'visual_analogies' | 'step_by_step' | 'concise_exam' | 'socratic';
export type ExplanationDepth = 'foundational' | 'balanced' | 'rigorous';
export type VoicePitch = 'low' | 'standard' | 'bright';
export type VoicePersona = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface VoicePersonaOption {
  id: VoicePersona;
  label: string;
  timbre: string;
}

export const VOICE_PERSONAS: VoicePersonaOption[] = [
  { id: 'Kore', label: 'Kore', timbre: 'Warm, articulate tutor' },
  { id: 'Puck', label: 'Puck', timbre: 'Upbeat, conversational' },
  { id: 'Charon', label: 'Charon', timbre: 'Measured, calm lecture' },
  { id: 'Fenrir', label: 'Fenrir', timbre: 'Resonant, authoritative' },
  { id: 'Zephyr', label: 'Zephyr', timbre: 'Light, crisp clarity' },
];

export interface VoicePreferences {
  enabledLanguages: LanguageCode[];
  voicePersona: VoicePersona;
  playbackSpeed: number;
  voicePitch: VoicePitch;
  autoSpeakAnswers: boolean;
  voiceInputAutoSend: boolean;
}

export interface MaterialChunk {
  id: string;
  text: string;
  embedding?: number[];
}

export interface StudyMaterial {
  id: string;
  title: string;
  subject: string;
  content: string;
  createdAt: string;
  wordCount: number;
  chunkCount: number;
  hasEmbeddings: boolean;
}

export interface StudyMaterialInternal extends StudyMaterial {
  chunks: MaterialChunk[];
}

export interface RetrievedChunk {
  materialId: string;
  materialTitle: string;
  subject: string;
  text: string;
  score: number;
}

export interface DoubtFeedback {
  rating: 'helpful' | 'needs_simpler' | 'needs_deeper' | 'more_examples';
  timestamp: string;
}

export interface DoubtMessage {
  id: string;
  role: 'student' | 'assistant';
  content: string;
  language: LanguageCode;
  subject: string;
  timestamp: string;
  retrievedSources?: RetrievedChunk[];
  pipelineMetrics?: {
    retrievalMs: number;
    synthesisMs: number;
    topSimilarity: number;
    chunksSearched: number;
    usedVectorEmbeddings: boolean;
  };
  followUpSuggestions?: string[];
  feedback?: DoubtFeedback;
}

export interface NoteConcept {
  term: string;
  definition: string;
  analogy: string;
}

export interface SmartNote {
  id: string;
  title: string;
  subject: string;
  language: LanguageCode;
  sourceMaterialId?: string;
  summary: string;
  keyConcepts: NoteConcept[];
  formulasOrRules: string[];
  memoryAnchors: string[];
  commonPitfalls: string[];
  createdAt: string;
  masteryScore: number;
  lastReviewedAt?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  conceptTag: string;
  difficulty: 'foundation' | 'applied' | 'exam';
}

export interface QuizAttempt {
  id: string;
  date: string;
  score: number;
  total: number;
  weakConcepts: string[];
}

export interface QuizSet {
  id: string;
  title: string;
  subject: string;
  language: LanguageCode;
  sourceMaterialId?: string;
  questions: QuizQuestion[];
  attempts: QuizAttempt[];
  createdAt: string;
}

export interface StudyBlock {
  id: string;
  dayIndex: number;
  dayLabel: string;
  date: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  blockType: 'concept' | 'practice' | 'revision' | 'quiz';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  completedAt?: string;
}

export interface StudyPlan {
  id: string;
  goalTitle: string;
  examDate: string;
  dailyHours: number;
  subjects: string[];
  strategySummary: string;
  blocks: StudyBlock[];
  createdAt: string;
}

export interface FeedbackEvent {
  id: string;
  module: 'doubt' | 'notes' | 'quiz' | 'planner';
  signal: 'helpful' | 'needs_simpler' | 'needs_deeper' | 'more_examples';
  detail?: string;
  timestamp: string;
}

export interface WeeklyStudyPoint {
  day: string;
  minutes: number;
  sessions: number;
  retentionIndex: number;
}

export interface SubjectMastery {
  subject: string;
  mastery: number;
  hoursLogged: number;
  doubtsResolved: number;
  nextRevisionDays: number;
}

export interface StudentProfile {
  name: string;
  program: string;
  preferredLanguage: LanguageCode;
  learningStyle: LearningStyle;
  explanationDepth: ExplanationDepth;
  dailyGoalMinutes: number;
  focusMinutesLogged: number;
  streakDays: number;
  weakConcepts: string[];
  feedbackHistory: FeedbackEvent[];
  weeklyStudy: WeeklyStudyPoint[];
  subjectMastery: SubjectMastery[];
  voicePreferences: VoicePreferences;
}

export interface EduMateState {
  profile: StudentProfile;
  materials: StudyMaterial[];
  doubts: DoubtMessage[];
  notes: SmartNote[];
  quizzes: QuizSet[];
  studyPlan: StudyPlan;
}
