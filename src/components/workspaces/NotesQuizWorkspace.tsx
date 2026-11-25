import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Plus,
  XCircle,
} from 'lucide-react';
import type { EduMateState, LanguageCode, QuizAttempt, QuizSet, SmartNote } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../types';
import { api } from '../../lib/api';

interface NotesQuizWorkspaceProps {
  state: EduMateState;
  preselectedMaterialId?: string;
  onStateChange: (next: EduMateState) => void;
  onAskDoubtAbout: (prompt: string) => void;
}

export const NotesQuizWorkspace: React.FC<NotesQuizWorkspaceProps> = ({
  state,
  preselectedMaterialId,
  onStateChange,
  onAskDoubtAbout,
}) => {
  const prefersReduced = useReducedMotion();
  const [subMode, setSubMode] = useState<'notes' | 'quiz'>('notes');

  // Generator form state
  const [sourceType, setSourceType] = useState<'vault' | 'custom'>('vault');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(
    preselectedMaterialId || state.materials[0]?.id || ''
  );
  const [customTopic, setCustomTopic] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('Physics');
  const [customText, setCustomText] = useState<string>('');
  const [questionCount, setQuestionCount] = useState<number>(4);
  const [language, setLanguage] = useState<LanguageCode>(state.profile.preferredLanguage);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Notes viewer state
  const [activeNoteId, setActiveNoteId] = useState<string>(state.notes[0]?.id ?? '');
  const [openAnalogyIdx, setOpenAnalogyIdx] = useState<number | null>(0);
  const [speakingNoteId, setSpeakingNoteId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Quiz runner state
  const [activeQuizId, setActiveQuizId] = useState<string>(state.quizzes[0]?.id ?? '');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedAttempt, setSubmittedAttempt] = useState<QuizAttempt | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState<boolean>(false);

  useEffect(() => {
    setLanguage(state.profile.preferredLanguage);
  }, [state.profile.preferredLanguage]);

  useEffect(() => {
    if (preselectedMaterialId) {
      setSelectedMaterialId(preselectedMaterialId);
      setSourceType('vault');
    }
  }, [preselectedMaterialId]);

  useEffect(() => {
    if (!activeNoteId && state.notes[0]) setActiveNoteId(state.notes[0].id);
    if (!activeQuizId && state.quizzes[0]) setActiveQuizId(state.quizzes[0].id);
    if (!selectedMaterialId && state.materials[0]) setSelectedMaterialId(state.materials[0].id);
  }, [state.notes, state.quizzes, state.materials, activeNoteId, activeQuizId, selectedMaterialId]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const activeNote: SmartNote | undefined =
    state.notes.find((n) => n.id === activeNoteId) ?? state.notes[0];
  const activeQuiz: QuizSet | undefined =
    state.quizzes.find((q) => q.id === activeQuizId) ?? state.quizzes[0];

  const handleGenerateNote = async () => {
    setError(null);
    setGenerating(true);
    try {
      const payload =
        sourceType === 'vault'
          ? { materialId: selectedMaterialId, language }
          : {
              topic: customTopic.trim(),
              subject: customSubject.trim() || 'General',
              customText: customText.trim(),
              language,
            };

      const res = await api.generateNote(payload);
      onStateChange(res.state);
      setActiveNoteId(res.note.id);
      setSubMode('notes');
      setOpenAnalogyIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate smart note.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateQuiz = async (overrideMaterialId?: string, overrideTopic?: string, overrideSubject?: string) => {
    setError(null);
    setGenerating(true);
    try {
      const payload = overrideMaterialId
        ? { materialId: overrideMaterialId, questionCount, language }
        : overrideTopic
          ? { topic: overrideTopic, subject: overrideSubject || 'General', questionCount, language }
          : sourceType === 'vault'
            ? { materialId: selectedMaterialId, questionCount, language }
            : {
                topic: customTopic.trim(),
                subject: customSubject.trim() || 'General',
                customText: customText.trim(),
                questionCount,
                language,
              };

      const res = await api.generateQuiz(payload);
      onStateChange(res.state);
      setActiveQuizId(res.quiz.id);
      setSelectedAnswers({});
      setSubmittedAttempt(null);
      setSubMode('quiz');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate adaptive quiz.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSpeakNote = async (note: SmartNote) => {
    if (speakingNoteId === note.id) {
      audioRef.current?.pause();
      setSpeakingNoteId(null);
      return;
    }
    setError(null);
    audioRef.current?.pause();
    setSpeakingNoteId(note.id);
    try {
      const voicePrefs = state.profile.voicePreferences;
      const speechScript = `${note.title}. ${note.summary}. Key takeaways: ${note.memoryAnchors.join('. ')}`;
      const { audioBase64 } = await api.synthesizeSpeech({
        text: speechScript,
        language: note.language || language,
        voicePersona: voicePrefs.voicePersona,
        voicePitch: voicePrefs.voicePitch,
      });
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.playbackRate = voicePrefs.playbackSpeed;
      audio.preservesPitch = true;
      audioRef.current = audio;
      audio.onended = () => setSpeakingNoteId(null);
      audio.onerror = () => setSpeakingNoteId(null);
      await audio.play();
    } catch (err) {
      setSpeakingNoteId(null);
      setError(err instanceof Error ? err.message : 'Could not play note summary.');
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz || submittingQuiz) return;
    setSubmittingQuiz(true);
    setError(null);
    try {
      const answersArray = activeQuiz.questions.map((_, idx) => selectedAnswers[idx] ?? -1);
      const res = await api.submitQuizAttempt(activeQuiz.id, answersArray);
      onStateChange(res.state);
      setSubmittedAttempt(res.attempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to score quiz.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Mode Switcher */}
      <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4E5869]">
            Smart Notes &amp; Adaptive Quiz Generator
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0E1116] tracking-tight">
            Turn Raw Syllabus Text into Active Recall
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubMode('notes')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subMode === 'notes'
                ? 'bg-white text-[#0E1116] border border-[#E2E6EE]'
                : 'text-[#4E5869] hover:text-[#0E1116]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Smart Notes ({state.notes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubMode('quiz')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subMode === 'quiz'
                ? 'bg-white text-[#0E1116] border border-[#E2E6EE]'
                : 'text-[#4E5869] hover:text-[#0E1116]'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Adaptive Quizzes ({state.quizzes.length})</span>
          </button>
        </div>
      </div>

      {/* Unified Synthesis Controls Bar */}
      <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg">
            <button
              type="button"
              onClick={() => setSourceType('vault')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sourceType === 'vault'
                  ? 'bg-white text-[#0E1116] border border-[#E2E6EE]'
                  : 'text-[#4E5869] hover:text-[#0E1116]'
              }`}
            >
              From Knowledge Vault
            </button>
            <button
              type="button"
              onClick={() => setSourceType('custom')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sourceType === 'custom'
                  ? 'bg-white text-[#0E1116] border border-[#E2E6EE]'
                  : 'text-[#4E5869] hover:text-[#0E1116]'
              }`}
            >
              Custom Topic / Paste Text
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-[#4E5869]">
              <span>Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="px-2.5 py-1.5 text-xs font-medium bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116] cursor-pointer"
              >
                {(SUPPORTED_LANGUAGES.filter((l) =>
                  state.profile.voicePreferences.enabledLanguages.includes(l.code)
                ).length > 0
                  ? SUPPORTED_LANGUAGES.filter((l) =>
                      state.profile.voicePreferences.enabledLanguages.includes(l.code)
                    )
                  : SUPPORTED_LANGUAGES
                ).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.nativeLabel})
                  </option>
                ))}
              </select>
            </label>

            {subMode === 'quiz' && (
              <label className="inline-flex items-center gap-2 text-xs text-[#4E5869]">
                <span>Questions</span>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-xs font-mono bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116] cursor-pointer"
                >
                  {[3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {sourceType === 'vault' ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              aria-label="Choose Knowledge Vault document"
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116] cursor-pointer"
            >
              {state.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.subject} — {m.title} ({m.wordCount} words)
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={generating || !selectedMaterialId}
                onClick={handleGenerateNote}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{generating && subMode === 'notes' ? 'Synthesizing...' : 'Generate Smart Note'}</span>
              </button>
              <button
                type="button"
                disabled={generating || !selectedMaterialId}
                onClick={() => handleGenerateQuiz()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>{generating && subMode === 'quiz' ? 'Building Quiz...' : 'Generate Quiz'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Topic title (e.g., Fourier Transforms)"
                className="sm:col-span-2 px-3.5 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
              />
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Subject (e.g., Physics)"
                className="px-3.5 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
              />
            </div>
            <textarea
              rows={3}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Optional: paste lecture excerpt, textbook paragraph, or syllabus bullets to ground the note or quiz..."
              className="w-full px-3.5 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={generating || (!customTopic.trim() && !customText.trim())}
                onClick={handleGenerateNote}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {generating ? 'Working...' : 'Generate Smart Note'}
              </button>
              <button
                type="button"
                disabled={generating || (!customTopic.trim() && !customText.trim())}
                onClick={() => handleGenerateQuiz()}
                className="px-4 py-2.5 text-xs font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                Generate Adaptive Quiz
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-[#CC2936]">{error}</p>
        )}
      </div>

      {/* Main Dual-View Content */}
      <AnimatePresence mode="wait">
        {subMode === 'notes' ? (
          <motion.div
            key="notes-view"
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Saved Notes Index */}
            <div className="lg:col-span-4 bg-white border border-[#E2E6EE] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E6EE] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0E1116]">Saved Study Notes</span>
                <span className="text-xs font-mono tabular-nums text-[#788296]">{state.notes.length}</span>
              </div>
              <div className="divide-y divide-[#EEF1F6]">
                {state.notes.map((note) => {
                  const selected = activeNote?.id === note.id;
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => {
                        setActiveNoteId(note.id);
                        setOpenAnalogyIdx(0);
                      }}
                      className={`w-full text-left px-5 py-4 transition-colors cursor-pointer ${
                        selected ? 'bg-[#EEF3FF]/70' : 'hover:bg-[#F7F8FA]'
                      }`}
                    >
                      <p className={`text-sm font-semibold leading-snug ${selected ? 'text-[#1D5BFF]' : 'text-[#0E1116]'}`}>
                        {note.title}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#788296]">
                        <span>{note.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>{note.language.toUpperCase()}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-[#0E1116]">{note.masteryScore}% mastery</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Note Reader */}
            <div className="lg:col-span-8 bg-white border border-[#E2E6EE] rounded-xl p-6 lg:p-8 space-y-6">
              {activeNote ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#E2E6EE]">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#4E5869] mb-1.5">
                        <span className="font-semibold text-[#1D5BFF]">{activeNote.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{activeNote.masteryScore}% mastery</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeNote.keyConcepts.length} core concepts</span>
                      </div>
                      <h2 className="font-display text-2xl font-bold text-[#0E1116] tracking-tight">
                        {activeNote.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSpeakNote(activeNote)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                          speakingNoteId === activeNote.id
                            ? 'bg-[#1D5BFF] text-white border-[#1D5BFF]'
                            : 'bg-[#F7F8FA] text-[#0E1116] border-[#E2E6EE] hover:border-[#1D5BFF]'
                        }`}
                      >
                        {speakingNoteId === activeNote.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={generating}
                        onClick={() =>
                          handleGenerateQuiz(
                            activeNote.sourceMaterialId,
                            activeNote.title,
                            activeNote.subject
                          )
                        }
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0E1116] hover:bg-[#1D5BFF] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        Quiz Me on Note
                      </button>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  <div>
                    <h3 className="text-xs font-semibold text-[#4E5869] mb-2">Core Synthesis</h3>
                    <p className="text-[15px] leading-[1.7] text-[#252C38]">{activeNote.summary}</p>
                  </div>

                  {/* Interactive Concept & Analogy Accordion */}
                  <div>
                    <h3 className="text-xs font-semibold text-[#4E5869] mb-3">
                      Key Concepts &amp; Mental Models
                    </h3>
                    <div className="border border-[#E2E6EE] rounded-lg divide-y divide-[#E2E6EE]">
                      {activeNote.keyConcepts.map((c, idx) => {
                        const open = openAnalogyIdx === idx;
                        return (
                          <div key={c.term} className="p-4">
                            <button
                              type="button"
                              onClick={() => setOpenAnalogyIdx(open ? null : idx)}
                              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                            >
                              <span className="font-display text-base font-bold text-[#0E1116]">
                                {c.term}
                              </span>
                              {open ? (
                                <ChevronUp className="w-4 h-4 text-[#4E5869] shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-[#4E5869] shrink-0" />
                              )}
                            </button>
                            <p className="mt-1.5 text-sm text-[#4E5869] leading-relaxed">
                              {c.definition}
                            </p>
                            {open && (
                              <motion.div
                                initial={prefersReduced ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 pt-3 border-t border-[#EEF1F6] text-sm text-[#1545CC]"
                              >
                                <span className="font-semibold">Intuitive Analogy: </span>
                                {c.analogy}
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Formulas & Core Rules */}
                  {activeNote.formulasOrRules.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-[#4E5869] mb-2.5">
                        Formulas &amp; Governing Rules
                      </h3>
                      <div className="bg-[#0E1116] text-[#F4F6FA] rounded-lg p-4 space-y-2 font-mono text-xs leading-relaxed">
                        {activeNote.formulasOrRules.map((f, idx) => (
                          <div key={idx} className="flex items-start gap-2.5">
                            <span className="text-[#788296] tabular-nums">0{idx + 1}.</span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Memory Anchors & Pitfalls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div>
                      <h3 className="text-xs font-semibold text-[#138A57] mb-2">Memory Anchors</h3>
                      <ul className="space-y-2 text-sm text-[#252C38] leading-relaxed list-disc pl-4">
                        {activeNote.memoryAnchors.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-[#CC2936] mb-2">Common Exam Pitfalls</h3>
                      <ul className="space-y-2 text-sm text-[#252C38] leading-relaxed list-disc pl-4">
                        {activeNote.commonPitfalls.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#4E5869]">Select or generate a smart note to view it here.</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="quiz-view"
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Saved Quizzes List */}
            <div className="lg:col-span-4 bg-white border border-[#E2E6EE] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E6EE] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0E1116]">Adaptive Quiz Sets</span>
                <span className="text-xs font-mono tabular-nums text-[#788296]">{state.quizzes.length}</span>
              </div>
              <div className="divide-y divide-[#EEF1F6]">
                {state.quizzes.map((qz) => {
                  const selected = activeQuiz?.id === qz.id;
                  const lastAttempt = qz.attempts[0];
                  return (
                    <button
                      key={qz.id}
                      type="button"
                      onClick={() => {
                        setActiveQuizId(qz.id);
                        setSelectedAnswers({});
                        setSubmittedAttempt(null);
                      }}
                      className={`w-full text-left px-5 py-4 transition-colors cursor-pointer ${
                        selected ? 'bg-[#EEF3FF]/70' : 'hover:bg-[#F7F8FA]'
                      }`}
                    >
                      <p className={`text-sm font-semibold leading-snug ${selected ? 'text-[#1D5BFF]' : 'text-[#0E1116]'}`}>
                        {qz.title}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#788296]">
                        <span>{qz.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{qz.questions.length} Qs</span>
                        {lastAttempt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-[#0E1116]">
                              Last: {lastAttempt.score}/{lastAttempt.total}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Quiz Runner */}
            <div className="lg:col-span-8 bg-white border border-[#E2E6EE] rounded-xl p-6 lg:p-8 space-y-6">
              {activeQuiz ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4 border-b border-[#E2E6EE]">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#4E5869] mb-1">
                        <span className="font-semibold text-[#1D5BFF]">{activeQuiz.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{activeQuiz.questions.length} questions</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeQuiz.language.toUpperCase()}</span>
                      </div>
                      <h2 className="font-display text-2xl font-bold text-[#0E1116] tracking-tight">
                        {activeQuiz.title}
                      </h2>
                    </div>

                    {submittedAttempt && (
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-2xl font-bold text-[#1D5BFF]">
                          {submittedAttempt.score}/{submittedAttempt.total}
                        </div>
                        <div className="text-xs text-[#4E5869]">
                          {Math.round((submittedAttempt.score / submittedAttempt.total) * 100)}% accuracy
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Score Summary & Feedback Loop Result */}
                  {submittedAttempt && (
                    <div className="p-4 rounded-lg bg-[#F7F8FA] border border-[#E2E6EE] space-y-2.5">
                      <p className="text-sm font-semibold text-[#0E1116]">
                        {submittedAttempt.weakConcepts.length === 0
                          ? 'Clean sweep — all tested concepts recorded as mastered.'
                          : 'Feedback Loop Updated: missed concepts added to your priority revision queue.'}
                      </p>
                      {submittedAttempt.weakConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {submittedAttempt.weakConcepts.map((wc) => (
                            <button
                              key={wc}
                              type="button"
                              onClick={() =>
                                onAskDoubtAbout(
                                  `I missed a quiz question on "${wc}" in ${activeQuiz.subject}. Explain it clearly with a fresh example.`
                                )
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-[#1D5BFF] bg-white border border-[#D4E0FF] hover:bg-[#EEF3FF] rounded-md transition-colors cursor-pointer"
                            >
                              Ask Tutor About: {wc}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Questions */}
                  <div className="space-y-6">
                    {activeQuiz.questions.map((q, qIdx) => {
                      const picked = selectedAnswers[qIdx];
                      const revealed = submittedAttempt !== null;
                      return (
                        <div key={q.id} className="pb-6 border-b border-[#EEF1F6] last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2 text-xs text-[#788296] mb-1.5 font-mono">
                            <span>Question 0{qIdx + 1} · {q.conceptTag}</span>
                            <span className="capitalize">{q.difficulty}</span>
                          </div>
                          <p className="text-[15px] font-semibold text-[#0E1116] leading-snug mb-3">
                            {q.question}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {q.options.map((opt, optIdx) => {
                              const isPicked = picked === optIdx;
                              const isCorrect = optIdx === q.correctIndex;

                              let stateClasses = 'bg-[#FAFBFD] border-[#E2E6EE] text-[#252C38] hover:border-[#1D5BFF]';
                              if (revealed) {
                                if (isCorrect) {
                                  stateClasses = 'bg-[#EDF9F2] border-[#138A57] text-[#0E1116] font-medium';
                                } else if (isPicked && !isCorrect) {
                                  stateClasses = 'bg-[#FDF2F3] border-[#CC2936] text-[#CC2936]';
                                } else {
                                  stateClasses = 'bg-white border-[#EEF1F6] text-[#788296]';
                                }
                              } else if (isPicked) {
                                stateClasses = 'bg-[#EEF3FF] border-[#1D5BFF] text-[#1545CC] font-medium';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  disabled={revealed}
                                  onClick={() =>
                                    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))
                                  }
                                  className={`p-3 rounded-lg border text-left text-sm transition-colors flex items-start gap-2.5 cursor-pointer disabled:cursor-default ${stateClasses}`}
                                >
                                  <span className="font-mono text-xs mt-0.5 shrink-0">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  <span className="flex-1 leading-snug">{opt}</span>
                                  {revealed && isCorrect && (
                                    <CheckCircle2 className="w-4 h-4 text-[#138A57] shrink-0 mt-0.5" />
                                  )}
                                  {revealed && isPicked && !isCorrect && (
                                    <XCircle className="w-4 h-4 text-[#CC2936] shrink-0 mt-0.5" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {revealed && (
                            <p className="mt-3 text-xs text-[#4E5869] leading-relaxed bg-[#F7F8FA] p-3 rounded-lg border border-[#E2E6EE]">
                              <strong className="text-[#0E1116]">Explanation: </strong>
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit / Retake Bar */}
                  <div className="pt-4 border-t border-[#E2E6EE] flex items-center justify-between gap-4">
                    <span className="text-xs font-mono tabular-nums text-[#4E5869]">
                      {Object.keys(selectedAnswers).length}/{activeQuiz.questions.length} answered
                    </span>

                    {submittedAttempt ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAnswers({});
                          setSubmittedAttempt(null);
                        }}
                        className="px-5 py-2.5 text-xs font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] border border-[#E2E6EE] rounded-lg transition-colors cursor-pointer"
                      >
                        Retake Quiz
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          submittingQuiz ||
                          Object.keys(selectedAnswers).length < activeQuiz.questions.length
                        }
                        onClick={handleSubmitQuiz}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {submittingQuiz ? 'Scoring...' : 'Submit & Update Mastery'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#4E5869]">Generate or select a quiz set to begin practicing.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
