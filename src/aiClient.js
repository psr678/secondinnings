export async function askClaude(messages, systemPrompt = "", maxTokens = 1000) {
  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      system: systemPrompt || undefined,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI request failed (${res.status})`);
  }

  const data = await res.json().catch(() => {
    throw new Error("Invalid AI response");
  });

  if (data.error) {
    throw new Error(typeof data.error === "string" ? data.error : (data.error.message || "AI error"));
  }

  if (typeof data.text !== "string") {
    throw new Error("Malformed AI response");
  }

  return data.text;
}

