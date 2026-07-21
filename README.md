# Performance Doctor — API server

Express service for **React Native–oriented** static analysis, optional **Groq** (`?ai=1`), and hybrid **AST + LLM** issue merging.

## Run

```bash
npm install
npm run dev      # ts-node-dev, default PORT 4000 (or `PORT` in `server/.env`)
npm run build && npm start
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | For `?ai=1` | Groq API key. |
| `PORT` | No | Listen port (default `4000`). If busy, server may try next ports (see `src/index.ts`). |
| `ANALYZE_API_KEY` | No | If set, `x-analyze-api-key` is enforced in **`NODE_ENV=production`** or when `ANALYZE_API_KEY_FORCE=1`. |
| `ANALYZE_LLM_ONLY` | No | `1` → skip AST merge with LLM (debug). |
| `ANALYZE_RATE_LIMIT_MAX` | No | Requests per window for `POST /analyze`. |

## API

### `POST /analyze`

**Body (JSON)**

```json
{ "code": "string", "platform": "ios" | "android" | "both" }
```

**Query**

- **`?ai=1`** — Run Groq + hybrid merge with AST (`analyzeCodeWithGroq`).  
- **Omit `ai`** — Static AST only (`analyzeCode`).

**Response** — `AnalysisResult`: `overallScore`, `optimizedScore`, `issues[]`, `metrics`, `optimizedCode`, `topBottleneck`, `analyzedAt`.

### Headers (optional)

- `x-analyze-api-key` — Must match `ANALYZE_API_KEY` when enforcement is active (see above).

## Code layout

- `src/analysis/analyzer.ts` — Parse, traverse, Groq, merge  
- `src/analysis/rules/` — AST rules (FlatList, bridge heuristics, memo, etc.)  
- `src/analysis/mergeIssues.ts` — AST + LLM dedupe  
- `src/utils/groqClient.ts` — Groq client (timeouts / retries tuned)  
- `src/app.ts` — Routes, rate limit, optional API key  

## Tests

```bash
npm test
```
