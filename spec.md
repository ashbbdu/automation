# Specification: Instagram Reel Automation Bot

## Overview

A backend automation service that schedules and posts Instagram Reels via the Facebook Graph API. It supports two posting strategies — daily incremental countdown videos and a general-purpose queue — with video storage on Supabase and persistence on a Railway-hosted MySQL database.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js v5 |
| ORM | Sequelize v6 |
| Database | MySQL (hosted on Railway) |
| Video Storage | Supabase Storage |
| S3 Storage | AWS SDK / Tigris (configured, not active) |
| HTTP Client | Axios |
| Task Scheduler | node-cron |
| File Upload | Multer |

---

## System Architecture

```
Client / Admin
      │
      ▼
 Express Server (port 4001)
      │
      ├── REST API endpoints (manual triggers + uploads)
      │
      ├── Cron Jobs (scheduled posting + token refresh)
      │
      ├── Instagram Service
      │       └── Facebook Graph API
      │
      ├── Supabase Storage (video files)
      │
      └── MySQL via Sequelize (metadata + tokens)
```

---

## Data Models

### IncrementalReel

Tracks daily countdown videos (e.g., "Day N without you").

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PK, auto-increment |
| video_url | TEXT | Not null; Supabase public URL |
| day_number | INTEGER | Default 0; day label in caption |
| posted | BOOLEAN | Default false; set true after posting |
| createdAt | TIMESTAMP | Auto-managed |
| updatedAt | TIMESTAMP | Auto-managed |

### NormalReel

Tracks general-purpose videos with custom captions.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PK, auto-increment |
| video_url | TEXT | Not null; Supabase public URL |
| caption | TEXT | Custom caption for the post |
| posted | BOOLEAN | Default false |
| createdAt | TIMESTAMP | Auto-managed |
| updatedAt | TIMESTAMP | Auto-managed |

### Token

Stores the active Instagram user access token.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PK |
| user_token | TEXT | Not null; long-lived token |
| updated_at | DATE | Default NOW |

---

## API Endpoints

Base URL: `http://localhost:4001`

### GET /

Health check.

**Response:** `200 OK` — plain text confirmation string.

---

### GET /incr

Manually trigger posting of the next unposted incremental reel.

**Behavior:**
1. Queries the oldest unposted `IncrementalReel` (ordered by `day_number ASC`).
2. Calls `postReel(video_url, "Day {day_number} without you 💔")`.
3. Marks the record `posted = true` on success.

**Response:**
```json
{ "message": "Incremental reel posted successfully" }
```

---

### GET /normal

Manually trigger posting of the next unposted normal reel.

**Behavior:**
1. Queries the oldest unposted `NormalReel` (ordered by `id ASC`).
2. Calls `postReel(video_url, caption)`.
3. Marks the record `posted = true` on success.

**Response:**
```json
{ "message": "Normal reel posted successfully" }
```

---

### POST /upload-incremental

Upload a video to the incremental reel queue.

**Request:** `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| video | file | Yes | Video file |
| day_number | number | Yes | Day label for caption |

**Behavior:**
1. Receives video via Multer (memory storage).
2. Uploads to Supabase bucket under path `incremental/{filename}`.
3. Creates `IncrementalReel` record with the public URL and `day_number`.

**Response:**
```json
{ "message": "Uploaded successfully", "url": "<supabase-public-url>" }
```

---

### POST /upload-normal

Upload a video to the normal reel queue.

**Request:** `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| video | file | Yes | Video file |
| caption | string | Yes | Caption for the Instagram post |

**Behavior:**
1. Receives video via Multer (memory storage).
2. Uploads to Supabase bucket under path `normal/{filename}`.
3. Creates `NormalReel` record with the public URL and caption.

**Response:**
```json
{ "message": "Uploaded successfully", "url": "<supabase-public-url>" }
```

---

### GET /fetch-last-data

Retrieve metadata of the most recently created incremental reel.

**Response:**
```json
{
  "id": 42,
  "video_url": "https://...",
  "day_number": 15,
  "posted": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## Cron Jobs

All cron jobs run in the `Asia/Kolkata` timezone unless noted.

| Job | Schedule | Action |
|---|---|---|
| Post incremental reel | Daily at 7:00 AM IST | Posts oldest unposted `IncrementalReel` |
| Post normal reel | Daily at 1:00 AM IST | Posts oldest unposted `NormalReel` |
| Refresh Instagram token | Every 50 days at midnight UTC | Calls Facebook token refresh endpoint |

---

## Instagram Posting Workflow

The `postReel(videoUrl, caption)` function in `instagramService.js` orchestrates the full posting flow:

```
1. getUserToken()       → Load token from DB
2. getPageToken()       → Exchange user token for page token via Graph API
3. createReel()         → POST to /{IG_USER_ID}/reels with video_url + caption
                          Returns: { id: <container_id> }
4. waitForProcessing()  → Poll /{container_id}?fields=status_code every 5s
                          Until status == "FINISHED" (max 5 min / 60 retries)
5. publishReel()        → POST to /{IG_USER_ID}/media_publish
                          with creation_id = <container_id>
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `APP_ID` | Facebook App ID |
| `APP_SECRET` | Facebook App Secret |
| `CLIENT_ID` | OAuth Client ID (token refresh) |
| `CLIENT_SECRET` | OAuth Client Secret (token refresh) |
| `PAGE_ID` | Facebook Page ID |
| `IG_USER_ID` | Instagram Creator/User ID |
| `USER_TOKEN` | Instagram access token (bootstrapped; stored in DB) |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database name |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `SUPABASE_BUCKET` | Supabase storage bucket name |
| `S3_BUCKET` | Tigris S3 bucket (unused) |
| `S3_ACCESS_KEY` | Tigris access key (unused) |
| `S3_SECRET_KEY` | Tigris secret key (unused) |
| `S3_ENDPOINT` | Tigris endpoint (unused) |

---

## Known Constraints & Limitations

- No authentication on any API endpoint — the server must not be publicly exposed.
- Token refresh runs on a 50-day interval; if the server restarts mid-cycle, the next refresh could be delayed indefinitely until the cron fires again.
- If the server is down at a scheduled post time, that post is silently skipped with no retry mechanism.
- `waitForProcessing()` times out after ~5 minutes (60 polls × 5 s); videos that take longer to process will fail silently.
- Multer uses in-memory storage, so large video uploads can exhaust available RAM.
- The S3/Tigris configuration is wired up but unused — Supabase is the sole active storage provider.
- `reelJobs.js` in `/jobs` is fully commented out and no longer used; logic lives in `index.js`.
