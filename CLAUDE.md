# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SecondInnings** is a React SPA — a personal life design portal for professionals planning career transitions or retirement. It includes financial runway calculation, location finding, career roadmaps, stress tracking, and an AI-powered life coach.

- **Live site:** https://secondinnings.in
- **Deployment:** Vercel (configured via `vercel.json`)

## Commands

```bash
npm run dev       # Start dev server (Vite, port 5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

No test runner or linter is currently configured.

## Environment

Copy `.env.example` to `.env` and set:
```
VITE_ANTHROPIC_KEY=your-api-key-here
```

This key powers the AI Coach tab (direct browser → Anthropic API calls using `dangerouslyAllowBrowser: true`).

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

**AI integration:** `askClaude(systemPrompt, userMessage, history)` calls `claude-sonnet-4-20250514` directly from the browser. It is used in both the Location Finder and AI Coach tabs.

### State persistence

User data lives only in React component state — it is **not** persisted to localStorage or any backend. All data resets on page refresh.
