"use client";
import { useEffect, useState } from "react";

const API_BASE = "";

export default function Home() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sources, setSources] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");

  const checkHealth = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setError("Cannot reach backend at " + API_BASE);
    }
  };

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/health`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Health check failed");
        if (active) setHealth(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Cannot reach backend");
      });
    fetch(`${API_BASE}/api/sources`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Source list failed");
        if (active) setSources(data.sources || []);
      })
      .catch((err) => {
        if (active) setError(err.message || "Cannot load sources");
      });
    return () => { active = false; };
  }, []);

  const loadSources = async () => {
    const res = await fetch(`${API_BASE}/api/sources`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Source list failed");
    setSources(data.sources || []);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!health?.medical_gate) { setError("Restart the backend to enable medical document checks."); return; }
    setUploading(true);
    setMessage("Checking medical content before indexing...");
    setError(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/ingest/pdf`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setMessage(`Saved ${data.ingested.filename} as ${data.ingested.medical_category}: ${data.ingested.chunk_count} chunk(s); vector indexed: ${data.ingested.indexed}.`);
      await loadSources();
    } catch (err) {
      setError(err.message || "Upload failed");
      setMessage("");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handlePaste = async (event) => {
    event.preventDefault();
    if (!pasteText.trim()) return;
    if (!health?.medical_gate) { setError("Restart the backend to enable medical document checks."); return; }
    setUploading(true);
    setMessage("Checking medical content before indexing...");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ingest/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pasteTitle.trim() || "Pasted document", text: pasteText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Paste failed");
      setMessage(`Saved as ${data.ingested.medical_category}: ${data.ingested.chunk_count} chunk(s).`);
      setPasteText("");
      await loadSources();
    } catch (err) {
      setError(err.message || "Paste failed");
      setMessage("");
    } finally {
      setUploading(false);
    }
  };

  const search = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    if (!health?.medical_gate) { setError("Restart the backend to enable medical-only search."); return; }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Search failed");
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: "900px", margin: "40px auto", padding: "20px" }}>
      <h1>MedAtlas – Local Medical Second Brain</h1>
      <p style={{ color: "#555" }}>100% Local AI • SQLite Authoritative • FAISS + BM25 Search</p>

      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "20px", marginTop: "20px" }}>
        <h2>System Health Status</h2>
        <button onClick={checkHealth} style={{ padding: "8px 14px", cursor: "pointer", marginBottom: "15px" }}>
          Refresh Status
        </button>

        {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}

        {health ? (
          <ul style={{ lineHeight: "1.8", fontSize: "16px" }}>
            <li><strong>Overall Status:</strong> {health.status.toUpperCase()}</li>
            <li><strong>SQLite Database:</strong> {health.sqlite ? "✅ Ready" : "❌ Offline"}</li>
            <li><strong>FAISS Index:</strong> {health.faiss_index ? "✅ Ready" : "❌ Offline"}</li>
            <li><strong>BGE Embedding Model:</strong> {health.bge_model ? "✅ Ready" : "❌ Missing"}</li>
            <li><strong>Ollama Local LLM:</strong> {health.ollama ? "✅ Connected" : "❌ Offline"}</li>
            <li><strong>Active Models:</strong> {health.models?.qwen} & {health.models?.guard}</li>
          </ul>
        ) : (
          !error && <p>Checking backend connection...</p>
        )}
        {health && !health.medical_gate && <p role="alert">Restart the backend, then click Refresh Status. Ingestion and search are paused until the medical classification gate is active.</p>}
      </div>

      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "20px", marginTop: "20px" }}>
        <h2>Ingest a medical PDF</h2>
        <label htmlFor="pdf-upload">Choose a PDF</label>
        <input id="pdf-upload" type="file" accept="application/pdf,.pdf" onChange={handleFileUpload} disabled={uploading || !health?.medical_gate} />
        <h3>Or paste a medical document</h3>
        <form onSubmit={handlePaste}>
          <label htmlFor="paste-title">Title</label>
          <input id="paste-title" value={pasteTitle} onChange={(event) => setPasteTitle(event.target.value)} />
          <label htmlFor="paste-text">Document text</label>
          <textarea id="paste-text" value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={6} style={{ display: "block", width: "100%" }} />
          <button type="submit" disabled={uploading || !health?.medical_gate || !pasteText.trim()}>{uploading ? "Checking..." : "Check and save"}</button>
        </form>
        {message && <p role="status">{message}</p>}
        <h3>Saved sources ({sources.length})</h3>
        {sources.length === 0 ? <p>No documents uploaded yet.</p> : (
          <ul>
            {sources.map((source) => (
              <li key={source.id}>
                <strong>{source.filename}</strong> — {source.medical_category || "Legacy: unclassified (quarantined)"} · {source.page_count} page(s), {source.chunk_count} chunk(s)
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "20px", marginTop: "20px" }}>
        <h2>Search indexed sources</h2>
        <form onSubmit={search}>
          <label htmlFor="source-search">Question or keyword</label>
          <input id="source-search" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="submit" disabled={searching || !health?.medical_gate || !query.trim()}>
            {searching ? "Searching..." : "Search"}
          </button>
        </form>
        {results.map((result) => (
          <details key={result.chunk_id} style={{ marginTop: "12px" }}>
            <summary>{result.filename} · {result.medical_category} · page {result.page_number}</summary>
            <p style={{ whiteSpace: "pre-wrap" }}>{result.text_content}</p>
            <small>Chunk {result.chunk_id} · score {result.score}</small>
          </details>
        ))}
        {query && !searching && results.length === 0 && <p>No matching chunks.</p>}
      </div>
    </main>
  );
}
