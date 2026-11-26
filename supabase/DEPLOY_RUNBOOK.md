# Deploy runbook: app code + migration 002

Status on 2026-11-26:

- 003, 004, 005 and 006 are **already applied** to the live database.
- 002 (`002_close_data_exposure.sql`) is **not applied yet**.
- `origin/main`, the code Vercel serves today (last commit 2026-09-02), is about 30
  commits behind local `main`. That old code reads `exams` from the **student exam
  page with the anon key**, so 002 would break every student exam link if it ran
  before the new code is live.

**Order matters: deploy the code first, then run 002.** The new code works on the
current database both before and after 002:

- Student routes and the admin API use the service role.
- The teacher dashboard uses the teacher's own RLS policies, which 002 keeps.
- Recordings are always served through signed URLs.

Time needed: about 45 minutes, plus a 10-minute smoke test.

---

## Environment variables (Vercel → Project → Settings → Environment Variables)

Set them for **Production** and **Preview**. Never paste values into chat, tickets or
this file.

| Variable | Required | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | every Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | browser client (teacher login and dashboard) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (server only, never `NEXT_PUBLIC_`) | student routes, admin API, teacher provisioning, recording signing |
| `ADMIN_SESSION_SECRET` | yes, ≥ 32 chars | admin session cookie (login fails closed without it) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | yes in production | durable rate limits (falls back to per-instance memory with a warning) |
| `DEEPGRAM_API_KEY` | yes | speech-to-text |
| `GEMINI_API_KEY` | yes | grading, insights, PDF question generation |
| `GEMINI_MODEL_PRIMARY`, `GEMINI_MODEL_FALLBACK` | optional | model override |
| `RESEND_API_KEY` | yes for the contact form | email (missing from `.env.example`) |
| `NEXT_PUBLIC_APP_URL` | yes | auth redirects, links |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | optional | Search Console |

> Vercel Preview deployments use the **same Supabase project** unless you give
> Preview its own values. Anything you do on a Preview URL writes to the live
> database, so use a test teacher account and a test exam.

---

## Step 1: Push the branch

```bash
git push -u origin release/002-data-exposure
```

Open a PR into `main`. Do **not** merge yet.

**Rollback:** delete the remote branch or close the PR. Nothing is deployed.

## Step 2: Vercel Preview checks (live DB, 002 not applied yet)

Vercel builds a Preview for the PR. Check that:

1. The build is green and the logs show no `Missing ...` / env warnings, apart from
   the Upstash warning if Preview has no Upstash.
2. A test teacher can log in: dashboard → exams list → exam detail (questions show)
   → results → settings (change the name, save, reload).
3. A student can open the test exam link, join, answer, and submit with **no 500**.
   (006 is applied, so submit works.)
4. Results show the submission. For an audio/video exam, the recording plays.
5. In the browser devtools Network tab, the student page makes **no** request to
   `/rest/v1/exams`, `/rest/v1/questions` or `/rest/v1/exam_models`.

**Rollback:** nothing to roll back; just don't merge.

## Step 3: Merge to `main` (production deploy)

Merge the PR. Wait until the Vercel production deployment is **Ready**, then repeat
Step 2 checks 2–4 quickly on the production domain.

**Rollback:** Vercel → Deployments → previous production deployment → **Promote to
Production**, or `git revert` the merge. This is safe as long as 002 hasn't run,
because the old code still works on today's DB.

## Step 4: Run migration 002

Supabase dashboard → SQL Editor → paste the **whole**
`supabase/migrations/002_close_data_exposure.sql` → Run.

- Expected: success, with the notice `002 self-check passed`.
- If it raises `002 self-check: ...`, **nothing was changed**: the whole transaction
  rolled back. Read the message, then:
  - `... can still UPDATE teachers(...)`: a grant was made by another role. Run
    check query 8 from `002_check.sql` to see the grantor. Revoke it as that role or
    ask Supabase support. Re-run 002.
  - `storage.objects policies still expose exam-recordings`: delete those policies
    in Storage → Policies, then re-run 002.
- Re-running 002 after a success is harmless.

**Rollback:** the `ROLLBACK` block at the bottom of 002. It restores the previous,
**insecure** state, so use it only if production is broken and a code fix is not
possible within minutes. Stored recording paths can stay; the app reads both paths
and old URLs.

## Step 5: Run the verification

Run each query in `supabase/verification/002_check.sql` **one by one**, and compare
each result with the `EXPECTED` comment above it. Every query must match.

**Rollback:** nothing to roll back (read-only). On a mismatch, stop and investigate
before going further. Use the Step 4 rollback only if the smoke test below fails
in a way that blocks students.

## Step 6: Smoke test (about 10 minutes)

The steps below call your Supabase project directly. In each one, replace
`$SUPABASE_URL` with your project's URL and `$ANON` with its anon key, both from
Supabase → Project Settings → API. A teacher token: sign in as the **test**
teacher on the site, open devtools → Application → Local Storage →
`sb-<project>-auth-token` → copy `access_token` into `$TEACHER_JWT`, and copy that
teacher's `user.id` into `$TEACHER_ID`.

1. **Anon REST returns nothing** (each prints `[]`):
   ```bash
   for t in exams questions exam_models teachers student_sessions audit_logs; do curl -s "$SUPABASE_URL/rest/v1/$t?select=*&limit=5" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"; echo " <- $t"; done
   ```
2. **Teacher can't change their own plan.** Expect HTTP 401/403 with code `42501`
   (permission denied):
   ```bash
   curl -s -i -X PATCH "$SUPABASE_URL/rest/v1/teachers?id=eq.$TEACHER_ID" -H "apikey: $ANON" -H "Authorization: Bearer $TEACHER_JWT" -H "Content-Type: application/json" -d '{"plan":"pro"}'
   ```
   The same request with `'{"name":"Smoke Test Teacher"}'` must return **204**
   (Settings still works). Set the name back afterwards.
3. **Audit log insert is closed.** Expect 401/403 with `42501` (row-level security):
   ```bash
   curl -s -i -X POST "$SUPABASE_URL/rest/v1/audit_logs" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"actor":"smoke","action":"fake"}'
   ```
4. **Student full flow** (production URL, test exam): open the link → join → answer
   every question (record audio for an audio exam) → submit → the confirmation page
   shows. Then in the teacher dashboard → Results: the submission is there with
   score/status, and tab switches if any.
5. **Teacher plays a recording.** Open the submission → press play on the combined
   recording and on a per-question recording. Devtools shows
   `/api/teacher/recording-url` → 200 and a `.../object/sign/exam-recordings/...`
   URL.
6. **Old public recording URL is dead.** Take a stored path (Supabase table editor,
   `student_sessions.recording_url`, for example `recordings/<id>-<ts>.webm`):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" "$SUPABASE_URL/storage/v1/object/public/exam-recordings/<path>?nocache=1"
   ```
   Expect `400` or `404`, not `200`. The Supabase CDN may keep serving a cached
   copy without the query string for up to the object's cache time (default 1 hour).
7. **Teacher dashboard sanity:** the exams list, a new draft exam (create → publish),
   the exam detail with questions, the notifications bell, and admin `/admin` login
   → overview and audit log all load.

If 1–3 or 6 fail, 002 isn't effective: re-check Step 5. If 4, 5 or 7 fail, check
the Vercel function logs first. The Step 4 rollback is the last resort.

## Step 7: Rotate keys

Do this after 002, because keys that were readable or shared earlier should be
treated as exposed.

1. **Supabase:** Project Settings → API keys. Create new keys (publishable/secret,
   or rotate the JWT secret on the legacy keys; that logs every teacher out). Put
   the new anon/publishable key into `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the new
   secret/service key into `SUPABASE_SERVICE_ROLE_KEY` in Vercel (Production and
   Preview). Redeploy, check that login and a student join work, then **disable or
   revoke the old keys**.
2. `ADMIN_SESSION_SECRET`: set a new random value
   (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
   and redeploy. This logs out all admins.
3. Deepgram, Gemini, Resend and Upstash: create new keys in each console, update
   them in Vercel, redeploy, then delete the old keys.
4. Update your local `.env.local` with the new values. It is git-ignored; never
   commit it.

**Rollback:** keep the old key enabled until the new deployment is verified.
Re-enabling it (or setting it back in Vercel) restores service.

---

## Done when

- `002_check.sql` matches every `EXPECTED`.
- Smoke tests 1–7 pass.
- The old keys are revoked.
- The one leftover repro session (student "Repro Drift Test", code `REPRO-1`,
  in progress) has been deleted from `student_sessions`, if you want it gone.
