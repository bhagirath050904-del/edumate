import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface VoiceWaveformMotionProps {
  mode: 'idle' | 'recording' | 'transcribing' | 'speaking';
  levels?: number[];
  label?: string;
}

const BAR_COUNT = 24;

export const VoiceWaveformMotion: React.FC<VoiceWaveformMotionProps> = ({
  mode,
  levels,
  label,
}) => {
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#F7F8FA] border border-[#E2E6EE]">
      <div className="flex items-center gap-[3px] h-7" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const centerWeight = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 2);
          const liveLevel = levels && levels[i] !== undefined ? levels[i] : 0;

          let targetScaleY = 0.14;
          if (mode === 'recording') {
            targetScaleY = Math.max(0.18, Math.min(1, liveLevel * 1.15 + centerWeight * 0.18));
          } else if (mode === 'speaking') {
            targetScaleY = 0.25 + centerWeight * 0.65;
          } else if (mode === 'transcribing') {
            targetScaleY = 0.22 + centerWeight * 0.35;
          }

          const barColor =
            mode === 'recording'
              ? 'bg-[#CC2936]'
              : mode === 'speaking'
                ? 'bg-[#1D5BFF]'
                : mode === 'transcribing'
                  ? 'bg-[#D9820B]'
                  : 'bg-[#CBD4E3]';

          return (
            <motion.span
              key={i}
              className={`w-[2.5px] h-full rounded-full ${barColor}`}
              style={{ transformOrigin: 'center' }}
              animate={
                prefersReduced
                  ? { scaleY: mode === 'idle' ? 0.15 : 0.55 }
                  : mode === 'recording'
                    ? { scaleY: targetScaleY }
                    : mode === 'speaking'
                      ? {
                          scaleY: [
                            0.18 + centerWeight * 0.12,
                            0.45 + centerWeight * 0.55,
                            0.2 + centerWeight * 0.15,
                          ],
                        }
                      : mode === 'transcribing'
                        ? { scaleY: [0.16, 0.45, 0.16] }
                        : { scaleY: 0.14 }
              }
              transition={
                mode === 'recording'
                  ? { duration: 0.08, ease: 'easeOut' }
                  : {
                      duration: mode === 'speaking' ? 0.7 + (i % 5) * 0.09 : 0.95,
                      repeat: mode === 'idle' ? 0 : Infinity,
                      delay: (i % 7) * 0.06,
                      ease: 'easeInOut',
                    }
              }
            />
          );
        })}
      </div>

      <span className="text-xs font-medium text-[#4E5869] whitespace-nowrap">
        {label ??
          (mode === 'recording'
            ? 'Listening via microphone'
            : mode === 'transcribing'
              ? 'Transcribing speech'
              : mode === 'speaking'
                ? 'Reading explanation aloud'
                : 'Voice ready')}
      </span>
    </div>
  );
};
