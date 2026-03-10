const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 СЮДИ ВСТАВТЕ СВІЙ GROQ API КЛЮЧ (починається з gsk_...)
const apiKey = process.env.OPENAI_API_KEY

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, system } = req.body;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY,
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
    console.log("Groq відповідь:", JSON.stringify(data).slice(0, 200));

    if (data.error) {
      console.log("ПОМИЛКА:", data.error);
      return res.status(400).json({ error: data.error });
    }

    const text = data.choices?.[0]?.message?.content || "Порожня відповідь.";
    res.json({ content: [{ type: "text", text }] });

  } catch (err) {
    console.log("CATCH помилка:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("✅ Сервер запущено на http://localhost:3001 (Groq AI)");
});
