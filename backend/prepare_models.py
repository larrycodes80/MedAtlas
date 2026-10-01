"""Download the two small retrieval models once; inference stays local."""

from pathlib import Path

from huggingface_hub import snapshot_download


ROOT = Path(__file__).resolve().parents[1] / "models"
FILES = [
    ("BAAI/bge-small-en-v1.5", "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a", "bge-small-en-v1.5"),
    ("cross-encoder/ms-marco-MiniLM-L6-v2", "233902d25c440f23af6f7d6e94d2946bac0bee0a", "ms-marco-MiniLM-L6-v2"),
]

for repo, revision, folder in FILES:
    target = ROOT / folder
    if (target / "config.json").exists() and (target / "model.safetensors").exists():
        print(f"Ready: {folder}")
        continue
    snapshot_download(
        repo_id=repo,
        revision=revision,
        local_dir=target,
        allow_patterns=["*.json", "*.safetensors", "vocab.txt", "1_Pooling/*", "2_Normalize/*"],
    )
    print(f"Downloaded: {folder}")
