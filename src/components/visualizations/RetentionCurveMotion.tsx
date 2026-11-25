import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { SubjectMastery } from '../../types';

interface RetentionCurveMotionProps {
  subjects: SubjectMastery[];
}

export const RetentionCurveMotion: React.FC<RetentionCurveMotionProps> = ({ subjects }) => {
  const prefersReduced = useReducedMotion();
  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0]?.subject ?? 'Physics');
  const [revisionCheckpoints, setRevisionCheckpoints] = useState<number>(3);

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.subject === selectedSubject) ?? subjects[0] ?? {
      subject: 'Physics',
      mastery: 76,
      hoursLogged: 5.5,
      doubtsResolved: 8,
      nextRevisionDays: 2,
    };
  }, [subjects, selectedSubject]);

  const width = 620;
  const height = 228;
  const padL = 44;
  const padR = 20;
  const padT = 18;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const totalDays = 21;

  const { cramPath, guidedPath, milestonePoints, cramEndPct, guidedEndPct } = useMemo(() => {
    const startScore = Math.min(96, Math.max(58, activeSubject.mastery + 12));
    const xOf = (day: number) => padL + (day / totalDays) * innerW;
    const yOf = (pct: number) => padT + ((100 - pct) / 100) * innerH;

    // Unstructured cramming: pure Ebbinghaus decay
    const cramPts: string[] = [];
    let cramEnd = 25;
    for (let d = 0; d <= totalDays; d += 0.5) {
      const pct = Math.max(18, startScore * Math.exp(-d / 6.2));
      if (d === totalDays) cramEnd = Math.round(pct);
      cramPts.push(`${d === 0 ? 'M' : 'L'} ${xOf(d).toFixed(1)} ${yOf(pct).toFixed(1)}`);
    }

    // EduMate Guided Spaced Revision checkpoints
    const revDays: number[] = [];
    for (let i = 1; i <= revisionCheckpoints; i++) {
      revDays.push(Math.round((i * totalDays) / (revisionCheckpoints + 0.85)));
    }

    const guidedPts: string[] = [];
    const markers: Array<{ day: number; pct: number; x: number; y: number }> = [];
    let currentStability = 5.8;
    let lastResetDay = 0;
    let peak = startScore;
    let guidedEnd = startScore;

    for (let d = 0; d <= totalDays; d += 0.25) {
      const hitRev = revDays.includes(d);
      if (hitRev) {
        const before = Math.max(24, peak * Math.exp(-(d - lastResetDay) / currentStability));
        guidedPts.push(`L ${xOf(d).toFixed(1)} ${yOf(before).toFixed(1)}`);
        peak = Math.min(97, Math.max(before + 18, startScore + revDays.indexOf(d) * 2.2));
        currentStability *= 1.65;
        lastResetDay = d;
        markers.push({ day: d, pct: Math.round(peak), x: xOf(d), y: yOf(peak) });
      }
      const pct = Math.max(24, peak * Math.exp(-(d - lastResetDay) / currentStability));
      if (d === totalDays) guidedEnd = Math.round(pct);
      guidedPts.push(`${d === 0 ? 'M' : 'L'} ${xOf(d).toFixed(1)} ${yOf(pct).toFixed(1)}`);
    }

    return {
      cramPath: cramPts.join(' '),
      guidedPath: guidedPts.join(' '),
      milestonePoints: markers,
      cramEndPct: cramEnd,
      guidedEndPct: guidedEnd,
    };
  }, [activeSubject.mastery, revisionCheckpoints, innerH, innerW]);

  const retentionLift = guidedEndPct - cramEndPct;

  return (
    <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-medium text-[#4E5869] mb-1">
            Spaced-Repetition Simulation · 21-Day Exam Horizon
          </p>
          <h3 className="font-display text-lg lg:text-xl font-bold text-[#0E1116] tracking-tight">
            Memory Decay vs. Guided Revision Curve
          </h3>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <div>
            <span className="text-[#788296] block">Cramming Day 21</span>
            <span className="text-sm font-semibold text-[#4E5869]">{cramEndPct}%</span>
          </div>
          <div className="h-7 w-px bg-[#E2E6EE]" />
          <div>
            <span className="text-[#1D5BFF] block">EduMate Day 21</span>
            <span className="text-sm font-semibold text-[#1D5BFF]">
              {guidedEndPct}% (+{retentionLift}%)
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Controls Deck */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#E2E6EE]">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F7F8FA] rounded-lg border border-[#E2E6EE]">
          {subjects.map((sub) => {
            const active = sub.subject === activeSubject.subject;
            return (
              <button
                key={sub.subject}
                type="button"
                onClick={() => setSelectedSubject(sub.subject)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#0E1116] shadow-xs border border-[#E2E6EE]'
                    : 'text-[#4E5869] hover:text-[#0E1116]'
                }`}
              >
                {sub.subject}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-3 text-xs text-[#4E5869]">
          <span className="font-medium whitespace-nowrap">
            Revision Checkpoints: <strong className="font-mono tabular-nums text-[#0E1116]">{revisionCheckpoints}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={revisionCheckpoints}
            onChange={(e) => setRevisionCheckpoints(Number(e.target.value))}
            className="w-28 accent-[#1D5BFF] cursor-pointer"
            aria-label="Number of guided revision checkpoints"
          />
        </label>
      </div>

      {/* SVG Motion Coordinate Plot */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[420px] block"
          role="img"
          aria-label={`Memory retention simulation curve for ${activeSubject.subject}`}
        >
          {/* Horizontal coordinate gridlines */}
          {[25, 50, 75, 100].map((val) => {
            const y = padT + ((100 - val) / 100) * innerH;
            return (
              <g key={val}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#EEF1F6" strokeWidth="1" />
                <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-[#788296] text-[10px] font-mono">
                  {val}%
                </text>
              </g>
            );
          })}

          {/* X-axis ticks */}
          {[0, 7, 14, 21].map((day) => {
            const x = padL + (day / totalDays) * innerW;
            return (
              <text key={day} x={x} y={height - 10} textAnchor="middle" className="fill-[#788296] text-[10px] font-mono">
                Day {day}
              </text>
            );
          })}

          {/* Unstructured Cramming Curve */}
          <path
            d={cramPath}
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* EduMate Guided Revision Curve */}
          <motion.path
            key={`${activeSubject.subject}-${revisionCheckpoints}`}
            d={guidedPath}
            fill="none"
            stroke="#1D5BFF"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={prefersReduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Revision Checkpoint Milestone Nodes */}
          {milestonePoints.map((pt, idx) => (
            <motion.g
              key={`${pt.day}-${idx}`}
              initial={prefersReduced ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25 + idx * 0.08, duration: 0.25 }}
            >
              <line
                x1={pt.x}
                y1={pt.y}
                x2={pt.x}
                y2={height - padB}
                stroke="#1D5BFF"
                strokeOpacity="0.18"
                strokeWidth="1"
              />
              <circle cx={pt.x} cy={pt.y} r="4.5" fill="#FFFFFF" stroke="#1D5BFF" strokeWidth="2.5" />
              <text x={pt.x} y={pt.y - 9} textAnchor="middle" className="fill-[#1D5BFF] text-[9px] font-mono font-semibold">
                R{idx + 1}
              </text>
            </motion.g>
          ))}
        </svg>
      </div>

      {/* Explicit Legend (color + line pattern + text label) */}
      <div className="mt-3 pt-3 border-t border-[#E2E6EE] flex flex-wrap items-center justify-between gap-3 text-xs text-[#4E5869]">
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex items-center gap-2">
            <span className="w-5 h-0.5 bg-[#1D5BFF] inline-block" />
            <span>EduMate Guided Recall ({activeSubject.subject} · {activeSubject.mastery}% baseline)</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-5 h-0.5 border-t-2 border-dashed border-[#94A3B8] inline-block" />
            <span>Unstructured Single-Pass Study</span>
          </span>
        </div>
        <span className="font-mono tabular-nums text-[#788296]">
          Next suggested review: in {activeSubject.nextRevisionDays}d
        </span>
      </div>
    </div>
  );
};
