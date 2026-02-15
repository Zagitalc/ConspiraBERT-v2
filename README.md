# ConspiraBERT v2

ConspiraBERT v2 is a rebuilt conspiracy-framing analyzer focused on modern API design, resilient inference fallback, and a cleaner UX.

## What Changed in v2

### Architecture
- Replaced legacy Flask route stack with a FastAPI backend.
- Added typed request/response schemas with Pydantic.
- Introduced provider-based inference flow:
  - Primary: OpenAI API
  - Fallback: local heuristic analyzer (no external API required)
- Added health and version endpoints for operational visibility.

### API Migration
- Removed legacy routes:
  - `/1/classify`
  - `/2/summarize-and-classify`
- Added v2 routes:
  - `POST /api/v2/analyze`
  - `GET /api/v2/health`
  - `GET /api/v2/version`

### Inference Behavior
- v2 classifies conspiratorial framing (not raw sentiment).
- If OpenAI is configured and available, v2 uses OpenAI.
- If OpenAI is unavailable (missing key, timeout, package issue), v2 automatically returns heuristic results with a warning.
- Sentence tokenization is robust:
  - prefers NLTK `punkt` when available
  - falls back to regex sentence splitting if tokenizer download/lookup fails

### Frontend
- Replaced old Bootstrap interface with a minimal single-page frontend.
- Added:
  - confidence meter
  - sentence-level labels
  - signal chips
  - model/provider badge
  - explicit loading, warning, and error states

### Deployment and Tooling
- Added Docker support (`Dockerfile`, `docker-compose.yml`, `.dockerignore`).
- Added Make targets for dev/test/build/run workflows.
- Added test scaffolding for API, schema validation, heuristic provider, and analyzer behavior.

## Repo Layout (v2)

- `project/backend/main.py`: FastAPI app entrypoints/routes
- `project/backend/config.py`: settings + config fingerprint
- `project/backend/schemas.py`: request/response contracts
- `project/backend/services/analyzer.py`: provider selection + fallback orchestration
- `project/backend/services/providers/openai_provider.py`: OpenAI inference adapter
- `project/backend/services/providers/heuristic_provider.py`: local fallback analyzer
- `project/frontend/`: static UI assets
- `project/app.py`: compatibility launcher (`python app.py`)

## API Contract

### `POST /api/v2/analyze`
Request JSON:
- `text` (string, required)
- `summarize` (bool, default `true`)
- `include_sentence_breakdown` (bool, default `true`)
- `max_sentences` (int, default `80`, range `1..200`)
- `language_hint` (string or `null`)

Response JSON:
- `overall_label`: `conspiracy | uncertain | non_conspiracy`
- `confidence`: float `0..1`
- `score`: int `0..100`
- `summary`: string or `null`
- `sentence_results`: list of sentence-level classifications
- `signals`: weighted evidence signals
- `model_info`: `{ provider, model, latency_ms, warning? }`
- `disclaimer`: user-facing caveat
- `warning`: optional degradation/fallback note

### `GET /api/v2/health`
Returns provider readiness:
- `openai_ready`
- `fallback_ready`

### `GET /api/v2/version`
Returns:
- app name
- app version
- config fingerprint

## Run Locally (Python)

```bash
cd /Users/longhchung/Documents/GitHub/ConspiraBERT-reworked/project
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Run with Docker

```bash
cd /Users/longhchung/Documents/GitHub/ConspiraBERT-reworked/project
cp .env.example .env
docker compose up --build
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Environment Variables

`project/.env`:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
APP_ENV=development
```

Notes:
- If `OPENAI_API_KEY` is empty, app still works via heuristic fallback.
- `OPENAI_MODEL` is optional; default model is configured in backend settings.

## Example Request

```bash
curl -X POST http://127.0.0.1:8000/api/v2/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The media is hiding the truth about this event.",
    "summarize": true,
    "include_sentence_breakdown": true,
    "max_sentences": 80
  }'
```

## Troubleshooting

| Problem | Symptoms | Fix |
|---|---|---|
| Missing dependencies | `ModuleNotFoundError` | Activate venv and run `pip install -r requirements.txt` |
| Docker daemon not running | `Cannot connect to the Docker daemon` | Start Docker Desktop, wait until healthy, rerun compose |
| Missing `.env` for compose | `open .../.env: no such file or directory` | `cp .env.example .env` in `project/` |
| No OpenAI key | health shows `openai_ready=false` | Add `OPENAI_API_KEY` to `.env` or run fallback mode |

## Make Targets

From `project/`:
- `make dev`
- `make test`
- `make docker-build`
- `make docker-run`
