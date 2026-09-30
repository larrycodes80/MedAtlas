# MedAtlas Frontend Plan (`frontend/`)

## 1. Tech Used
- **App:** Next.js (JavaScript) running on `http://127.0.0.1:3000`
- **Talks to Backend at:** `http://127.0.0.1:8000`

## 2. Dashboard Screens
1. **Top Status Bar:** Shows green/red indicators for Backend, SQLite, ChromaDB, and Ollama, plus a "Rebuild Vector DB" button.
2. **Sources Screen:** Upload PDF button, Paste Conversation box, and list of uploaded files.
3. **Chat Screen:** Ask medical questions, see Llama Guard safety badges, and read cited page numbers + quotes.
4. **Memory Review Screen:** See facts Qwen found with **Approve** and **Reject** buttons.
5. **Patient Concepts Screen:** View approved Conditions, Medications, Allergies, and Lab Results sorted cleanly.
6. **Audit Log Screen:** View a timeline of every upload, approval, or rejection.