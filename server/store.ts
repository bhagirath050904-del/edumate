import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  DoubtMessage,
  EduMateState,
  MaterialChunk,
  QuizSet,
  SmartNote,
  StudentProfile,
  StudyMaterial,
  StudyMaterialInternal,
  StudyPlan,
} from '../src/types.ts';

interface PersistedStore {
  profile: StudentProfile;
  materials: StudyMaterialInternal[];
  doubts: DoubtMessage[];
  notes: SmartNote[];
  quizzes: QuizSet[];
  studyPlan: StudyPlan;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'edumate-store.json');

export function chunkText(text: string, maxChars = 480, overlap = 80): MaterialChunk[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: MaterialChunk[] = [];
  let buffer = '';

  const flush = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    chunks.push({
      id: `chk_${crypto.randomBytes(4).toString('hex')}`,
      text: trimmed,
    });
  };

  for (const para of paragraphs) {
    if ((buffer + '\n\n' + para).length <= maxChars) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      if (buffer) {
        flush(buffer);
        const tail = buffer.slice(Math.max(0, buffer.length - overlap));
        buffer = tail ? `${tail} ${para}` : para;
      } else {
        buffer = para;
      }
      while (buffer.length > maxChars) {
        flush(buffer.slice(0, maxChars));
        buffer = buffer.slice(maxChars - overlap);
      }
    }
  }
  if (buffer) flush(buffer);

  return chunks;
}

function buildMaterial(
  id: string,
  title: string,
  subject: string,
  content: string,
  createdAt: string
): StudyMaterialInternal {
  const chunks = chunkText(content);
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return {
    id,
    title,
    subject,
    content,
    createdAt,
    wordCount,
    chunkCount: chunks.length,
    hasEmbeddings: false,
    chunks,
  };
}

function createInitialStore(): PersistedStore {
  const now = new Date();
  const iso = (daysAgo: number) => {
    const d = new Date(now.getTime() - daysAgo * 86400000);
    return d.toISOString();
  };
  const futureDate = (daysAhead: number) => {
    const d = new Date(now.getTime() + daysAhead * 86400000);
    return d.toISOString().slice(0, 10);
  };

  const materials: StudyMaterialInternal[] = [
    buildMaterial(
      'mat_thermo_01',
      'Laws of Thermodynamics & Entropy Cycles',
      'Physics',
      `First Law of Thermodynamics: Energy cannot be created or destroyed; the change in internal energy of a closed system equals the heat supplied minus the work done by the system: ΔU = Q - W. For an isothermal process in an ideal gas, ΔU = 0 so Q = W. For an adiabatic process, Q = 0 so ΔU = -W.

Second Law of Thermodynamics & Entropy: In any spontaneous natural process, the total entropy of an isolated system always increases (ΔS_universe >= 0). Entropy change for a reversible heat transfer is ΔS = ∫ dQ_rev / T. Heat never spontaneously flows from a colder reservoir to a hotter reservoir without external work.

Carnot Cycle Efficiency: A Carnot engine operates reversibly between a hot reservoir at temperature T_H and a cold reservoir at T_C (in Kelvin). Its maximum theoretical efficiency is η = 1 - (T_C / T_H). No real heat engine operating between the same two temperatures can exceed Carnot efficiency because real cycles involve friction and irreversible heat transfer across finite temperature gradients.

Gibbs Free Energy: At constant temperature and pressure, spontaneity is determined by ΔG = ΔH - TΔS. A reaction or process is spontaneous when ΔG < 0, at equilibrium when ΔG = 0, and non-spontaneous when ΔG > 0.`,
      iso(5)
    ),
    buildMaterial(
      'mat_linalg_02',
      'Eigenvalues, Eigenvectors & Spectral Decomposition',
      'Linear Algebra',
      `Definition: For a square n×n matrix A, a nonzero vector v is an eigenvector with eigenvalue λ if Av = λv. Geometrically, matrix A stretches or flips vector v along its own span without rotating it off its line of action.

Characteristic Polynomial: Rewriting Av = λv gives (A - λI)v = 0. Nonzero solutions exist if and only if det(A - λI) = 0. The roots of this characteristic polynomial are the eigenvalues of A. The sum of eigenvalues equals the trace tr(A), and the product of eigenvalues equals det(A).

Diagonalization & Powers of Matrices: If A has n linearly independent eigenvectors placed as columns of P, and D is the diagonal matrix of corresponding eigenvalues, then A = P D P⁻¹. Computing A^k simplifies dramatically to P D^k P⁻¹, which is essential in Markov chains, dynamical systems, and PageRank.

Spectral Theorem for Symmetric Matrices: Every real symmetric matrix (A = Aᵀ) has strictly real eigenvalues and an orthonormal basis of eigenvectors, yielding A = Q Λ Qᵀ where Q is orthogonal (Q⁻¹ = Qᵀ). Principal Component Analysis (PCA) applies this theorem directly to the covariance matrix to find orthogonal directions of maximum variance.`,
      iso(3)
    ),
    buildMaterial(
      'mat_os_03',
      'CPU Scheduling, Deadlocks & Virtual Memory',
      'Computer Science',
      `CPU Scheduling Algorithms: Operating systems balance throughput, turnaround time, waiting time, and response time. Shortest Job First (SJF) minimizes average waiting time but risks starvation of long processes. Round Robin (RR) assigns a fixed time quantum q to guarantee fair response times in interactive systems; if q is too small, context-switch overhead dominates; if q is too large, RR degrades into First-Come First-Served (FCFS).

Four Coffman Conditions for Deadlock: A deadlock can only occur if all four hold simultaneously: (1) Mutual Exclusion, (2) Hold and Wait, (3) No Preemption, and (4) Circular Wait. Breaking any single condition prevents deadlock—for example, imposing a strict global ordering on resource lock acquisition eliminates Circular Wait.

Banker's Algorithm (Deadlock Avoidance): Before granting a resource request, the OS checks whether the resulting state remains "safe"—meaning there exists at least one safe execution sequence where every process can obtain its maximum declared resources and terminate.

Virtual Memory & Page Replacement: Paging separates logical addresses from physical frames. When a referenced page is absent from RAM, a page fault triggers disk fetch. Least Recently Used (LRU) approximates Belady's optimal algorithm by exploiting temporal locality, whereas FIFO can suffer from Belady's Anomaly where adding more frames increases page faults.`,
      iso(2)
    ),
    buildMaterial(
      'mat_bio_04',
      'Cellular Respiration & ATP Yield Pathways',
      'Biology',
      `Overview of Aerobic Respiration: Cells oxidize glucose (C6H12O6) across four coupled stages: Glycolysis (cytoplasm), Pyruvate Oxidation (mitochondrial matrix), Citric Acid / Krebs Cycle (matrix), and Oxidative Phosphorylation (inner mitochondrial membrane).

Glycolysis: Splits one 6-carbon glucose into two 3-carbon pyruvate molecules. Consumes 2 ATP in the investment phase and produces 4 ATP in the payoff phase, giving a net yield of 2 ATP and 2 NADH per glucose. Glycolysis requires no oxygen and feeds anaerobic fermentation when O2 is absent.

Citric Acid Cycle: Each acetyl-CoA (two per glucose) enters the cycle, releasing CO2 and generating 3 NADH, 1 FADH2, and 1 GTP/ATP per turn (so 6 NADH, 2 FADH2, 2 ATP per glucose).

Electron Transport Chain & Chemiosmosis: NADH and FADH2 donate high-energy electrons to Complexes I–IV, pumping protons (H⁺) into the intermembrane space to establish an electrochemical proton-motive gradient. Oxygen acts as the final electron acceptor, forming water. Protons flow back through ATP synthase to synthesize approximately 26–28 ATP, bringing total aerobic yield to roughly 30–32 ATP per glucose.`,
      iso(1)
    ),
  ];

  const notes: SmartNote[] = [
    {
      id: 'note_thermo_01',
      title: 'Carnot Efficiency & Entropy Intuition',
      subject: 'Physics',
      language: 'en',
      sourceMaterialId: 'mat_thermo_01',
      summary:
        'Heat engines convert thermal energy into mechanical work by operating between two temperature reservoirs. Even an idealized frictionless engine cannot convert 100% of heat into work because some heat must be rejected to keep total entropy from decreasing.',
      keyConcepts: [
        {
          term: 'Carnot Efficiency (η)',
          definition: 'The strict upper bound on heat engine efficiency determined solely by Kelvin reservoir temperatures: η = 1 - T_C / T_H.',
          analogy: 'Like a waterwheel: you can only extract work from the height drop between upper and lower water levels, never from the flat pond below.',
        },
        {
          term: 'Entropy (ΔS)',
          definition: 'A state function quantifying energy dispersal and microscopic multiplicity; total entropy of an isolated system never decreases.',
          analogy: 'Dropping ink into water spreads naturally across countless configurations, while spontaneously re-gathering into one droplet never happens.',
        },
        {
          term: 'Gibbs Free Energy (ΔG)',
          definition: 'Combines enthalpy and entropy (ΔG = ΔH - TΔS) to predict spontaneity at constant temperature and pressure.',
          analogy: 'A net budget check: enthalpy is the direct cash cost, while TΔS is the freedom bonus you gain from spreading energy out.',
        },
      ],
      formulasOrRules: [
        'ΔU = Q - W (First Law of Thermodynamics)',
        'η_Carnot = 1 - (T_C / T_H)  [Temperatures strictly in Kelvin]',
        'ΔS_rev = ∫ dQ_rev / T  and  ΔS_universe >= 0',
        'ΔG = ΔH - TΔS  (< 0 implies spontaneous process)',
      ],
      memoryAnchors: [
        'Always convert Celsius to Kelvin (+273.15) before plugging into η = 1 - T_C / T_H.',
        'Isothermal ideal gas → ΔT = 0 → ΔU = 0 → all heat absorbed becomes work (Q = W).',
      ],
      commonPitfalls: [
        'Using °C instead of Kelvin in the Carnot ratio — this produces wildly wrong efficiencies.',
        'Confusing ΔS_system < 0 with a violation of the Second Law; local entropy can drop if surroundings gain more entropy.',
      ],
      createdAt: iso(2),
      masteryScore: 78,
      lastReviewedAt: iso(1),
    },
    {
      id: 'note_os_02',
      title: 'Deadlock Prevention & Scheduling Trade-offs',
      subject: 'Computer Science',
      language: 'en',
      sourceMaterialId: 'mat_os_03',
      summary:
        'Operating systems juggle responsiveness against throughput in CPU scheduling and must either prevent or avoid circular waits when multiple threads compete for exclusive locks.',
      keyConcepts: [
        {
          term: 'Round Robin Quantum (q)',
          definition: 'The fixed CPU slice allocated to each ready process before preemption.',
          analogy: 'A fair kitchen timer shared among chefs: too short and everyone spends all day swapping stations; too long and late orders burn.',
        },
        {
          term: 'Coffman Conditions',
          definition: 'The four necessary conditions for deadlock: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.',
          analogy: 'A four-way traffic gridlock where every car blocks the next intersection and refuses to reverse.',
        },
      ],
      formulasOrRules: [
        'Turnaround Time = Completion Time - Arrival Time',
        'Waiting Time = Turnaround Time - Burst Time',
        'Lock Ordering Rule: Acquire lock(i) before lock(j) whenever i < j to break Circular Wait',
      ],
      memoryAnchors: [
        'M-H-N-C: Mutual exclusion, Hold & wait, No preemption, Circular wait.',
        'LRU follows temporal locality; FIFO can fail with Belady’s Anomaly.',
      ],
      commonPitfalls: [
        'Assuming Shortest Job First works well without knowing burst lengths in advance — OS kernels approximate it with exponential averaging.',
        'Thinking Banker’s Algorithm prevents deadlock; it actually performs dynamic deadlock avoidance using declared maxima.',
      ],
      createdAt: iso(1),
      masteryScore: 84,
      lastReviewedAt: iso(0),
    },
  ];

  const quizzes: QuizSet[] = [
    {
      id: 'quiz_thermo_01',
      title: 'Thermodynamics & Entropy Checkpoint',
      subject: 'Physics',
      language: 'en',
      sourceMaterialId: 'mat_thermo_01',
      createdAt: iso(2),
      questions: [
        {
          id: 'q1',
          question: 'A reversible Carnot engine operates between 600 K and 300 K. What is its maximum theoretical efficiency?',
          options: ['25%', '50%', '66.7%', '100%'],
          correctIndex: 1,
          explanation: 'Using η = 1 - (T_C / T_H) = 1 - (300 / 600) = 0.50, or 50%. Both temperatures are already in Kelvin.',
          conceptTag: 'Carnot Efficiency',
          difficulty: 'foundation',
        },
        {
          id: 'q2',
          question: 'During an adiabatic compression of an ideal gas (Q = 0), what happens to the internal energy ΔU?',
          options: [
            'ΔU stays zero because heat transfer is zero',
            'ΔU decreases because the gas loses heat',
            'ΔU increases because work done on the gas raises its temperature',
            'ΔU oscillates depending on pressure only',
          ],
          correctIndex: 2,
          explanation: 'From ΔU = Q - W with Q = 0, compressing the gas means work done by the gas W is negative, so ΔU = -W > 0.',
          conceptTag: 'Adiabatic Processes',
          difficulty: 'applied',
        },
        {
          id: 'q3',
          question: 'Which condition guarantees a chemical process is spontaneous at constant temperature and pressure?',
          options: ['ΔH > 0 and ΔS < 0', 'ΔG < 0', 'ΔS_system = 0', 'ΔG > 0'],
          correctIndex: 1,
          explanation: 'Gibbs free energy ΔG = ΔH - TΔS determines spontaneity at constant T and P; ΔG < 0 means spontaneous.',
          conceptTag: 'Gibbs Free Energy',
          difficulty: 'foundation',
        },
      ],
      attempts: [
        {
          id: 'att_01',
          date: iso(2),
          score: 2,
          total: 3,
          weakConcepts: ['Adiabatic Processes'],
        },
      ],
    },
  ];

  const studyPlan: StudyPlan = {
    id: 'plan_midterm_01',
    goalTitle: 'Midterm Examinations — Core STEM Track',
    examDate: futureDate(12),
    dailyHours: 3.5,
    subjects: ['Physics', 'Linear Algebra', 'Computer Science', 'Biology'],
    strategySummary:
      'Front-loads high-leverage weak concepts (Adiabatic Processes, Spectral Decomposition) in morning deep-work blocks while interleaving short evening active-recall quizzes to flatten the forgetting curve.',
    createdAt: iso(2),
    blocks: [
      {
        id: 'blk_1',
        dayIndex: 0,
        dayLabel: 'Today',
        date: futureDate(0),
        subject: 'Physics',
        topic: 'Adiabatic vs. Isothermal Work Derivations',
        durationMinutes: 45,
        blockType: 'concept',
        priority: 'high',
        completed: true,
        completedAt: iso(0),
      },
      {
        id: 'blk_2',
        dayIndex: 0,
        dayLabel: 'Today',
        date: futureDate(0),
        subject: 'Linear Algebra',
        topic: 'Characteristic Polynomials & Diagonalization Drills',
        durationMinutes: 50,
        blockType: 'practice',
        priority: 'high',
        completed: false,
      },
      {
        id: 'blk_3',
        dayIndex: 0,
        dayLabel: 'Today',
        date: futureDate(0),
        subject: 'Computer Science',
        topic: 'Coffman Deadlock Conditions Active Recall',
        durationMinutes: 30,
        blockType: 'revision',
        priority: 'medium',
        completed: false,
      },
      {
        id: 'blk_4',
        dayIndex: 1,
        dayLabel: 'Tomorrow',
        date: futureDate(1),
        subject: 'Biology',
        topic: 'Oxidative Phosphorylation & ATP Yield Mapping',
        durationMinutes: 45,
        blockType: 'concept',
        priority: 'medium',
        completed: false,
      },
      {
        id: 'blk_5',
        dayIndex: 1,
        dayLabel: 'Tomorrow',
        date: futureDate(1),
        subject: 'Physics',
        topic: 'Carnot Cycle & Gibbs Free Energy Timed Quiz',
        durationMinutes: 35,
        blockType: 'quiz',
        priority: 'high',
        completed: false,
      },
      {
        id: 'blk_6',
        dayIndex: 2,
        dayLabel: 'Day 3',
        date: futureDate(2),
        subject: 'Linear Algebra',
        topic: 'Spectral Theorem & PCA Orthogonality Review',
        durationMinutes: 50,
        blockType: 'revision',
        priority: 'high',
        completed: false,
      },
      {
        id: 'blk_7',
        dayIndex: 2,
        dayLabel: 'Day 3',
        date: futureDate(2),
        subject: 'Computer Science',
        topic: 'Banker’s Algorithm Safe-Sequence Walkthroughs',
        durationMinutes: 45,
        blockType: 'practice',
        priority: 'medium',
        completed: false,
      },
    ],
  };

  const doubts: DoubtMessage[] = [
    {
      id: 'msg_seed_1',
      role: 'student',
      content: 'Why can’t even a perfectly frictionless Carnot engine reach 100% efficiency?',
      language: 'en',
      subject: 'Physics',
      timestamp: iso(1),
    },
    {
      id: 'msg_seed_2',
      role: 'assistant',
      content: `### Why 100% Efficiency Is Physically Impossible

Even if you eliminate every trace of friction, a cyclic heat engine is bounded by the **Second Law of Thermodynamics** and the temperature ratio of its two reservoirs:

\`η = 1 - (T_C / T_H)\`

#### Step-by-Step Reasoning
1. **Heat carries entropy:** When the engine absorbs heat \`Q_H\` from the hot reservoir at \`T_H\`, it also takes in entropy \`ΔS_in = Q_H / T_H\`.
2. **Work carries zero entropy:** Pure mechanical work \`W\` transfers ordered energy without carrying entropy out of the engine.
3. **The engine must reset each cycle:** To return to its starting state, the engine has to dump at least \`ΔS_in\` of entropy into the cold reservoir at \`T_C\`, which forces it to reject waste heat \`Q_C >= T_C · (Q_H / T_H)\`.

#### Concrete Intuition
Think of a waterfall turning a turbine: energy extraction depends on the *drop* between the top height (\`T_H\`) and bottom height (\`T_C\`). Reaching 100% efficiency would require \`T_C = 0 K\` (absolute zero), which is unattainable in finite steps.

**Checkpoint question:** If a Carnot engine runs between \`500 K\` and \`250 K\`, how much heat must be rejected for every \`100 J\` absorbed?`,
      language: 'en',
      subject: 'Physics',
      timestamp: iso(1),
      retrievedSources: [
        {
          materialId: 'mat_thermo_01',
          materialTitle: 'Laws of Thermodynamics & Entropy Cycles',
          subject: 'Physics',
          text: 'Carnot Cycle Efficiency: A Carnot engine operates reversibly between a hot reservoir at temperature T_H and a cold reservoir at T_C (in Kelvin). Its maximum theoretical efficiency is η = 1 - (T_C / T_H).',
          score: 0.91,
        },
      ],
      pipelineMetrics: {
        retrievalMs: 42,
        synthesisMs: 840,
        topSimilarity: 0.91,
        chunksSearched: 16,
        usedVectorEmbeddings: true,
      },
      followUpSuggestions: [
        'Walk me through solving the 500 K to 250 K checkpoint',
        'How does entropy relate to Gibbs free energy?',
        'Generate a 5-question practice quiz on Thermodynamics',
      ],
      feedback: {
        rating: 'helpful',
        timestamp: iso(1),
      },
    },
  ];

  const profile: StudentProfile = {
    name: 'Bhagirath',
    program: 'B.Tech · Computer Science & Engineering',
    preferredLanguage: 'en',
    learningStyle: 'visual_analogies',
    explanationDepth: 'balanced',
    dailyGoalMinutes: 150,
    focusMinutesLogged: 495,
    streakDays: 6,
    weakConcepts: ['Adiabatic Processes', 'Spectral Decomposition', 'Banker’s Algorithm'],
    feedbackHistory: [
      {
        id: 'fb_seed_1',
        module: 'doubt',
        signal: 'helpful',
        detail: 'Waterfall analogy made Carnot efficiency click immediately.',
        timestamp: iso(1),
      },
    ],
    weeklyStudy: [
      { day: 'Mon', minutes: 95, sessions: 3, retentionIndex: 68 },
      { day: 'Tue', minutes: 120, sessions: 4, retentionIndex: 72 },
      { day: 'Wed', minutes: 85, sessions: 2, retentionIndex: 71 },
      { day: 'Thu', minutes: 140, sessions: 4, retentionIndex: 77 },
      { day: 'Fri', minutes: 110, sessions: 3, retentionIndex: 80 },
      { day: 'Sat', minutes: 155, sessions: 5, retentionIndex: 85 },
      { day: 'Sun', minutes: 90, sessions: 3, retentionIndex: 87 },
    ],
    subjectMastery: [
      { subject: 'Physics', mastery: 78, hoursLogged: 6.4, doubtsResolved: 9, nextRevisionDays: 2 },
      { subject: 'Linear Algebra', mastery: 66, hoursLogged: 5.1, doubtsResolved: 7, nextRevisionDays: 1 },
      { subject: 'Computer Science', mastery: 84, hoursLogged: 7.2, doubtsResolved: 11, nextRevisionDays: 4 },
      { subject: 'Biology', mastery: 73, hoursLogged: 3.8, doubtsResolved: 4, nextRevisionDays: 3 },
    ],
    voicePreferences: {
      enabledLanguages: ['en', 'hi', 'es', 'fr', 'ta'],
      voicePersona: 'Kore',
      playbackSpeed: 1.0,
      voicePitch: 'standard',
      autoSpeakAnswers: false,
      voiceInputAutoSend: false,
    },
  };

  return {
    profile,
    materials,
    doubts,
    notes,
    quizzes,
    studyPlan,
  };
}

let cachedStore: PersistedStore | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getStore(): PersistedStore {
  if (cachedStore) return cachedStore;
  ensureDataDir();
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedStore;
      if (parsed && parsed.profile && Array.isArray(parsed.materials)) {
        if (!parsed.profile.voicePreferences) {
          parsed.profile.voicePreferences = {
            enabledLanguages: ['en', 'hi', 'es', 'fr', 'ta'],
            voicePersona: 'Kore',
            playbackSpeed: 1.0,
            voicePitch: 'standard',
            autoSpeakAnswers: false,
            voiceInputAutoSend: false,
          };
        }
        cachedStore = parsed;
        return cachedStore;
      }
    } catch (err) {
      console.error('Failed to read edumate-store.json, reinitializing:', err);
    }
  }
  cachedStore = createInitialStore();
  saveStore();
  return cachedStore;
}

export function saveStore(): void {
  if (!cachedStore) return;
  ensureDataDir();
  const tmpPath = path.resolve(DATA_DIR, `edumate-store.${crypto.randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(cachedStore, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

export function serializePublicState(store: PersistedStore): EduMateState {
  const publicMaterials: StudyMaterial[] = store.materials.map((m) => ({
    id: m.id,
    title: m.title,
    subject: m.subject,
    content: m.content,
    createdAt: m.createdAt,
    wordCount: m.wordCount,
    chunkCount: m.chunks.length,
    hasEmbeddings: m.chunks.length > 0 && m.chunks.every((c) => Array.isArray(c.embedding) && c.embedding.length > 0),
  }));

  return {
    profile: store.profile,
    materials: publicMaterials,
    doubts: store.doubts,
    notes: store.notes,
    quizzes: store.quizzes,
    studyPlan: store.studyPlan,
  };
}
