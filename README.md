# MedAtlas

MedAtlas is a local-first medical document workspace. It keeps accounts, uploaded medical records, indexes, retrieval, and model inference on the user’s device. It accepts medical PDFs and pasted medical text, rejects non-medical material before indexing, answers questions only from retrieved source text, and records citations and user-approved memory proposals.

**Built with Llama:** the local safety model is based on Meta Llama Guard 3-1B. See [LICENSE.md](LICENSE.md).

## What is implemented

- Local account creation and login using name, date of birth, and password.
- Unique usr_ user IDs, scrypt password hashes, and twelve-hour HttpOnly sessions.
- Per-user document, search, memory, file-download, and audit-log isolation.
- PDF ingestion with native text extraction and Tesseract OCR fallback.
- Pasted-text ingestion through the same medical-only gate.
- Six document classifications: laboratory/pathology, diagnostic imaging, clinical notes/summaries, therapeutics/prescriptions, patient-generated health data, and insurance/consent.
- Semantic chunking, SQLite FTS5/BM25 keyword search, FAISS vector search, reciprocal-rank fusion, and cross-encoder reranking.
- Top-10 hybrid retrieval followed by source-grounded Qwen evidence selection.
- Input and output safety checks with local Llama Guard.
- Exact quote validation, citation generation, abstention for weak evidence, and blocking of diagnosis/treatment/dosing advice.
- Human approval workflow for structured memories extracted from documents.
- Insurance checklist, tagged insurance-source discovery, and offline folder bundling.
- One-command Windows startup with no runtime internet dependency.

## End-to-end pipeline

~~~mermaid
flowchart TD
    A[User opens localhost:3002] --> B[Next.js UI]
    B -->|same-origin /api proxy| C[FastAPI on 127.0.0.1:8765]
    C --> D{Authenticated user?}
    D -->|No| E[401 response]
    D -->|Yes| F[User-scoped SQLite data]

    F --> G[PDF or pasted medical text]
    G --> H[PyMuPDF text extraction]
    H -->|empty page| I[Tesseract OCR]
    I --> J[Qwen3 medical classifier]
    H --> J
    J --> K{Supported category and verbatim medical evidence?}
    K -->|No| L[Reject before storage, chunking, or indexing]
    K -->|Yes| M[Store original, pages, category, and audit event]
    M --> N[Semantic chunks with BGE embeddings]
    N --> O[SQLite FTS5/BM25]
    N --> P[FAISS IndexFlatIP]

    Q[Health question] --> R[Llama Guard input check]
    R -->|Blocked| S[Reject request]
    R -->|Safe| T[FAISS + BM25 retrieval, top 10]
    T --> U[Cross-encoder reranking]
    U --> V[Qwen3 selects up to 3 verbatim quotes]
    V --> W[Exact quote and relevance checks]
    W --> X[Llama Guard output check]
    X -->|Pass| Y[Answer with page citations]
    X -->|Fail or weak evidence| Z[Abstain]
~~~

### Ingestion pipeline

1. The browser sends a PDF or pasted text to the local FastAPI server through the Next.js /api/* rewrite.
2. PDF uploads are limited to 10 MB and 1–50 pages. PyMuPDF extracts native text. Pages without usable text use Tesseract through pytesseract and Pillow.
3. The local Qwen3 classifier receives a bounded sample and must return one supported category plus a verbatim medical excerpt. Invalid, uncertain, or non-medical content is rejected before the original is saved, chunked, embedded, or indexed.
4. Accepted source text is stored in SQLite with its user ID, category, page number, OCR flag, filename, and audit event. The original file is stored under data/uploads/.
5. Text is normalized into paragraphs and sentences. BGE embeddings compare neighboring units; chunks respect paragraph boundaries, a 650-character ceiling, a 60-character minimum, and a cosine semantic-break threshold of 0.62.
6. Each chunk enters SQLite FTS5 for BM25 search and the rebuildable FAISS vector index for semantic search. The vector index is written atomically and SQLite remains authoritative.

### Question-answer pipeline

1. Llama Guard 3-1B checks the user question at temperature 0.2.
2. Safe questions run hybrid retrieval: FAISS candidates plus SQLite FTS5/BM25 candidates are fused with reciprocal-rank scoring. The API asks for top 10 final results.
3. The cross-encoder/ms-marco-MiniLM-L6-v2 reranker scores the fused candidates.
4. Qwen3 4B runs at temperature 0 and may select at most three complete verbatim source quotes.
5. The backend accepts only quotes that exist exactly in the selected chunk, applies a second relevance threshold, and maps every quote to a filename and page.
6. The final cited text is checked by Llama Guard again. Weak retrieval, unsupported evidence, invalid quotes, or blocked output produces an abstention.

### Memory and insurance pipelines

- Memory proposals are extracted only from a user’s own chunks. Each proposal is pending until the user approves or rejects it; only approved memories appear in concepts.
- The insurance panel asks for a policy reference, displays the eight-document checklist, finds that user’s sources tagged Insurance & Consent, and lets the user choose a local parent folder. The browser creates Insurance documents and copies the original files there.

## System architecture

| Layer | Component | Version / configuration | Function |
|---|---|---|---|
| UI | Next.js | 16.3.7 | Serves the local web application and proxies /api/* to FastAPI. |
| UI | React / React DOM | 19.2.8 | Client-side account, dashboard, upload, question, memory, and insurance interactions. |
| UI | TypeScript | 5.9.3 | Type checking for the primary MedAtlas component. |
| API | FastAPI | 0.142.1 | Local HTTP API, validation, authentication middleware, ingestion, search, chat, memory, and file routes. |
| API server | Uvicorn | 0.54.0 | Runs FastAPI on 127.0.0.1:8765. |
| Storage | SQLite + FTS5 | Python sqlite3 | Authoritative documents, pages, chunks, accounts, sessions, memories, and audit logs; BM25 keyword ranking. |
| Vector search | FAISS CPU | 1.15.1 | Exact inner-product search over normalized BGE vectors. |
| Embeddings | BAAI/bge-small-en-v1.5 | revision 5c38ec7c405ec4b44b94cc5a9bb96e735b38267a, 384 dimensions | Sentence and chunk semantic representations. |
| Reranking | cross-encoder/ms-marco-MiniLM-L6-v2 | revision 233902d25c440f23af6f7d6e94d2946bac0bee0a | Pairwise query/chunk relevance scoring after hybrid retrieval. |
| Answer model | Qwen3 4B through Ollama | qwen3:4b, observed Ollama digest 359d7dd4bcda | Structured medical classification, source-quote selection, and memory extraction. |
| Safety model | Llama Guard 3 1B through Ollama | custom medatlas-guard digest 2eac6c1ce23b; base llama-guard3:1b digest 494147e06bf9 | Input and output safety classification; custom template; temperature 0.2. |
| Local model runtime | Ollama | 0.35.0 | Serves both local language models over 127.0.0.1:11434. |
| PDF/OCR | PyMuPDF / Tesseract / pytesseract / Pillow | 1.28.2 / 5.4.0.20240606 / 0.3.13 / 12.3.0 | PDF parsing, OCR fallback, and image conversion. |
| Runtime | Python / Node.js | 3.12.10 / 24.19.0 observed on the development machine | Executes the backend and frontend. |

ChromaDB is not in the active retrieval path. The implemented design uses SQLite FTS5 plus FAISS and keeps SQLite as the source of truth. An optional installed ChromaDB package is not required by the application and is intentionally excluded from the active dependency manifest.

## Direct dependency versions

### Python backend (backend/requirements.txt)

| Package | Version |
|---|---:|
| fastapi | 0.142.1 |
| uvicorn[standard] | 0.54.0 |
| python-multipart | 0.0.32 |
| pymupdf | 1.28.2 |
| pytesseract | 0.3.13 |
| pillow | 12.3.0 |
| sentence-transformers | 6.1.0 |
| huggingface-hub | 1.33.0 |
| faiss-cpu | 1.15.1 |
| httpx | 0.28.1 |
| python-dotenv | 1.2.3 |

PyTorch, NumPy, SciPy, scikit-learn, Transformers, Pydantic, Starlette, and their transitive dependencies are installed by the pinned dependency graph. Their upstream licenses remain applicable; see LICENSE.md.

### Frontend (frontend/package.json and frontend/package-lock.json)

| Package | Locked version |
|---|---:|
| next | 16.3.7 |
| react / react-dom | 19.2.8 |
| lucide-react | 1.31.0 |
| radix-ui | 1.6.7 |
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| input-otp | 1.4.2 |
| tailwind-merge | 3.6.0 |
| @tailwindcss/postcss / tailwindcss | 4.2.1 |
| tw-animate-css | 1.4.0 |
| typescript | 5.9.3 |
| eslint | 9.39.5 |
| eslint-config-next | 16.3.7 |
| @types/node | 26.6.3 |
| @types/react | 19.2.14 |
| @types/react-dom | 19.2.3 |

The lockfile is authoritative for the complete npm transitive dependency tree.

## Local setup and offline operation

### One-time setup while connected

~~~powershell
cd C:\Users\Satwik\Documents\MedAtlas
python -m venv backend\.venv
& .\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
& .\backend\.venv\Scripts\python.exe backend\prepare_models.py
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull qwen3:4b
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull llama-guard3:1b
& .\backend\prepare_guard.ps1
cd frontend
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' run build
~~~

Tesseract must be installed locally at C:\Users\Satwik\AppData\Local\Programs\Tesseract-OCR\tesseract.exe or configured with TESSERACT_CMD in the ignored backend/.env file. Model weights, Ollama models, backend/.venv, frontend/node_modules, the database, uploads, and FAISS data are intentionally excluded from Git.

### Start offline

After the one-time setup, disconnecting from the internet is supported:

~~~powershell
cd C:\Users\Satwik\Documents\MedAtlas
.\start-medatlas.cmd
~~~

The launcher starts Ollama, FastAPI, and the production Next.js server, waits for /api/health to report ok, and opens http://127.0.0.1:3002. All runtime listeners are loopback-only. The public hosted Site is a separate deployment and cannot connect to this local database or local models.

## API surface

| Route | Purpose |
|---|---|
| GET /api/health | Reports SQLite, FAISS, BGE, reranker, Ollama, and medical-gate readiness. |
| GET/POST /api/auth/status, create, login, logout | Local account and session lifecycle. |
| POST /api/ingest/pdf | Extract/OCR, classify, store, chunk, BM25-index, and FAISS-index a PDF. |
| POST /api/ingest/conversation | Classify and ingest pasted medical text. |
| GET /api/sources | Lists only the signed-in user’s sources. |
| GET /api/search?q=...&limit=10 | Hybrid retrieval and reranking. |
| POST /api/chat | Guarded, cited, evidence-grounded question answering. |
| POST /api/memories/propose | Creates pending source-backed memory proposals. |
| GET /api/memories / POST /api/memories/{id}/decision | Review and approve/reject memories. |
| GET /api/concepts | Returns approved concepts for the signed-in user. |
| GET /api/audit | Returns that user’s audit events. |
| POST /api/admin/rebuild-index | Rebuilds FAISS from SQLite. |
| POST /api/admin/rechunk | Rebuilds chunks, BM25 rows, and FAISS from stored pages. |
| GET /api/documents/{id}/file | Downloads only an owned original source. |

## Project layout

~~~text
MedAtlas/
├── backend/                  FastAPI, authentication, ingestion, retrieval, tests
├── frontend/                 Next.js application and local API proxy
├── data/                     SQLite database, uploaded sources, FAISS index (ignored)
├── models/                   BGE and reranker weights (ignored)
├── demo/                     Presentation/test material
├── start-medatlas.cmd        One-command Windows launcher
├── start-local.ps1           Service startup script
├── PRODUCT.md                Product scope notes
├── backend.md                Backend design and offline notes
├── frontend.md               Frontend behavior and local integration notes
├── README.md                 This project guide
└── LICENSE.md                Project license and third-party notices
~~~

## Verification

~~~powershell
cd C:\Users\Satwik\Documents\MedAtlas
& .\backend\.venv\Scripts\python.exe backend\smoke.py
& .\backend\.venv\Scripts\python.exe backend\test_auth.py
Get-ChildItem backend -Filter *.py | ForEach-Object { & .\backend\.venv\Scripts\python.exe -m py_compile $_.FullName }
cd frontend
& 'C:\Program Files\nodejs\npm.cmd' run build
~~~

The local validation covers account isolation, medical-only rejection, PDF extraction, semantic chunks, hybrid retrieval, reranking, FAISS indexing, guarded answers, memory review, and the production frontend build.

## Limitations and safety

- This is a document-grounded research/demo application, not a medical device or a substitute for a licensed clinician.
- Evidence checks reduce unsupported output but do not prove clinical correctness. Reranker scores are relevance scores, not calibrated medical confidence probabilities.
- OCR quality depends on scan quality and the installed Tesseract language data.
- FAISS is fully rebuildable from SQLite, but the current implementation rebuilds the vector file after each ingest; very large corpora need an incremental index strategy.
- Runtime is offline after setup, but installing packages, downloading models, updating dependencies, and the public hosted Site require internet access.
- Before redistributing a bundled application, complete the third-party checklist in LICENSE.md, especially PyMuPDF’s license choice, Meta’s Llama terms, model-weight redistribution, and visual-asset provenance.

## License

MedAtlas source code is released under the MIT License, subject to the separate terms of third-party packages, model weights, fonts, native tools, and visual assets described in LICENSE.md.

