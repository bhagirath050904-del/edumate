import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { SubjectMastery, WeeklyStudyPoint } from '../../types';

interface StudyMomentumChartProps {
  weeklyStudy: WeeklyStudyPoint[];
  subjectMastery: SubjectMastery[];
  dailyGoalMinutes: number;
}

export const StudyMomentumChart: React.FC<StudyMomentumChartProps> = ({
  weeklyStudy,
  subjectMastery,
  dailyGoalMinutes,
}) => {
  const prefersReduced = useReducedMotion();
  const maxMinutes = Math.max(dailyGoalMinutes, ...weeklyStudy.map((w) => w.minutes), 120);
  const totalWeekMinutes = weeklyStudy.reduce((sum, w) => sum + w.minutes, 0);
  const goalHitDays = weeklyStudy.filter((w) => w.minutes >= dailyGoalMinutes).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Weekly Study Velocity Bars */}
      <div className="lg:col-span-7 bg-white border border-[#E2E6EE] rounded-xl p-5 lg:p-6 flex flex-col justify-between">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-medium text-[#4E5869] mb-1">
              Weekly Focus Velocity · Goal {dailyGoalMinutes} min/day
            </p>
            <h3 className="font-display text-lg font-bold text-[#0E1116] tracking-tight">
              Consistent Momentum Over Cramming
            </h3>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#4E5869]">
            {(totalWeekMinutes / 60).toFixed(1)} hrs total · {goalHitDays}/7 days on goal
          </div>
        </div>

        <div className="relative h-48 flex items-end gap-3 pt-4">
          {/* Daily Goal Reference Line */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[#1D5BFF]/40 pointer-events-none flex justify-end"
            style={{ bottom: `${Math.min(92, (dailyGoalMinutes / maxMinutes) * 100)}%` }}
          >
            <span className="text-[10px] font-mono text-[#1D5BFF] bg-white px-1.5 -mt-2">
              Goal {dailyGoalMinutes}m
            </span>
          </div>

          {weeklyStudy.map((point, idx) => {
            const heightPct = Math.max(8, Math.round((point.minutes / maxMinutes) * 100));
            const meetsGoal = point.minutes >= dailyGoalMinutes;
            return (
              <div key={point.day} className="flex-1 flex flex-col items-center h-full justify-end group">
                <div className="text-[11px] font-mono tabular-nums text-[#4E5869] mb-1.5">
                  {point.minutes}m
                </div>
                <div className="w-full max-w-[44px] h-[132px] bg-[#F7F8FA] rounded-t-md flex items-end overflow-hidden border border-[#EEF1F6]">
                  <motion.div
                    className={`w-full rounded-t-sm ${meetsGoal ? 'bg-[#1D5BFF]' : 'bg-[#94A9E6]'}`}
                    initial={prefersReduced ? { height: `${heightPct}%` } : { height: '0%' }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ delay: idx * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <div className="mt-2 text-xs font-medium text-[#4E5869]">{point.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subject Mastery Distribution */}
      <div className="lg:col-span-5 bg-white border border-[#E2E6EE] rounded-xl p-5 lg:p-6 flex flex-col justify-between">
        <div>
          <p className="text-xs font-medium text-[#4E5869] mb-1">Progress Analytics</p>
          <h3 className="font-display text-lg font-bold text-[#0E1116] tracking-tight mb-5">
            Subject Mastery Ledger
          </h3>

          <div className="space-y-4">
            {subjectMastery.map((sub, idx) => {
              const statusLabel =
                sub.mastery >= 80 ? 'Strong' : sub.mastery >= 68 ? 'On track' : 'Needs focus';
              const barColor =
                sub.mastery >= 80
                  ? 'bg-[#138A57]'
                  : sub.mastery >= 68
                    ? 'bg-[#1D5BFF]'
                    : 'bg-[#D9820B]';

              return (
                <div key={sub.subject} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-sm font-semibold text-[#0E1116] truncate">{sub.subject}</span>
                      <span className="text-xs text-[#788296] whitespace-nowrap">
                        {statusLabel}
                      </span>
                    </div>
                    <div className="text-xs font-mono tabular-nums text-[#0E1116] font-semibold shrink-0">
                      {sub.mastery}%
                    </div>
                  </div>

                  <div className="h-2 w-full bg-[#F1F4F9] rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${barColor}`}
                      initial={prefersReduced ? { scaleX: sub.mastery / 100 } : { scaleX: 0 }}
                      animate={{ scaleX: sub.mastery / 100 }}
                      style={{ transformOrigin: 'left' }}
                      transition={{ delay: 0.1 + idx * 0.06, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#788296]">
                    <span>{sub.hoursLogged}h logged · {sub.doubtsResolved} doubts resolved</span>
                    <span>Review in {sub.nextRevisionDays}d</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
