import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import type { EduMateState } from './types';
import { api } from './lib/api';
import { OverviewWorkspace } from './components/workspaces/OverviewWorkspace';
import { DoubtSolverWorkspace } from './components/workspaces/DoubtSolverWorkspace';
import { NotesQuizWorkspace } from './components/workspaces/NotesQuizWorkspace';
import { PlannerAnalyticsWorkspace } from './components/workspaces/PlannerAnalyticsWorkspace';
import { KnowledgeVaultWorkspace } from './components/workspaces/KnowledgeVaultWorkspace';
import { VoiceSettingsPanel } from './components/VoiceSettingsPanel';

type WorkspaceTab = 'overview' | 'doubt' | 'notes' | 'planner' | 'vault';

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'doubt', label: 'Doubt Solver' },
  { id: 'notes', label: 'Notes & Quiz' },
  { id: 'planner', label: 'Planner' },
  { id: 'vault', label: 'Knowledge Vault' },
];

export default function App() {
  const prefersReduced = useReducedMotion();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [state, setState] = useState<EduMateState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    api
      .getState()
      .then((data) => {
        if (!active) return;
        setState(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load EduMate workspace.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleToggleBlock = async (blockId: string, completed: boolean) => {
    const updated = await api.toggleStudyBlock(blockId, completed);
    setState(updated);
  };

  const handleLogFocus = async (minutes: number, subject: string) => {
    const updated = await api.logFocusSession(minutes, subject);
    setState(updated);
  };

  const handleAskPrompt = (prompt: string) => {
    setPendingPrompt(prompt);
    setActiveTab('doubt');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-[#0E1116]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#E2E6EE]">
        <div className="max-w-[1360px] mx-auto px-5 lg:px-10 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNavigate('overview')}
            className="font-display text-xl font-extrabold tracking-tight text-[#0E1116] whitespace-nowrap shrink-0 cursor-pointer"
          >
            EDUMATE
          </button>

          {/* Zone 2: 5 Concise Single-Line Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Primary workspaces">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'text-[#0E1116] font-semibold' : 'text-[#4E5869] hover:text-[#0E1116]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="edumate-nav-underline"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-0 right-0 -bottom-[21px] h-[2px] bg-[#1D5BFF]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('doubt')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ask a Doubt
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 text-[#0E1116] border border-[#E2E6EE] rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E2E6EE] bg-white px-5 py-3 flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-[#EEF3FF] text-[#1D5BFF] font-semibold'
                    : 'text-[#4E5869] hover:bg-[#F7F8FA]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-5 lg:px-10 py-8">
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-52 bg-white border border-[#E2E6EE] rounded-xl" />
            <div className="grid grid-cols-4 gap-4">
              <div className="h-24 bg-white border border-[#E2E6EE] rounded-xl" />
              <div className="h-24 bg-white border border-[#E2E6EE] rounded-xl" />
              <div className="h-24 bg-white border border-[#E2E6EE] rounded-xl" />
              <div className="h-24 bg-white border border-[#E2E6EE] rounded-xl" />
            </div>
          </div>
        ) : loadError || !state ? (
          <div className="bg-white border border-[#E2E6EE] rounded-xl p-8 text-center space-y-3">
            <h2 className="font-display text-xl font-bold text-[#0E1116]">
              Unable to connect to EduMate backend
            </h2>
            <p className="text-sm text-[#4E5869]">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1D5BFF] rounded-lg cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={prefersReduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'overview' && (
                <OverviewWorkspace
                  state={state}
                  onNavigate={handleNavigate}
                  onToggleBlock={handleToggleBlock}
                  onLogFocus={handleLogFocus}
                  onAskWeakConcept={(concept) =>
                    handleAskPrompt(
                      `Help me master "${concept}" step-by-step using my indexed study notes and give me one quick check question.`
                    )
                  }
                  onOpenVoiceSettings={() => setVoiceSettingsOpen(true)}
                />
              )}

              {activeTab === 'doubt' && (
                <DoubtSolverWorkspace
                  state={state}
                  initialPrompt={pendingPrompt}
                  onConsumeInitialPrompt={() => setPendingPrompt('')}
                  onStateChange={setState}
                />
              )}

              {activeTab === 'notes' && (
                <NotesQuizWorkspace
                  state={state}
                  preselectedMaterialId={selectedMaterialId}
                  onStateChange={setState}
                  onAskDoubtAbout={handleAskPrompt}
                />
              )}

              {activeTab === 'planner' && (
                <PlannerAnalyticsWorkspace
                  state={state}
                  onStateChange={setState}
                  onToggleBlock={handleToggleBlock}
                  onLogFocus={handleLogFocus}
                />
              )}

              {activeTab === 'vault' && (
                <KnowledgeVaultWorkspace
                  state={state}
                  onStateChange={setState}
                  onGenerateNoteFromMaterial={(matId) => {
                    setSelectedMaterialId(matId);
                    handleNavigate('notes');
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E2E6EE] bg-white mt-12">
        <div className="max-w-[1360px] mx-auto px-5 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#788296]">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[#0E1116]">EDUMATE</span>
            <span aria-hidden="true">·</span>
            <span>Learn smarter. Plan better. Stress less.</span>
          </div>
          <div>Team DELTOX · Member: Bhagirath</div>
        </div>
      </footer>

      {state && voiceSettingsOpen && (
        <VoiceSettingsPanel
          state={state}
          onStateChange={setState}
          variant="drawer"
          onClose={() => setVoiceSettingsOpen(false)}
        />
      )}
    </div>
  );
}
