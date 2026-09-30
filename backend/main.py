from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
from config import DB_PATH, CHROMA_DIR, BGE_MODEL_PATH, OLLAMA_BASE_URL, QWEN_MODEL, GUARD_MODEL
from db import init_db, get_connection

app = FastAPI(title="MedAtlas Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
async def health_check():
    sqlite_ok = False
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        sqlite_ok = DB_PATH.exists()
    except Exception:
        sqlite_ok = False

    bge_ok = BGE_MODEL_PATH.exists()
    chroma_ok = CHROMA_DIR.exists()

    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            ollama_ok = resp.status_code == 200
    except Exception:
        ollama_ok = False

    return {
        "status": "ok" if (sqlite_ok and bge_ok and ollama_ok) else "degraded",
        "sqlite": sqlite_ok,
        "chroma_dir": chroma_ok,
        "bge_model": bge_ok,
        "ollama": ollama_ok,
        "models": {
            "qwen": QWEN_MODEL,
            "guard": GUARD_MODEL
        }
    }