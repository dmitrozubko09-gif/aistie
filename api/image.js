export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt" });

    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) return res.status(500).json({ error: "HF_TOKEN not set" });

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
      if (err.error && err.error.toLowerCase().includes("loading")) {
        return res.status(503).json({ error: "Model is loading, try again in 20 seconds", loading: true });
      }
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "image/jpeg");
    res.send(Buffer.from(imageBuffer));

  } catch (err) {
    console.error("Image error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
