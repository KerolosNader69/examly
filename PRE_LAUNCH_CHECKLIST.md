# 🚀 Pre-Launch Production Checklist

This checklist tracks critical security, data cleanup, authentication, and integration tasks that must be completed before launching **Examly** for real teachers and students in production.

---

## 🔒 Security & Credentials

- [ ] **⚠️ SECURITY: Rotate Supabase Database Password**  
  Rotate the Supabase database password before production launch — it was exposed in plaintext in local scratch files during development (now deleted, never pushed to git, but should still be rotated as precaution).  
  *Reset via: Supabase Dashboard → Project Settings → Database → Database Password.*

- [ ] **Rotate Deepgram & Gemini API Keys**  
  Rotate Deepgram and Gemini API keys as general hygiene after development.

- [ ] **Enable Gemini API Paid Plan / Billing**  
  Ensure billing is enabled for the Gemini API project so that student exam submissions & responses are processed under enterprise privacy terms (preventing data usage for Google AI model training under free tier terms).

---

## 🧹 Database & Data Cleanup

- [ ] **Purge All Development Test Data**  
  Clean up all test data generated during initial setup & testing (~46 test teachers, dummy test exams, student_sessions, and development audit_logs).

- [ ] **Re-enable Email Confirmation in Supabase Auth**  
  Re-enable mandatory email verification under *Supabase Dashboard → Authentication → Providers → Email → Confirm email*. (Disabled during dev testing).

---

## 💸 Billing & Payments

- [ ] **Connect Paymob Payment Gateway**  
  Complete Paymob merchant integration for real Egyptian/regional payment processing (credit cards, Mobile Wallets, InstaPay).

- [ ] **Finalize Production Tier Pricing**  
  Finalize real pricing models and update placeholders across the frontend/dashboard pricing pages (currently estimated at Free: $0, Basic: $15/mo, Pro: $29/mo).

---

## ✉️ Transactional Emails

- [ ] **Connect Resend Email Provider**  
  Configure custom domain SMTP/Resend integration in Supabase Auth & server API routes for custom transactional emails (welcome emails, password resets, exam invitations).
