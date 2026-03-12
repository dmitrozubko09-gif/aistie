export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, system, model } = req.body;

    // Check if any message contains an image (vision content)
    const hasImage = messages?.some(m =>
      Array.isArray(m.content) && m.content.some(c => c.type === "image_url")
    );

    const ALLOWED_MODELS = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
      "meta-llama/llama-4-scout-17b-16e-instruct", // vision model
    ];

    // Auto-select vision model if image is present
    const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
    let selectedModel = ALLOWED_MODELS.includes(model) ? model : "llama-3.3-70b-versatile";
    if (hasImage) selectedModel = VISION_MODEL;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not set" });

    // For vision model, system prompt must be in first user message (Groq vision limitation)
    let apiMessages;
    if (hasImage) {
      // Inject system as a prefix text in the first user message that has an image
      apiMessages = messages.map((m, idx) => {
        if (idx === 0 && Array.isArray(m.content)) {
          const textPart = m.content.find(c => c.type === "text");
          const otherParts = m.content.filter(c => c.type !== "text");
          return {
            ...m,
            content: [
              { type: "text", text: `[Системна інструкція: ${system}]\n\n${textPart?.text || ""}` },
              ...otherParts,
            ],
          };
        }
        return m;
      });
    } else {
      apiMessages = [
        { role: "system", content: system },
        ...messages,
      ];
    }

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
        messages: apiMessages,
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
