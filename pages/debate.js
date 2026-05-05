$ cat /home/user/Thead-Feed/pages/debate.js

import { useState } from "react";
import Link from "next/link";

const ROUND_LABELS = {
  1: "1라운드 — 초기 답변",
  2: "2라운드 — 상호 검토",
};

const BADGE_COLORS = {
  Haiku: "#5B5BD6",
  Sonnet: "#9333EA",
  "GPT-4o-mini": "#16A34A",
  "Gemini Flash": "#CA8A04",
};

function AgentCard({ agentName, emoji, badge, text, thinking }) {
  const badgeColor = BADGE_COLORS[badge] || "#555";
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: "#fff",
        opacity: thinking ? 0.6 : 1,
        transition: "opacity 0.3s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{agentName}</span>
        {badge && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#fff",
              background: badgeColor,
              borderRadius: 4,
              padding: "2px 6px",
            }}
          >
            {badge}
          </span>
        )}
        {thinking && (
          <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>생각 중...</span>
        )}
      </div>
      {text && (
        <p style={{ margin: 0, lineHeight: 1.75, fontSize: 15, color: "#111", whiteSpace: "pre-wrap" }}>
          {text}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 12,
          borderBottom: "1px solid #f3f4f6",
          paddingBottom: 8,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

async function parseSSEStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const messages = buffer.split("\n\n");
    buffer = messages.pop();

    for (const message of messages) {
      if (!message.trim()) continue;
      let event = "message";
      let dataStr = "";
      for (const line of message.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
      }
      if (dataStr) {
        try {
          onEvent(event, JSON.parse(dataStr));
        } catch {}
      }
    }
  }
}

export default function Debate() {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("");
  const [thinking, setThinking] = useState(null);
  const [rounds, setRounds] = useState({});
  const [synthesis, setSynthesis] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function startDebate() {
    if (!question.trim() || running) return;
    setRunning(true);
    setError("");
    setStatus("");
    setThinking(null);
    setRounds({});
    setSynthesis("");

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "서버 오류");
      }

      await parseSSEStream(res, (event, data) => {
        switch (event) {
          case "status":
            setStatus(data.message);
            break;
          case "thinking":
            setThinking({ agentId: data.agentId, round: data.round });
            break;
          case "response":
            setThinking(null);
            setRounds((prev) => ({
              ...prev,
              [data.round]: [...(prev[data.round] || []), data],
            }));
            break;
          case "synthesis":
            setSynthesis(data.text);
            break;
          case "done":
            setStatus("");
            break;
          case "error":
            setError(data.message);
            break;
        }
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
      setThinking(null);
    }
  }

  const roundNums = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Link href="/" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 14 }}>
          ← Thead Feed
        </Link>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, marginTop: 12 }}>
        🤖 Multi-LLM 토론
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        질문 하나에 여러 AI가 독립적으로 답변하고, 서로의 의견을 검토해 최종 답변을 완성합니다.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && startDebate()}
          placeholder="예: 인공지능이 인간의 창의성을 대체할 수 있을까요?"
          disabled={running}
          style={{
            flex: 1,
            padding: "11px 14px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 15,
            outline: "none",
          }}
        />
        <button
          onClick={startDebate}
          disabled={running || !question.trim()}
          style={{
            padding: "11px 22px",
            borderRadius: 10,
            background: running ? "#6b7280" : "#111",
            color: "#fff",
            border: "none",
            fontSize: 15,
            fontWeight: 600,
            cursor: running ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {running ? "토론 중..." : "토론 시작"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 12,
            color: "#dc2626",
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {status && (
        <p style={{ color: "#6b7280", fontSize: 14, fontStyle: "italic", marginBottom: 16 }}>
          ⏳ {status}
        </p>
      )}

      {roundNums.map((roundNum) => (
        <Section key={roundNum} title={ROUND_LABELS[roundNum] || `${roundNum}라운드`}>
          {rounds[roundNum].map((r) => (
            <AgentCard
              key={r.agentId}
              {...r}
              thinking={thinking?.agentId === r.agentId && thinking?.round === roundNum}
            />
          ))}
          {thinking?.round === roundNum && (
            <AgentCard
              agentId={thinking.agentId}
              agentName="..."
              emoji="💭"
              thinking={true}
            />
          )}
        </Section>
      ))}

      {thinking && !thinking.round && (
        <AgentCard agentId="pending" agentName="..." emoji="💭" thinking={true} />
      )}

      {synthesis && (
        <Section title="✨ 최종 종합">
          <div
            style={{
              background: "linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)",
              border: "1px solid #c7d2fe",
              borderRadius: 14,
              padding: 20,
              lineHeight: 1.8,
              fontSize: 15,
              color: "#111",
              whiteSpace: "pre-wrap",
            }}
          >
            {synthesis}
          </div>
        </Section>
      )}

      {!running && !roundNums.length && !error && (
        <div
          style={{
            textAlign: "center",
            color: "#9ca3af",
            marginTop: 60,
            fontSize: 15,
            lineHeight: 2,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
          <p>질문을 입력하면 여러 AI가 함께 토론합니다.</p>
          <p style={{ fontSize: 13 }}>
            Anthropic (필수) · OpenAI · Gemini 키가 설정된 경우 자동 참여
          </p>
        </div>
      )}
    </div>
  );
}
