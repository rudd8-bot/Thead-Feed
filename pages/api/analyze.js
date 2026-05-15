export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text 필요" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `다음 Threads 게시물을 한국어로 분석해주세요. 핵심 주제, 톤, 인사이트를 간결하게 요약하세요.\n\n${text}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const result = data.content?.[0]?.text || "분석 결과 없음";
    res.status(200).json({ result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
