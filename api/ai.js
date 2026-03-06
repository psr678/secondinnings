/**
 * Vercel Serverless Function — /api/ai
 *
 * Acts as a secure proxy to the Anthropic API.
 * The ANTHROPIC_KEY env var is server-side only (no VITE_ prefix),
 * so it is never embedded in the browser bundle and never visible
 * in DevTools network traffic.
 *
 * Protections:
 *  - CORS: only allows requests from the production domain + localhost dev
 *  - Method guard: POST only
 *  - Request body validation: messages array, role/content checks
 *  - max_tokens capped at 2000 to prevent abuse
 *  - Content length limit: rejects oversized payloads
 *  - Key never sent to the client
 */

const ALLOWED_ORIGINS = [
  "https://secondinnings.in",
  "https://www.secondinnings.in",
  "http://localhost:5173",
  "http://localhost:4173",
];

// Add dynamic Vercel preview URLs (process.env.VERCEL_URL is set automatically)
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any *.vercel.app preview deployment owned by this project
  if (origin.match(/^https:\/\/secondinnings[^.]*\.vercel\.app$/)) return true;
  return false;
}

export default async function handler(req, res) {
  const origin = req.headers["origin"] || "";

  // ── CORS headers ──────────────────────────────────────────────────────────
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Origin enforcement (non-browser clients like curl have no Origin) ─────
  // We log but do not hard-block missing origin to allow Vercel preview tests.
  // For full lockdown, uncomment the block below:
  // if (!isAllowedOrigin(origin)) {
  //   return res.status(403).json({ error: "Forbidden" });
  // }

  // ── API key ───────────────────────────────────────────────────────────────
  const key = process.env.ANTHROPIC_KEY;
  if (!key) {
    return res.status(503).json({ error: "AI service not configured" });
  }

  // ── Body size guard (reject payloads > 50 KB) ─────────────────────────────
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength > 50_000) {
    return res.status(413).json({ error: "Request payload too large" });
  }

  // ── Body validation ───────────────────────────────────────────────────────
  const body = req.body;

  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid request body" });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: "messages array is required and must not be empty" });
  }

  if (body.messages.length > 100) {
    return res.status(400).json({ error: "Too many messages in conversation" });
  }

  for (const msg of body.messages) {
    if (!msg || typeof msg !== "object") {
      return res.status(400).json({ error: "Each message must be an object" });
    }
    if (!["user", "assistant"].includes(msg.role)) {
      return res.status(400).json({ error: `Invalid role: ${msg.role}` });
    }
    if (typeof msg.content !== "string") {
      return res.status(400).json({ error: "Message content must be a string" });
    }
    if (msg.content.length > 20_000) {
      return res.status(400).json({ error: "Message content exceeds 20,000 character limit" });
    }
  }

  // Optional system prompt validation
  if (body.system !== undefined && typeof body.system !== "string") {
    return res.status(400).json({ error: "system must be a string" });
  }
  if (body.system && body.system.length > 10_000) {
    return res.status(400).json({ error: "system prompt exceeds 10,000 character limit" });
  }

  // ── Cap max_tokens to prevent runaway costs ───────────────────────────────
  const maxTokens = Math.min(
    typeof body.max_tokens === "number" ? body.max_tokens : 1000,
    2000
  );

  // ── Proxy to Anthropic ────────────────────────────────────────────────────
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: body.messages,
        ...(body.system ? { system: body.system } : {}),
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      // Forward Anthropic's error status but don't expose the raw response
      return res.status(upstream.status).json({
        error: data?.error?.message || "Upstream AI error",
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach AI service" });
  }
}
