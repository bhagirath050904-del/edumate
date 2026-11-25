# EDUMATE

**Learn smarter. Plan better. Stress less.**

EduMate is a full-stack intelligent study companion built for **Team DELTOX** (Member: Bhagirath). It brings RAG-grounded doubt solving, smart notes and adaptive quiz generation, exam study planning, progress analytics, and multilingual voice interaction into one unified student workspace.

---

## Core Capabilities

### 1. AI Doubt Solver & RAG Pipeline
- Indexes uploaded or pasted lecture notes into overlapping semantic chunks stored in the **Knowledge Vault**.
- Computes vector embeddings and ranks the most relevant syllabus passages using cosine similarity before generating structured, cited explanations.
- Includes a closed-loop feedback bar (`Helpful`, `Simpler analogy`, `Deeper rigor`, `More examples`) that automatically recalibrates the student's learning style and explanation depth for subsequent responses.

### 2. Smart Notes & Adaptive Quiz Generator
- Synthesizes structured study notes from Vault documents or custom topics, including executive summaries, expandable concept-and-analogy cards, formula ledgers, memory anchors, and exam pitfalls.
- Generates timed multiple-choice adaptive quizzes (3–6 questions), grades submissions with detailed explanations, and feeds missed concepts back into the student's priority revision queue.

### 3. Study Planner & Progress Analytics
- Builds multi-day interleaved exam schedules tailored to target exam dates, daily study hours, selected subjects, and tracked weak concepts.
- Tracks completed study blocks, focus sessions, and per-subject mastery in real time.

### 4. Multilingual Voice Assistant & Settings
- Supports **9 languages**: English, Hindi, Spanish, French, German, Tamil, Telugu, Japanese, and Mandarin.
- Records microphone voice doubts with live frequency-bar feedback, transcribes speech server-side, and reads tutor explanations and note summaries aloud.
- Dedicated **Multilingual Voice Assistant Settings Panel** to choose active languages, set a primary default language, adjust playback speed (`0.75x`–`1.75x`), switch vocal pitch (`Low`, `Standard`, `Bright`), pick a tutor voice persona, toggle auto-read/auto-send behavior, and preview live audio samples.

### 5. Motion Visualizations
- **Closed Learning Loop & RAG Visualizer**: Interactive four-stage pipeline showing live retrieval stages and matched source passage scores.
- **Subject Goal Progress Rings**: Animated circular SVG progress indicators (`strokeDashoffset`) synced with logged study hours and plan completion.
- **Study Streak Tracker**: Consecutive-day focus counter with an animated flame icon, 7-day focus cadence strip, and Quick Log modal.
- **Memory Decay vs. Guided Revision Curve**: Interactive 21-day spaced-repetition simulation with configurable revision checkpoints.
- **Calm Study Hourglass**: Kinetic SVG focus timer that logs completed sessions directly into weekly momentum and subject mastery analytics.
- **Live Acoustic Waveform**: Real-time Web Audio API frequency visualization during voice capture and playback.

---

## Architecture & Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons |
| **Backend** | Node.js, Express (`server.ts`), Vite dev middleware |
| **AI & Speech** | `@google/genai` (server-side proxy for text synthesis, embeddings, transcription, and TTS) |
| **Persistence** | Atomic server-side JSON store (`data/edumate-store.json`) for profiles, Vault chunks, notes, quizzes, study plans, and feedback |

---

## Project Structure

```text
├── server.ts                          # Express API server & Vite integration
├── server/
│   ├── gemini.ts                      # Server-side LLM, RAG embeddings, STT & TTS engine
│   └── store.ts                       # Persistent store & text chunking pipeline
├── src/
│   ├── App.tsx                        # Root application shell & workspace navigation
│   ├── types.ts                       # Shared domain TypeScript interfaces
│   ├── lib/api.ts                     # Typed frontend REST client
│   └── components/
│       ├── MarkdownRenderer.tsx       # Safe React Markdown & inline formula renderer
│       ├── QuickLogModal.tsx          # Manual study session logging modal
│       ├── VoiceSettingsPanel.tsx     # Multilingual voice preferences panel
│       ├── visualizations/            # Motion visualizations (RAG loop, rings, streak, retention, hourglass, waveform)
│       └── workspaces/                # Overview, Doubt Solver, Notes & Quiz, Planner, Knowledge Vault
├── index.html
├── package.json
└── .env.example
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and provide your Gemini API key:
```bash
cp .env.example .env
```

Required variables:
- `GEMINI_API_KEY` — Used strictly on the server for LLM reasoning, vector embeddings, audio transcription, and text-to-speech.
- `PORT` — Optional server port (defaults to `3000`).

### 3. Run Locally
```bash
npm run dev
```
The full-stack app will start on `http://localhost:3000`.

### 4. Type-Check & Build for Production
```bash
npm run lint
npm run build
npm start
```

---

## Key API Endpoints

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/state` | Fetch full hydrated student workspace state |
| `PATCH` | `/api/profile` | Update profile, language, learning style, and voice preferences |
| `POST` | `/api/materials` | Ingest, chunk, and embed study material into the Knowledge Vault |
| `DELETE` | `/api/materials/:id` | Remove a study material from the Vault |
| `POST` | `/api/doubt` | Run RAG retrieval + personalized doubt solving |
| `POST` | `/api/notes/generate` | Synthesize structured Smart Notes |
| `POST` | `/api/quiz/generate` | Generate an adaptive multiple-choice quiz |
| `POST` | `/api/quiz/:id/attempt` | Score a quiz attempt and update mastery & weak concepts |
| `POST` | `/api/planner/generate` | Build an adaptive multi-day exam study plan |
| `PATCH` | `/api/planner/block/:id` | Toggle study block completion and log progress |
| `POST` | `/api/focus/log` | Log focus timer or Quick Log study minutes |
| `POST` | `/api/feedback` | Record feedback to recalibrate tutor style & depth |
| `POST` | `/api/voice/transcribe` | Transcribe recorded student voice input |
| `POST` | `/api/voice/speak` | Synthesize spoken tutor audio with persona & pitch settings |
