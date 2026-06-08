# woped-web — local test build (t2p v2)

This branch is a **testing build** of the WOPED web frontend, refactored to use the
**T2P v2 API** with an updated UI. It is meant for trying out the new text-to-process
flow against a **locally running backend stack**. It is not an official release and is
not meant to be merged into `woped/woped-web`.

> ⚠️ The hosted DHBW server does **not** serve the v2 endpoints yet, so you **must** run
> the t2p-2.0 backend stack locally to test the T2P flow.

## 1. Start the backend stack

The T2P tab calls **t2p-2.0 on port 5005**, which in turn chains to the LLM connector
and the model-transformer. All three repos on branch `feature/WWI23B4_T2P`, started
from each repo's root (each repo has its own `.venv`):

| Service              | Port | Start command (from the repo root)                                                                                   |
|----------------------|------|-----------------------------------------------------------------------------------------------------------------------|
| llm-api-connector    | 5001 | `.venv/bin/flask --app app run --port 5001`                                                                            |
| model-transformer    | 5002 | `.venv/bin/flask --app flasky run --port 5002`                                                                         |
| t2p-2.0              | 5005 | `LLM_API_CONNECTOR_URL=http://localhost:5001 TRANSFORMER_BASE_URL=http://localhost:5002 .venv/bin/flask --app flasky run --port 5005` |

`t2p-2.0` (5005) is the one the frontend talks to; the env vars point it at the other two.

## 2. Start the frontend

```bash
npm install
npm start          # = ng serve --proxy-config src/proxy.conf.json
```

Open **http://localhost:4200**. The dev proxy sends `/t2p-api` → `localhost:5005`.
For T2P generation, enter your **LLM API key** in the UI (OpenAI `gpt-4o` by default, or
Gemini `gemini-1.5-pro`; the model list comes from `GET /v2/models`).

## What the frontend calls

| Tab   | Frontend path  | Proxied to (local) | Calls                                                        |
|-------|----------------|--------------------|--------------------------------------------------------------|
| T2P   | `/t2p-api`     | `localhost:5005`   | `GET /v2/models`, `POST /v2/generate/bpmn`, `POST /v2/generate/pnml` |
| P2T   | `/p2t`         | `localhost:8082`   | the P2T (process-to-text) service                            |

## Notes

- The **P2T** tab points at `localhost:8082`, a **separate** service not part of the
  t2p-2.0 stack above. It won't work unless you also run that backend. (P2T *is* hosted
  on DHBW, so `src/proxy.conf.dhbw.json` works for the P2T tab — but **not** for T2P,
  since DHBW has no v2 endpoints yet.)
- The `--proxy-config` flag is required; without it the dev server won't proxy
  `/t2p-api` or `/p2t`.
- To change a port, edit the `target` in `src/proxy.conf.json`.
