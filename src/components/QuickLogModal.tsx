import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Clock, X } from 'lucide-react';

interface QuickLogModalProps {
  subjects: string[];
  onClose: () => void;
  onLogSession: (minutes: number, subject: string) => Promise<void>;
}

const DURATION_PRESETS = [15, 25, 45, 60, 90];

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  subjects,
  onClose,
  onLogSession,
}) => {
  const prefersReduced = useReducedMotion();
  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] ?? 'Physics');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clamped = Math.max(5, Math.min(180, Math.round(durationMinutes)));
    if (!selectedSubject.trim()) {
      setError('Please select a subject.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onLogSession(clamped, selectedSubject);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log study session.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E1116]/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-log-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={prefersReduced ? undefined : { opacity: 0, scale: 0.97, y: 6 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white border border-[#E2E6EE] rounded-xl p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E2E6EE]">
          <div>
            <p className="text-xs font-medium text-[#4E5869]">Manual Focus Entry</p>
            <h2
              id="quick-log-modal-title"
              className="font-display text-xl font-bold text-[#0E1116] tracking-tight mt-0.5"
            >
              Quick Log Study Session
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Log modal"
            className="p-2 text-[#4E5869] hover:text-[#0E1116] bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Subject Selection */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-[#0E1116]">Choose Subject</span>
            <div className="grid grid-cols-2 gap-2">
              {subjects.map((sub) => {
                const active = selectedSubject === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-left transition-colors truncate cursor-pointer ${
                      active
                        ? 'bg-[#EEF3FF] text-[#1D5BFF] border-[#1D5BFF]'
                        : 'bg-[#FAFBFD] text-[#0E1116] border-[#E2E6EE] hover:border-[#CBD4E3]'
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session Duration */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <label htmlFor="quick-log-duration" className="text-xs font-semibold text-[#0E1116]">
                Session Duration
              </label>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-sm font-semibold text-[#1D5BFF]">
                <Clock className="w-3.5 h-3.5" />
                {durationMinutes} min
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {DURATION_PRESETS.map((mins) => {
                const active = durationMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`py-2 text-xs font-mono tabular-nums rounded-md border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#EEF3FF] text-[#1D5BFF] border-[#1D5BFF]/50 font-semibold'
                        : 'bg-[#F7F8FA] text-[#4E5869] border-[#E2E6EE] hover:text-[#0E1116]'
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                id="quick-log-duration"
                type="range"
                min={5}
                max={180}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="flex-1 accent-[#1D5BFF] cursor-pointer"
              />
              <input
                type="number"
                min={5}
                max={180}
                value={durationMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val)) setDurationMinutes(val);
                }}
                aria-label="Duration in minutes"
                className="w-16 px-2.5 py-1.5 text-xs font-mono tabular-nums text-center bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-[#CC2936]">{error}</p>}

          <div className="pt-4 border-t border-[#E2E6EE] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#4E5869] hover:text-[#0E1116] bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Logging...' : `Log ${durationMinutes}m Session`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
