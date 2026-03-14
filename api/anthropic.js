export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  try {
    const { messages, system, max_tokens = 1000 } = req.body || {};

    const body = {
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens,
      messages,
    };
    if (system) body.system = system;

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("Anthropic error", upstream.status, text);
      return res.status(502).json({ error: "Upstream Anthropic error", status: upstream.status });
    }

    const data = await upstream.json();
    if (data.error) {
      console.error("Anthropic API error", data.error);
      return res.status(502).json({ error: data.error.message || "Anthropic API error" });
    }

    const text = (data.content || []).map((b) => b.text || "").join("") || "…";
    return res.status(200).json({ text });
  } catch (err) {
    console.error("Unexpected server error", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}

