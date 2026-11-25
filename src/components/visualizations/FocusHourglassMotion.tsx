import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Play, Pause, RotateCcw, Check } from 'lucide-react';

interface FocusHourglassMotionProps {
  subjects: string[];
  onLogSession: (minutes: number, subject: string) => Promise<void>;
}

const PRESETS = [
  { label: '15m Sprint', minutes: 15 },
  { label: '25m Focus', minutes: 25 },
  { label: '45m Deep', minutes: 45 },
];

export const FocusHourglassMotion: React.FC<FocusHourglassMotionProps> = ({ subjects, onLogSession }) => {
  const prefersReduced = useReducedMotion();
  const [selectedMinutes, setSelectedMinutes] = useState<number>(25);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>(subjects[0] ?? 'Physics');
  const [logging, setLogging] = useState<boolean>(false);
  const [loggedBanner, setLoggedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const totalSeconds = selectedMinutes * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const elapsedMinutes = Math.max(1, Math.round((totalSeconds - remainingSeconds) / 60));

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const handleSelectPreset = (m: number) => {
    setIsRunning(false);
    setSelectedMinutes(m);
    setRemainingSeconds(m * 60);
    setLoggedBanner(null);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(selectedMinutes * 60);
    setLoggedBanner(null);
  };

  const handleCompleteAndLog = async () => {
    setLogging(true);
    setIsRunning(false);
    const minutesToRecord = progress > 0.04 ? elapsedMinutes : selectedMinutes;
    try {
      await onLogSession(minutesToRecord, subject);
      setLoggedBanner(`Logged ${minutesToRecord} min for ${subject}`);
      setRemainingSeconds(selectedMinutes * 60);
    } finally {
      setLogging(false);
    }
  };

  // Hourglass sand geometry calculations
  const topRemainingRatio = Math.max(0, 1 - progress);
  const topSandY = 26 + (1 - topRemainingRatio) * 58;
  const bottomSandHeight = Math.max(2, progress * 58);
  const bottomSandY = 160 - bottomSandHeight;

  return (
    <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 lg:p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-medium text-[#4E5869] mb-1">Focus Instrument</p>
            <h3 className="font-display text-lg font-bold text-[#0E1116] tracking-tight">
              Calm Study Hourglass
            </h3>
          </div>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Focus session subject"
            className="text-xs font-medium bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg px-2.5 py-1.5 text-[#0E1116] cursor-pointer"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Preset Segmented Control */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg mb-5">
          {PRESETS.map((p) => (
            <button
              key={p.minutes}
              type="button"
              onClick={() => handleSelectPreset(p.minutes)}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                selectedMinutes === p.minutes
                  ? 'bg-white text-[#0E1116] border border-[#E2E6EE]'
                  : 'text-[#4E5869] hover:text-[#0E1116]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Kinetic Hourglass SVG Visual */}
        <div className="flex items-center justify-center gap-6 my-3">
          <svg
            viewBox="0 0 130 186"
            className="w-28 h-40 shrink-0"
            role="img"
            aria-label={`Study timer hourglass, ${Math.round(progress * 100)}% complete`}
          >
            <defs>
              <clipPath id="upper-chamber">
                <path d="M 28 24 L 102 24 C 102 60, 74 84, 65 92 C 56 84, 28 60, 28 24 Z" />
              </clipPath>
              <clipPath id="lower-chamber">
                <path d="M 65 94 C 74 102, 102 126, 102 162 L 28 162 C 28 126, 56 102, 65 94 Z" />
              </clipPath>
            </defs>

            {/* Top & Bottom structural caps */}
            <rect x="20" y="14" width="90" height="7" rx="3.5" fill="#0E1116" />
            <rect x="20" y="165" width="90" height="7" rx="3.5" fill="#0E1116" />

            {/* Cobalt glass outline */}
            <path
              d="M 28 24 L 102 24 C 102 60, 74 84, 65 92 C 56 84, 28 60, 28 24 Z"
              fill="#EEF3FF"
              stroke="#1D5BFF"
              strokeWidth="2.5"
            />
            <path
              d="M 65 94 C 74 102, 102 126, 102 162 L 28 162 C 28 126, 56 102, 65 94 Z"
              fill="#EEF3FF"
              stroke="#1D5BFF"
              strokeWidth="2.5"
            />

            {/* Upper golden sand */}
            <g clipPath="url(#upper-chamber)">
              <motion.rect
                x="24"
                width="82"
                height="72"
                fill="#E5A024"
                animate={{ y: topSandY }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </g>

            {/* Falling stream when active */}
            {isRunning && topRemainingRatio > 0 && (
              <motion.line
                x1="65"
                y1="91"
                x2="65"
                y2={bottomSandY + 2}
                stroke="#D9820B"
                strokeWidth="2"
                strokeDasharray="3 4"
                animate={prefersReduced ? undefined : { strokeDashoffset: [0, -14] }}
                transition={{ duration: 0.65, repeat: Infinity, ease: 'linear' }}
              />
            )}

            {/* Lower golden sand pile */}
            <g clipPath="url(#lower-chamber)">
              <motion.rect
                x="24"
                width="82"
                height="72"
                fill="#D9820B"
                animate={{ y: bottomSandY }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </g>
          </svg>

          <div className="space-y-2">
            <div className="font-mono tabular-nums text-4xl font-semibold text-[#0E1116] tracking-tight">
              {formattedTime}
            </div>
            <p className="text-xs text-[#4E5869]">
              {isRunning ? 'Session in progress' : remainingSeconds === 0 ? 'Session complete' : 'Ready to focus'}
            </p>
            <div className="text-xs font-mono tabular-nums text-[#788296]">
              {Math.round(progress * 100)}% elapsed
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="pt-4 mt-4 border-t border-[#E2E6EE] space-y-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning((r) => !r)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'Pause' : 'Start Focus'}</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset focus timer"
            className="p-2.5 text-[#4E5869] hover:text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF1F6] border border-[#E2E6EE] rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={logging}
            onClick={handleCompleteAndLog}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{logging ? 'Saving...' : 'Log Session'}</span>
          </button>
        </div>

        {loggedBanner && (
          <p className="text-xs font-medium text-[#138A57] text-center">{loggedBanner}</p>
        )}
      </div>
    </div>
  );
};
