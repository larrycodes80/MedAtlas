import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen3:4b")
GUARD_MODEL = os.getenv("GUARD_MODEL", "llama-guard3:1b")

DATA_DIR = Path(os.getenv("DATA_DIR", "C:/Users/Satwik/Documents/MedAtlas/data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "medatlas.db"
CHROMA_DIR = Path(os.getenv("CHROMA_DIR", str(DATA_DIR / "chroma")))
BGE_MODEL_PATH = Path(os.getenv("BGE_MODEL_PATH", "C:/Users/Satwik/Documents/MedAtlas/models/bge-small-en-v1.5"))
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "C:/Program Files/Tesseract-OCR/tesseract.exe")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)