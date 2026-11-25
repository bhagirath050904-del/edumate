import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowRight, BookOpen, Calendar, CheckCircle2, Clock, MessageSquareText, Mic } from 'lucide-react';
import type { EduMateState } from '../../types';
import { LearningLoopMotion } from '../visualizations/LearningLoopMotion';
import { RetentionCurveMotion } from '../visualizations/RetentionCurveMotion';
import { FocusHourglassMotion } from '../visualizations/FocusHourglassMotion';
import { StudyMomentumChart } from '../visualizations/StudyMomentumChart';
import { SubjectGoalRings } from '../visualizations/SubjectGoalRings';
import { StudyStreakTracker } from '../visualizations/StudyStreakTracker';
import { QuickLogModal } from '../QuickLogModal';

type WorkspaceTab = 'overview' | 'doubt' | 'notes' | 'planner' | 'vault';

interface OverviewWorkspaceProps {
  state: EduMateState;
  onNavigate: (tab: WorkspaceTab) => void;
  onToggleBlock: (blockId: string, completed: boolean) => Promise<void>;
  onLogFocus: (minutes: number, subject: string) => Promise<void>;
  onAskWeakConcept: (concept: string) => void;
  onOpenVoiceSettings: () => void;
}

export const OverviewWorkspace: React.FC<OverviewWorkspaceProps> = ({
  state,
  onNavigate,
  onToggleBlock,
  onLogFocus,
  onAskWeakConcept,
  onOpenVoiceSettings,
}) => {
  const { profile, materials, notes, quizzes, studyPlan } = state;
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  const availableSubjects = useMemo(() => {
    const merged = [
      ...profile.subjectMastery.map((s) => s.subject),
      ...studyPlan.subjects,
      ...materials.map((m) => m.subject),
    ];
    const unique = Array.from(new Set(merged.filter(Boolean)));
    return unique.length > 0 ? unique : ['Physics', 'Linear Algebra', 'Computer Science', 'Biology'];
  }, [profile.subjectMastery, studyPlan.subjects, materials]);

  const daysToExam = Math.max(
    0,
    Math.ceil((new Date(studyPlan.examDate).getTime() - Date.now()) / 86400000)
  );
  const completedBlocks = studyPlan.blocks.filter((b) => b.completed).length;
  const avgMastery =
    profile.subjectMastery.length > 0
      ? Math.round(
          profile.subjectMastery.reduce((sum, s) => sum + s.mastery, 0) /
            profile.subjectMastery.length
        )
      : 0;
  const totalChunks = materials.reduce((sum, m) => sum + m.chunkCount, 0);
  const todayBlocks = studyPlan.blocks.filter((b) => b.dayIndex === 0);
  const focusHours = Math.floor(profile.focusMinutesLogged / 60);
  const focusRemMins = profile.focusMinutesLogged % 60;

  return (
    <div className="space-y-8">
      {/* Editorial Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-[#E2E6EE] rounded-xl p-6 lg:p-8 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#4E5869] mb-3">
              <span className="font-semibold text-[#1D5BFF]">Guided Student Workspace</span>
              <span aria-hidden="true">·</span>
              <span>{profile.program}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{daysToExam} days until target exam</span>
            </div>

            <h1 className="font-display text-3xl lg:text-[40px] font-extrabold text-[#0E1116] tracking-tight leading-[1.1] max-w-xl">
              Learn smarter. Plan better. Stress less.
            </h1>

            <p className="mt-3.5 text-[15px] text-[#4E5869] leading-relaxed max-w-xl">
              Welcome back, {profile.name}. Your study materials, RAG doubt solver, revision quizzes,
              and exam schedule stay connected in a single feedback loop so every session targets what
              matters next.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-[#E2E6EE] flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('doubt')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <MessageSquareText className="w-4 h-4" />
              <span>Solve a Doubt</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('notes')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Notes &amp; Quiz</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Adaptive Plan</span>
            </button>
            <button
              type="button"
              onClick={() => setQuickLogOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>Quick Log</span>
            </button>
          </div>
        </div>

        {/* Today's Guided Queue */}
        <div className="lg:col-span-5 bg-white border border-[#E2E6EE] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-4">
              <div>
                <p className="text-xs font-medium text-[#4E5869]">Today&apos;s Guided Queue</p>
                <h2 className="font-display text-lg font-bold text-[#0E1116] tracking-tight">
                  {studyPlan.goalTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="text-xs font-semibold text-[#1D5BFF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Full plan
              </button>
            </div>

            {todayBlocks.length === 0 ? (
              <p className="text-sm text-[#4E5869] py-6">
                No blocks scheduled for today yet. Generate a fresh plan in the Study Planner.
              </p>
            ) : (
              <div className="divide-y divide-[#EEF1F6]">
                {todayBlocks.map((block) => (
                  <div key={block.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleBlock(block.id, !block.completed)}
                      aria-label={`Mark ${block.topic} as ${block.completed ? 'incomplete' : 'complete'}`}
                      className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        block.completed
                          ? 'bg-[#138A57] border-[#138A57] text-white'
                          : 'border-[#CBD4E3] hover:border-[#1D5BFF] bg-white'
                      }`}
                    >
                      {block.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium leading-snug ${
                          block.completed ? 'line-through text-[#788296]' : 'text-[#0E1116]'
                        }`}
                      >
                        {block.topic}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#788296]">
                        <span>{block.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{block.blockType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{block.durationMinutes} min</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {profile.weakConcepts.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#E2E6EE]">
              <p className="text-xs font-medium text-[#4E5869] mb-2">
                Priority concepts flagged by your recent quizzes
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.weakConcepts.slice(0, 3).map((concept) => (
                  <button
                    key={concept}
                    type="button"
                    onClick={() => onAskWeakConcept(concept)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-md transition-colors cursor-pointer"
                  >
                    <span>Revise: {concept}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Full-Width 4-Column KPI Ledger */}
      <section className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#E2E6EE] rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-[#E2E6EE]">
        <div className="p-5">
          <p className="text-xs font-medium text-[#4E5869]">Exam Countdown</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-[#0E1116]">
            {daysToExam} days
          </p>
          <p className="mt-1 text-xs text-[#788296] font-mono tabular-nums">
            {completedBlocks}/{studyPlan.blocks.length} plan blocks done
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-[#4E5869]">Average Mastery</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-[#1D5BFF]">
            {avgMastery}%
          </p>
          <p className="mt-1 text-xs text-[#788296] font-mono tabular-nums">
            Across {profile.subjectMastery.length} active subjects
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-[#4E5869]">Focus Logged</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-[#0E1116]">
            {focusHours}h {focusRemMins}m
          </p>
          <p className="mt-1 text-xs text-[#788296] font-mono tabular-nums">
            {profile.streakDays}-day steady streak
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-[#4E5869]">Knowledge Vault</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-[#0E1116]">
            {materials.length} sources
          </p>
          <p className="mt-1 text-xs text-[#788296] font-mono tabular-nums">
            {totalChunks} RAG chunks · {notes.length} notes · {quizzes.length} quizzes
          </p>
        </div>
      </section>

      {/* Study Streak Tracker with Animated Flame */}
      <section>
        <StudyStreakTracker
          streakDays={profile.streakDays}
          weeklyStudy={profile.weeklyStudy}
          dailyGoalMinutes={profile.dailyGoalMinutes}
          defaultSubject={profile.subjectMastery[0]?.subject ?? 'Physics'}
          onQuickLogFocus={onLogFocus}
        />
      </section>

      {/* Subject Study Goal Circular Progress Indicators */}
      <section>
        <SubjectGoalRings
          subjects={profile.subjectMastery}
          planBlocks={studyPlan.blocks}
          dailyGoalMinutes={profile.dailyGoalMinutes}
          onSelectSubject={() => onNavigate('planner')}
        />
      </section>

      {/* Motion Visualization 1: Closed Learning Loop & RAG Architecture */}
      <section>
        <LearningLoopMotion
          state={state}
          onNavigate={(route) => onNavigate(route)}
        />
      </section>

      {/* Motion Visualization 2 & 3: Retention Curve + Focus Hourglass */}
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

      {/* Motion Visualization 4: Weekly Momentum & Subject Mastery */}
      <section>
        <StudyMomentumChart
          weeklyStudy={profile.weeklyStudy}
          subjectMastery={profile.subjectMastery}
          dailyGoalMinutes={profile.dailyGoalMinutes}
        />
      </section>

      {/* Four Toolkit Quick-Access Strip (Matching Slide 4) */}
      <section className="bg-white border border-[#E2E6EE] rounded-xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
          <div>
            <p className="text-xs font-medium text-[#4E5869]">The EduMate Toolkit</p>
            <h2 className="font-display text-xl font-bold text-[#0E1116] tracking-tight">
              Everything Students Need to Move Forward
            </h2>
          </div>
          <span className="text-xs text-[#788296]">One unified student experience</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E6EE]">
          {[
            {
              index: '01',
              title: 'AI Doubt Solver',
              desc: 'Ask questions grounded directly in your indexed syllabus notes with transparent RAG citations.',
              action: () => onNavigate('doubt'),
              icon: MessageSquareText,
            },
            {
              index: '02',
              title: 'Smart Notes & Quiz',
              desc: 'Synthesize exam-ready concept sheets, analogies, and adaptive recall quizzes in seconds.',
              action: () => onNavigate('notes'),
              icon: BookOpen,
            },
            {
              index: '03',
              title: 'Planner & Analytics',
              desc: 'Turn exam dates and weak topics into calm daily blocks with retention simulations.',
              action: () => onNavigate('planner'),
              icon: Calendar,
            },
            {
              index: '04',
              title: 'Voice & Multilingual',
              desc: `${profile.voicePreferences.enabledLanguages.length} active languages · ${profile.voicePreferences.playbackSpeed.toFixed(2)}x speed · ${profile.voicePreferences.voicePitch} pitch (${profile.voicePreferences.voicePersona}).`,
              action: onOpenVoiceSettings,
              icon: Mic,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.index}
                type="button"
                onClick={item.action}
                className="text-left p-4 first:pl-0 last:pr-0 sm:px-5 hover:bg-[#F7F8FA] transition-colors flex flex-col justify-between gap-3 cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-[#1D5BFF] mb-2">
                    <span>{item.index}</span>
                    <Icon className="w-4 h-4 text-[#4E5869] group-hover:text-[#1D5BFF] transition-colors" />
                  </div>
                  <h3 className="font-display text-base font-bold text-[#0E1116] group-hover:text-[#1D5BFF] transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-[#4E5869] leading-relaxed">{item.desc}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D5BFF]">
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <AnimatePresence>
        {quickLogOpen && (
          <QuickLogModal
            subjects={availableSubjects}
            onClose={() => setQuickLogOpen(false)}
            onLogSession={onLogFocus}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
