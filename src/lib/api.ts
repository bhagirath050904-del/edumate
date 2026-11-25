import type {
  DoubtMessage,
  EduMateState,
  ExplanationDepth,
  FeedbackEvent,
  LanguageCode,
  LearningStyle,
  QuizAttempt,
  QuizSet,
  SmartNote,
} from '../types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getState: () => request<EduMateState>('/api/state'),

  updateProfile: (payload: {
    name?: string;
    program?: string;
    preferredLanguage?: LanguageCode;
    learningStyle?: LearningStyle;
    explanationDepth?: ExplanationDepth;
    dailyGoalMinutes?: number;
    voicePreferences?: Partial<{
      enabledLanguages: LanguageCode[];
      voicePersona: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
      playbackSpeed: number;
      voicePitch: 'low' | 'standard' | 'bright';
      autoSpeakAnswers: boolean;
      voiceInputAutoSend: boolean;
    }>;
  }) =>
    request<EduMateState>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  addMaterial: (payload: { title: string; subject: string; content: string }) =>
    request<{ state: EduMateState; materialId: string }>('/api/materials', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteMaterial: (id: string) =>
    request<EduMateState>(`/api/materials/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  askDoubt: (payload: { question: string; subject: string; language: LanguageCode }) =>
    request<{ message: DoubtMessage; state: EduMateState }>('/api/doubt', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  clearDoubts: () =>
    request<EduMateState>('/api/doubt', {
      method: 'DELETE',
    }),

  generateNote: (payload: {
    materialId?: string;
    topic?: string;
    subject?: string;
    customText?: string;
    language: LanguageCode;
  }) =>
    request<{ note: SmartNote; state: EduMateState }>('/api/notes/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateQuiz: (payload: {
    materialId?: string;
    topic?: string;
    subject?: string;
    customText?: string;
    questionCount: number;
    language: LanguageCode;
  }) =>
    request<{ quiz: QuizSet; state: EduMateState }>('/api/quiz/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitQuizAttempt: (quizId: string, answers: number[]) =>
    request<{ attempt: QuizAttempt; state: EduMateState }>(`/api/quiz/${encodeURIComponent(quizId)}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  generateStudyPlan: (payload: {
    goalTitle: string;
    examDate: string;
    dailyHours: number;
    subjects: string[];
    language: LanguageCode;
  }) =>
    request<EduMateState>('/api/planner/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleStudyBlock: (blockId: string, completed: boolean) =>
    request<EduMateState>(`/api/planner/block/${encodeURIComponent(blockId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  logFocusSession: (minutes: number, subject?: string) =>
    request<EduMateState>('/api/focus/log', {
      method: 'POST',
      body: JSON.stringify({ minutes, subject }),
    }),

  submitFeedback: (payload: {
    module: FeedbackEvent['module'];
    signal: FeedbackEvent['signal'];
    detail?: string;
    messageId?: string;
  }) =>
    request<EduMateState>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  transcribeAudio: (payload: { audioBase64: string; mimeType: string; language: LanguageCode }) =>
    request<{ transcript: string }>('/api/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  synthesizeSpeech: (payload: {
    text: string;
    language: LanguageCode;
    voicePersona?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
    voicePitch?: 'low' | 'standard' | 'bright';
  }) =>
    request<{ audioBase64: string; mimeType: string }>('/api/voice/speak', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
