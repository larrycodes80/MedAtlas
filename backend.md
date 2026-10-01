# MedAtlas backend

MedAtlas runs locally at `http://127.0.0.1:8765` for the integrated frontend. SQLite stores source text, semantic chunks, proposed memories, and audit events. The FAISS vector index is rebuilt from SQLite. SQLite FTS5 supplies BM25 keyword ranking. A local cross-encoder reranks the combined candidates.

The local vault uses separate password accounts. `backend/auth.py` stores each name and birth date with a unique `usr_...` ID and an scrypt password hash. Sessions last twelve hours and use HttpOnly, SameSite cookies. All medical, search, upload, file, memory, audit, and admin routes require a valid session. `GET /api/health` and the account endpoints remain available before login. Documents and audit events are linked to the signed-in user, so accounts cannot read one another's data.

## Answer pipeline

`Question → Llama Guard 3 1B input check → FAISS + BM25 retrieval (top 10) → cross-encoder rerank → Qwen3 4B → exact quote/citation check → Llama Guard output check → answer`

- Qwen runs at temperature `0` and selects up to three complete source quotes. The backend assembles the visible answer from those quotes, with a citation for each one.
- Llama Guard runs at temperature `0.2` for input and output checks.
- The model sees short source labels; the backend maps them to retrieved SQLite chunks and requires exact quotes. A second relevance check rejects unrelated quotes.
- Weak retrieval, missing evidence, or a failed check produces an abstention. The reranker cutoff is a heuristic, not a medical confidence probability; tune it against a labeled evaluation set before relying on it for clinical use.
- Medical diagnosis, treatment, and dosing advice are outside the Q&A scope. Llama Guard checks the user request and final text; Qwen is also instructed to abstain from those requests.
- Semantic chunking groups neighboring sentences using the local BGE embedding model, respecting paragraph boundaries and a 650-character ceiling.

## Before ingestion

PDFs are text-extracted or OCR'd first. Pasted text is checked directly. A local Qwen classification call rejects content that is not clearly one of these medical document types **before** saving, chunking, BM25 indexing, or embedding: Laboratory & Pathology Reports; Diagnostic Imaging Reports; Clinical Notes & Summaries; Therapeutics & Prescriptions; Patient-Generated Health Data (PGHD); Insurance & Consent. The model must return a verbatim medical-content excerpt; missing or invalid evidence is rejected. Accepted documents store their category in SQLite and expose it through upload responses, `/api/sources`, and search results. Uncertain or invalid classifications fail closed. Older documents without a category are kept but quarantined: they are excluded from search and future index rebuilds, not silently deleted. Restart the backend after updating it; the frontend pauses ingestion and search until `/api/health` reports that the medical gate is active.

## Why FAISS rather than ChromaDB

The current local stack uses SQLite for authoritative text, metadata, and FTS5/BM25, plus FAISS for exact vector search. ChromaDB can also run locally and offline; it is simply not needed for this small corpus. Compared with ChromaDB, we manage metadata joins and persistence ourselves. This implementation fully rebuilds the FAISS file after each upload and loads it for each query, so ingestion and query overhead will grow with the corpus. SQLite remains authoritative, index writes are atomic, a chunk-count check detects some stale indexes, and `/api/admin/rebuild-index` repairs the vector copy. This does not eliminate every consistency risk; if the corpus becomes large or needs richer metadata filtering, evaluate incremental FAISS indexing or ChromaDB then.

## Setup (PowerShell, from the repository root)

```powershell
python -m venv backend\.venv
& .\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
& .\backend\.venv\Scripts\python.exe backend\prepare_models.py
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull qwen3:4b
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull llama-guard3:1b
& .\backend\prepare_guard.ps1
& .\backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
```

`prepare_models.py` downloads pinned BGE and MiniLM model revisions once; inference runs locally afterward. The Ollama commands assume its standard Windows install path. `prepare_guard.ps1` creates the local `medatlas-guard` model. Optional settings go in ignored `backend/.env`. Model weights, data files, and `.env` stay out of Git.

## Offline use on this PC

Tesseract 5.4.0 is installed at `C:\Users\Satwik\AppData\Local\Programs\Tesseract-OCR\tesseract.exe`, with English OCR data. The ignored `backend/.env` points `TESSERACT_CMD` there. The Python environment, BGE and reranker weights, Ollama's `qwen3:4b` and `medatlas-guard` models, frontend packages, SQLite database, and FAISS index are also local. Keep those files when copying or rebuilding the project: Git intentionally excludes them.

From the repository root, run the single local launcher:

```powershell
.\start-local.ps1
```

It starts Ollama, FastAPI on `127.0.0.1:8765`, and Next.js on `127.0.0.1:3002`, with offline model flags enabled. The launcher uses only loopback services.

For a one-click Windows shortcut that starts the same services and opens the app automatically, double-click `start-medatlas.cmd` or run it from PowerShell:

```powershell
.\start-medatlas.cmd
```

Manual startup is also available in separate PowerShell windows:

```powershell
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" serve
```

```powershell
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
& .\backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8765
```

```powershell
$env:NEXT_TELEMETRY_DISABLED = '1'
& .\frontend\node_modules\.bin\next.cmd dev --hostname 127.0.0.1 --port 3002
```

Open `http://127.0.0.1:3002`. OCR, local PDF ingestion, chunking, search, reranking, and model answers use local files and loopback connections. Do not run `pip install`, `npm install`, model pulls, or `prepare_models.py` while offline; those are one-time setup commands for a new machine. The hosted site and remote URLs require internet.

Close older backend and frontend terminal processes before starting the updated app on ports 8765 and 3002. Confirm `http://127.0.0.1:3002/api/auth/status` returns JSON and that an unsigned request to `http://127.0.0.1:3002/api/sources` returns HTTP 401.

On an existing database, migrate old fixed-size chunks and build FAISS through the authenticated admin API after signing in. Direct admin API calls need the browser's session cookie.

## API

- `GET /api/health`: SQLite, FAISS, BGE, reranker, and Ollama status.
- `GET /api/auth/status`, `POST /api/auth/create`, `POST /api/auth/login`, `POST /api/auth/logout`: local password-account session flow.
- `POST /api/ingest/pdf?force_ocr=false`: PDF text or OCR, medical classification, semantic chunks, BM25, and FAISS.
- `POST /api/ingest/conversation`: `{ "title": "...", "text": "..." }`; same medical gate for pasted text.
- `GET /api/sources`: ingested documents, medical categories, and chunk counts.
- `GET /api/search?q=...&limit=10`: hybrid FAISS/BM25 search with reranker scores and categories.
- `POST /api/chat`: `{ "query": "..." }`; returns `answer`, cited source quotes, and `abstained`.
- `POST /api/memories/propose`: `{ "document_id": "..." }`; creates pending memory proposals.
- `GET /api/memories?status=pending|approved|rejected` and `POST /api/memories/{id}/decision`: review memories.
- `GET /api/concepts`: approved memories grouped by category.
- `GET /api/audit?limit=100`: recent audit events.
- `POST /api/admin/rebuild-index`: rebuilds FAISS from current SQLite chunks.
- `POST /api/admin/rechunk`: rebuilds semantic chunks, BM25, and FAISS from stored pages.
- `GET /api/documents/{id}/file`: downloads the original source.

## Checks

```powershell
& .\backend\.venv\Scripts\python.exe backend\smoke.py
Get-ChildItem backend -Filter *.py | ForEach-Object { & .\backend\.venv\Scripts\python.exe -m py_compile $_.FullName }
```

The smoke check covers semantic splitting and rejects a fabricated quote. Live checks should include a supported record question, an unrelated question that abstains, and a treatment-advice question that the guard blocks.

The local offline validation also covers password account creation/login/logout, real local guard and Qwen calls, PDF extraction and medical classification, semantic chunking, FAISS/BM25 indexing, user-scoped Insurance & Consent file retrieval, and the production frontend build. Runtime listeners are restricted to `127.0.0.1`; model downloads and package installs are setup steps only.
