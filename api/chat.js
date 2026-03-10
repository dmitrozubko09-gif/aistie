export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GROQ_API_KEY; // ← правильна назва
  const { messages, system } = req.body;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey, // ← тепер однакова назва
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 8192,
        temperature: 0.6,
        top_p: 0.9,
        messages: [
          { role: "system", content: system },
          ...messages
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