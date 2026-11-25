import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Flame, Check, Plus } from 'lucide-react';
import type { WeeklyStudyPoint } from '../../types';

interface StudyStreakTrackerProps {
  streakDays: number;
  weeklyStudy: WeeklyStudyPoint[];
  dailyGoalMinutes: number;
  defaultSubject: string;
  onQuickLogFocus: (minutes: number, subject: string) => Promise<void>;
}

export const StudyStreakTracker: React.FC<StudyStreakTrackerProps> = ({
  streakDays,
  weeklyStudy,
  dailyGoalMinutes,
  defaultSubject,
  onQuickLogFocus,
}) => {
  const prefersReduced = useReducedMotion();
  const [logging, setLogging] = useState(false);

  const todaySlot = weeklyStudy[weeklyStudy.length - 1];
  const todayMinutes = todaySlot?.minutes ?? 0;
  const todaySessions = todaySlot?.sessions ?? 0;
  const todayGoalPct = Math.min(100, Math.round((todayMinutes / Math.max(1, dailyGoalMinutes)) * 100));
  const activeDaysCount = weeklyStudy.filter((d) => d.sessions > 0).length;

  const handleQuickLog = async () => {
    if (logging) return;
    setLogging(true);
    try {
      await onQuickLogFocus(15, defaultSubject);
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 lg:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Animated Flame & Consecutive Day Counter */}
        <div className="lg:col-span-4 flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-xl bg-[#FFF6E8] border border-[#F3D5A3] flex items-center justify-center shrink-0 overflow-hidden">
            {/* Ambient subtle warm glow pulse */}
            {!prefersReduced && streakDays > 0 && (
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 bg-[#E5A024]/20 rounded-xl"
                animate={{ opacity: [0.25, 0.6, 0.25], scale: [0.92, 1.05, 0.92] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* Animated Flame Icon */}
            <motion.div
              className="relative z-10 flex items-center justify-center"
              animate={
                prefersReduced || streakDays === 0
                  ? undefined
                  : {
                      y: [0, -2, 0, -1, 0],
                      scale: [1, 1.08, 0.98, 1.05, 1],
                      rotate: [0, -3, 2, -2, 0],
                    }
              }
              transition={{
                duration: 2.1,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Flame
                className={`w-7 h-7 ${
                  streakDays > 0 ? 'text-[#D9531E] fill-[#F59E0B]' : 'text-[#9AA6BA]'
                }`}
                strokeWidth={2}
              />
            </motion.div>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-[#4E5869]">Study Streak</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <motion.span
                key={streakDays}
                initial={prefersReduced ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="font-mono tabular-nums text-3xl font-bold text-[#0E1116] tracking-tight"
              >
                {streakDays}
              </motion.span>
              <span className="font-display text-sm font-semibold text-[#0E1116]">
                consecutive {streakDays === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="text-xs text-[#788296] font-mono tabular-nums mt-0.5">
              {activeDaysCount}/7 days logged this week
            </p>
          </div>
        </div>

        {/* Center: 7-Day Focus Session Cadence Strip */}
        <div className="lg:col-span-5 lg:border-x lg:border-[#EEF1F6] lg:px-6">
          <div className="flex items-center justify-between text-xs text-[#4E5869] mb-2.5">
            <span className="font-medium">Consecutive Focus Log</span>
            <span className="font-mono tabular-nums text-[#788296]">
              Today: {todaySessions} {todaySessions === 1 ? 'session' : 'sessions'} · {todayMinutes}m
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weeklyStudy.map((day, idx) => {
              const isToday = idx === weeklyStudy.length - 1;
              const logged = day.sessions > 0;
              const hitGoal = day.minutes >= dailyGoalMinutes;

              return (
                <div key={day.day} className="flex flex-col items-center gap-1.5">
                  <motion.div
                    initial={prefersReduced ? false : { scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.04, duration: 0.22 }}
                    title={`${day.day}: ${day.sessions} sessions (${day.minutes} min)`}
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                      hitGoal
                        ? 'bg-[#D9531E] border-[#D9531E] text-white'
                        : logged
                          ? 'bg-[#FFF6E8] border-[#E5A024] text-[#B36800]'
                          : 'bg-[#F7F8FA] border-[#E2E6EE] text-[#9AA6BA]'
                    } ${isToday ? 'ring-2 ring-[#1D5BFF]/30 ring-offset-1' : ''}`}
                  >
                    {logged ? (
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                      <span className="text-[11px] font-mono tabular-nums">–</span>
                    )}
                  </motion.div>
                  <span
                    className={`text-[11px] font-medium ${
                      isToday ? 'text-[#1D5BFF] font-semibold' : 'text-[#4E5869]'
                    }`}
                  >
                    {day.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Today's Daily Streak Protection & Quick Log */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="font-medium text-[#4E5869]">Today&apos;s Goal</span>
              <span className="font-mono tabular-nums font-semibold text-[#0E1116]">
                {todayMinutes}/{dailyGoalMinutes}m
              </span>
            </div>
            <div className="h-2 w-full bg-[#EEF1F6] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[#D9531E]"
                initial={prefersReduced ? { scaleX: todayGoalPct / 100 } : { scaleX: 0 }}
                animate={{ scaleX: todayGoalPct / 100 }}
                style={{ transformOrigin: 'left' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={logging}
            onClick={handleQuickLog}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#FFF6E8] hover:text-[#B36800] border border-[#E2E6EE] hover:border-[#E5A024] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{logging ? 'Logging...' : 'Log 15m Focus Sprint'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
