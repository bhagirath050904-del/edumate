import React, { useRef, useState } from 'react';
import { FileText, Trash2, Upload, UserCheck } from 'lucide-react';
import type {
  EduMateState,
  ExplanationDepth,
  LanguageCode,
  LearningStyle,
} from '../../types';
import { SUPPORTED_LANGUAGES } from '../../types';
import { api } from '../../lib/api';
import { VoiceSettingsPanel } from '../VoiceSettingsPanel';

interface KnowledgeVaultWorkspaceProps {
  state: EduMateState;
  onStateChange: (next: EduMateState) => void;
  onGenerateNoteFromMaterial: (materialId: string) => void;
}

export const KnowledgeVaultWorkspace: React.FC<KnowledgeVaultWorkspaceProps> = ({
  state,
  onStateChange,
  onGenerateNoteFromMaterial,
}) => {
  // Material ingestion form
  const [title, setTitle] = useState<string>('');
  const [subject, setSubject] = useState<string>('Physics');
  const [content, setContent] = useState<string>('');
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(state.materials[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile personalization form
  const [name, setName] = useState<string>(state.profile.name);
  const [program, setProgram] = useState<string>(state.profile.program);
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>(
    state.profile.preferredLanguage
  );
  const [learningStyle, setLearningStyle] = useState<LearningStyle>(state.profile.learningStyle);
  const [explanationDepth, setExplanationDepth] = useState<ExplanationDepth>(
    state.profile.explanationDepth
  );
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(state.profile.dailyGoalMinutes);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      setError('Please select a text or markdown note file under 200 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setContent(text.slice(0, 38000));
      if (!title.trim()) {
        setTitle(file.name.replace(/\.(txt|md)$/i, ''));
      }
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    setIngesting(true);
    try {
      const res = await api.addMaterial({
        title: title.trim(),
        subject: subject.trim(),
        content: content.trim(),
      });
      onStateChange(res.state);
      setTitle('');
      setContent('');
      setExpandedId(res.materialId);
      setStatusMessage('Study material indexed and vectorized for RAG retrieval.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to index material.');
    } finally {
      setIngesting(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    setError(null);
    try {
      const updated = await api.deleteMaterial(id);
      onStateChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete material.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      const updated = await api.updateProfile({
        name: name.trim(),
        program: program.trim(),
        preferredLanguage,
        learningStyle,
        explanationDepth,
        dailyGoalMinutes,
      });
      onStateChange(updated);
      setStatusMessage('Student personalization profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-[#E2E6EE] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4E5869]">
            RAG Knowledge Vault &amp; Personalization Profile
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0E1116] tracking-tight">
            Ground Every Answer in Your Exact Course Material
          </h1>
        </div>
        <div className="text-xs font-mono tabular-nums text-[#4E5869]">
          {state.materials.length} documents ·{' '}
          {state.materials.reduce((s, m) => s + m.chunkCount, 0)} semantic chunks
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2.5 rounded-lg bg-[#EDF9F2] border border-[#138A57]/30 text-xs font-medium text-[#138A57]">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-[#FDF2F3] border border-[#CC2936]/30 text-xs font-medium text-[#CC2936]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Upload + Vault Ledger */}
        <div className="lg:col-span-7 space-y-6">
          {/* Add Material Form */}
          <form
            onSubmit={handleAddMaterial}
            className="bg-white border border-[#E2E6EE] rounded-xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-[#0E1116]">
                Index New Lecture Notes or Syllabus
              </h2>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0E1116] bg-[#F7F8FA] hover:bg-[#EEF3FF] hover:text-[#1D5BFF] border border-[#E2E6EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import .txt / .md</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title (e.g., Wave Optics Lecture 4)"
                className="sm:col-span-2 px-3.5 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
              />
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="px-3.5 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
              />
            </div>

            <textarea
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste lecture transcripts, chapter summaries, or key definitions (minimum 30 characters). EduMate chunks and embeds this text for semantic RAG retrieval..."
              className="w-full px-3.5 py-2.5 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116] leading-relaxed"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-mono tabular-nums text-[#788296]">
                {content.trim() ? content.trim().split(/\s+/).length : 0} words ready
              </span>
              <button
                type="submit"
                disabled={ingesting || content.trim().length < 30 || !title.trim()}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1D5BFF] hover:bg-[#1545CC] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {ingesting ? 'Chunking & Embedding...' : 'Add to Knowledge Vault'}
              </button>
            </div>
          </form>

          {/* Indexed Materials Table */}
          <div className="bg-white border border-[#E2E6EE] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E6EE] flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#0E1116]">
                Indexed Course Materials
              </h2>
              <span className="text-xs text-[#788296]">Used automatically by RAG Doubt Solver</span>
            </div>

            <div className="divide-y divide-[#EEF1F6]">
              {state.materials.map((mat) => {
                const isOpen = expandedId === mat.id;
                return (
                  <div key={mat.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : mat.id)}
                        className="text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#1D5BFF] shrink-0" />
                          <h3 className="font-display text-base font-bold text-[#0E1116] truncate">
                            {mat.title}
                          </h3>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#788296]">
                          <span className="font-medium text-[#4E5869]">{mat.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{mat.wordCount} words</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{mat.chunkCount} chunks</span>
                          <span aria-hidden="true">·</span>
                          <span className={mat.hasEmbeddings ? 'text-[#138A57]' : 'text-[#4E5869]'}>
                            {mat.hasEmbeddings ? 'Vector embeddings ready' : 'Auto-embeds on query'}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onGenerateNoteFromMaterial(mat.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#1D5BFF] bg-[#EEF3FF] hover:bg-[#DCE6FF] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Open in Notes
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaterial(mat.id)}
                          aria-label={`Delete ${mat.title}`}
                          className="p-1.5 text-[#788296] hover:text-[#CC2936] rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-4 pt-3 border-t border-[#EEF1F6] text-xs text-[#4E5869] leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
                        {mat.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Student Personalization & Feedback Log */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-[#E2E6EE] rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#1D5BFF]" />
              <h2 className="font-display text-lg font-bold text-[#0E1116]">
                Student Personalization Profile
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="student-name" className="block text-xs font-medium text-[#4E5869] mb-1">
                  Student Name
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
                />
              </div>

              <div>
                <label htmlFor="student-program" className="block text-xs font-medium text-[#4E5869] mb-1">
                  Academic Track / Program
                </label>
                <input
                  id="student-program"
                  type="text"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
                />
              </div>

              <div>
                <label htmlFor="pref-lang" className="block text-xs font-medium text-[#4E5869] mb-1">
                  Default Language (Text &amp; Voice)
                </label>
                <select
                  id="pref-lang"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label} ({l.nativeLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pref-style" className="block text-xs font-medium text-[#4E5869] mb-1">
                    Learning Style
                  </label>
                  <select
                    id="pref-style"
                    value={learningStyle}
                    onChange={(e) => setLearningStyle(e.target.value as LearningStyle)}
                    className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
                  >
                    <option value="visual_analogies">Visual Analogies</option>
                    <option value="step_by_step">Step-by-Step Proofs</option>
                    <option value="concise_exam">Concise Exam Recall</option>
                    <option value="socratic">Socratic Guidance</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="pref-depth" className="block text-xs font-medium text-[#4E5869] mb-1">
                    Explanation Depth
                  </label>
                  <select
                    id="pref-depth"
                    value={explanationDepth}
                    onChange={(e) => setExplanationDepth(e.target.value as ExplanationDepth)}
                    className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-[#E2E6EE] rounded-lg text-[#0E1116]"
                  >
                    <option value="foundational">Foundational</option>
                    <option value="balanced">Balanced University</option>
                    <option value="rigorous">Rigorous / Formal</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="daily-goal" className="block text-xs font-medium text-[#4E5869] mb-1">
                  Daily Study Target:{' '}
                  <strong className="font-mono tabular-nums text-[#0E1116]">{dailyGoalMinutes} min</strong>
                </label>
                <input
                  id="daily-goal"
                  type="range"
                  min={45}
                  max={360}
                  step={15}
                  value={dailyGoalMinutes}
                  onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
                  className="w-full accent-[#1D5BFF] cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-2.5 text-xs font-semibold text-white bg-[#0E1116] hover:bg-[#1D5BFF] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? 'Saving Profile...' : 'Save Personalization Settings'}
            </button>
          </form>

          {/* Closed-Loop Feedback History Ledger */}
          <div className="bg-white border border-[#E2E6EE] rounded-xl p-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-base font-bold text-[#0E1116]">
                Feedback Calibration Log
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#788296]">
                {state.profile.feedbackHistory.length} signals
              </span>
            </div>

            {state.profile.feedbackHistory.length === 0 ? (
              <p className="text-xs text-[#788296]">
                Rate explanations in the Doubt Solver to calibrate EduMate to your pace.
              </p>
            ) : (
              <div className="divide-y divide-[#EEF1F6]">
                {[...state.profile.feedbackHistory].reverse().slice(0, 5).map((fb) => (
                  <div key={fb.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#0E1116] capitalize">
                        {fb.signal.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-[#788296]">{fb.module}</span>
                    </div>
                    {fb.detail && <p className="text-xs text-[#4E5869] mt-0.5">{fb.detail}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Multilingual Voice Assistant Settings Panel */}
      <VoiceSettingsPanel
        state={state}
        onStateChange={onStateChange}
        variant="embedded"
      />
    </div>
  );
};
