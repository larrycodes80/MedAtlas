# MedAtlas – Your Local Medical Second Brain

## 1. What We Are Building
MedAtlas is a local-first medical second brain that ingests medical PDFs and conversations, answers questions with page citations, proposes medical memories for human approval, and stores structured records on your laptop.

## 2. Core Rules
1. **100% Local AI:** No cloud APIs. Uses `qwen3:4b` for answers, `llama-guard3:1b` for safety, and `bge-small-en-v1.5` for embeddings.
2. **SQLite is Boss (`data/medatlas.db`):** Every document, page, chunk, memory, and audit log lives in SQLite first.
3. **ChromaDB is Rebuildable (`data/chroma/`):** Vector embeddings are generated from SQLite chunks and can be rebuilt anytime.
4. **Human Approval Required:** AI can only propose a medical fact (`pending`). The user must click **Approve** before it becomes active (`approved`).
5. **Safety Guard:** Llama Guard checks user questions first, then Qwen answers, then Llama Guard checks the answer before displaying it.

## 3. Folder Structure
- `backend/` - Python FastAPI server
- `frontend/` - Next.js user interface
- `data/uploads/` - Uploaded PDFs and conversations
- `data/medatlas.db` - Main SQLite database
- `data/chroma/` - ChromaDB vector storage
- `models/` - Local embedding model (`bge-small-en-v1.5`)
- `demo/` - Sample test files for the presentation