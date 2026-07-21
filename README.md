# Performance Doctor API

Express and TypeScript API for React Native static analysis, optional Groq
analysis (`?ai=1`), JWT authentication, and PostgreSQL-backed analysis history.

## Local development

Requirements: Node.js 20 and PostgreSQL.

```bash
cp .env.example .env
npm install
npm run dev
```

Create the database named by `DATABASE_URL` before starting the API. Tables and
indexes are created idempotently during startup.

```bash
npm test
npm run build
npm start
```

## Environment

| Variable | Production | Description |
| --- | --- | --- |
| `DATABASE_URL` | Required | PostgreSQL connection string. |
| `JWT_SECRET` | Required | Random secret containing at least 32 characters. |
| `GROQ_API_KEY` | Required | Groq key used by `POST /analyze?ai=1`. |
| `ANALYZE_API_KEY` | Required | Separate client-facing key expected in `x-analyze-api-key`. |
| `CORS_ORIGINS` | Required | Comma-separated frontend origins, without paths. |
| `NODE_ENV` | Required | Set to `production` on Render. |
| `PORT` | Render-provided | HTTP port; defaults to `4000` locally. |
| `ANALYZE_JSON_LIMIT` | Optional | Express JSON body limit; defaults to `512kb`. |
| `ANALYZE_RATE_LIMIT_MAX` | Optional | Analyze requests per minute; defaults to `40`. |
| `AUTH_RATE_LIMIT_MAX` | Optional | Login/register requests per minute; defaults to `30`. |
| `ANALYZE_LLM_ONLY` | Optional | Set to `1` to omit AST findings from AI results. |

Never commit `.env`. Values in `.env.example` are placeholders only.

## API

- `GET /health` — service and database readiness
- `POST /analyze` — static analysis; add `?ai=1` plus a Bearer JWT for Groq analysis
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` — Bearer JWT required
- `GET /history` — Bearer JWT required
- `GET /history/:id` — Bearer JWT required
- `POST /history` — Bearer JWT required
- `DELETE /history/:id` — Bearer JWT required

`POST /analyze` expects:

```json
{ "code": "string", "platform": "ios" }
```

In production, send the configured `ANALYZE_API_KEY` as
`x-analyze-api-key`. Treat this browser-visible value as an access identifier,
not as the only protection for paid AI calls; AI analysis also requires a
signed-in user and is rate-limited.

## Deploy to Render from GitHub

The repository includes `render.yaml`, which creates the web service and
PostgreSQL database.

1. Revoke and replace any API key that has ever been committed to Git.
2. Push the repository to GitHub and ensure the `CI` workflow passes.
3. In Render, choose **New > Blueprint**, connect the GitHub repository, and
   apply `render.yaml`.
4. Enter `GROQ_API_KEY`, `ANALYZE_API_KEY`, and `CORS_ORIGINS` when prompted.
   Set `CORS_ORIGINS` to the deployed frontend URL, for example
   `https://performance-doctor.example.com`.
5. After deployment, verify `https://<service>.onrender.com/health`, then test
   registration, login, analysis, and history.

Deploy directly from GitHub only after secrets have been rotated, CI is green,
and the production frontend origin is known. After that, use pull requests into
`main`; Render auto-deploys each commit that passes its test-and-build command.

Render sends `SIGTERM` during deploys. The server stops accepting traffic,
finishes active requests, and closes the PostgreSQL pool before exiting.
