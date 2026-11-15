<h1 align="center">Examly</h1>

<p align="center">
  <strong>AI-powered oral exams for every teacher</strong><br>
  <sub>Spoken, MCQ and written answers graded by meaning, not keywords · English & Arabic</sub>
</p>

<p align="center">
  <a href="https://examly.site"><img src="https://img.shields.io/badge/LIVE-examly.site-FFD60A?style=for-the-badge&labelColor=1d1d26" alt="Live at examly.site" /></a>
  <img src="https://img.shields.io/badge/Next.js-1d1d26?style=for-the-badge&logo=nextdotjs&logoColor=FFD60A" alt="Next.js" />
  <img src="https://img.shields.io/badge/Supabase-1d1d26?style=for-the-badge&logo=supabase&logoColor=FFD60A" alt="Supabase" />
  <img src="https://img.shields.io/badge/TypeScript-1d1d26?style=for-the-badge&logo=typescript&logoColor=FFD60A" alt="TypeScript" />
</p>

---

## The problem

Oral assessment is the best way to check real understanding, and the hardest to scale. A teacher with a full class cannot listen to, transcribe and fairly grade every spoken answer.

## What Examly does

1. **The teacher builds an exam**: writes questions and model answers, or generates them from an uploaded document.
2. **Students join with a code** from any device, on the teacher's own branded subdomain, and answer out loud.
3. **Speech becomes text** with Deepgram (Nova-3, with a Nova-2 fallback).
4. **Gemini grades the meaning.** The prompt scores conceptual correctness against the model answer, so different wording or simpler vocabulary still earns full marks, while a fluent answer that misses the facts does not.
5. **The teacher reviews results and insights** in the dashboard and keeps the final say.

## Features

| Area | What's included |
|:--|:--|
| Teachers | Exam builder, generate questions from documents, results, AI insights, billing, settings |
| Students | Join by exam code, spoken answers, instant grading |
| Multi-tenant | Branded subdomain per teacher |
| Integrity | Tab-switch detection during exams |
| Admin | Teacher management, financial reports, system health, audit log, separate admin auth |
| Security | Row-level security policies on every table, service-role access isolated to server routes |
| Email | Transactional email through Resend |

## Tech stack

- **App:** Next.js (App Router) · React · TypeScript · Tailwind CSS
- **Data & auth:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **AI:** Deepgram speech-to-text · Google Gemini (`@google/genai`)
- **Validation:** Zod
- **Testing:** Playwright end-to-end tests

## Project structure

```text
app/
  (marketing)      landing, pricing, about, security, legal pages
  dashboard/       teacher dashboard: exams, results, billing, settings
  exam/[code]/     student exam room
  admin/           admin console: teachers, finance, health, audit log
  api/exam/        transcribe · evaluate · generate-from-pdf · generate-insights · join · submit
  api/admin/       admin endpoints
components/        UI, dashboard, student and landing components
lib/               Supabase clients, auth, schemas, exams, email
supabase/          SQL migrations (schema + RLS policies)
tests/e2e/         Playwright specs
```

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|:--|:--|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin access (never exposed to the browser) |
| `DEEPGRAM_API_KEY` | Speech-to-text |
| `GEMINI_API_KEY` | Grading and question generation |
| `NEXT_PUBLIC_APP_URL` | Public base URL |

Apply `supabase/migrations/001_initial_schema.sql` to a fresh Supabase project, then run the end-to-end suite with `npx playwright test`.

## Author

Built by **[Kerollos Nader](https://github.com/KerolosNader69)**, founder and full-stack developer.
