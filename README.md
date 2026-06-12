# ChatApplication — Production Deployment

This repository is prepared for production deployments using Docker Compose with AWS S3 for all uploads and Redis for presence/cache.

Key points
- All uploaded avatars and message files are stored in S3 (no local fallback).
- Redis is used for presence and caching recent messages for faster login sync.
- A single root `.env` (NOT tracked) is used for runtime secrets. Use `.env.example` as a template.
- A single `.gitignore` and `.dockerignore` are present at the repo root.

Quick start (production with Docker Compose)

1. Copy and populate `.env` from `.env.example` at repository root.

2. Start services:

```bash
docker-compose up -d --build
```

3. The API will be available at `http://localhost:3000` by default.

Environment variables (minimal required)
- `ACCESS_TOKEN_SECRET` — JWT access token secret
- `REFRESH_TOKEN_SECRET` — JWT refresh token secret
- `MONGODB_URI` — MongoDB connection URI
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` — AWS S3 credentials and bucket
- `REDIS_ENABLED=true`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` — Redis connection

Notes
- Do not commit real `.env` files. The repo uses `.env.example` as the canonical template.
- The server will fail fast if S3 credentials are missing (S3-only upload policy).
- Frontend expects URLs returned from the server (S3 URLs) for avatars and files.

If you want, I can:
- Add a small deploy script that validates envs and runs `docker-compose`.
- Continue a deeper duplicate-file cleanup and remove unused assets.
