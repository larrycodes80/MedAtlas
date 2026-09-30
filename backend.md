# MedAtlas Backend Plan (`backend/`)

## 1. Tech Used
- **Server:** FastAPI running on `http://127.0.0.1:8000`
- **Database:** SQLite (`data/medatlas.db`) + FTS5 keyword search
- **Vector Search:** ChromaDB (`data/chroma/`) + `bge-small-en-v1.5`
- **Local LLM:** Ollama (`http://127.0.0.1:11434`) running `qwen3:4b` and `llama-guard3:1b`
- **PDF & OCR:** PyMuPDF + Tesseract OCR

## 2. SQLite Tables
1. `documents` - Stores file info (`id`, `filename`, `source_type`, `page_count`, `created_at`)
2. `pages` - Stores text per page (`id`, `document_id`, `page_number`, `text_content`, `used_ocr`)
3. `chunks` - Smaller pieces of text for search (`id`, `document_id`, `page_number`, `chunk_index`, `text_content`, `quote_snippet`)
4. `chunks_fts` - Keyword search table linked to `chunks`
5. `memories` - Medical facts (`id`, `category`, `fact_text`, `source_document_id`, `source_page`, `source_quote`, `status`)
6. `audit_logs` - History of every action (`id`, `action`, `target_type`, `target_id`, `details`, `timestamp`)

## 3. API Routes to Build
- `GET /api/health` - Check if SQLite, ChromaDB, and Ollama are working
- `POST /api/ingest/pdf` - Upload and process a PDF file
- `POST /api/ingest/conversation` - Save pasted doctor/patient notes
- `GET /api/sources` - List all uploaded documents
- `GET /api/search` - Search chunks using ChromaDB + SQLite FTS5
- `POST /api/chat` - Safe Q&A with Llama Guard + Qwen + Citations
- `GET /api/memories` - List pending, approved, or rejected memories
- `POST /api/memories/{id}/decision` - Approve or reject a proposed memory
- `GET /api/concepts` - Group approved memories into a patient dashboard
- `GET /api/audit` - Show the full audit history
- `POST /api/admin/rebuild-chroma` - Rebuild ChromaDB from SQLite