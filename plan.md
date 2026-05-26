# Development Plan: Instagram Reel Automation Bot

## Current State Summary

The app is functional and in production. It posts reels to Instagram on a cron schedule, manages a queue in MySQL, and stores videos on Supabase. The core loop works. The gaps are around reliability, security, observability, and maintainability.

---

## Priority 1 — Reliability (Do first)

These are failure modes that can silently break production posting.

### 1.1 Add retry logic for failed posts

**Problem:** If the Graph API call fails (network blip, rate limit, token expiry) the reel is skipped and never retried. The `posted` flag stays `false` but there's no tracking of why it failed or how many times it was attempted.

**Change:**
- Add a `retry_count` (INTEGER, default 0) and `last_error` (TEXT) column to both `IncrementalReel` and `NormalReel`.
- On posting failure, increment `retry_count` and store the error message instead of silently catching.
- Skip records with `retry_count >= 3` so permanent failures don't block the queue.

---

### 1.2 Fix token refresh reliability

**Problem:** Token refresh runs on a node-cron 50-day schedule. If the server restarts, the cron resets and the next refresh could be pushed well beyond 60 days — at which point the token expires and all posting stops.

**Change:**
- Store `last_refreshed_at` in the `Token` table.
- On server startup, check if more than 45 days have passed since last refresh and trigger a refresh immediately if so.
- Log the refresh result with timestamp.

---

### 1.3 Replace in-memory Multer storage with streaming uploads

**Problem:** Multer stores the entire uploaded video in RAM before uploading to Supabase. A large video file can exhaust memory and crash the server.

**Change:**
- Stream the upload directly to Supabase using `diskStorage` or a piped stream.
- Set a reasonable file size limit (e.g., 500 MB) to reject oversized files early.

---

### 1.4 Handle `waitForProcessing` timeout gracefully

**Problem:** If Instagram takes more than 5 minutes to process a reel, `waitForProcessing` silently times out. The container ID is lost and the reel cannot be published.

**Change:**
- On timeout, store the `container_id` and mark the record with `status = 'processing'`.
- Add a separate recovery job that checks for `processing` records older than 10 minutes and attempts to publish or reset them.

---

## Priority 2 — Security

The server has no authentication. Anyone who discovers the port can trigger posts or upload content.

### 2.1 Add API key middleware

**Change:**
- Add a shared secret in `.env` (e.g., `API_SECRET`).
- Create a simple Express middleware that checks for `Authorization: Bearer <secret>` on all non-health-check routes.
- Reject with `401` if missing or wrong.

This is the minimal viable protection for a private server. If the server is ever exposed publicly, move to a stronger auth mechanism.

---

### 2.2 Validate upload inputs

**Problem:** There is no validation on the `day_number` or `caption` fields. A bad request can insert garbage data into the DB.

**Change:**
- Validate `day_number` is a positive integer.
- Validate `caption` is a non-empty string under a reasonable length limit (e.g., 2,200 chars — Instagram's caption limit).
- Return `400` with a descriptive message on validation failure.

---

## Priority 3 — Observability

There is currently no structured logging or alerting. Failures are silent.

### 3.1 Add structured logging

**Change:**
- Replace `console.log` / `console.error` calls with a lightweight logger (e.g., `pino` or `winston`).
- Log at minimum: reel ID, action (attempted/succeeded/failed), timestamp, and error message.
- Output JSON logs so they can be ingested by Railway's log viewer or any external tool.

---

### 3.2 Add a status endpoint

**Change:**
- Add `GET /status` that returns:
  - Count of unposted reels (incremental + normal)
  - Last successful post timestamp (per type)
  - Token `updated_at` date
  - Server uptime

This gives a quick way to verify the queue health without hitting the DB directly.

---

## Priority 4 — Code Health

These changes reduce technical debt without changing behavior.

### 4.1 Remove dead code

- Delete `jobs/reelJobs.js` — it is entirely commented out and replaced by logic in `index.js`.
- Remove the S3/Tigris configuration in `config/s3.js` and the corresponding `.env` variables, or document clearly that it is reserved for future use.
- Remove the commented-out legacy code block at the bottom of `instagramService.js`.

---

### 4.2 Extract cron job logic from index.js

**Problem:** `index.js` contains route handlers, cron setup, and business orchestration all mixed together.

**Change:**
- Move the cron job setup into its own file, e.g., `jobs/scheduler.js`.
- `index.js` should only be responsible for server startup, middleware, and importing routes.

---

### 4.3 Extract routes into a router

**Change:**
- Create `routes/reels.js` with all reel-related routes.
- Mount it in `index.js` with `app.use('/reels', reelRouter)` or keep paths flat — either is fine, but separate the files.

---

### 4.4 Move port to environment variable

**Problem:** Port is hardcoded to `4001`.

**Change:**
- Read from `process.env.PORT` with a fallback: `const PORT = process.env.PORT || 4001`.

---

## Priority 5 — Future Features (Backlog)

These are enhancements for later, not blocking current operation.

| Feature | Notes |
|---|---|
| Admin UI | Simple dashboard to view queue, upload videos, trigger posts manually |
| Multi-account support | Support multiple Instagram accounts/pages |
| Webhook from Instagram | Replace polling in `waitForProcessing` with a webhook callback |
| Video preview before posting | Store thumbnail and allow review before the cron fires |
| Post analytics | Store likes/comments/reach after posting via Graph API |
| Scheduled post time per reel | Allow per-record scheduled time instead of a single daily cron |

---

## Implementation Order

```
Week 1: Priority 1 (reliability)
  - 1.2 Token refresh fix (startup check) — low effort, high risk if skipped
  - 1.1 Retry logic — adds retry_count + last_error columns, update cron handlers
  - 1.3 Multer streaming — swap storage strategy

Week 2: Priority 2 (security) + 1.4 (timeout recovery)
  - 2.1 API key middleware
  - 2.2 Input validation
  - 1.4 Container ID recovery job

Week 3: Priority 3 + 4 (observability + cleanup)
  - 3.1 Structured logging (pino)
  - 3.2 /status endpoint
  - 4.1 Remove dead code
  - 4.2–4.4 Refactor structure
```
