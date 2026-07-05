# ✨ Repurpose

> **Turn one video or transcript into a week of high-performance marketing content in under a minute.**

Repurpose is a modern, full-stack AI-powered content engine. Drop in a YouTube link or paste a raw transcript and automatically generate a complete suite of polished marketing assets: an SEO blog post, a 5-slide LinkedIn carousel, an email newsletter, and three distinct Twitter/X threads.

---

## 🎨 Visual Assets & Design Philosophy
Repurpose is crafted with a high-end, premium dark-mode aesthetic featuring:
*   **Vibrant Aurora Gradients** and subtle glow effects using Tailwind CSS v4.
*   **Micro-animations** (float, bounce-rotate, slide reveals) for a polished user experience.
*   **Responsive split-screen layouts** with custom interactive cards.
*   **Accessible ARIA patterns** and screen-reader friendliness.

---

## 🏗️ System Architecture

The following diagram illustrates how video links or raw transcripts flow through the system:

```mermaid
sequenceDiagram
    autonumber
    actor User as Content Creator
    participant Web as Web App (TanStack Start)
    database DB as Supabase Database
    participant Worker as Background Worker
    participant AI as Lovable AI Gateway (Gemini)

    User->>Web: Submits YouTube URL or Transcript
    Web->>DB: submit_content_job() RPC
    Note over DB: Atomically checks monthly quota<br/>and rate limits (10 jobs/mo)
    DB-->>Web: Returns Job ID (Queued)
    Web-->>User: Navigates to /jobs/:id (Shows loading state)
    
    rect rgb(20, 20, 30)
        Note over Worker: Triggered via cron or hook
        Worker->>DB: claim_jobs() (Acquires SKIP LOCKED row)
        DB-->>Worker: Claims jobs for user_id
        Note over Worker: If YouTube URL, extracts transcript
        Worker->>AI: Requests schema-validated generation
        AI-->>Worker: Returns JSON matching OutputSchema
        Worker->>DB: complete_job_and_charge() RPC
        Note over DB: Saves blog, carousel, email, threads<br/>Charges usage characters & unlocks queue
    end

    Web->>DB: Polls active job status
    DB-->>Web: Status = 'done'
    Web-->>User: Displays tabs with copyable assets
```

---

## 🚀 The Repurposed Output Suite

Upon processing a job, the application generates four core formats validated against strict structural schemas:

| Output Format | Structure / Style | Ideal Use Case |
| :--- | :--- | :--- |
| **📝 SEO Blog Post** | ~1,000 words, clean markdown, H2/H3 headings, intro, takeaways, conclusion. | Web site content, SEO search growth. |
| **📊 LinkedIn Carousel** | Exactly 5 slides: Hook ➔ 3 Insights ➔ CTA. Ready to paste to Figma or PDF. | Business networks, high-authority branding. |
| **✉️ Email Newsletter** | Pre-formatted `Subject: ...` line followed by a 200–350 word plain text body. | Subscriber lists, product updates. |
| **🐦 Twitter Threads** | 3 distinct angles, 5–8 tweets per thread, each under 270 chars. | Viral social reach, quick summaries. |

---

## 🛠️ Technology Stack

*   **Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React 19, Vite, TanStack Router, TanStack Query) — leveraging lightning-fast server functions (RPCs) and hybrid streaming.
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with premium CSS variables, HSL color tokens, and custom keyframes.
*   **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL) featuring Row Level Security (RLS), custom triggers, and transactional SQL procedures.
*   **AI generation**: [Vercel AI SDK](https://sdk.vercel.ai/docs) using `google/gemini-3-flash-preview` via the Lovable AI Gateway provider.
*   **Validation**: [Zod](https://zod.dev/) for strict runtime type-checking of user inputs and structured AI responses.

---

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/prof-rdx/Repurpose.git
cd Repurpose
```

### 2. Install dependencies
Ensure you have [Bun](https://bun.sh/) or Node.js installed. We recommend Bun:
```bash
bun install
# or
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root of the project:
```env
SUPABASE_PROJECT_ID="your-project-id"
SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_URL="https://your-project.supabase.co"

# AI engine key
LOVABLE_API_KEY="your-lovable-api-key"

# Secret to protect execution of background processing hook
CRON_SECRET="your-secure-cron-secret"
```

### 4. Supabase Database Migration
Apply the database migrations to your Supabase project:
```bash
# Using Supabase CLI:
supabase link --project-ref your-project-id
supabase db push
```
*Alternatively, run the SQL files in order from [supabase/migrations/](file:///Users/ahmed/Downloads/lovable-16d05802-2026-06-25/supabase/migrations/) directly in the Supabase SQL editor.*

### 5. Running the Application
Start the development server:
```bash
bun run dev
# or
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚡ Background Worker execution
To run the background processor that claims queued jobs and generates assets, trigger the following endpoint with your `CRON_SECRET`:

```bash
curl -X POST http://localhost:3000/api/public/hooks/process-pending-jobs \
  -H "Content-Type: application/json" \
  -H "X-Cron-Secret: your-secure-cron-secret" \
  -d '{}'
```
In production, configure a cron job (e.g. via Vercel Cron, GitHub Actions, or Supabase pg_cron) to hit this endpoint once every minute.
