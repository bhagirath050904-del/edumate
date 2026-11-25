import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Mic,
  Square,
  Send,
  Volume2,
  VolumeX,
  ThumbsUp,
  RotateCcw,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  DoubtMessage,
  EduMateState,
  FeedbackEvent,
  LanguageCode,
  LearningStyle,
} from '../../types';
import { SUPPORTED_LANGUAGES } from '../../types';
import { api } from '../../lib/api';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { LearningLoopMotion } from '../visualizations/LearningLoopMotion';
import { VoiceWaveformMotion } from '../visualizations/VoiceWaveformMotion';
import { VoiceSettingsPanel } from '../VoiceSettingsPanel';

interface DoubtSolverWorkspaceProps {
  state: EduMateState;
  initialPrompt?: string;
  onConsumeInitialPrompt?: () => void;
  onStateChange: (next: EduMateState) => void;
}

const QUICK_PROMPTS = [
  'Explain why adiabatic compression raises an ideal gas temperature using my Physics notes.',
  'How does the Spectral Theorem connect symmetric matrices to PCA?',
  'Explain all four Coffman conditions for deadlock with a quick memory trick.',
  'Compare ATP yield across glycolysis, Krebs cycle, and oxidative phosphorylation.',
];

const LEARNING_STYLE_LABELS: Record<LearningStyle, string> = {
  visual_analogies: 'Analogies',
  step_by_step: 'Step-by-Step',
  concise_exam: 'Exam Concise',
  socratic: 'Socratic',
};

export const DoubtSolverWorkspace: React.FC<DoubtSolverWorkspaceProps> = ({
  state,
  initialPrompt,
  onConsumeInitialPrompt,
  onStateChange,
}) => {
  const prefersReduced = useReducedMotion();
  const [question, setQuestion] = useState<string>('');
  const [subject, setSubject] = useState<string>('All Subjects');
  const [language, setLanguage] = useState<LanguageCode>(state.profile.preferredLanguage);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [pipelineStage, setPipelineStage] = useState<0 | 1 | 2 | 3 | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Voice recording + real FFT level visualization
  const [voiceMode, setVoiceMode] = useState<'idle' | 'recording' | 'transcribing' | 'speaking'>('idle');
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(24).fill(0.15));
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState<boolean>(false);

  const voicePrefs = state.profile.voicePreferences;
  const availableLanguages = SUPPORTED_LANGUAGES.filter((l) =>
    voicePrefs.enabledLanguages.includes(l.code)
  );
  const languageOptions = availableLanguages.length > 0 ? availableLanguages : SUPPORTED_LANGUAGES;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLanguage(state.profile.preferredLanguage);
  }, [state.profile.preferredLanguage]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setQuestion(initialPrompt);
      onConsumeInitialPrompt?.();
    }
  }, [initialPrompt, onConsumeInitialPrompt]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => undefined);
      playbackAudioRef.current?.pause();
    };
  }, []);

  const subjectOptions = [
    'All Subjects',
    ...Array.from(new Set(state.materials.map((m) => m.subject))),
  ];

  const latestAssistant = [...state.doubts].reverse().find((d) => d.role === 'assistant');

  const handleLanguageChange = async (nextLang: LanguageCode) => {
    setLanguage(nextLang);
    try {
      const updated = await api.updateProfile({ preferredLanguage: nextLang });
      onStateChange(updated);
    } catch {
      // Keep local selection even if background sync fails
    }
  };

  const handleStyleChange = async (nextStyle: LearningStyle) => {
    try {
      const updated = await api.updateProfile({ learningStyle: nextStyle });
      onStateChange(updated);
      setFeedbackToast(`Tutor style switched to ${LEARNING_STYLE_LABELS[nextStyle]}`);
      window.setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update style.');
    }
  };

  const handleAsk = async (promptOverride?: string) => {
    const text = (promptOverride ?? question).trim();
    if (!text || submitting) return;

    setError(null);
    setSubmitting(true);
    setPipelineStage(0);

    const t1 = window.setTimeout(() => setPipelineStage(1), 280);
    const t2 = window.setTimeout(() => setPipelineStage(2), 950);

    try {
      const res = await api.askDoubt({
        question: text,
        subject,
        language,
      });
      setPipelineStage(3);
      onStateChange(res.state);
      setQuestion('');
      window.setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 120);
      if (res.state.profile.voicePreferences.autoSpeakAnswers && res.message) {
        void handleSpeakMessage(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach EduMate AI engine.');
    } finally {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setSubmitting(false);
      window.setTimeout(() => setPipelineStage(null), 1100);
    }
  };

  const startVoiceRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup Web Audio API analyser for real-time harmonic motion bars
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextCtor();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(freqData);
        const bars = Array.from({ length: 24 }, (_, i) => {
          const val = freqData[i % freqData.length] ?? 0;
          return Math.min(1, val / 190);
        });
        setAudioLevels(bars);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => undefined);

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 200) {
          setVoiceMode('idle');
          return;
        }

        setVoiceMode('transcribing');
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = typeof reader.result === 'string' ? reader.result : '';
              const comma = result.indexOf(',');
              resolve(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
            reader.readAsDataURL(blob);
          });

          const { transcript } = await api.transcribeAudio({
            audioBase64: base64,
            mimeType: blob.type || 'audio/webm',
            language,
          });
          if (transcript) {
            if (state.profile.voicePreferences.voiceInputAutoSend) {
              setQuestion(transcript);
              void handleAsk(transcript);
            } else {
              setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript));
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Voice transcription failed.');
        } finally {
          setVoiceMode('idle');
          setAudioLevels(Array(24).fill(0.15));
        }
      };

      recorder.start();
      setVoiceMode('recording');
    } catch {
      setError('Microphone permission was denied. Please allow microphone access to use voice input.');
      setVoiceMode('idle');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSpeakMessage = async (msg: DoubtMessage) => {
    if (speakingMessageId === msg.id) {
      playbackAudioRef.current?.pause();
      setSpeakingMessageId(null);
      setVoiceMode('idle');
      return;
    }

    setError(null);
    playbackAudioRef.current?.pause();
    setSpeakingMessageId(msg.id);
    setVoiceMode('speaking');

    try {
      const { audioBase64 } = await api.synthesizeSpeech({
        text: msg.content,
        language: msg.language || language,
        voicePersona: voicePrefs.voicePersona,
        voicePitch: voicePrefs.voicePitch,
      });
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.playbackRate = voicePrefs.playbackSpeed;
      audio.preservesPitch = true;
      playbackAudioRef.current = audio;
      audio.onended = () => {
        setSpeakingMessageId(null);
        setVoiceMode('idle');
      };
      audio.onerror = () => {
        setSpeakingMessageId(null);
        setVoiceMode('idle');
      };
      await audio.play();
    } catch (err) {
      setSpeakingMessageId(null);
      setVoiceMode('idle');
      setError(err instanceof Error ? err.message : 'Could not synthesize spoken explanation.');
    }
  };

  const handleFeedback = async (messageId: string, signal: FeedbackEvent['signal']) => {
    try {
      const updated = await api.submitFeedback({
        module: 'doubt',
        signal,
        messageId,
      });
      onStateChange(updated);
      const adaptationNote: Record<FeedbackEvent['signal'], string> = {
        helpful: 'Saved. EduMate will keep this explanation style.',
        needs_simpler: 'Calibrated: next explanations will use foundational analogies.',
        needs_deeper: 'Calibrated: next explanations will increase mathematical rigor.',
        more_examples: 'Calibrated: next explanations will include more worked examples.',
      };
      setFeedbackToast(adaptationNote[signal]);
      window.setTimeout(() => setFeedbackToast(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record feedback.');
    }
  };

  const handleClear = async () => {
    try {
      const updated = await api.clearDoubts();
      onStateChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear thread.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header & Contextual Controls Toolbar */}
      <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4E5869]">
            RAG Doubt Solver · Voice &amp; Multilingual Tutor
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0E1116] tracking-tight">
            Ask Anything — Grounded in Your Study Vault
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Subject Filter */}
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Filter RAG retrieval by subject"
            className="px-3 py-2 text-xs font-medium bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116] cursor-pointer"
          >
            {subjectOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* Multilingual Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
            aria-label="Tutor response and voice language"
            className="px-3 py-2 text-xs font-medium bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116] cursor-pointer"
          >
            {languageOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label} ({lang.nativeLabel})
              </option>
            ))}
          </select>

          {/* Voice Assistant Settings Trigger */}
          <button
            type="button"
            onClick={() => setVoiceSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>
              Voice Settings ({voicePrefs.playbackSpeed.toFixed(2)}x · {voicePrefs.voicePitch})
            </span>
          </button>

          {/* Learning Style Segmented Control */}
          <div className="hidden sm:flex items-center gap-1 p-1 bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg">
            {(Object.keys(LEARNING_STYLE_LABELS) as LearningStyle[]).map((styleKey) => (
              <button
                key={styleKey}
                type="button"
                onClick={() => handleStyleChange(styleKey)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  state.profile.learningStyle === styleKey
                    ? 'bg-white text-[#0E1116] border border-[#E2E6EE]'
                    : 'text-[#4E5869] hover:text-[#0E1116]'
                }`}
              >
                {LEARNING_STYLE_LABELS[styleKey]}
              </button>
            ))}
          </div>

          {state.doubts.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#4E5869] hover:text-[#0E1116] bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Thread</span>
            </button>
          )}
        </div>
      </div>

      {/* Live RAG Motion Pipeline Visualizer */}
      <LearningLoopMotion
        state={state}
        activeStage={pipelineStage}
        liveSources={latestAssistant?.retrievedSources ?? []}
        compact
      />

      {feedbackToast && (
        <div className="px-4 py-2.5 rounded-lg bg-[#EEF3FF] border border-[#1D5BFF]/25 text-xs font-medium text-[#1545CC] flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-[#FDF2F3] border border-[#CC2936]/30 text-xs font-medium text-[#CC2936]">
          {error}
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="bg-white border border-[#E2E6EE] rounded-xl flex flex-col">
        <div className="p-5 lg:p-6 space-y-6 max-h-[620px] overflow-y-auto">
          {state.doubts.length === 0 ? (
            <div className="py-10 text-center max-w-xl mx-auto space-y-4">
              <h2 className="font-display text-xl font-bold text-[#0E1116]">
                Start a Guided Doubt-Solving Session
              </h2>
              <p className="text-sm text-[#4E5869] leading-relaxed">
                Type or speak your question in any of 9 languages. EduMate searches your Knowledge
                Vault with vector embeddings first, then tailors the explanation to your learning
                profile.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-left">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleAsk(q)}
                    className="p-3 rounded-lg bg-[#F7F8FA] hover:bg-[#EEF3FF] border border-[#E2E6EE] hover:border-[#1D5BFF]/40 text-xs text-[#252C38] leading-relaxed transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            state.doubts.map((msg) => {
              const isStudent = msg.role === 'student';
              return (
                <motion.div
                  key={msg.id}
                  initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={isStudent ? 'flex justify-end' : 'flex justify-start'}
                >
                  {isStudent ? (
                    <div className="max-w-2xl bg-[#0E1116] text-white rounded-xl px-5 py-3.5">
                      <div className="flex items-center gap-2 text-[11px] text-white/65 mb-1 font-mono">
                        <span>{state.profile.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{msg.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>{msg.language.toUpperCase()}</span>
                      </div>
                      <p className="text-[15px] leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="w-full max-w-4xl border border-[#E2E6EE] rounded-xl p-5 lg:p-6 bg-[#FAFBFD]">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#E2E6EE]">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#4E5869]">
                          <span className="font-display font-bold text-[#0E1116]">EduMate Tutor</span>
                          <span aria-hidden="true">·</span>
                          <span>{msg.subject}</span>
                          {msg.pipelineMetrics && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-[#788296]">
                                {msg.pipelineMetrics.chunksSearched} passages searched ·{' '}
                                {Math.round(msg.pipelineMetrics.topSimilarity * 100)}% top match
                              </span>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSpeakMessage(msg)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                            speakingMessageId === msg.id
                              ? 'bg-[#1D5BFF] text-white border-[#1D5BFF]'
                              : 'bg-white text-[#0E1116] border-[#E2E6EE] hover:border-[#1D5BFF] hover:text-[#1D5BFF]'
                          }`}
                        >
                          {speakingMessageId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>Stop Audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>

                      <MarkdownRenderer content={msg.content} />

                      {/* Cited RAG Sources */}
                      {msg.retrievedSources && msg.retrievedSources.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-[#E2E6EE]">
                          <p className="text-xs font-medium text-[#4E5869] mb-2 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-[#1D5BFF]" />
                            <span>Grounded in Knowledge Vault</span>
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#4E5869]">
                            {msg.retrievedSources.map((src, i) => (
                              <span key={`${src.materialId}-${i}`}>
                                <strong className="font-medium text-[#0E1116]">{src.materialTitle}</strong>{' '}
                                <span className="font-mono tabular-nums text-[#1D5BFF]">
                                  ({Math.round(src.score * 100)}%)
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Closed-Loop Feedback Calibration Bar */}
                      <div className="mt-4 pt-4 border-t border-[#E2E6EE] flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-[#788296]">
                          {msg.feedback
                            ? `Feedback recorded: ${msg.feedback.rating.replace(/_/g, ' ')}`
                            : 'Calibrate next explanation:'}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(
                            [
                              { key: 'helpful', label: 'Helpful' },
                              { key: 'needs_simpler', label: 'Simpler analogy' },
                              { key: 'needs_deeper', label: 'Deeper rigor' },
                              { key: 'more_examples', label: 'More examples' },
                            ] as const
                          ).map((fb) => {
                            const active = msg.feedback?.rating === fb.key;
                            return (
                              <button
                                key={fb.key}
                                type="button"
                                onClick={() => handleFeedback(msg.id, fb.key)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                                  active
                                    ? 'bg-[#EEF3FF] text-[#1D5BFF] border-[#1D5BFF]/40'
                                    : 'bg-white text-[#4E5869] border-[#E2E6EE] hover:text-[#0E1116] hover:border-[#CBD4E3]'
                                }`}
                              >
                                {fb.key === 'helpful' && <ThumbsUp className="w-3 h-3" />}
                                <span>{fb.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Follow-up Prompts */}
                      {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {msg.followUpSuggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => handleAsk(sug)}
                              disabled={submitting}
                              className="px-3 py-1.5 text-xs font-medium text-[#1545CC] bg-white hover:bg-[#EEF3FF] border border-[#D4E0FF] rounded-lg transition-colors text-left cursor-pointer disabled:opacity-50"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}

          {submitting && (
            <div className="border border-[#E2E6EE] rounded-xl p-5 bg-[#FAFBFD] max-w-2xl">
              <p className="text-xs font-mono text-[#1D5BFF] mb-2">
                {pipelineStage === 0
                  ? 'Encoding student query...'
                  : pipelineStage === 1
                    ? 'Retrieving matching passages from Knowledge Vault...'
                    : 'Synthesizing personalised explanation...'}
              </p>
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-[#E2E6EE] rounded w-3/4" />
                <div className="h-3 bg-[#E2E6EE] rounded w-full" />
                <div className="h-3 bg-[#E2E6EE] rounded w-5/6" />
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* Input & Voice Composer Bar */}
        <div className="p-4 lg:p-5 border-t border-[#E2E6EE] bg-[#FAFBFD] rounded-b-xl space-y-3">
          {voiceMode !== 'idle' && (
            <VoiceWaveformMotion mode={voiceMode} levels={audioLevels} />
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5"
          >
            <div className="flex-1">
              <label htmlFor="doubt-input" className="sr-only">
                Ask your study question
              </label>
              <textarea
                id="doubt-input"
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder={`Ask a conceptual question, paste a problem, or tap Voice to speak in ${
                  SUPPORTED_LANGUAGES.find((l) => l.code === language)?.label ?? 'English'
                }...`}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DBE7] focus:border-[#1D5BFF] rounded-lg resize-none text-[#0E1116] placeholder:text-[#788296]"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={voiceMode === 'recording' ? stopVoiceRecording : startVoiceRecording}
                disabled={voiceMode === 'transcribing' || submitting}
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                  voiceMode === 'recording'
                    ? 'bg-[#CC2936] text-white border-[#CC2936]'
                    : 'bg-white text-[#0E1116] border-[#D4DBE7] hover:border-[#1D5BFF] hover:text-[#1D5BFF]'
                }`}
              >
                {voiceMode === 'recording' ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>{voiceMode === 'transcribing' ? 'Transcribing...' : 'Voice'}</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={!question.trim() || submitting}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Solving...' : 'Ask EduMate'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Multilingual Voice Settings Slide-Over Panel */}
      {voiceSettingsOpen && (
        <VoiceSettingsPanel
          state={state}
          onStateChange={onStateChange}
          variant="drawer"
          onClose={() => setVoiceSettingsOpen(false)}
        />
      )}
    </div>
  );
};
