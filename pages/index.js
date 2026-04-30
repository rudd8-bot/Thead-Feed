import { useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState({});
  const [analyzing, setAnalyzing] = useState({});

  async function fetchPosts() {
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    setPosts([]);
    setAnalysis({});
    try {
      const res = await fetch(`/api/threads?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPosts(data.posts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function analyzePost(post) {
    setAnalyzing((prev) => ({ ...prev, [post.id]: true }));
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: post.text }),
      });
      const data = await res.json();
      setAnalysis((prev) => ({ ...prev, [post.id]: data.result }));
    } catch (e) {
      setAnalysis((prev) => ({ ...prev, [post.id]: "분석 실패" }));
    } finally {
      setAnalyzing((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>🧵 Thead Feed</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchPosts()}
          placeholder="Threads 사용자명 입력 (예: zuck)"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        />
        <button
          onClick={fetchPosts}
          disabled={loading}
          style={{ padding: "10px 20px", borderRadius: 8, background: "#000", color: "#fff", border: "none", fontSize: 16, cursor: "pointer" }}
        >
          {loading ? "..." : "검색"}
        </button>
      </div>

      {error && <p style={{ color: "red", marginBottom: 16 }}>{error}</p>}

      {posts.map((post) => (
        <div key={post.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ marginBottom: 8, lineHeight: 1.6 }}>{post.text || "(텍스트 없음)"}</p>
          <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>{new Date(post.timestamp).toLocaleString("ko-KR")}</p>

          <button
            onClick={() => analyzePost(post)}
            disabled={analyzing[post.id]}
            style={{ padding: "6px 14px", borderRadius: 6, background: "#f0f0f0", border: "none", cursor: "pointer", fontSize: 14 }}
          >
            {analyzing[post.id] ? "분석 중..." : "AI 분석"}
          </button>

          {analysis[post.id] && (
            <div style={{ marginTop: 12, padding: 12, background: "#f8f8f8", borderRadius: 8, fontSize: 14, lineHeight: 1.7 }}>
              {analysis[post.id]}
            </div>
          )}
        </div>
      ))}

      {!loading && posts.length === 0 && !error && (
        <p style={{ color: "#aaa", textAlign: "center", marginTop: 40 }}>사용자명을 입력하고 검색하세요</p>
      )}
    </div>
  );
}
