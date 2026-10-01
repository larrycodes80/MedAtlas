import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
# Runtime inference is local-only; model libraries must not fall back to Hub downloads.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
root = Path(__file__).resolve().parents[1]

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen3:4b")
GUARD_MODEL = os.getenv("GUARD_MODEL", "medatlas-guard")

DATA_DIR = Path(os.getenv("DATA_DIR", str(root / "data")))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "medatlas.db"
BGE_MODEL_PATH = Path(os.getenv("BGE_MODEL_PATH", str(root / "models/bge-small-en-v1.5")))
RERANKER_MODEL_PATH = Path(os.getenv("RERANKER_MODEL_PATH", str(root / "models/ms-marco-MiniLM-L6-v2")))
FAISS_INDEX_PATH = DATA_DIR / "faiss.npz"
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "C:/Program Files/Tesseract-OCR/tesseract.exe")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
