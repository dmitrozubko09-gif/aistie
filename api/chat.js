export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GROQ_API_KEY;
  const { messages, system, stream = false } = req.body;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 8192,
        temperature: 0.6,
        top_p: 0.9,
        stream,
        messages: [
          { role: "system", content: system },
          ...messages
        ],
      }),
    });

    // ── STREAMING ──────────────────────────────────────────────
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let inputTokens = 0;
      let outputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            res.write(`data: [DONE]\n\n`);
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.x_groq?.usage) {
              inputTokens = parsed.x_groq.usage.prompt_tokens || 0;
              outputTokens = parsed.x_groq.usage.completion_tokens || 0;
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              res.write(`data: ${JSON.stringify({ delta, inputTokens, outputTokens })}\n\n`);
            }
          } catch {}
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, inputTokens, outputTokens })}\n\n`);
      res.end();
      return;
    }

    // ── NON-STREAMING (fallback) ────────────────────────────────
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error });

    const text = data.choices?.[0]?.message?.content || "Порожня відповідь.";
    const usage = data.usage || {};
    res.json({
      content: [{ type: "text", text }],
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}