# Re:Learn 🧠⚡

> **An AI-powered learning system that diagnoses underlying programming misconceptions rather than simply flagging code as incorrect.**

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/Groq_API-F55036?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com/)

---

## 📌 Overview

Traditional automated grading systems typically evaluate student code through unit tests and compiler errors, yielding unhelpful output like `Test Case 3 Failed: Output Mismatch`. This leaves novice programmers confused about *why* their mental model was flawed.

**Re:Learn** is designed for introductory programming learners (Python and JavaScript). It leverages the **Groq API** (powered by `llama3-70b-8192`) and **Supabase Edge Functions** to perform deep semantic analysis on code submissions. It classifies the student's specific cognitive misconception, generates a targeted pedagogical intervention, and follows up with an adaptive resolution challenge.

---

## ✨ Key Features

* **VS Code-Style In-Browser Editor**: Powered by `@monaco-editor/react` with syntax highlighting, autocomplete, and line numbers.
* **Semantic Misconception Diagnosis**: Distinguishes between subtle variations of beginner mistakes (e.g., assignment `=` vs. equality `==`, shallow vs. deep copy, variable scope misunderstandings).
* **Strict JSON-Guaranteed Evaluation**: Backed by high-speed Groq inference using structured JSON output.
* **Targeted Interventions**: Replaces cryptic stack traces with clear conceptual explanations and reflective guiding questions.
* **Adaptive Resolution Loop**: Presents a modified follow-up challenge to verify whether the learner has resolved their mental misconception.
* **Multi-Key Cycling & Resilience Engine**: Supports pooling multiple free Google Gemini API keys with automatic cycling, rate-limit (429) detection, per-key cooldowns, and transparent failover so your application never gets blocked by free-tier limits.
* **Learner Progression & Analytics**: Stores learner attempts, code submissions, and diagnosis histories in a PostgreSQL database with Row Level Security (RLS).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React |
| **Code Editor** | `@monaco-editor/react` |
| **AI Inference** | Google Gemini (`gemini-1.5-flash` / `gemini-2.0-flash`) & Groq (`llama3-70b-8192`) |
| **API Resilience** | Multi-Key Cycling & Automatic Failover Engine |

---

## 📂 Project Structure

```text
CodeBlooded_maharashtra_round/
├── .env.example              # Sample root environment configuration
├── .gitignore                # Git ignore rules
├── README.md                 # Project documentation
└── relearn/                  # Main web application
    ├── public/               # Static assets & icons
    ├── src/
    │   ├── assets/           # Media & graphics
    │   ├── components/
    │   │   ├── CodeEditor.tsx        # Monaco editor integration
    │   │   └── InterventionPanel.tsx # Adaptive feedback & diagnosis panel
    │   ├── lib/
    │   │   └── supabase.ts           # Supabase client setup
    │   ├── pages/
    │   │   └── LearningModule.tsx    # Core challenge & assessment loop view
    │   ├── App.tsx                   # Root React component
    │   ├── main.tsx                  # React DOM mount point
    │   └── index.css                 # Tailwind CSS styles
    ├── supabase/
    │   ├── migrations/
    │   │   └── 00001_initial_schema.sql  # Profiles, misconceptions, and attempts tables
    │   └── functions/
    │       └── diagnose-misconception/
    │           └── index.ts              # Supabase Edge Function with Groq integration
    ├── .env.example          # App-specific environment template
    ├── package.json          # Dependencies and scripts
    └── vite.config.ts        # Vite + Tailwind plugins
```

---

## 🚀 Getting Started

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* A [Supabase](https://supabase.com/) account and project
* A [Groq Cloud](https://console.groq.com/) API key

### 2. Installation
Clone the repository and install the dependencies:

```bash
# Clone the repository
git clone https://github.com/RishabhDev676/CodeBlooded_maharashtra_round.git
cd CodeBlooded_maharashtra_round/relearn

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your environment variables:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Database Setup & Edge Function Deployment
Apply the migration to your Supabase project:
```bash
# Push database schema
npx supabase db push

# Set your Groq API Key secret in Supabase
npx supabase secrets set GROQ_API_KEY=your_groq_api_key

# Deploy the Edge Function
npx supabase functions deploy diagnose-misconception
```

### 5. Run the Local Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

> **💡 Quick Demo Mode**: If you haven't connected Supabase or Groq keys yet, the frontend comes with a built-in fallback simulation that allows you to experience the diagnosis and intervention workflow immediately!

---

## 🗄️ Database Architecture

* **`profiles`**: Stores student profiles synced automatically with Supabase Auth.
* **`misconceptions`**: Catalogue of known mental misconceptions across Python and JavaScript.
* **`attempts`**: History of student code submissions, test outcomes, and detailed AI diagnosis JSON payload.

---

## 🗺️ Project Plan & Roadmap

### Phase 1: Foundation (✅ Completed)
- [x] Initial React, Vite, and Tailwind CSS architecture.
- [x] Supabase PostgreSQL database schema (Profiles, Misconceptions, Attempts).
- [x] `@monaco-editor/react` integration for a native coding experience.

### Phase 2: Intelligence & Pedagogy (✅ Completed)
- [x] Google Gemini & Groq AI integration with strictly enforced JSON schemas.
- [x] **Multi-Key Resilience Engine**: Auto-cycling between API keys on quota exhaustion.
- [x] Socratic diagnostic logic (differentiating syntax errors from mental model errors).

### Phase 3: Analytics & Adaptive UI (✅ Completed)
- [x] **Framer Motion Timeline**: Interactive chat-like assistant panel for active feedback.
- [x] **Learner Model Dashboard**: Recharts-powered radar & bar charts displaying concept mastery and recurring bottlenecks.
- [x] Adaptive Resolution Challenge loop to verify mastery.

### Phase 4: Hackathon Advanced Deliverables (✅ Completed)
- [x] **Expanded Dataset**: Pre-populated dictionary & SQL seed (`seed.sql`) of known cognitive traps across Python, JavaScript, Algebra, and Physics.
- [x] **Multimodal Inputs**: Enabled image upload for handwritten calculations and diagrams, analyzed jointly with code via Gemini 1.5 Flash Vision.
- [x] **Model Evaluation Benchmark Suite**: Built-in interactive benchmark evaluator testing diagnostic accuracy and differentiation across Seen vs Unseen misconceptions.

---



## 👥 Authors & Acknowledgments

* **Rishabh Dev** ([@RishabhDev676](https://github.com/RishabhDev676))
* Built for **Bit N Build - CodeBlooded (Maharashtra Round)**
