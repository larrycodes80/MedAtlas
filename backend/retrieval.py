import os
import re
import tempfile
from functools import lru_cache

import faiss
import numpy as np
from sentence_transformers import CrossEncoder, SentenceTransformer

from config import BGE_MODEL_PATH, FAISS_INDEX_PATH, RERANKER_MODEL_PATH
from db import get_connection


@lru_cache(maxsize=1)
def model():
    if not (BGE_MODEL_PATH / "config.json").exists():
        raise RuntimeError(f"Embedding model missing: {BGE_MODEL_PATH}")
    return SentenceTransformer(str(BGE_MODEL_PATH), device="cpu", local_files_only=True)


@lru_cache(maxsize=1)
def reranker():
    if not (RERANKER_MODEL_PATH / "config.json").exists():
        raise RuntimeError(f"Reranker model missing: {RERANKER_MODEL_PATH}")
    return CrossEncoder(str(RERANKER_MODEL_PATH), device="cpu", local_files_only=True, max_length=256)


def rebuild(rows):
    rows = list(rows)
    if rows:
        vectors = np.asarray(
            model().encode([row["text_content"] for row in rows], normalize_embeddings=True, show_progress_bar=False),
            dtype="float32",
        )
        index = faiss.IndexFlatIP(vectors.shape[1])
        index.add(vectors)
    else:
        index = faiss.IndexFlatIP(384)

    # One atomic file keeps FAISS vectors and their SQLite chunk IDs in sync.
    with tempfile.NamedTemporaryFile(dir=FAISS_INDEX_PATH.parent, suffix=".npz", delete=False) as temp:
        temporary_path = temp.name
    try:
        np.savez(temporary_path, index=faiss.serialize_index(index), ids=np.asarray([row["id"] for row in rows]))
        os.replace(temporary_path, FAISS_INDEX_PATH)
    finally:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)
    return len(rows)


def index_document(doc_id, rows):
    # ponytail: full rebuild per ingest is simple for a laptop corpus; use incremental FAISS IDs if it gets large.
    with get_connection() as db:
        all_rows = db.execute(
            "SELECT c.id, c.text_content FROM chunks c JOIN documents d ON d.id = c.document_id "
            "WHERE d.medical_category IS NOT NULL ORDER BY c.id"
        ).fetchall()
    rebuild(all_rows)
    return len(rows)


def _fts_query(query):
    tokens = re.findall(r"\w+", query.lower())[:16]
    return " OR ".join(f'"{token}"' for token in tokens)


def _vector_results(query, limit):
    if not FAISS_INDEX_PATH.exists():
        raise RuntimeError("FAISS index is missing; rebuild it from SQLite.")
    with np.load(FAISS_INDEX_PATH, allow_pickle=False) as saved:
        index = faiss.deserialize_index(saved["index"])
        ids = saved["ids"].tolist()
    if index.ntotal != len(ids):
        raise RuntimeError("FAISS index is inconsistent; rebuild it from SQLite.")
    if not ids:
        return [], 0
    query_vector = np.asarray(
        model().encode(["Represent this sentence for searching relevant passages: " + query], normalize_embeddings=True, show_progress_bar=False),
        dtype="float32",
    )
    scores, positions = index.search(query_vector, min(limit, len(ids)))
    return [(ids[position], float(score)) for score, position in zip(scores[0], positions[0]) if position >= 0], len(ids)


def search(query, db, limit=10):
    query = query.strip()
    if not query:
        return []

    vector, index_count = _vector_results(query, max(20, limit * 4))
    if db.execute(
        "SELECT COUNT(*) FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.medical_category IS NOT NULL"
    ).fetchone()[0] != index_count:
        raise RuntimeError("FAISS index is stale; rebuild it from SQLite.")
    expression = _fts_query(query)
    lexical = db.execute(
        "SELECT chunk_id, bm25(chunks_fts) AS rank FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT 20",
        (expression,),
    ).fetchall() if expression else []

    candidates = {}
    for ranking in (vector, lexical):
        for position, (chunk_id, score) in enumerate(ranking, 1):
            candidate = candidates.setdefault(chunk_id, {"fusion_score": 0.0})
            candidate["fusion_score"] += 1 / (60 + position)
            if ranking is vector:
                candidate["vector_similarity"] = score
            else:
                candidate["bm25_score"] = float(score)

    ranked = sorted(candidates, key=lambda chunk_id: candidates[chunk_id]["fusion_score"], reverse=True)[:30]
    results = []
    for chunk_id in ranked:
        row = db.execute(
            """
            SELECT c.id AS chunk_id, c.document_id, d.filename, d.medical_category,
                   c.page_number, c.text_content, c.quote_snippet
            FROM chunks c JOIN documents d ON d.id = c.document_id
            WHERE c.id = ? AND d.medical_category IS NOT NULL
            """,
            (chunk_id,),
        ).fetchone()
        if row:
            results.append({**dict(row), **candidates[chunk_id]})
    if not results:
        return []

    scores = reranker().predict([(query, row["text_content"]) for row in results], show_progress_bar=False)
    for row, score in zip(results, scores):
        row["rerank_score"] = float(score)
        row["score"] = round(row["rerank_score"], 4)
        row["fusion_score"] = round(row["fusion_score"], 6)
        row["vector_similarity"] = round(row.get("vector_similarity", 0.0), 4)
    return sorted(results, key=lambda row: (row["rerank_score"], row["fusion_score"]), reverse=True)[:limit]
