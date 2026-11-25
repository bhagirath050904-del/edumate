import React, { useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import type { EduMateState, RetrievedChunk } from '../../types';

interface LearningLoopMotionProps {
  state: EduMateState;
  activeStage?: 0 | 1 | 2 | 3 | null;
  liveSources?: RetrievedChunk[];
  compact?: boolean;
  onNavigate?: (tab: 'doubt' | 'notes' | 'planner' | 'vault') => void;
}

const STAGES = [
  {
    id: 0,
    index: '01',
    title: 'Student Input',
    shortDesc: 'Question, voice prompt, exam goal, or uploaded notes',
    route: 'vault' as const,
    cta: 'Open Knowledge Vault',
  },
  {
    id: 1,
    index: '02',
    title: 'LLM + RAG Retrieval',
    shortDesc: 'Vector embeddings match your exact syllabus passages',
    route: 'doubt' as const,
    cta: 'Open Doubt Solver',
  },
  {
    id: 2,
    index: '03',
    title: 'Personalised Synthesis',
    shortDesc: 'Tailored explanation, smart note, adaptive quiz, or plan',
    route: 'notes' as const,
    cta: 'Open Notes & Quiz',
  },
  {
    id: 3,
    index: '04',
    title: 'Feedback Loop',
    shortDesc: 'Quiz misses and ratings recalibrate the next session',
    route: 'planner' as const,
    cta: 'Open Study Planner',
  },
];

export const LearningLoopMotion: React.FC<LearningLoopMotionProps> = ({
  state,
  activeStage = null,
  liveSources = [],
  compact = false,
  onNavigate,
}) => {
  const prefersReduced = useReducedMotion();
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const effectiveStage = activeStage !== null ? activeStage : selectedStage;

  const totalChunks = state.materials.reduce((acc, m) => acc + m.chunkCount, 0);
  const embeddedCount = state.materials.filter((m) => m.hasEmbeddings).length;
  const completedBlocks = state.studyPlan.blocks.filter((b) => b.completed).length;
  const totalBlocks = state.studyPlan.blocks.length;

  const stageMetrics: Record<number, { label: string; value: string; detail: string }> = {
    0: {
      label: 'Indexed Vault Materials',
      value: `${state.materials.length} docs · ${totalChunks} passages`,
      detail: `Active language: ${state.profile.preferredLanguage.toUpperCase()} · ${state.doubts.filter((d) => d.role === 'student').length} doubts asked`,
    },
    1: {
      label: 'Semantic Retrieval Engine',
      value: `${embeddedCount}/${state.materials.length} vectorized`,
      detail:
        liveSources.length > 0
          ? `Top cosine match: ${Math.round(liveSources[0].score * 100)}% from "${liveSources[0].materialTitle}"`
          : 'Embeds student notes with Gemini Embedding 2 and ranks top passages before synthesis.',
    },
    2: {
      label: 'Generated Study Assets',
      value: `${state.notes.length} notes · ${state.quizzes.length} quizzes`,
      detail: `${completedBlocks}/${totalBlocks} scheduled study blocks completed toward ${state.studyPlan.goalTitle}.`,
    },
    3: {
      label: 'Adaptive Personalization',
      value: `${state.profile.feedbackHistory.length} feedback signals`,
      detail: `Style: ${state.profile.learningStyle.replace(/_/g, ' ')} · Depth: ${state.profile.explanationDepth} · ${state.profile.weakConcepts.length} weak concepts tracked`,
    },
  };

  return (
    <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-medium text-[#4E5869] mb-1">
            Closed Learning Loop · Clarity → Structure → Confidence
          </p>
          <h3 className="font-display text-lg lg:text-xl font-bold text-[#0E1116] tracking-tight">
            {compact ? 'Live RAG & Personalization Pipeline' : 'How EduMate Turns Study Input into Guided Progress'}
          </h3>
        </div>
        <div className="text-xs font-mono tabular-nums text-[#4E5869]">
          {activeStage !== null ? `Stage 0${activeStage + 1} processing` : `Interactive · Click any stage`}
        </div>
      </div>

      {/* Motion SVG Pipeline Track */}
      <div className="relative mb-5 overflow-hidden">
        <svg
          viewBox="0 0 880 116"
          className="w-full h-auto block"
          role="img"
          aria-label="EduMate four-stage closed learning and RAG retrieval loop"
        >
          {/* Forward backbone */}
          <line x1="95" y1="42" x2="785" y2="42" stroke="#E2E6EE" strokeWidth="2" />
          {/* Feedback return arc from Stage 4 back to Stage 1 */}
          <path
            d="M 785 56 C 785 104, 95 104, 95 56"
            fill="none"
            stroke="#CBD4E3"
            strokeWidth="1.75"
            strokeDasharray="5 5"
          />

          {/* Active forward animated signal trace */}
          {!prefersReduced && (
            <motion.line
              x1="95"
              y1="42"
              x2="785"
              y2="42"
              stroke="#1D5BFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.9 }}
              animate={{
                pathLength: activeStage !== null ? (activeStage + 1) / 4 : 1,
                opacity: 1,
              }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          )}

          {/* Traveling pulse along the forward pipeline */}
          {!prefersReduced && (
            <motion.circle
              r="4.5"
              fill="#1D5BFF"
              cy="42"
              initial={{ cx: 95, opacity: 0 }}
              animate={{ cx: [95, 325, 555, 785], opacity: [0, 1, 1, 0] }}
              transition={{
                duration: activeStage !== null ? 1.8 : 4.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}

          {/* Feedback return pulse along the lower arc */}
          {!prefersReduced && (
            <motion.path
              d="M 785 56 C 785 104, 95 104, 95 56"
              fill="none"
              stroke="#D9820B"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, pathOffset: 0 }}
              animate={{ pathLength: [0.05, 0.22, 0.05], pathOffset: [0, 0.8, 1] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* Feedback return label */}
          <text
            x="440"
            y="108"
            textAnchor="middle"
            className="fill-[#788296] text-[11px] font-mono"
          >
            Feedback recalibrates depth, analogies &amp; revision priority
          </text>

          {/* 4 Interactive Stage Nodes */}
          {STAGES.map((stage, idx) => {
            const x = 95 + idx * 230;
            const isSelected = effectiveStage === idx;
            const isPassed = activeStage !== null && idx <= activeStage;

            return (
              <g
                key={stage.id}
                onClick={() => setSelectedStage(idx)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedStage(idx);
                  }
                }}
              >
                {isSelected && !prefersReduced && (
                  <motion.circle
                    cx={x}
                    cy={42}
                    r={25}
                    fill="none"
                    stroke="#1D5BFF"
                    strokeOpacity={0.22}
                    strokeWidth={2}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1.08, opacity: 1 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                <circle
                  cx={x}
                  cy={42}
                  r={18}
                  fill={isSelected || isPassed ? '#1D5BFF' : '#FFFFFF'}
                  stroke={isSelected || isPassed ? '#1D5BFF' : '#CBD4E3'}
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y={46}
                  textAnchor="middle"
                  className={`text-[11px] font-mono font-semibold ${
                    isSelected || isPassed ? 'fill-white' : 'fill-[#0E1116]'
                  }`}
                >
                  {stage.index}
                </text>
                <text
                  x={x}
                  y={16}
                  textAnchor="middle"
                  className={`text-[12px] font-semibold ${
                    isSelected ? 'fill-[#0E1116]' : 'fill-[#4E5869]'
                  }`}
                >
                  {stage.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stage Inspector Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveStage}
          initial={prefersReduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="pt-4 border-t border-[#E2E6EE] flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1 max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#4E5869]">
              <span className="font-mono font-medium text-[#1D5BFF]">
                Stage {STAGES[effectiveStage].index}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#0E1116]">{stageMetrics[effectiveStage].label}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#0E1116]">{stageMetrics[effectiveStage].value}</span>
            </div>
            <p className="text-sm text-[#4E5869] leading-relaxed">
              {stageMetrics[effectiveStage].detail}
            </p>
          </div>

          {onNavigate && !compact && (
            <button
              type="button"
              onClick={() => onNavigate(STAGES[effectiveStage].route)}
              className="px-4 py-2 text-xs font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {STAGES[effectiveStage].cta}
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Live retrieved chunk bars when inside Doubt Solver */}
      {liveSources.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#E2E6EE] space-y-2.5">
          <p className="text-xs font-medium text-[#4E5869]">
            Retrieved Knowledge Vault Passages ({liveSources.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {liveSources.map((src, idx) => (
              <motion.div
                key={`${src.materialId}-${idx}`}
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.25 }}
                className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E2E6EE]"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[#0E1116] truncate">
                    {src.materialTitle}
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#1D5BFF] shrink-0">
                    {Math.round(src.score * 100)}%
                  </span>
                </div>
                <div className="h-1 w-full bg-[#E2E6EE] rounded-full overflow-hidden mb-2">
                  <motion.div
                    className="h-full bg-[#1D5BFF]"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: Math.min(1, src.score) }}
                    style={{ transformOrigin: 'left' }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="text-xs text-[#4E5869] line-clamp-2 leading-relaxed">{src.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
