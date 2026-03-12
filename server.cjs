const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 СЮДИ ВСТАВТЕ СВІЙ GROQ API КЛЮЧ (починається з gsk_...)
const apiKey = process.env.OPENAI_API_KEY

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, system, model } = req.body;
    const ALLOWED_MODELS = ["llama-3.3-70b-versatile","llama-3.1-8b-instant","mixtral-8x7b-32768","gemma2-9b-it"];
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : "llama-3.3-70b-versatile";

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

// 🎨 IMAGE GENERATION — Stable Diffusion via Hugging Face
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt" });

    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) return res.status(500).json({ error: "HF_TOKEN not set in .env" });

    // SDXL-Turbo — найшвидша модель на HuggingFace
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + HF_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: "blurry, bad quality, distorted, ugly, watermark",
            num_inference_steps: 25,
            guidance_scale: 7.5,
            width: 768,
            height: 512,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      // Model loading — повідомляємо клієнта
      if (err.error && err.error.includes("loading")) {
        return res.status(503).json({ error: "Model is loading, try again in 20 seconds", loading: true });
      }
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    res.set("Content-Type", "image/jpeg");
    res.send(Buffer.from(imageBuffer));

  } catch (err) {
    console.error("Image generation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("✅ Сервер запущено на http://localhost:3001 (Groq AI)");
});
