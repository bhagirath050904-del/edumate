import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Volume2, VolumeX, X, RotateCcw } from 'lucide-react';
import type {
  EduMateState,
  LanguageCode,
  VoicePersona,
  VoicePitch,
  VoicePreferences,
} from '../types';
import { SUPPORTED_LANGUAGES, VOICE_PERSONAS } from '../types';
import { api } from '../lib/api';
import { VoiceWaveformMotion } from './visualizations/VoiceWaveformMotion';

interface VoiceSettingsPanelProps {
  state: EduMateState;
  onStateChange: (next: EduMateState) => void;
  variant: 'drawer' | 'embedded';
  onClose?: () => void;
}

const SPEED_PRESETS = [0.85, 1.0, 1.25, 1.5];

const PITCH_OPTIONS: Array<{ id: VoicePitch; label: string; detail: string; frequency: number }> = [
  { id: 'low', label: 'Low', detail: 'Calm, deeper vocal register', frequency: 1.5 },
  { id: 'standard', label: 'Standard', detail: 'Natural balanced pitch', frequency: 2.4 },
  { id: 'bright', label: 'Bright', detail: 'Crisp, higher register', frequency: 3.5 },
];

const SAMPLE_PHRASES: Record<LanguageCode, string> = {
  en: 'Hello! EduMate is calibrated to your voice pace and pitch. Ready to solve your next study doubt.',
  hi: 'नमस्ते! एडुमेट आपकी चुनी हुई गति और स्वर के अनुसार तैयार है। आइए आपका अगला प्रश्न हल करें।',
  es: 'Hola. EduMate está calibrado con tu velocidad y tono preferidos. Listo para resolver tu siguiente duda.',
  fr: 'Bonjour. EduMate est calibré selon votre vitesse et votre tonalité. Prêt à résoudre votre prochaine question.',
  de: 'Hallo. EduMate ist auf dein Tempo und deine Stimmlage abgestimmt. Bereit für deine nächste Lernfrage.',
  ta: 'வணக்கம்! உங்கள் வேகம் மற்றும் குரல் சுருதிக்கு ஏற்ப எடுமேட் தயாராக உள்ளது.',
  te: 'నమస్కారం! మీ వేగం మరియు స్వరానికి అనుగుణంగా ఎడుమేట్ సిద్ధంగా ఉంది.',
  ja: 'こんにちは。EduMateは設定された速度と声の高さに合わせて調整されました。次の質問をどうぞ。',
  zh: '你好！EduMate 已按你设置的语速和音调完成校准，随时为你解答下一个学习疑问。',
};

export const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
  state,
  onStateChange,
  variant,
  onClose,
}) => {
  const prefersReduced = useReducedMotion();
  const savedPrefs = state.profile.voicePreferences;

  const [enabledLanguages, setEnabledLanguages] = useState<LanguageCode[]>(
    savedPrefs.enabledLanguages
  );
  const [defaultLanguage, setDefaultLanguage] = useState<LanguageCode>(
    state.profile.preferredLanguage
  );
  const [voicePersona, setVoicePersona] = useState<VoicePersona>(savedPrefs.voicePersona);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(savedPrefs.playbackSpeed);
  const [voicePitch, setVoicePitch] = useState<VoicePitch>(savedPrefs.voicePitch);
  const [autoSpeakAnswers, setAutoSpeakAnswers] = useState<boolean>(savedPrefs.autoSpeakAnswers);
  const [voiceInputAutoSend, setVoiceInputAutoSend] = useState<boolean>(
    savedPrefs.voiceInputAutoSend
  );

  const [saving, setSaving] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setEnabledLanguages(state.profile.voicePreferences.enabledLanguages);
    setDefaultLanguage(state.profile.preferredLanguage);
    setVoicePersona(state.profile.voicePreferences.voicePersona);
    setPlaybackSpeed(state.profile.voicePreferences.playbackSpeed);
    setVoicePitch(state.profile.voicePreferences.voicePitch);
    setAutoSpeakAnswers(state.profile.voicePreferences.autoSpeakAnswers);
    setVoiceInputAutoSend(state.profile.voicePreferences.voiceInputAutoSend);
  }, [state.profile.preferredLanguage, state.profile.voicePreferences]);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
    };
  }, []);

  // Live harmonic curve reflecting chosen pitch (frequency) & playback speed (phase density)
  const acousticCurvePath = useMemo(() => {
    const pitchOpt = PITCH_OPTIONS.find((p) => p.id === voicePitch) ?? PITCH_OPTIONS[1];
    const freq = pitchOpt.frequency * (0.75 + playbackSpeed * 0.25);
    const width = 420;
    const midY = 28;
    const amp = voicePitch === 'low' ? 18 : voicePitch === 'bright' ? 13 : 15.5;
    const pts: string[] = [];
    for (let x = 0; x <= width; x += 6) {
      const t = x / width;
      const envelope = Math.sin(t * Math.PI);
      const y = midY + Math.sin(t * Math.PI * 2 * freq) * amp * envelope;
      pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [voicePitch, playbackSpeed]);

  const toggleLanguage = (code: LanguageCode) => {
    setSavedNotice(null);
    setEnabledLanguages((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev; // Keep at least one active language
        const next = prev.filter((c) => c !== code);
        if (defaultLanguage === code) {
          setDefaultLanguage(next[0]);
        }
        return next;
      }
      return [...prev, code];
    });
  };

  const handleSetDefaultLanguage = (code: LanguageCode) => {
    setSavedNotice(null);
    setDefaultLanguage(code);
    if (!enabledLanguages.includes(code)) {
      setEnabledLanguages((prev) => [...prev, code]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const payload: Partial<VoicePreferences> = {
        enabledLanguages,
        voicePersona,
        playbackSpeed,
        voicePitch,
        autoSpeakAnswers,
        voiceInputAutoSend,
      };
      const updated = await api.updateProfile({
        preferredLanguage: defaultLanguage,
        voicePreferences: payload,
      });
      onStateChange(updated);
      setSavedNotice('Voice assistant preferences saved.');
      window.setTimeout(() => setSavedNotice(null), 3200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save voice preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setEnabledLanguages(['en', 'hi', 'es', 'fr', 'ta']);
    setDefaultLanguage('en');
    setVoicePersona('Kore');
    setPlaybackSpeed(1.0);
    setVoicePitch('standard');
    setAutoSpeakAnswers(false);
    setVoiceInputAutoSend(false);
    setSavedNotice(null);
  };

  const handlePreviewVoice = async () => {
    if (previewing) {
      previewAudioRef.current?.pause();
      setPreviewing(false);
      return;
    }
    setError(null);
    setPreviewing(true);
    try {
      const sampleText = SAMPLE_PHRASES[defaultLanguage] ?? SAMPLE_PHRASES.en;
      const { audioBase64 } = await api.synthesizeSpeech({
        text: sampleText,
        language: defaultLanguage,
        voicePersona,
        voicePitch,
      });
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.playbackRate = playbackSpeed;
      audio.preservesPitch = true;
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewing(false);
      audio.onerror = () => setPreviewing(false);
      await audio.play();
    } catch (err) {
      setPreviewing(false);
      setError(err instanceof Error ? err.message : 'Could not synthesize voice preview.');
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E2E6EE]">
        <div>
          <p className="text-xs font-medium text-[#4E5869] mb-0.5">
            Multilingual Voice Assistant Preferences
          </p>
          <h2 className="font-display text-xl font-bold text-[#0E1116] tracking-tight">
            Languages, Playback Speed &amp; Vocal Pitch
          </h2>
        </div>
        {variant === 'drawer' && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice settings panel"
            className="p-2 text-[#4E5869] hover:text-[#0E1116] bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Live Acoustic Profile Motion Preview */}
      <div className="p-4 rounded-xl bg-[#FAFBFD] border border-[#E2E6EE] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-[#0E1116]">
            Acoustic Profile ·{' '}
            <span className="font-mono tabular-nums text-[#1D5BFF]">
              {voicePersona} · {playbackSpeed.toFixed(2)}x · {voicePitch} pitch
            </span>
          </span>
          <span className="font-mono text-[#788296]">
            {SUPPORTED_LANGUAGES.find((l) => l.code === defaultLanguage)?.label}
          </span>
        </div>

        {previewing ? (
          <VoiceWaveformMotion
            mode="speaking"
            label={`Playing ${voicePersona} (${playbackSpeed.toFixed(2)}x · ${voicePitch} pitch)`}
          />
        ) : (
          <svg
            viewBox="0 0 420 56"
            className="w-full h-14 block"
            role="img"
            aria-label={`Acoustic pitch and speed curve: ${voicePitch} pitch at ${playbackSpeed}x speed`}
          >
            <line x1="0" y1="28" x2="420" y2="28" stroke="#E2E6EE" strokeWidth="1" />
            <motion.path
              key={`${voicePitch}-${playbackSpeed.toFixed(2)}`}
              d={acousticCurvePath}
              fill="none"
              stroke="#1D5BFF"
              strokeWidth="2.25"
              strokeLinecap="round"
              initial={prefersReduced ? false : { pathLength: 0.2, opacity: 0.5 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-xs text-[#4E5869]">
            Test your exact language, persona, pitch, and playback speed live.
          </span>
          <button
            type="button"
            onClick={handlePreviewVoice}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              previewing
                ? 'bg-[#1D5BFF] text-white border-[#1D5BFF]'
                : 'bg-white text-[#0E1116] border-[#E2E6EE] hover:border-[#1D5BFF] hover:text-[#1D5BFF]'
            }`}
          >
            {previewing ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Stop Preview</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Preview Voice Sample</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section 1: Active Multilingual Languages */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#0E1116]">
              Active Voice &amp; Tutor Languages
            </h3>
            <p className="text-xs text-[#4E5869]">
              Select which languages appear in your quick switcher, and choose your primary default.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#788296]">
            {enabledLanguages.length}/{SUPPORTED_LANGUAGES.length} enabled
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isEnabled = enabledLanguages.includes(lang.code);
            const isDefault = defaultLanguage === lang.code;

            return (
              <div
                key={lang.code}
                className={`p-3 rounded-lg border transition-colors flex flex-col justify-between gap-2 ${
                  isDefault
                    ? 'bg-[#EEF3FF]/80 border-[#1D5BFF]'
                    : isEnabled
                      ? 'bg-white border-[#CBD4E3]'
                      : 'bg-[#F7F8FA] border-[#E2E6EE] opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
                    className="flex items-center gap-2 text-left cursor-pointer min-w-0"
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isEnabled
                          ? 'bg-[#1D5BFF] border-[#1D5BFF] text-white'
                          : 'bg-white border-[#CBD4E3]'
                      }`}
                    >
                      {isEnabled && <Check className="w-3 h-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-[#0E1116] truncate">
                        {lang.label}
                      </span>
                      <span className="block text-[11px] text-[#4E5869] truncate">
                        {lang.nativeLabel}
                      </span>
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSetDefaultLanguage(lang.code)}
                  className={`text-[11px] font-medium text-left transition-colors cursor-pointer ${
                    isDefault ? 'text-[#1D5BFF] font-semibold' : 'text-[#788296] hover:text-[#0E1116]'
                  }`}
                >
                  {isDefault ? 'Primary default' : 'Set as default'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Playback Speed & Voice Pitch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E2E6EE]">
        {/* Playback Speed */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <label htmlFor="voice-speed-slider" className="text-sm font-semibold text-[#0E1116]">
              Playback Speed
            </label>
            <span className="font-mono tabular-nums text-sm font-semibold text-[#1D5BFF]">
              {playbackSpeed.toFixed(2)}x
            </span>
          </div>
          <input
            id="voice-speed-slider"
            type="range"
            min={0.75}
            max={1.75}
            step={0.05}
            value={playbackSpeed}
            onChange={(e) => {
              setPlaybackSpeed(Number(e.target.value));
              setSavedNotice(null);
            }}
            className="w-full accent-[#1D5BFF] cursor-pointer"
          />
          <div className="flex items-center justify-between gap-1.5">
            {SPEED_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setPlaybackSpeed(preset);
                  setSavedNotice(null);
                }}
                className={`flex-1 py-1.5 text-xs font-mono tabular-nums rounded-md border transition-colors cursor-pointer ${
                  Math.abs(playbackSpeed - preset) < 0.01
                    ? 'bg-[#EEF3FF] text-[#1D5BFF] border-[#1D5BFF]/40 font-semibold'
                    : 'bg-[#F7F8FA] text-[#4E5869] border-[#E2E6EE] hover:text-[#0E1116]'
                }`}
              >
                {preset}x
              </button>
            ))}
          </div>
        </div>

        {/* Voice Pitch Toggle */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-[#0E1116]">Voice Pitch</span>
            <span className="text-xs text-[#4E5869] capitalize">{voicePitch} register</span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg">
            {PITCH_OPTIONS.map((opt) => {
              const active = voicePitch === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setVoicePitch(opt.id);
                    setSavedNotice(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white text-[#1D5BFF] border border-[#E2E6EE]'
                      : 'text-[#4E5869] hover:text-[#0E1116]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[#788296]">
            {PITCH_OPTIONS.find((p) => p.id === voicePitch)?.detail}
          </p>
        </div>
      </div>

      {/* Section 3: Voice Persona */}
      <div className="space-y-2.5 pt-4 border-t border-[#E2E6EE]">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#0E1116]">Tutor Voice Persona</h3>
          <span className="text-xs text-[#788296]">Gemini Speech Synthesis</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {VOICE_PERSONAS.map((vp) => {
            const active = voicePersona === vp.id;
            return (
              <button
                key={vp.id}
                type="button"
                onClick={() => {
                  setVoicePersona(vp.id);
                  setSavedNotice(null);
                }}
                className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#EEF3FF] border-[#1D5BFF] text-[#1545CC]'
                    : 'bg-white border-[#E2E6EE] text-[#0E1116] hover:bg-[#F7F8FA]'
                }`}
              >
                <span className="block text-xs font-semibold">{vp.label}</span>
                <span className="block text-[11px] text-[#4E5869] mt-0.5 leading-snug">
                  {vp.timbre}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 4: Hands-Free Behavior Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[#E2E6EE]">
        <button
          type="button"
          role="switch"
          aria-checked={autoSpeakAnswers}
          onClick={() => {
            setAutoSpeakAnswers((v) => !v);
            setSavedNotice(null);
          }}
          className="p-3.5 rounded-lg border border-[#E2E6EE] bg-[#FAFBFD] hover:border-[#CBD4E3] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div>
            <span className="block text-xs font-semibold text-[#0E1116]">Auto-read tutor answers</span>
            <span className="block text-[11px] text-[#4E5869] mt-0.5">
              Speak new Doubt Solver replies aloud automatically
            </span>
          </div>
          <span
            className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
              autoSpeakAnswers ? 'bg-[#1D5BFF] justify-end' : 'bg-[#CBD4E3] justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
          </span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={voiceInputAutoSend}
          onClick={() => {
            setVoiceInputAutoSend((v) => !v);
            setSavedNotice(null);
          }}
          className="p-3.5 rounded-lg border border-[#E2E6EE] bg-[#FAFBFD] hover:border-[#CBD4E3] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div>
            <span className="block text-xs font-semibold text-[#0E1116]">Auto-send voice questions</span>
            <span className="block text-[11px] text-[#4E5869] mt-0.5">
              Submit immediately once microphone transcription finishes
            </span>
          </div>
          <span
            className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
              voiceInputAutoSend ? 'bg-[#1D5BFF] justify-end' : 'bg-[#CBD4E3] justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
          </span>
        </button>
      </div>

      {error && <p className="text-xs font-medium text-[#CC2936]">{error}</p>}
      {savedNotice && <p className="text-xs font-medium text-[#138A57]">{savedNotice}</p>}

      {/* Action Footer */}
      <div className="pt-4 border-t border-[#E2E6EE] flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#4E5869] hover:text-[#0E1116] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Defaults</span>
        </button>

        <div className="flex items-center gap-2">
          {variant === 'drawer' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#4E5869] hover:text-[#0E1116] bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Voice Preferences'}
          </button>
        </div>
      </div>
    </div>
  );

  if (variant === 'embedded') {
    return <div className="bg-white border border-[#E2E6EE] rounded-xl p-6">{content}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0E1116]/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Multilingual voice assistant settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <motion.div
        initial={prefersReduced ? false : { x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={prefersReduced ? undefined : { x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl bg-white h-full overflow-y-auto p-6 lg:p-8 border-l border-[#E2E6EE] shadow-xl"
      >
        {content}
      </motion.div>
    </div>
  );
};
