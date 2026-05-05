async function callAnthropic(model, systemPrompt, messages) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`Anthropic: ${data.error.message}`);
  return data.content?.[0]?.text || "";
}

async function callOpenAI(model, systemPrompt, messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "system", content: systemPrompt }, ...messages] }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(model, systemPrompt, messages) {
  const contents = messages.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { maxOutputTokens: 1024 } }) }
  );
  const data = await response.json();
  if (data.error) throw new Error(`Gemini: ${data.error.message}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function buildAgents() {
  const agents = [];
  if (process.env.ANTHROPIC_API_KEY) {
    const haikuSystem = "당신은 논리적이고 체계적인 분석가 AI입니다. 질문을 명확하게 구조화하고 핵심 근거를 바탕으로 간결하게 답변하세요. 300자 이내로 작성하세요.";
    const sonnetSystem = "당신은 깊이 사고하는 비판적 사상가 AI입니다. 표면적 답변을 넘어 본질적 의미와 숨겨진 가정을 탐구하세요. 다양한 시각을 300자 이내로 제시하세요.";
    agents.push({ id: "claude-analyst", name: "Claude 분석가", emoji: "🔵", badge: "Haiku", call: (msgs) => callAnthropic("claude-haiku-4-5-20251001", haikuSystem, msgs) });
    agents.push({ id: "claude-thinker", name: "Claude 사색가", emoji: "🟣", badge: "Sonnet", call: (msgs) => callAnthropic("claude-sonnet-4-6", sonnetSystem, msgs) });
  }
  if (process.env.OPENAI_API_KEY) {
    const gptSystem = "당신은 실용적이고 현실 중심의 AI입니다. 실제로 적용 가능한 해결책과 구체적인 예시를 중심으로 300자 이내로 답변하세요.";
    agents.push({ id: "gpt-pragmatist", name: "GPT 실용주의자", emoji: "🟢", badge: "GPT-4o-mini", call: (msgs) => callOpenAI("gpt-4o-mini", gptSystem, msgs) });
  }
  if (process.env.GEMINI_API_KEY) {
    const geminiSystem = "당신은 다양한 분야를 연결하는 종합적 사고를 하는 AI입니다. 다른 영역과의 유사점과 패턴을 찾아 통합적 시각을 300자 이내로 제공하세요.";
    agents.push({ id: "gemini-connector", name: "Gemini 연결자", emoji: "🟡", badge: "Gemini Flash", call: (msgs) => callGemini("gemini-1.5-flash", geminiSystem, msgs) });
  }
  return agents;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: "question 필요" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const agents = buildAgents();

  if (agents.length === 0) { send("error", { message: "ANTHROPIC_API_KEY 필요" }); res.end(); return; }

  try {
    send("status", { message: `1라운드 시작 — ${agents.length}개 AI가 독립적으로 답변합니다` });
    const round1 = {};
    for (const agent of agents) {
      send("thinking", { agentId: agent.id, agentName: agent.name, emoji: agent.emoji, round: 1 });
      const text = await agent.call([{ role: "user", content: question }]);
      round1[agent.id] = text;
      send("response", { round: 1, agentId: agent.id, agentName: agent.name, emoji: agent.emoji, badge: agent.badge, text });
    }

    send("status", { message: "2라운드 시작 — 서로의 답변을 검토하고 정제합니다" });
    const round2 = {};
    for (const agent of agents) {
      const othersText = agents.filter((a) => a.id !== agent.id).map((a) => `[${a.name}의 답변]\n${round1[a.id]}`).join("\n\n");
      const messages = [
        { role: "user", content: question },
        { role: "assistant", content: round1[agent.id] },
        { role: "user", content: `다른 AI들의 답변을 읽었습니다. 동의하거나 보완할 점, 또는 반론이 있다면 자신의 관점을 정제해 300자 이내로 답변하세요.\n\n${othersText}` },
      ];
      send("thinking", { agentId: agent.id, agentName: agent.name, emoji: agent.emoji, round: 2 });
      const text = await agent.call(messages);
      round2[agent.id] = text;
      send("response", { round: 2, agentId: agent.id, agentName: agent.name, emoji: agent.emoji, badge: agent.badge, text });
    }

    send("status", { message: "최종 종합 중..." });
    const allContext = agents.map((a) => `[${a.name}]\n• 1라운드: ${round1[a.id]}\n• 2라운드: ${round2[a.id]}`).join("\n\n---\n\n");
    const synthAgent = agents.find((a) => a.id === "claude-thinker") || agents[0];
    const synthText = await synthAgent.call([{ role: "user", content: `질문: ${question}\n\n아래는 여러 AI의 토론 기록입니다. 이를 종합해 가장 완전한 최종 답변을 작성하세요.\n\n${allContext}` }]);
    send("synthesis", { text: synthText });
    send("done", {});
  } catch (e) {
    send("error", { message: e.message });
  }
  res.end();
}
