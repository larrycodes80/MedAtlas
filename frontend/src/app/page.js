"use client";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

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
    checkHealth();
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: "900px", margin: "40px auto", padding: "20px" }}>
      <h1>MedAtlas – Local Medical Second Brain</h1>
      <p style={{ color: "#555" }}>100% Local AI • SQLite Authoritative • ChromaDB Vector Search</p>

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
            <li><strong>ChromaDB Folder:</strong> {health.chroma_dir ? "✅ Ready" : "❌ Offline"}</li>
            <li><strong>BGE Embedding Model:</strong> {health.bge_model ? "✅ Ready" : "❌ Missing"}</li>
            <li><strong>Ollama Local LLM:</strong> {health.ollama ? "✅ Connected" : "❌ Offline"}</li>
            <li><strong>Active Models:</strong> {health.models?.qwen} & {health.models?.guard}</li>
          </ul>
        ) : (
          !error && <p>Checking backend connection...</p>
        )}
      </div>
    </main>
  );
}