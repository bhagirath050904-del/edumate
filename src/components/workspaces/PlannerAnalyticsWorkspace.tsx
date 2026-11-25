import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Calendar, CheckCircle2, RefreshCw } from 'lucide-react';
import type { EduMateState, StudyBlock } from '../../types';
import { api } from '../../lib/api';
import { RetentionCurveMotion } from '../visualizations/RetentionCurveMotion';
import { StudyMomentumChart } from '../visualizations/StudyMomentumChart';
import { FocusHourglassMotion } from '../visualizations/FocusHourglassMotion';

interface PlannerAnalyticsWorkspaceProps {
  state: EduMateState;
  onStateChange: (next: EduMateState) => void;
  onToggleBlock: (blockId: string, completed: boolean) => Promise<void>;
  onLogFocus: (minutes: number, subject: string) => Promise<void>;
}

const DEFAULT_SUBJECTS = ['Physics', 'Linear Algebra', 'Computer Science', 'Biology', 'Economics', 'Chemistry'];

export const PlannerAnalyticsWorkspace: React.FC<PlannerAnalyticsWorkspaceProps> = ({
  state,
  onStateChange,
  onToggleBlock,
  onLogFocus,
}) => {
  const prefersReduced = useReducedMotion();
  const { studyPlan, profile } = state;

  const [goalTitle, setGoalTitle] = useState<string>(studyPlan.goalTitle);
  const [examDate, setExamDate] = useState<string>(studyPlan.examDate);
  const [dailyHours, setDailyHours] = useState<number>(studyPlan.dailyHours);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(studyPlan.subjects);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const allAvailableSubjects = useMemo(() => {
    return Array.from(
      new Set([
        ...DEFAULT_SUBJECTS,
        ...state.materials.map((m) => m.subject),
        ...studyPlan.subjects,
      ])
    );
  }, [state.materials, studyPlan.subjects]);

  const toggleSubject = (sub: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(sub)
        ? prev.length > 1
          ? prev.filter((s) => s !== sub)
          : prev
        : [...prev, sub]
    );
  };

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGenerating(true);
    try {
      const updated = await api.generateStudyPlan({
        goalTitle: goalTitle.trim(),
        examDate,
        dailyHours,
        subjects: selectedSubjects,
        language: profile.preferredLanguage,
      });
      onStateChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build adaptive study plan.');
    } finally {
      setGenerating(false);
    }
  };

  // Group blocks by dayIndex
  const groupedDays = useMemo(() => {
    const map = new Map<number, { dayLabel: string; date: string; blocks: StudyBlock[] }>();
    for (const blk of studyPlan.blocks) {
      const entry = map.get(blk.dayIndex) ?? {
        dayLabel: blk.dayLabel,
        date: blk.date,
        blocks: [],
      };
      entry.blocks.push(blk);
      map.set(blk.dayIndex, entry);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [studyPlan.blocks]);

  const completedCount = studyPlan.blocks.filter((b) => b.completed).length;
  const totalCount = studyPlan.blocks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header + Adaptive Plan Generator */}
      <section className="bg-white border border-[#E2E6EE] rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#4E5869]">
              Study Planner &amp; Progress Analytics
            </p>
            <h1 className="font-display text-2xl font-bold text-[#0E1116] tracking-tight">
              Replace Last-Minute Stress with Interleaved Structure
            </h1>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#4E5869]">
            Plan completion: <strong className="text-[#1D5BFF]">{completionPct}%</strong> ({completedCount}/{totalCount} blocks)
          </div>
        </div>

        <form onSubmit={handleGeneratePlan} className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 border-t border-[#E2E6EE]">
          <div className="lg:col-span-5">
            <label htmlFor="goal-title" className="block text-xs font-medium text-[#4E5869] mb-1.5">
              Exam or Learning Goal
            </label>
            <input
              id="goal-title"
              type="text"
              required
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="exam-date" className="block text-xs font-medium text-[#4E5869] mb-1.5">
              Target Exam Date
            </label>
            <input
              id="exam-date"
              type="date"
              required
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="daily-hours" className="block text-xs font-medium text-[#4E5869] mb-1.5">
              Daily Pace: <strong className="font-mono text-[#0E1116]">{dailyHours} hrs</strong>
            </label>
            <input
              id="daily-hours"
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={dailyHours}
              onChange={(e) => setDailyHours(Number(e.target.value))}
              className="w-full mt-2 accent-[#1D5BFF] cursor-pointer"
            />
          </div>

          <div className="lg:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={generating}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Planning...' : 'Rebuild Plan'}</span>
            </button>
          </div>

          <div className="lg:col-span-12 flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-[#4E5869] mr-1">Subjects:</span>
            {allAvailableSubjects.map((sub) => {
              const active = selectedSubjects.includes(sub);
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => toggleSubject(sub)}
                  className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#EEF3FF] text-[#1D5BFF] border-[#1D5BFF]/40'
                      : 'bg-[#F7F8FA] text-[#4E5869] border-[#E2E6EE] hover:text-[#0E1116]'
                  }`}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </form>

        {error && <p className="text-xs font-medium text-[#CC2936]">{error}</p>}
      </section>

      {/* Strategy Note + Completion Progress Bar */}
      <section className="bg-white border border-[#E2E6EE] rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-medium text-[#1D5BFF] mb-1">Adaptive Strategy</p>
            <p className="text-sm text-[#252C38] leading-relaxed">{studyPlan.strategySummary}</p>
          </div>
          <div className="w-full md:w-52 shrink-0">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#4E5869] mb-1.5">
              <span>Progress</span>
              <span>{completionPct}%</span>
            </div>
            <div className="h-2 w-full bg-[#EEF1F6] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#1D5BFF] rounded-full"
                initial={prefersReduced ? { scaleX: completionPct / 100 } : { scaleX: 0 }}
                animate={{ scaleX: completionPct / 100 }}
                style={{ transformOrigin: 'left' }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Multi-Day Schedule Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-4 border-t border-[#E2E6EE]">
          {groupedDays.map(([dayIdx, group]) => {
            const totalDayMins = group.blocks.reduce((s, b) => s + b.durationMinutes, 0);
            return (
              <div key={dayIdx} className="border border-[#E2E6EE] rounded-xl p-4 bg-[#FAFBFD] flex flex-col">
                <div className="flex items-baseline justify-between pb-3 mb-3 border-b border-[#E2E6EE]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#1D5BFF]" />
                    <h3 className="font-display text-base font-bold text-[#0E1116]">
                      {group.dayLabel}
                    </h3>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#788296]">
                    {group.date} · {totalDayMins}m
                  </span>
                </div>

                <div className="space-y-3">
                  {group.blocks.map((block) => (
                    <div
                      key={block.id}
                      className={`p-3.5 rounded-lg border transition-colors ${
                        block.completed
                          ? 'bg-white/70 border-[#E2E6EE] opacity-75'
                          : 'bg-white border-[#E2E6EE] hover:border-[#CBD4E3]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleBlock(block.id, !block.completed)}
                          aria-label={`Toggle completion for ${block.topic}`}
                          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            block.completed
                              ? 'bg-[#138A57] border-[#138A57] text-white'
                              : 'border-[#CBD4E3] hover:border-[#1D5BFF] bg-white'
                          }`}
                        >
                          {block.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-semibold leading-snug ${
                              block.completed ? 'line-through text-[#788296]' : 'text-[#0E1116]'
                            }`}
                          >
                            {block.topic}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#4E5869]">
                            <span className="font-medium text-[#0E1116]">{block.subject}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{block.blockType}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{block.durationMinutes}m</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                block.priority === 'high'
                                  ? 'text-[#CC2936] font-medium'
                                  : block.priority === 'medium'
                                    ? 'text-[#D9820B]'
                                    : 'text-[#788296]'
                              }
                            >
                              {block.priority === 'high'
                                ? 'High priority'
                                : block.priority === 'medium'
                                  ? 'Medium'
                                  : 'Low'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Motion Analytics Suite */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8">
          <RetentionCurveMotion subjects={profile.subjectMastery} />
        </div>
        <div className="lg:col-span-4 flex">
          <div className="w-full flex flex-col">
            <FocusHourglassMotion
              subjects={profile.subjectMastery.map((s) => s.subject)}
              onLogSession={onLogFocus}
            />
          </div>
        </div>
      </section>

      <section>
        <StudyMomentumChart
          weeklyStudy={profile.weeklyStudy}
          subjectMastery={profile.subjectMastery}
          dailyGoalMinutes={profile.dailyGoalMinutes}
        />
      </section>
    </div>
  );
};
