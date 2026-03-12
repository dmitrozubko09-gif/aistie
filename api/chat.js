export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, system, model } = req.body;

    const ALLOWED_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"];
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : "llama-3.3-70b-versatile";

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not set" });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 8192,
        temperature: 0.6,
        top_p: 0.9,
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    if (data.error) return res.status(400).json({ error: data.error });

    const text = data.choices?.[0]?.message?.content || "Порожня відповідь.";
    res.json({ content: [{ type: "text", text }] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
