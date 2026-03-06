# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SecondInnings** is a React SPA — a personal life design portal for professionals planning career transitions or retirement. It includes financial runway calculation, location finding, career roadmaps, stress tracking, and an AI-powered life coach.

- **Live site:** https://secondinnings.in
- **Deployment:** Vercel (configured via `vercel.json`)

## Commands

```bash
npm run dev       # Start Vite dev server (port 5173) — AI calls use dev fallback
vercel dev        # Start Vite + Vercel functions locally — AI calls go via /api/ai
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
npm test          # Run Vitest test suite (53 tests)
npm run test:watch  # Watch mode
```

## Environment

Copy `.env.example` to `.env.local` and configure:

**Production / `vercel dev` (secure — key never in browser):**
```
ANTHROPIC_KEY=your-api-key-here
```
Set this in Vercel Dashboard → Project → Settings → Environment Variables.

**Local dev fallback (only when running plain `npm run dev` without Vercel CLI):**
```
VITE_ANTHROPIC_KEY=your-api-key-here
```
This is embedded in the browser bundle — never set it in production.

## AI Architecture

All AI calls go through `askClaude()` in `src/App.jsx`:
- **Production**: `POST /api/ai` → `api/ai.js` serverless function → Anthropic API
  - Key is server-side only (`ANTHROPIC_KEY`), never in browser bundle
  - CORS restricted to `secondinnings.in` and preview deployments
  - Request validated: body size, message count, content length, max_tokens capped
- **Dev fallback**: if `/api/ai` returns 404, falls back to direct browser call using `VITE_ANTHROPIC_KEY`

## Architecture

The entire application lives in two source files:
- `src/main.jsx` — React 18 entry point, strict mode, mounts `#root`
- `src/App.jsx` — Monolithic ~1500-line component containing all logic, data, and UI

**There are no separate component files, routing libraries, state managers, or CSS files.** All styling is inline CSS via theme objects.

### Key patterns in App.jsx

**Theme system:** A `THEMES` object defines 6 color schemes (Warm Ivory, Charcoal & Gold, etc.) with keys like `bg`, `bgCard`, `ink`, `accent`, `amber`, `red`. The active theme object is passed down as a `t` prop or accessed from state.

**Data constants** (defined at module level, before the component):
- `PROFESSIONS`, `POST_PATHS`, `STRESS_DRIVERS`, `CLIMATES`, `BUDGETS`, `PRIORITIES_LIST`
- `TRANSITION_TRACKS` — career path recommendations keyed by profession
- `DECISION_FILTERS`, `LANGUAGES`, `GENERIC_PHASES`

**Inner functional components** (defined inside App.jsx, before the main `App` component):
- `Bar()` — progress bar
- `Radar()` — SVG radar/spider chart
- `ThemePanel()` — slide-out theme selector
- `FieldError()` — form validation display
- `Onboarding()` — 6-step wizard (profession → stress → path → lifestyle → family → plan)

**Main `App` component** (starts around line 536) manages all state via `useState` hooks and renders 9 tabs:
1. Dashboard
2. Location Finder (AI-generated city recommendations)
3. Life Timeline
4. Financial Runway Calculator
5. Career Roadmap
6. Stress & Energy Tracker
7. Academic/Opportunities
8. Decision Tool
9. AI Coach (chat interface to Claude via `askClaude()`)

**AI integration:** `askClaude(messages, systemPrompt, maxTokens)` routes through `POST /api/ai` (serverless proxy). It is used in both the Location Finder and AI Coach tabs.

### State persistence

User data lives only in React component state — it is **not** persisted to localStorage or any backend. All data resets on page refresh.
