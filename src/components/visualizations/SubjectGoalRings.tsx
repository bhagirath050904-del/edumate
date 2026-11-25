import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import type { StudyBlock, SubjectMastery } from '../../types';

interface SubjectGoalRingsProps {
  subjects: SubjectMastery[];
  planBlocks: StudyBlock[];
  dailyGoalMinutes: number;
  onSelectSubject: (subject: string) => void;
}

interface ComputedSubjectGoal {
  subject: string;
  completionPct: number;
  hoursLogged: number;
  targetHours: number;
  completedBlocks: number;
  totalBlocks: number;
  mastery: number;
  statusLabel: string;
  strokeColor: string;
  statusTextColor: string;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const SubjectGoalRings: React.FC<SubjectGoalRingsProps> = ({
  subjects,
  planBlocks,
  dailyGoalMinutes,
  onSelectSubject,
}) => {
  const prefersReduced = useReducedMotion();

  const items: ComputedSubjectGoal[] = useMemo(() => {
    const subjectCount = Math.max(1, subjects.length);
    const weeklyHoursTotal = (dailyGoalMinutes * 7) / 60;
    const baseTargetPerSubject = Math.max(4, Number((weeklyHoursTotal / subjectCount).toFixed(1)));

    return subjects.map((sub) => {
      const subBlocks = planBlocks.filter(
        (b) => b.subject.toLowerCase() === sub.subject.toLowerCase()
      );
      const completedBlocks = subBlocks.filter((b) => b.completed).length;
      const totalBlocks = subBlocks.length;

      // Target scales slightly higher when a subject has lower mastery or more planned blocks
      const targetHours = Number(
        Math.max(baseTargetPerSubject, sub.hoursLogged * 0.6 + 3.5).toFixed(1)
      );
      const hoursRatio = Math.min(1, sub.hoursLogged / targetHours);
      const blocksRatio = totalBlocks > 0 ? completedBlocks / totalBlocks : hoursRatio;

      // Weighted goal completion combining logged study hours and scheduled block execution
      const completionPct = Math.max(
        5,
        Math.min(100, Math.round((hoursRatio * 0.72 + blocksRatio * 0.28) * 100))
      );

      let statusLabel = 'Needs focus';
      let strokeColor = '#D9820B';
      let statusTextColor = 'text-[#B36800]';

      if (completionPct >= 80) {
        statusLabel = 'Goal on track';
        strokeColor = '#138A57';
        statusTextColor = 'text-[#138A57]';
      } else if (completionPct >= 55) {
        statusLabel = 'Steady pace';
        strokeColor = '#1D5BFF';
        statusTextColor = 'text-[#1D5BFF]';
      }

      return {
        subject: sub.subject,
        completionPct,
        hoursLogged: sub.hoursLogged,
        targetHours,
        completedBlocks,
        totalBlocks,
        mastery: sub.mastery,
        statusLabel,
        strokeColor,
        statusTextColor,
      };
    });
  }, [subjects, planBlocks, dailyGoalMinutes]);

  const avgCompletion =
    items.length > 0
      ? Math.round(items.reduce((sum, item) => sum + item.completionPct, 0) / items.length)
      : 0;

  return (
    <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-medium text-[#4E5869] mb-1">
            Weekly Study Goal Completion · Live Sync with Focus &amp; Planner
          </p>
          <h2 className="font-display text-lg lg:text-xl font-bold text-[#0E1116] tracking-tight">
            Subject Goal Progress Rings
          </h2>
        </div>
        <div className="text-xs font-mono tabular-nums text-[#4E5869]">
          Overall goal completion:{' '}
          <strong className="text-[#0E1116]">{avgCompletion}%</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EEF1F6]">
        {items.map((item, idx) => {
          const targetOffset = CIRCUMFERENCE * (1 - item.completionPct / 100);

          return (
            <button
              key={item.subject}
              type="button"
              onClick={() => onSelectSubject(item.subject)}
              className="group p-4 sm:px-5 first:pl-0 last:pr-0 text-left hover:bg-[#FAFBFD] transition-colors flex flex-col items-center text-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1D5BFF] rounded-lg"
            >
              {/* Circular SVG Progress Indicator */}
              <div className="relative w-28 h-28 flex items-center justify-center mb-3.5">
                <svg
                  viewBox="0 0 104 104"
                  className="w-full h-full -rotate-90"
                  role="img"
                  aria-label={`${item.subject} study goal ${item.completionPct}% complete`}
                >
                  {/* Subtle calibrated quadrant ticks */}
                  {[0, 90, 180, 270].map((deg) => (
                    <line
                      key={deg}
                      x1="52"
                      y1="3"
                      x2="52"
                      y2="7"
                      stroke="#CBD4E3"
                      strokeWidth="1.25"
                      transform={`rotate(${deg} 52 52)`}
                    />
                  ))}

                  {/* Background track */}
                  <circle
                    cx="52"
                    cy="52"
                    r={RADIUS}
                    fill="none"
                    stroke="#EEF1F6"
                    strokeWidth="6.5"
                  />

                  {/* Animated Framer Motion progress stroke */}
                  <motion.circle
                    cx="52"
                    cy="52"
                    r={RADIUS}
                    fill="none"
                    stroke={item.strokeColor}
                    strokeWidth="6.5"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    initial={
                      prefersReduced
                        ? { strokeDashoffset: targetOffset }
                        : { strokeDashoffset: CIRCUMFERENCE }
                    }
                    animate={{ strokeDashoffset: targetOffset }}
                    transition={{
                      duration: 0.9,
                      delay: idx * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                </svg>

                {/* Center Percentage Readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono tabular-nums text-xl font-bold text-[#0E1116] leading-none">
                    {item.completionPct}%
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-[#788296] mt-1">
                    {item.hoursLogged}h/{item.targetHours}h
                  </span>
                </div>
              </div>

              {/* Subject Title & Clean Unboxed Metadata */}
              <div className="flex items-center justify-center gap-1">
                <h3 className="font-display text-sm font-bold text-[#0E1116] group-hover:text-[#1D5BFF] transition-colors">
                  {item.subject}
                </h3>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#788296] group-hover:text-[#1D5BFF] transition-colors shrink-0" />
              </div>

              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs">
                <span className={`font-medium ${item.statusTextColor}`}>{item.statusLabel}</span>
                <span className="text-[#CBD4E3]" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[#788296]">
                  {item.completedBlocks}/{item.totalBlocks} blocks
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
