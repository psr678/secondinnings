import React, { useState, useRef, useEffect } from "react";
import { escapeHtml, calcFinancials, validateStep, matchRegion as matchRegionUtil } from "./utils.js";

// ── AI API ─────────────────────────────────────────────────────────────────
// Production: /api/ai (Vercel serverless proxy — key never in browser bundle).
// Dev fallback: if /api/ai returns 404 (no Vercel CLI running), falls back to
//               a direct Anthropic call using VITE_ANTHROPIC_KEY (local only).
const DEV_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Decode Google JWT payload (sub, name, email, picture) — not a security operation
function parseGoogleJwt(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(decodeURIComponent(atob(b64).split("").map(c=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join("")));
  } catch { return null; }
}

async function askClaude(messages, systemPrompt, maxTokens = 1000) {
  const body = { max_tokens: maxTokens, messages };
  if (systemPrompt) body.system = systemPrompt;

  // Try the server-side proxy first (production + `vercel dev`)
  const proxyRes = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (proxyRes.status !== 404) {
    const data = await proxyRes.json();
    if (!proxyRes.ok || data.error) throw new Error(data.error || "Request failed");
    return data.content?.map((b) => b.text || "").join("") || "…";
  }

  // Dev-only fallback: direct browser→Anthropic (key visible in DevTools)
  if (!DEV_KEY) throw new Error("Run `vercel dev` or set VITE_ANTHROPIC_KEY in .env.local for local dev");
  const dr = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": DEV_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages, ...(systemPrompt ? { system: systemPrompt } : {}) }),
  });
  const dd = await dr.json();
  if (dd.error) throw new Error(dd.error.message);
  return dd.content?.map((b) => b.text || "").join("") || "…";
}

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = {
  "warm-ivory": {
    name: "Warm Ivory", mood: "Calm · Light · Editorial",
    bg: "#F7F3EE", bgCard: "#FFFFFF", bgMuted: "#F0EBE3",
    ink: "#1C3A2E", inkMid: "#4A6358", inkLight: "#8BA396",
    accent: "#5C8A6E", accentLight: "#EBF3EF",
    amber: "#C4873A", amberLight: "#FDF3E7",
    red: "#C0564A", redLight: "#FDECEA",
    border: "#E2DAD0", shadow: "0 2px 12px rgba(28,58,46,0.08)",
    dark: false,
  },
  "charcoal-gold": {
    name: "Charcoal & Gold", mood: "Luxurious · Executive · Confident",
    bg: "#141414", bgCard: "#1E1E1E", bgMuted: "#252525",
    ink: "#F0EAD6", inkMid: "#B0A080", inkLight: "#6A5A40",
    accent: "#C9A84C", accentLight: "#C9A84C18",
    amber: "#E8B060", amberLight: "#E8B06018",
    red: "#C95F4A", redLight: "#C95F4A18",
    border: "#2E2E2E", shadow: "0 2px 16px rgba(0,0,0,0.4)",
    dark: true,
  },
  "midnight-slate": {
    name: "Midnight Slate", mood: "Professional · Analytical · Focused",
    bg: "#0F1923", bgCard: "#1A2735", bgMuted: "#1F2F40",
    ink: "#E8EEF4", inkMid: "#8BA5BE", inkLight: "#4A6880",
    accent: "#4A9EBF", accentLight: "#4A9EBF18",
    amber: "#E8A44A", amberLight: "#E8A44A18",
    red: "#D95F52", redLight: "#D95F5218",
    border: "#2A3F52", shadow: "0 2px 16px rgba(0,0,0,0.4)",
    dark: true,
  },
  "forest-depths": {
    name: "Forest Depths", mood: "Grounded · Calm · Timeless",
    bg: "#0D1F17", bgCard: "#152A1E", bgMuted: "#1A3324",
    ink: "#E2EDE6", inkMid: "#7AAF90", inkLight: "#3D6B52",
    accent: "#4CAF7A", accentLight: "#4CAF7A18",
    amber: "#D4A84B", amberLight: "#D4A84B18",
    red: "#C95F52", redLight: "#C95F5218",
    border: "#1E3D2A", shadow: "0 2px 16px rgba(0,0,0,0.4)",
    dark: true,
  },
  "royal-indigo": {
    name: "Royal Indigo", mood: "Premium · Intelligent · Bold",
    bg: "#0E0F1E", bgCard: "#161728", bgMuted: "#1C1D34",
    ink: "#E8E9F8", inkMid: "#8E90C0", inkLight: "#4A4C7A",
    accent: "#7B6EF6", accentLight: "#7B6EF618",
    amber: "#E8A44A", amberLight: "#E8A44A18",
    red: "#D95F6A", redLight: "#D95F6A18",
    border: "#252742", shadow: "0 2px 16px rgba(0,0,0,0.5)",
    dark: true,
  },
  "deep-ocean": {
    name: "Deep Ocean", mood: "Serene · Clear · Strategic",
    bg: "#070E1A", bgCard: "#0D1828", bgMuted: "#122030",
    ink: "#DCE8F5", inkMid: "#6A9EC0", inkLight: "#304A60",
    accent: "#3B9EE8", accentLight: "#3B9EE818",
    amber: "#E8B44A", amberLight: "#E8B44A18",
    red: "#D95F5A", redLight: "#D95F5A18",
    border: "#162236", shadow: "0 2px 16px rgba(0,0,0,0.5)",
    dark: true,
  },
  "warm-sand": {
    name: "Warm Sand", mood: "Earthy · Warm · Balanced",
    bg: "#EDE0D0", bgCard: "#F5EDE0", bgMuted: "#E0CEB8",
    ink: "#2A1A0E", inkMid: "#6B4525", inkLight: "#A07050",
    accent: "#A0522D", accentLight: "#A0522D18",
    amber: "#C4873A", amberLight: "#C4873A18",
    red: "#B04040", redLight: "#B0404018",
    border: "#D0B898", shadow: "0 2px 12px rgba(42,26,14,0.1)",
    dark: false,
  },
  "cloud-blue": {
    name: "Cloud Blue", mood: "Clear · Focused · Balanced",
    bg: "#E4EBF5", bgCard: "#EEF3FA", bgMuted: "#D5E0EE",
    ink: "#1A2540", inkMid: "#3A5080", inkLight: "#7090B8",
    accent: "#3060B0", accentLight: "#3060B018",
    amber: "#D4924A", amberLight: "#D4924A18",
    red: "#C04040", redLight: "#C0404018",
    border: "#C0D0E5", shadow: "0 2px 12px rgba(26,37,64,0.1)",
    dark: false,
  },
  "dusk-plum": {
    name: "Dusk Plum", mood: "Rich · Creative · Balanced",
    bg: "#2D2535", bgCard: "#382D42", bgMuted: "#322838",
    ink: "#F0EBF8", inkMid: "#A090C0", inkLight: "#6A5880",
    accent: "#9B72CF", accentLight: "#9B72CF18",
    amber: "#E8A44A", amberLight: "#E8A44A18",
    red: "#D95F6A", redLight: "#D95F6A18",
    border: "#4A3858", shadow: "0 2px 16px rgba(0,0,0,0.3)",
    dark: true,
  },
};

// ── Static Data ───────────────────────────────────────────────────────────────
const PROFESSIONS = ["IT / Technology","Finance / Banking","Healthcare / Medicine","Education / Academia","Legal / Law","Engineering / Manufacturing","Government / Public Sector","Entrepreneurship / Business","Creative / Media","Other Professional"];
const POST_PATHS = ["Switch to Academia / Teaching","Start own Business / Consulting","Freelance / Advisory roles","Full Retirement","Part-time flexible work","NGO / Social Impact","Creative Pursuits","Not sure yet"];
const STRESS_DRIVERS = ["Heavy workload","Office politics","Job uncertainty / AI disruption","Financial pressure","Health concerns","Loss of purpose","Work-life imbalance","Toxic environment"];
const CLIMATES = ["Cool / Hill (5–15°C)","Mild / Plateau (15–25°C)","Warm / Coastal (25–35°C)","Any climate"];
const BUDGETS = ["Under ₹40k/month","₹40k–₹75k/month","₹75k–₹1.5L/month","Above ₹1.5L / International"];
// LOCATIONS are now AI-generated per user profile — no static list
const TRANSITION_TRACKS = {
  "IT / Technology": [{ title:"Professor of Practice — AI & Systems",fit:9.5,desc:"Teach AI governance, enterprise architecture, digital transformation at private universities." },{ title:"Independent Tech Consultant",fit:9.0,desc:"Advisory retainers with startups and mid-size firms. Flexible, remote-friendly." },{ title:"Innovation Lab / Incubation Mentor",fit:8.5,desc:"Guide early-stage tech startups. Low time commitment, high intellectual reward." }],
  "Finance / Banking": [{ title:"Finance Faculty / Adjunct Professor",fit:9.0,desc:"Teach corporate finance, risk management, or fintech at business schools." },{ title:"Independent Financial Advisor",fit:8.5,desc:"Boutique advisory practice. High-value, low-volume client relationships." },{ title:"FinTech Startup Advisor",fit:8.0,desc:"Board or advisory roles with early-stage fintech ventures." }],
  "Healthcare / Medicine": [{ title:"Medical Faculty / Clinical Trainer",fit:9.0,desc:"Teach at medical colleges or train junior doctors. 2–3 days/week model." },{ title:"Healthcare NGO / Policy Advisor",fit:8.5,desc:"Shape public health policy. Meaningful, low-stress engagement." },{ title:"Telemedicine / Health Writer",fit:7.5,desc:"Remote consultations or medical content creation. Full flexibility." }],
  "Legal / Law": [{ title:"Law Faculty / Visiting Professor",fit:9.0,desc:"Teach at law schools. Respected, intellectually stimulating, low bureaucracy at private institutions." },{ title:"Mediation & Arbitration Practice",fit:8.5,desc:"Build a boutique mediation practice. Flexible and high-value." },{ title:"Legal NGO / Policy Work",fit:8.0,desc:"Access to justice, policy reform. Purpose-driven engagement." }],
  "Engineering / Manufacturing": [{ title:"Technical Faculty / Industry Chair",fit:9.0,desc:"Teach applied engineering at technical institutions. Highly valued." },{ title:"Technical Consultant / Quality Advisor",fit:8.5,desc:"Advisory mandates with manufacturing firms. Process excellence focus." },{ title:"Startup Technical Mentor",fit:8.0,desc:"Guide hardware / deep-tech startups as senior technical advisor." }],
  "Education / Academia": [{ title:"Senior Research / Emeritus Role",fit:9.0,desc:"Transition to research-only or emeritus position. Maximum intellectual freedom." },{ title:"Curriculum Design Consultant",fit:8.5,desc:"Help institutions modernize curriculum. High impact, low pressure." },{ title:"EdTech Advisory / Content Creation",fit:8.0,desc:"Build or advise online learning platforms. Scalable reach." }],
  "Government / Public Sector": [{ title:"Policy Think Tank / Advisor",fit:9.0,desc:"Contribute expertise to policy bodies without full-time obligation." },{ title:"Public Administration Faculty",fit:8.5,desc:"Teach governance and public policy at management institutions." },{ title:"Social Enterprise Leadership",fit:8.0,desc:"Lead or advise NGOs / social enterprises in your domain." }],
  "Entrepreneurship / Business": [{ title:"Startup Mentor / Angel Investor",fit:9.0,desc:"Invest time and capital in early-stage ventures. Build a portfolio." },{ title:"Business Faculty / Executive Education",fit:8.5,desc:"Teach strategy, entrepreneurship, or leadership at business schools." },{ title:"Board Director (SME/NGO)",fit:8.0,desc:"Independent board roles. Strategic oversight, no operational load." }],
  "Creative / Media": [{ title:"Creative Faculty / Workshop Leader",fit:9.0,desc:"Teach design, writing, or media at arts and communication schools." },{ title:"Independent Creative Practice",fit:8.5,desc:"Freelance work on your own terms. Portfolio over payroll." },{ title:"Content Creator / Author",fit:8.0,desc:"Write, produce, or curate. Build an audience around your expertise." }],
  "Other Professional": [{ title:"Domain Expert Consultant",fit:8.5,desc:"Independent consulting in your professional domain. Flexible retainer model." },{ title:"Visiting Faculty / Trainer",fit:8.0,desc:"Teach at professional institutions in your field." },{ title:"NGO / Purpose-Driven Work",fit:7.5,desc:"Apply expertise toward social impact. Lower income, higher meaning." }],
};
const DECISION_FILTERS = [
  { q:"Does this increase my options / leverage?", tag:"Optionality" },
  { q:"Does this preserve my cognitive energy?", tag:"Energy" },
  { q:"Does this reduce my dependency on one employer?", tag:"Independence" },
  { q:"Will this still feel worth it at my transition age?", tag:"Future Self" },
  { q:"Does this reduce volatility in my life?", tag:"Stability" },
  { q:"Does this align with my post-career path?", tag:"Direction" },
];

const RESOURCES = {
  "Switch to Academia / Teaching": {
    courses: [
      { title:"Teaching Portfolio Development", platform:"Coursera", url:"https://www.coursera.org/search?query=teaching+portfolio" },
      { title:"Research Methodology for Practitioners", platform:"edX", url:"https://www.edx.org/search?q=research+methodology" },
      { title:"Learning Design: The Art of Facilitation", platform:"LinkedIn Learning", url:"https://www.linkedin.com/learning/search?keywords=learning+design" },
    ],
    communities: [
      { name:"Association of Indian Universities", url:"https://www.aiu.ac.in" },
      { name:"NPTEL Faculty Network", url:"https://nptel.ac.in" },
      { name:"LinkedIn Educators Group", url:"https://www.linkedin.com/search/results/groups/?keywords=educators" },
      { name:"IIM / ISB Alumni Faculty Networks", url:"https://www.linkedin.com/search/results/groups/?keywords=IIM+alumni" },
    ],
    books: [
      { title:"Make It Stick", author:"Peter Brown", url:"https://www.goodreads.com/search?q=Make+It+Stick+Peter+Brown" },
      { title:"The Courage to Teach", author:"Parker Palmer", url:"https://www.goodreads.com/search?q=The+Courage+to+Teach+Parker+Palmer" },
      { title:"Small Teaching", author:"James Lang", url:"https://www.goodreads.com/search?q=Small+Teaching+James+Lang" },
    ],
    channels: [
      { name:"MIT OpenCourseWare", url:"https://www.youtube.com/@mitocw" },
      { name:"NPTEL (YouTube)", url:"https://nptel.ac.in" },
      { name:"Yale Open Courses", url:"https://oyc.yale.edu" },
      { name:"TED-Ed", url:"https://www.youtube.com/@TEDed" },
    ],
  },
  "Start own Business / Consulting": {
    courses: [
      { title:"Entrepreneurship: Launching an Innovative Business", platform:"Coursera", url:"https://www.coursera.org/search?query=entrepreneurship+launching+innovative+business" },
      { title:"Strategy for Executives", platform:"edX (HBS Online)", url:"https://www.edx.org/search?q=strategy+executives" },
      { title:"Consulting Essentials", platform:"LinkedIn Learning", url:"https://www.linkedin.com/learning/search?keywords=consulting+essentials" },
    ],
    communities: [
      { name:"TiE Global", url:"https://tie.org" },
      { name:"Entrepreneurs' Organization (EO)", url:"https://www.eonetwork.org" },
      { name:"iSPIRT", url:"https://ispirt.in" },
      { name:"Nasscom 10,000 Startups", url:"https://nasscom.in" },
    ],
    books: [
      { title:"The Consulting Bible", author:"Alan Weiss", url:"https://www.goodreads.com/search?q=The+Consulting+Bible+Alan+Weiss" },
      { title:"Built to Sell", author:"John Warrillow", url:"https://www.goodreads.com/search?q=Built+to+Sell+John+Warrillow" },
      { title:"Zero to One", author:"Peter Thiel", url:"https://www.goodreads.com/search?q=Zero+to+One+Peter+Thiel" },
    ],
    channels: [
      { name:"Y Combinator (YouTube)", url:"https://www.youtube.com/@ycombinator" },
      { name:"My First Million (Podcast)", url:"https://www.mfmpod.com" },
      { name:"Lex Fridman", url:"https://www.youtube.com/@lexfridman" },
      { name:"CNBC Make It", url:"https://www.youtube.com/@CNBCMakeIt" },
    ],
  },
  "Freelance / Advisory roles": {
    courses: [
      { title:"Freelance Business Fundamentals", platform:"LinkedIn Learning", url:"https://www.linkedin.com/learning/search?keywords=freelance+business" },
      { title:"Negotiation & Contract Basics", platform:"Coursera", url:"https://www.coursera.org/search?query=negotiation+basics" },
      { title:"Personal Branding for Experts", platform:"Udemy", url:"https://www.udemy.com/courses/search/?q=personal+branding" },
    ],
    communities: [
      { name:"Toptal Expert Network", url:"https://www.toptal.com" },
      { name:"IAOP Professionals", url:"https://www.iaop.org" },
      { name:"World of Freelancers", url:"https://www.linkedin.com/search/results/groups/?keywords=freelancers" },
      { name:"LinkedIn Freelancers Group", url:"https://www.linkedin.com/search/results/groups/?keywords=freelance+professionals" },
    ],
    books: [
      { title:"Company of One", author:"Paul Jarvis", url:"https://www.goodreads.com/search?q=Company+of+One+Paul+Jarvis" },
      { title:"The Free Agent Nation", author:"Daniel Pink", url:"https://www.goodreads.com/search?q=Free+Agent+Nation+Daniel+Pink" },
      { title:"Atomic Habits", author:"James Clear", url:"https://www.goodreads.com/search?q=Atomic+Habits+James+Clear" },
    ],
    channels: [
      { name:"Ali Abdaal (YouTube)", url:"https://www.youtube.com/@aliabdaal" },
      { name:"Deep Work / Cal Newport (Podcast)", url:"https://www.calnewport.com/podcast/" },
      { name:"The Tim Ferriss Show", url:"https://tim.blog/podcast/" },
      { name:"My First Million (Podcast)", url:"https://www.mfmpod.com" },
    ],
  },
  "Full Retirement": {
    courses: [
      { title:"Positive Psychology and Well-Being", platform:"Coursera (Yale)", url:"https://www.coursera.org/search?query=positive+psychology+well-being" },
      { title:"Mindfulness-Based Stress Reduction", platform:"edX", url:"https://www.edx.org/search?q=mindfulness+stress+reduction" },
      { title:"Personal Finance & Retirement Planning", platform:"Khan Academy", url:"https://www.khanacademy.org/college-careers-more/personal-finance" },
    ],
    communities: [
      { name:"Senior Planet", url:"https://seniorplanet.org" },
      { name:"Transitions Network", url:"https://www.transitionsnetwork.org" },
      { name:"LinkedIn Retirement Lifestyle Groups", url:"https://www.linkedin.com/search/results/groups/?keywords=retirement+lifestyle" },
      { name:"RetirementJoy Community", url:"https://www.linkedin.com/search/results/groups/?keywords=retirement+joy" },
    ],
    books: [
      { title:"Die with Zero", author:"Bill Perkins", url:"https://www.goodreads.com/search?q=Die+with+Zero+Bill+Perkins" },
      { title:"Younger Next Year", author:"Chris Crowley", url:"https://www.goodreads.com/search?q=Younger+Next+Year+Chris+Crowley" },
      { title:"The Good Life", author:"Robert Waldinger", url:"https://www.goodreads.com/search?q=The+Good+Life+Robert+Waldinger" },
    ],
    channels: [
      { name:"Huberman Lab", url:"https://www.youtube.com/@hubermanlab" },
      { name:"Big Think", url:"https://www.youtube.com/@bigthink" },
      { name:"Dhruv Rathee", url:"https://www.youtube.com/@dhruvrathee" },
      { name:"Retirement Answer Man (Podcast)", url:"https://rogerwhitney.com/retirement-answer-man-podcast/" },
    ],
  },
  "Part-time flexible work": {
    courses: [
      { title:"Designing Your Ideal Work Life", platform:"Coursera", url:"https://www.coursera.org/search?query=work+life+design" },
      { title:"Digital Skills for the Modern Workplace", platform:"Google Grow", url:"https://grow.google/" },
      { title:"Productivity & Time Design", platform:"Udemy", url:"https://www.udemy.com/courses/search/?q=productivity+time+design" },
    ],
    communities: [
      { name:"Flexa Careers Community", url:"https://flexa.careers" },
      { name:"Remote Year", url:"https://www.remoteyear.com" },
      { name:"LinkedIn Open to Work", url:"https://www.linkedin.com/search/results/groups/?keywords=remote+work+professionals" },
      { name:"Virtual Team Communities", url:"https://www.linkedin.com/search/results/groups/?keywords=virtual+team" },
    ],
    books: [
      { title:"Four Thousand Weeks", author:"Oliver Burkeman", url:"https://www.goodreads.com/search?q=Four+Thousand+Weeks+Oliver+Burkeman" },
      { title:"Rest", author:"Alex Soojung-Kim Pang", url:"https://www.goodreads.com/search?q=Rest+Alex+Soojung-Kim+Pang" },
      { title:"Designing Your Life", author:"Bill Burnett & Dave Evans", url:"https://www.goodreads.com/search?q=Designing+Your+Life+Burnett+Evans" },
    ],
    channels: [
      { name:"Deep Work / Cal Newport (Podcast)", url:"https://www.calnewport.com/podcast/" },
      { name:"WorkLife with Adam Grant", url:"https://www.ted.com/podcasts/worklife" },
      { name:"Notion HQ (YouTube)", url:"https://www.youtube.com/@NotionHQ" },
      { name:"Wes Roth (YouTube)", url:"https://www.youtube.com/@WesRoth" },
    ],
  },
  "NGO / Social Impact": {
    courses: [
      { title:"Social Entrepreneurship", platform:"Coursera (Copenhagen Business School)", url:"https://www.coursera.org/search?query=social+entrepreneurship" },
      { title:"Nonprofit Management Essentials", platform:"edX", url:"https://www.edx.org/search?q=nonprofit+management" },
      { title:"Human Rights & Development", platform:"FutureLearn", url:"https://www.futurelearn.com/search?q=human+rights+development" },
    ],
    communities: [
      { name:"Dasra Accelerator Network", url:"https://dasra.org" },
      { name:"Ashoka Changemakers", url:"https://www.ashoka.org" },
      { name:"India Development Review (IDR)", url:"https://idronline.org" },
      { name:"Give India Community", url:"https://giveindia.org" },
    ],
    books: [
      { title:"Lean Impact", author:"Ann Mei Chang", url:"https://www.goodreads.com/search?q=Lean+Impact+Ann+Mei+Chang" },
      { title:"The Purpose Economy", author:"Aaron Hurst", url:"https://www.goodreads.com/search?q=The+Purpose+Economy+Aaron+Hurst" },
      { title:"Winners Take All", author:"Anand Giridharadas", url:"https://www.goodreads.com/search?q=Winners+Take+All+Anand+Giridharadas" },
    ],
    channels: [
      { name:"TED Talks Social Good", url:"https://www.ted.com/topics/social+change" },
      { name:"India Development Review", url:"https://idronline.org" },
      { name:"Nonprofit Quarterly (Podcast)", url:"https://nonprofitquarterly.org/podcasts/" },
      { name:"WorkLife with Adam Grant", url:"https://www.ted.com/podcasts/worklife" },
    ],
  },
  "Creative Pursuits": {
    courses: [
      { title:"Creativity & Entrepreneurship", platform:"Coursera (Wesleyan)", url:"https://www.coursera.org/search?query=creativity+entrepreneurship" },
      { title:"Writing for Personal Expression", platform:"Skillshare", url:"https://www.skillshare.com/en/search?query=writing+personal+expression" },
      { title:"Design Thinking for Beginners", platform:"Coursera", url:"https://www.coursera.org/search?query=design+thinking" },
    ],
    communities: [
      { name:"Behance Creative Network", url:"https://www.behance.net" },
      { name:"NaNoWriMo Community", url:"https://nanowrimo.org" },
      { name:"Creative Mornings", url:"https://creativemornings.com" },
      { name:"Writers Side", url:"https://www.linkedin.com/search/results/groups/?keywords=writers+creative" },
    ],
    books: [
      { title:"The Artist's Way", author:"Julia Cameron", url:"https://www.goodreads.com/search?q=The+Artist%27s+Way+Julia+Cameron" },
      { title:"Steal Like an Artist", author:"Austin Kleon", url:"https://www.goodreads.com/search?q=Steal+Like+an+Artist+Austin+Kleon" },
      { title:"Big Magic", author:"Elizabeth Gilbert", url:"https://www.goodreads.com/search?q=Big+Magic+Elizabeth+Gilbert" },
    ],
    channels: [
      { name:"The Futur (YouTube)", url:"https://www.youtube.com/@thefutur" },
      { name:"On Being (Podcast)", url:"https://onbeing.org/series/podcast/" },
      { name:"Chase Jarvis LIVE", url:"https://www.chasejarvis.com/blog/" },
      { name:"How I Built This (Podcast)", url:"https://www.npr.org/podcasts/510313/how-i-built-this" },
    ],
  },
  "Not sure yet": {
    courses: [
      { title:"Designing Your Life", platform:"Coursera (Stanford d.school)", url:"https://www.coursera.org/search?query=designing+your+life" },
      { title:"Ikigai: Find Your Reason for Being", platform:"Udemy", url:"https://www.udemy.com/courses/search/?q=ikigai" },
      { title:"Career Decisions: From Insight to Impact", platform:"edX (Babson)", url:"https://www.edx.org/search?q=career+decisions" },
    ],
    communities: [
      { name:"Transitions Network", url:"https://www.transitionsnetwork.org" },
      { name:"Mid-Life Career Changers", url:"https://www.linkedin.com/search/results/groups/?keywords=mid+life+career+change" },
      { name:"Designing Your Life Community", url:"https://www.linkedin.com/search/results/groups/?keywords=designing+your+life" },
      { name:"LinkedIn Career Exploration", url:"https://www.linkedin.com/search/results/groups/?keywords=career+exploration" },
    ],
    books: [
      { title:"Designing Your Life", author:"Bill Burnett & Dave Evans", url:"https://www.goodreads.com/search?q=Designing+Your+Life+Burnett" },
      { title:"What Color Is Your Parachute?", author:"Richard N. Bolles", url:"https://www.goodreads.com/search?q=What+Color+Is+Your+Parachute" },
      { title:"Transitions", author:"William Bridges", url:"https://www.goodreads.com/search?q=Transitions+William+Bridges" },
    ],
    channels: [
      { name:"Brené Brown (Podcast)", url:"https://brenebrown.com/podcasts/" },
      { name:"WorkLife with Adam Grant", url:"https://www.ted.com/podcasts/worklife" },
      { name:"The Knowledge Project (Podcast)", url:"https://fs.blog/knowledge-project-podcast/" },
      { name:"The Tim Ferriss Show", url:"https://tim.blog/podcast/" },
    ],
  },
};

function computeReadinessInsights(log) {
  if (log.length < 2) return [];
  const dims = [
    { key:"financial", label:"Financial clarity" },
    { key:"direction", label:"Direction clarity" },
    { key:"energy",    label:"Energy & wellbeing" },
    { key:"family",    label:"Family alignment" },
    { key:"progress",  label:"Plan progress" },
  ];
  const recent = log.slice(-3);
  const insights = [];
  for (const d of dims) {
    const vals = recent.map(w => w[d.key]);
    const latest = vals[vals.length - 1];
    const allDropping = vals.length >= 2 && vals.every((v,i) => i === 0 || v < vals[i-1]);
    const allRising   = vals.length >= 3 && vals.every((v,i) => i === 0 || v >= vals[i-1]);
    if (allDropping) {
      insights.push({ type:"drop", msg:`${d.label} has dropped ${vals.length >= 3 ? "3 weeks" : "2 weeks"} in a row — set aside 15 minutes to identify the blocker.` });
    } else if (latest < 5) {
      insights.push({ type:"low", msg:`${d.label} is low (${latest}/10) — a small focused action this week could shift momentum.` });
    } else if (allRising) {
      insights.push({ type:"rise", msg:`${d.label} has improved 3 weeks straight — keep the current habit or routine going.` });
    }
  }
  return insights.slice(0, 3);
}

// ── Personalisation helpers ────────────────────────────────────────────────────
function buildCareerSteps(profession, postPath, yearsLeft) {
  const phases = [
    `Now – ${Math.max(1,yearsLeft-4)}y`,
    `${Math.max(1,yearsLeft-4)}y – ${Math.max(2,yearsLeft-2)}y`,
    `${Math.max(2,yearsLeft-2)}y – ${Math.max(3,yearsLeft-1)}y`,
    `${Math.max(3,yearsLeft-1)}y – Transition`,
  ];
  const titles = ["Explore & Reposition","Build & Validate","Align & Pilot","Launch & Commit"];
  const PATH_TASKS = {
    "Switch to Academia / Teaching": [
      ["Deliver your first guest lecture or workshop at a target institution","Identify 3–5 institutions aligned with your expertise and values","Join academic networks and faculty communities on LinkedIn","Write a 2-page teaching philosophy statement"],
      ["Co-author a practitioner case study or academic paper","Apply for visiting faculty or adjunct positions","Build a full course outline for your core subject","Get peer feedback on your teaching or facilitation style"],
      ["Negotiate a contractual or part-time academic engagement","Test income from coaching, bootcamps, or online courses","Secure first formal academic affiliation (even honorary)","Build your publication and speaking track record"],
      ["Transition to your primary academic role","Launch a signature course, workshop series, or module","Build student mentorship relationships","Evaluate long-term research or administration potential"],
    ],
    "Start own Business / Consulting": [
      ["Define your consulting niche and ideal client profile","Register business entity and set up basic infrastructure","Reach out to 10 warm contacts about your transition plans","Deliver a first pro-bono or low-cost engagement to build portfolio"],
      ["Close your first paid consulting engagement","Build case studies from early client work","Identify 2–3 repeatable, scalable service offerings","Set pricing tiers and test market response"],
      ["Systematise delivery — templates, SOPs, onboarding docs","Build a referral pipeline from satisfied early clients","Set monthly revenue targets and track them consistently","Explore part-time support as the practice grows"],
      ["Achieve consistent revenue from your consulting practice","Gradually reduce employment income dependency","Build long-term retainer client relationships","Define and scale your sustainable business model"],
    ],
    "Freelance / Advisory roles": [
      ["Identify 3 advisory or board opportunities in your domain","Update professional profiles for senior independent positioning","Define your advisory value proposition clearly in writing","Reach out to founders and leaders who could benefit from your experience"],
      ["Close your first paid advisory or board mandate","Build a signature methodology you can consistently deliver","Develop a thought leadership or speaking angle","Explore equity-based advisory compensation models"],
      ["Scale to 2–3 concurrent advisory engagements","Test passive income from content, IP, or licensing","Build a personal site or portfolio to attract inbound interest","Negotiate reduced hours at current employer to create capacity"],
      ["Transition fully to advisory or freelance work","Maintain 4–6 active mandates at any time","Systematise outreach for consistent deal flow","Review income diversification and sustainability annually"],
    ],
    "Full Retirement": [
      ["Validate your retirement corpus target with a qualified financial advisor","Begin shifting portfolio toward income-generating assets","Discuss retirement timeline explicitly and honestly with your family","Explore what purpose, community, and structure will look like post-work"],
      ["Test retirement lifestyle with a 2-week sabbatical or unpaid leave","Identify volunteering, mentoring, or community engagement models","Build daily routines that could replace the structure work provides","Optimise health and fitness habits as a long-term energy investment"],
      ["Finalise your financial plan, passive income streams, and SWR","Begin knowledge transfer and handover at work proactively","Set up rental, dividend, or annuity income streams","Identify your core 'reason to get up' in post-retirement life"],
      ["Execute your clean exit from primary employment","Establish a fulfilling post-retirement rhythm and structure","Engage with purpose projects — mentoring, NGOs, travel, hobbies","Review financial health annually and adjust as needed"],
    ],
    "Part-time flexible work": [
      ["Identify roles in your domain offering genuinely flexible arrangements","Explore negotiating part-time or remote options in your current role","Build a savings buffer to sustain a period of reduced income","Research the gig and project economy in your area of expertise"],
      ["Pilot a flexible work arrangement for 3–6 months","Take on a first side project or freelance engagement","Map the minimum income floor needed to sustain your lifestyle","Reduce commute obligations and fixed costs wherever possible"],
      ["Confirm a permanent part-time or flexible arrangement","Replace any income gap with 2–3 additional flexible income streams","Establish firm, non-negotiable boundaries around your time","Invest in health, hobbies, and meaningful personal projects"],
      ["Sustain a balanced portfolio of flexible work you enjoy","Evaluate which engagements energise vs. drain you each quarter","Build long-term relationships with remote or flexible clients","Design your ideal week and protect it with discipline"],
    ],
    "NGO / Social Impact": [
      ["Identify 3 NGOs or impact organisations aligned with your cause","Volunteer or contribute pro-bono to understand the sector deeply","Clarify which cause area energises you most consistently","Connect with impact sector professionals in your city and network"],
      ["Apply for advisory, project-based, or board roles in NGOs","Attend impact sector conferences or community convenings","Develop a clear value proposition for impact organisations","Build credibility in your chosen cause through visible action"],
      ["Secure a formal part-time or leadership role in an NGO","Develop funding and grant literacy if relevant to your work","Build a peer network within the impact sector","Test compensation models — stipend, honorarium, or board role"],
      ["Transition into a full-time or primary NGO leadership role","Drive a flagship programme, campaign, or initiative","Measure and communicate your impact with data and stories","Build sustainable funding, partnerships, or institutional backing"],
    ],
    "Creative Pursuits": [
      ["Dedicate 5 hours per week to your primary creative practice","Join a creative community, cohort, or learning group","Complete one small creative project end-to-end without waiting for perfect","Research the monetisation landscape for your chosen art form"],
      ["Build an audience around your creative work — blog, newsletter, or social media","Submit or exhibit work in relevant platforms, shows, or publications","Identify 2–3 sustainable income models for your creative practice","Develop a body of work you're genuinely proud to share publicly"],
      ["Close your first paid creative project, commission, or collaboration","Launch an online course, channel, or product around your creative domain","Carve out protected, uninterrupted creative time each week","Connect with publishers, galleries, studios, or distribution platforms"],
      ["Make creativity your primary professional identity","Build sustainable income from your creative output","Exhibit, perform, publish, or distribute at meaningful scale","Define the legacy creative project you want to be known for"],
    ],
    "Not sure yet": [
      ["Start a possibilities journal — write down 5 different paths to explore","Have conversations with 10 people who've made successful career transitions","Take a professional career assessment or invest in a coaching session","Reduce major financial obligations to maximise your optionality"],
      ["Identify your top 2–3 candidate paths based on what you've explored","Run small, low-risk experiments — a workshop, project, or part-time role","Evaluate energy, meaning, and income fit for each path honestly","Narrow to one primary direction with a clear backup plan"],
      ["Commit to your chosen direction for 12 months before reassessing","Build the skills and relationships needed for your chosen path","Test the lifestyle fit of your intended transition hands-on","Build a financial buffer to reduce pressure on your decision"],
      ["Execute your transition with full intention and openness","Reflect and course-correct without self-judgment","Build new identity and daily routines around your next chapter","Document your journey — it will help others in the same position"],
    ],
  };
  const PROFESSION_NUANCE = {
    "IT / Technology": "Translate your technical depth into thought leadership — write, speak, and mentor publicly in your domain",
    "Finance / Banking": "Leverage your financial credibility to build trust rapidly in your target new domain",
    "Healthcare / Medicine": "Use your clinical credibility as an immediate trust signal in your chosen transition path",
    "Legal / Law": "Position your legal and analytical expertise as a strategic differentiator in your new context",
    "Engineering / Manufacturing": "Apply systems thinking and first-principles problem solving to accelerate your new domain",
    "Education / Academia": "Use your teaching and curriculum experience as an immediate credibility advantage in any path",
    "Government / Public Sector": "Translate your policy experience and stakeholder management skills into advisory or leadership roles",
    "Entrepreneurship / Business": "Apply startup agility, team-building instinct, and commercial thinking to your new venture or role",
    "Creative / Media": "Use your communication and storytelling skills to accelerate visibility in whatever path you choose",
    "Other Professional": "Document your domain expertise into a clear, transferable value proposition for your new audience",
  };
  const baseTasks = PATH_TASKS[postPath] || PATH_TASKS["Not sure yet"];
  const nuance = PROFESSION_NUANCE[profession] || PROFESSION_NUANCE["Other Professional"];
  return baseTasks.map((tasks, i) => ({
    phase: phases[i],
    title: titles[i],
    tasks: i === 0 ? [...tasks.slice(0,3), nuance] : tasks,
  }));
}

function buildTimelinePhases(postPath, stressDrivers, yearsLeft) {
  const yT1 = yearsLeft >= 6 ? 5 : Math.max(1, Math.floor(yearsLeft * 0.65));
  const yT2 = Math.max(1, Math.min(Math.round(yearsLeft * 0.3), yT1 - 1));
  const labels = ["Now – T-"+yT1, "T-"+yT1+" – T-"+yT2, "T-"+yT2+" – T", "T onwards"];
  const hasOverwork = (stressDrivers||[]).includes("Heavy workload") || (stressDrivers||[]).includes("Work-life imbalance");
  const hasPurpose = (stressDrivers||[]).includes("Loss of purpose");
  const hasFinancial = (stressDrivers||[]).includes("Financial pressure");
  const hasToxic = (stressDrivers||[]).includes("Toxic environment") || (stressDrivers||[]).includes("Office politics");
  const hasAI = (stressDrivers||[]).includes("Job uncertainty / AI disruption");
  const descs = {
    "Switch to Academia / Teaching": [
      "Build academic credibility while still employed. Deliver guest sessions, publish practitioner insights, and map your target institutions.",
      "Make academic roles available to you without depending on them. Secure your first affiliation or adjunct role while your financial runway holds.",
      "Reduce corporate intensity. Pilot teaching or research part-time. Validate that the academic pace fits your energy and lifestyle.",
      "Full transition to academic life. Own your subject. Teach, mentor, and build a body of work entirely on your terms.",
    ],
    "Start own Business / Consulting": [
      "Build your consulting identity and first client relationships while still employed. Define your niche and close your first engagement.",
      "Make employment optional. Grow consulting income to a level that validates your model before you make the leap.",
      "Reduce employment dependency. Run both in parallel. Validate sustainable cash flow and client pipeline.",
      "Full launch of your consulting practice. No targets but your own. Build, grow, and refine entirely on your terms.",
    ],
    "Freelance / Advisory roles": [
      "Position yourself as a senior independent voice. Identify advisory opportunities and signal your transition intent to warm networks.",
      "Close your first paid mandates. Build the track record that makes inbound advisory interest inevitable.",
      "Scale to multiple concurrent mandates. Reduce employment hours. Test the freelance lifestyle for real.",
      "Full portfolio career. Choose only what energises you. Work on your schedule, for as long as you choose.",
    ],
    "Full Retirement": [
      `Build your financial runway aggressively.${hasFinancial?" Every rupee saved now is a month of freedom later.":""} Clarify what full retirement will look and feel like.`,
      "Validate your corpus, passive income streams, and lifestyle assumptions. Test retirement life in short experiments.",
      "Begin the handover. Reduce work obligations. Prepare your family, your finances, and yourself for the shift.",
      "Full retirement. Design your days with intention. Purpose, health, community, and financial peace — all on your terms.",
    ],
    "NGO / Social Impact": [
      "Identify your cause and begin building credibility in it through volunteering and pro-bono contribution.",
      "Secure your first formal impact role or board position. Prove you can add value without your corporate title.",
      "Transition into a part-time impact leadership role. Validate that the mission and culture align with your values.",
      "Full-time purpose work. Lead with conviction. Measure your impact. Build something that outlasts your involvement.",
    ],
    "Creative Pursuits": [
      "Start creating now — before you feel ready. Volume and consistency beat perfection at this stage.",
      "Build an audience and a body of work. Identify your strongest medium and your first viable monetisation path.",
      "Carve out serious creative time. Pilot your first paid creative project. Validate the model.",
      "Creativity as your primary identity. Create, exhibit, publish, perform. On your schedule, for your audience.",
    ],
  };
  const defaults = [
    `Build leverage and expertise.${hasToxic?" Limit political entanglement and protect your energy.":""}${hasFinancial?" Accelerate savings aggressively.":""} Reduce your dependency on any single employer.`,
    `Make your current role optional.${hasPurpose?" Begin actively testing what gives you meaning outside of work.":""} Warm your transition path and build external reputation.`,
    `Reduce intensity.${hasOverwork?" Begin protecting your cognitive energy — it's your most depleted asset.":""} Test your post-career path part-time. Prepare a deliberate, clean exit.`,
    `Full transition.${hasAI?" Build a career identity that no algorithm can replace.":""} New role, new rhythm, new rules — entirely yours.`,
  ];
  const chosen = descs[postPath] || defaults;
  return [
    { label:labels[0], title:"Authority Accumulation", desc:chosen[0] },
    { label:labels[1], title:"Optionality Building",   desc:chosen[1] },
    { label:labels[2], title:"Controlled Deceleration",desc:chosen[2] },
    { label:labels[3], title:"Second Innings Launch",  desc:chosen[3] },
  ];
}

function buildPrinciples(profile) {
  const sd = profile?.stressDrivers || [];
  const hasToxic   = sd.includes("Toxic environment") || sd.includes("Office politics");
  const hasOverwork= sd.includes("Heavy workload")    || sd.includes("Work-life imbalance");
  const hasPurpose = sd.includes("Loss of purpose");
  const hasAI      = sd.includes("Job uncertainty / AI disruption");
  const tAge       = profile?.transitionAge || "your target age";
  const path       = profile?.postPath || "";
  return [
    {
      icon:"◆",
      title: hasToxic ? "Contribute. Don't absorb." : "Contribute. Don't carry.",
      desc:  hasToxic
        ? "Give structured input. Refuse to own others' dysfunction. Your energy is finite — protect it from toxic dynamics and invisible obligations."
        : "Give structured input. Detach from outcome ownership. Outcome belongs to the system — input quality belongs to you.",
    },
    {
      icon:"◈",
      title:"The Transition Age Test",
      desc:`Before any major decision: "Will this serve my future self at ${tAge}?" If the answer is no — reduce your investment in it. This filter cuts through almost every false priority.`,
    },
    {
      icon:"◎",
      title: hasAI ? "Build human-only identity." : "Build portable identity.",
      desc:  hasAI
        ? "Write, speak, mentor, and advise — roles that require judgment, empathy, and trust. AI replaces information processing. It cannot replace you at your best."
        : "Writing, speaking, advising. Your reputation must outlive your employer. Build it now, while you have the platform and the credibility to accelerate it.",
    },
    {
      icon:"◉",
      title: hasOverwork ? "Energy is the asset." : "Energy over income.",
      desc:  hasOverwork
        ? "You are already in energy deficit. From here, every commitment must pass one test: does this restore or deplete me? Income can be rebuilt. Burnout cannot be reversed overnight."
        : "From mid-transition, cognitive energy is your scarcest resource. Protect it ruthlessly. It compounds into your creativity, decisions, and relationships.",
    },
    {
      icon:"◐",
      title: hasPurpose ? "Meaning is built, not found." : "Criteria over arbitration.",
      desc:  hasPurpose
        ? "Stop waiting for purpose to arrive. Design experiments. Commit briefly. Reflect honestly. Meaning emerges from action and attention — not from contemplation alone."
        : "Stop solving others' misalignments. Set frameworks. Let teams own decisions. Your job at this stage is to provide clarity — not resolution.",
    },
    {
      icon:"◑",
      title:"Exit from strength.",
      desc: path === "Full Retirement"
        ? "Retire because you've built enough — not because you're exhausted. Leave with pride, a financial plan, and a sense of purpose that waits on the other side."
        : "Don't escape — design. Leave when you choose, not when forced. The quality of your exit shapes the quality of everything that follows.",
    },
  ];
}

function buildOutreachStrategy(postPath) {
  const map = {
    "Switch to Academia / Teaching": [
      { step:"01", title:"Demonstrate First", desc:"Deliver a free guest lecture or workshop at a target institution. Don't pitch — let the quality of your thinking open the door." },
      { step:"02", title:"Publish Your Perspective", desc:"Write one strong practitioner article or case study. This elevates you above typical applicants who have only academic credentials." },
      { step:"03", title:"Propose a Module", desc:"Submit a structured 8–12 week course outline to a relevant institution. Solving a real curriculum gap is more powerful than any CV." },
    ],
    "Start own Business / Consulting": [
      { step:"01", title:"Demonstrate Before You Pitch", desc:"Deliver a free diagnostic or workshop for a potential client. Let the output speak — relationships and revenue follow naturally from proven value." },
      { step:"02", title:"Publish Your Methodology", desc:"Write a clear, opinionated piece about how you solve problems in your domain. Your thinking IS your product — show it publicly before anyone asks." },
      { step:"03", title:"Propose a Pilot Project", desc:"Offer a low-risk, time-boxed engagement to your first 3 clients. A successful pilot creates case studies, referrals, and the confidence to scale." },
    ],
    "Freelance / Advisory roles": [
      { step:"01", title:"Signal Your Availability", desc:"Update your LinkedIn and tell former colleagues you're open to advisory or board roles. Most opportunities at this level come through warm networks, not applications." },
      { step:"02", title:"Define Your Advisory Thesis", desc:"Write a crisp 1-page document: what you bring, who you help, and how you engage. This becomes your handout in every conversation." },
      { step:"03", title:"Close Your First Mandate", desc:"Offer a 90-day trial engagement at a reduced fee. A short, successful mandate creates the reference that opens the next door — and the one after that." },
    ],
    "NGO / Social Impact": [
      { step:"01", title:"Volunteer Strategically", desc:"Offer your most valuable professional skill to one NGO pro-bono for 60 days. Deep engagement reveals culture, impact, and fit — better than any interview." },
      { step:"02", title:"Build Your Impact Brief", desc:"Create a 1-page document mapping your professional experience to a social cause. Impact organisations respond to specificity and genuine commitment." },
      { step:"03", title:"Propose a Programme", desc:"Pitch a specific initiative or project you could lead. Concrete proposals convert interest into roles — especially in resource-constrained NGOs." },
    ],
    "Creative Pursuits": [
      { step:"01", title:"Create Consistently First", desc:"Share one piece of creative work per week without waiting for it to be perfect. Visibility compounds — your first 100 pieces will teach you more than any plan." },
      { step:"02", title:"Build Your Audience", desc:"Choose one platform and go deep. Newsletter, Substack, Instagram, or YouTube. An engaged audience of 500 is worth more than 50,000 passive followers." },
      { step:"03", title:"Monetise One Way", desc:"Identify the simplest path to your first paid creative income — a commission, a course, a print. Validate the model completely before trying to scale it." },
    ],
    "Full Retirement": [
      { step:"01", title:"Identify Your Purpose Anchors", desc:"List 3 things that will give structure and meaning to your days — mentoring, volunteering, travel, a creative project. Retirement without purpose empties fast." },
      { step:"02", title:"Validate Your Financial Floor", desc:"Confirm with a qualified advisor that your corpus, safe withdrawal rate, and passive income sustain your lifestyle for 25+ years across market scenarios." },
      { step:"03", title:"Design Your First Year", desc:"Plan the first 12 months of retirement in detail — health, travel, social, hobbies. The transition shock is real; early structure prevents it from derailing you." },
    ],
    "Part-time flexible work": [
      { step:"01", title:"Negotiate Before You Leave", desc:"The best flexible arrangement is often in your current organisation. Prepare a business case for part-time or remote — most employers prefer retaining experienced talent." },
      { step:"02", title:"Build a Parallel Income Stream", desc:"Start one freelance or consulting project while still employed. Proof of concept before the leap dramatically reduces fear and financial risk." },
      { step:"03", title:"Define Your Non-Negotiables", desc:"Set clear rules: which days you work, what you won't do, and your minimum income floor. Flexibility without boundaries quickly becomes drift." },
    ],
    "Not sure yet": [
      { step:"01", title:"Run Experiments, Not Plans", desc:"Don't wait for clarity before acting. Run 3 small experiments — a conversation, a project, a workshop — and let the results guide you, not your assumptions." },
      { step:"02", title:"Talk to People Who've Transitioned", desc:"Find 10 people who've made a career shift and ask: what surprised you most? Their answers will compress years of your own confusion into weeks." },
      { step:"03", title:"Reduce Optionality Killers", desc:"Pay down debt, reduce fixed costs, and build savings. Not knowing your exact path is fine — running out of financial runway while you figure it out is not." },
    ],
  };
  return map[postPath] || map["Not sure yet"];
}
const READINESS_DIMS = [
  { key:"financial", label:"Financial Clarity",   q:"How confident are you about your financial plan?" },
  { key:"direction", label:"Career Direction",     q:"How clear is your post-transition path?" },
  { key:"energy",    label:"Energy & Wellbeing",   q:"How energized and well do you feel this week?" },
  { key:"family",    label:"Family Alignment",     q:"How aligned is your family with the transition plan?" },
  { key:"progress",  label:"Weekly Progress",      q:"How much meaningful progress did you make this week?" },
];
const TABS = [
  { id:"dashboard", icon:"◈", label:"Overview" },
  { id:"location", icon:"⊕", label:"Location Finder" },
  { id:"timeline", icon:"◎", label:"Life Timeline" },
  { id:"runway", icon:"◆", label:"Financial Runway" },
  { id:"career", icon:"◉", label:"Career Roadmap" },
  { id:"stress", icon:"◐", label:"Readiness Check" },
  { id:"academic", icon:"◳", label:"Opportunities" },
  { id:"decision", icon:"⊗", label:"Decision Tool" },
  { id:"coach", icon:"◑", label:"AI Coach" },
];
const STEPS = [
  { title:"Your Starting Point", subtitle:"A few basics to personalise your plan" },
  { title:"What's Driving Your Transition?", subtitle:"Select all that apply" },
  { title:"Where Do You Want to Go?", subtitle:"Your ideal post-career path" },
  { title:"Lifestyle Preferences", subtitle:"Climate, budget, and priorities" },
  { title:"Family & Dependents", subtitle:"Help us factor in the people who matter most" },
  { title:"Your Plan Is Ready", subtitle:"Personalised to your profile" },
];

const LANGUAGES = [
  "English","Hindi","Tamil","Telugu","Kannada","Malayalam","Bengali","Marathi",
  "Spanish","French","Portuguese","German","Italian","Arabic","Mandarin","Japanese","Malay"
];

const PRIORITIES_LIST = [
  { id:"Mental peace",          icon:"🧘", desc:"Low-stress, slow-paced environment" },
  { id:"Low crowds",            icon:"🌿", desc:"Smaller cities, less congestion" },
  { id:"Good healthcare",       icon:"🏥", desc:"Quality hospitals & specialists nearby" },
  { id:"Academic access",       icon:"📚", desc:"Universities, libraries, research hubs" },
  { id:"Affordable cost",       icon:"💰", desc:"Low cost of living relative to savings" },
  { id:"Cool climate",          icon:"❄",  desc:"Prefer hill stations or temperate zones" },
  { id:"Cultural life",         icon:"🎭", desc:"Arts, music, theatre, museums" },
  { id:"Vegetarian food",       icon:"🥗", desc:"Easy access to vegetarian / vegan options" },
  { id:"Nature access",         icon:"🏞", desc:"Parks, trails, beaches, green spaces" },
  { id:"Safety & low crime",    icon:"🔒", desc:"Safe neighbourhoods, low crime rates" },
  { id:"Expat community",       icon:"🌍", desc:"Active expat / international community" },
  { id:"Kids schooling",        icon:"🏫", desc:"Good international / CBSE / IB schools nearby" },
  { id:"Elderly care services", icon:"👴", desc:"Senior care facilities & geriatric specialists" },
  { id:"Spiritual environment", icon:"🕍", desc:"Access to temples, churches, or meditation centres" },
  { id:"Sports & fitness",      icon:"🏋", desc:"Gyms, sports clubs, cycling tracks" },
];

// ── Bar component ─────────────────────────────────────────────────────────────
function Bar({ value, max = 10, color, bg, height = 6 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height, background:bg, borderRadius:height/2, overflow:"hidden" }}>
        <div style={{ width:`${(value/max)*100}%`, height:"100%", background:color, borderRadius:height/2, transition:"width 0.6s" }} />
      </div>
      <span style={{ fontSize:12, color, minWidth:24, textAlign:"right", fontWeight:700 }}>{value}</span>
    </div>
  );
}

// ── Radar component ───────────────────────────────────────────────────────────
function Radar({ data, labels, color, border }) {
  const cx=100, cy=100, r=72, n=labels.length;
  const pts = data.map((v,i) => { const a=(Math.PI*2*i)/n-Math.PI/2; return { x:cx+r*(v/10)*Math.cos(a), y:cy+r*(v/10)*Math.sin(a) }; });
  const poly = pts.map(p=>`${p.x},${p.y}`).join(" ");
  const grids = [0.33,0.66,1].map(s=>labels.map((_,i)=>{ const a=(Math.PI*2*i)/n-Math.PI/2; return { x:cx+r*s*Math.cos(a), y:cy+r*s*Math.sin(a) }; }));
  const axes = labels.map((_,i)=>{ const a=(Math.PI*2*i)/n-Math.PI/2; return { x:cx+r*Math.cos(a), y:cy+r*Math.sin(a) }; });
  const lbls = labels.map((l,i)=>{ const a=(Math.PI*2*i)/n-Math.PI/2; return { l, x:cx+(r+20)*Math.cos(a), y:cy+(r+20)*Math.sin(a) }; });
  const ariaLabel = labels.map((l,i) => `${l}: ${data[i]}/10`).join(", ");
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label={`Radar chart — ${ariaLabel}`}>
      {grids.map((ring,ri)=><polygon key={ri} points={ring.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={border} strokeWidth="1"/>)}
      {axes.map((a,i)=><line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke={border} strokeWidth="1"/>)}
      <polygon points={poly} fill={color+"28"} stroke={color} strokeWidth="2"/>
      {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color}/>)}
      {lbls.map((l,i)=><text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill={color} fontFamily="'Lato',sans-serif" fontWeight="700">{l.l}</text>)}
    </svg>
  );
}

// ── CircleScore component ─────────────────────────────────────────────────────
function CircleScore({ value, max=10, color, bg, size=80, label }) {
  const r=30, cx=40, cy=40, circumference=2*Math.PI*r;
  const filled=circumference*(value/max);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label={`${label||"Score"}: ${value} out of ${max}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={bg} strokeWidth="8"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circumference-filled}`}
          strokeDashoffset={circumference*0.25}
          strokeLinecap="round"
          style={{ transition:"stroke-dasharray 0.6s ease" }}/>
        <text x={cx} y={cy-4} textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="700" fill={color} fontFamily="'DM Serif Display',serif">{value}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="8" fill={color} fontFamily="'Lato',sans-serif" opacity="0.7">/10</text>
      </svg>
      {label && <div style={{ fontSize:10, color, fontWeight:700, textAlign:"center", lineHeight:1.3, maxWidth:72 }}>{label}</div>}
    </div>
  );
}

// ── Theme Switcher Panel ──────────────────────────────────────────────────────
function ThemePanel({ current, onSelect, onClose, T }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Choose theme" style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"flex-end" }}>
      <button onClick={onClose} aria-label="Close theme panel" style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.5)", border:"none", cursor:"pointer", width:"100%", height:"100%" }} />
      <div style={{ position:"relative", width:400, height:"100vh", background:T.bgCard, borderLeft:`1px solid ${T.border}`, overflowY:"auto", padding:24, boxShadow:"-8px 0 32px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:T.ink }}>Choose Theme</div>
            <div style={{ fontSize:12, color:T.inkLight, marginTop:3 }}>Changes apply instantly</div>
          </div>
          <button onClick={onClose} aria-label="Close theme panel" style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 12px", color:T.inkMid, cursor:"pointer", fontSize:13 }}>✕ Close</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {Object.entries(THEMES).map(([id, theme]) => {
            const active = current === id;
            return (
              <button key={id} onClick={() => onSelect(id)} aria-pressed={active} style={{ cursor:"pointer", borderRadius:12, border:`2px solid ${active ? theme.accent : T.border}`, overflow:"hidden", transition:"all 0.2s", boxShadow: active ? `0 0 0 2px ${theme.accent}44` : "none", background:"transparent", textAlign:"left", padding:0 }}>
                {/* Mini preview */}
                <div style={{ background:theme.bg, padding:"10px 14px" }}>
                  <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                    {[theme.accent, theme.amber, theme.red, theme.ink].map((c,i)=>(
                      <div key={i} style={{ width:16, height:16, borderRadius:"50%", background:c, border:`1px solid ${theme.border}` }} />
                    ))}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
                    {["Overview","Locations","Runway"].map((t,i)=>(
                      <div key={t} style={{ background: i===0 ? theme.accentLight : theme.bgCard, border:`1px solid ${i===0 ? theme.accent+"55" : theme.border}`, borderRadius:5, padding:"5px 6px" }}>
                        <div style={{ fontSize:7, color:theme.inkLight, textTransform:"uppercase", letterSpacing:"0.08em" }}>Tab</div>
                        <div style={{ fontSize:9, color: i===0 ? theme.accent : theme.ink, fontWeight:700, marginTop:2 }}>{t}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Label */}
                <div style={{ background:theme.bgCard, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", borderTop:`1px solid ${theme.border}` }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:theme.ink }}>{theme.name}</div>
                    <div style={{ fontSize:11, color:theme.inkLight, marginTop:2 }}>{theme.mood}</div>
                  </div>
                  {active && <div style={{ background:theme.accent, color:theme.dark ? "#000" : "#fff", fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, letterSpacing:"0.08em" }}>ACTIVE</div>}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop:20, padding:16, background:T.bgMuted, borderRadius:10, fontSize:12, color:T.inkMid, lineHeight:1.7 }}>
          💡 Your theme preference is saved for this session. All 9 portal tabs update instantly when you switch.
        </div>
      </div>
    </div>
  );
}

// ── Validation helpers ────────────────────────────────────────────────────────
function FieldError({ msg, T }) {
  if (!msg) return null;
  return (
    <div role="alert" style={{ marginTop:6, padding:"8px 12px", background:T.redLight, border:`1px solid ${T.red}44`, borderRadius:7, fontSize:12, color:T.red, display:"flex", alignItems:"center", gap:6 }}>
      <span aria-hidden="true">⚠</span> {msg}
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({ onComplete, T, isEditing=false, initialForm=null, onCancelEdit }) {
  const [started, setStarted] = useState(isEditing);
  const [step, setStep] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payPlan, setPayPlan] = useState(null);
  const defaultForm = { name:"", age:"", transitionAge:"", profession:"", stressDrivers:[], postPath:"", climate:"", budget:"", priorities:[], languages:[], dependents:"", kidsAge:"", kidsSchooling:"", agingParents:"", dependentNotes:"" };
  const [form, setForm] = useState(initialForm || defaultForm);
  const [touched, setTouched] = useState({});
  const [triedNext, setTriedNext] = useState(false);
  const [selectedN, setSelectedN] = useState(null);
  const [landingScrolled, setLandingScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setLandingScrolled(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggle = (field, val) => setForm(f=>({ ...f, [field]: f[field].includes(val) ? f[field].filter(x=>x!==val) : [...f[field], val] }));
  const yearsToTransition = form.transitionAge && form.age ? parseInt(form.transitionAge)-parseInt(form.age) : null;

  const chip = (active, color=T.accent) => ({ background: active ? color+"22" : T.bgMuted, border:`1.5px solid ${active ? color : T.border}`, borderRadius:20, padding:"7px 15px", fontSize:12, color: active ? color : T.inkMid, cursor:"pointer", fontWeight: active ? 700 : 400, transition:"all 0.15s", fontFamily:"'Lato',sans-serif" });
  const btn = (variant="primary") => ({ background: variant==="primary" ? T.accent : variant==="amber" ? T.amber : "transparent", border:`1.5px solid ${variant==="primary" ? T.accent : variant==="amber" ? T.amber : T.border}`, borderRadius:8, padding:"10px 24px", color: variant==="ghost" ? T.inkMid : T.dark ? "#111" : "#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.18s" });
  const inputStyle = (fieldErr) => ({ background:T.bgMuted, border:`1.5px solid ${fieldErr ? T.red : T.border}`, borderRadius:8, padding:"10px 14px", color:T.ink, fontSize:14, width:"100%", fontFamily:"'Lato',sans-serif", boxSizing:"border-box" });

  const errs = validateStep(step, form);
  const canProceed = Object.keys(errs).length === 0;

  if (!started) {
    return (
      <div style={{ background:T.bg, fontFamily:"'Lato',sans-serif", overflowX:"hidden" }}>

        {/* ── STICKY NAVBAR ─────────────────────────────────────────────────── */}
        <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:T.bgCard+"EE", backdropFilter:"blur(12px)", borderBottom:`1px solid ${T.border}`, padding:"0 48px", display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🌿</div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:T.ink }}>SecondInni<span style={{ color:T.red, fontStyle:"italic" }}>_</span>gs</div>
          </div>
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            {[["Purpose","#purpose"],["Your Journey","#journey"],["Why It Matters","#why"],["Choose Your Path","#pricing"]].map(([label,href])=>(
              <a key={label} href={href} style={{ padding:"7px 16px", color:T.inkMid, fontSize:13, fontWeight:600, textDecoration:"none", borderRadius:8, transition:"all 0.15s", fontFamily:"'Lato',sans-serif" }}
                onMouseEnter={e=>{ e.currentTarget.style.color=T.accent; e.currentTarget.style.background=T.accentLight; }}
                onMouseLeave={e=>{ e.currentTarget.style.color=T.inkMid; e.currentTarget.style.background="transparent"; }}>
                {label}
              </a>
            ))}
            <button onClick={()=>setStarted(true)} style={{ background:T.accent, border:"none", borderRadius:8, padding:"8px 20px", color:T.dark?"#111":"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", marginLeft:8 }}>
              Start Free →
            </button>
          </div>
        </nav>

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <div style={{ minHeight:"100vh", display:"flex", position:"relative", paddingTop:64 }}>
          {/* LEFT PANEL */}
          <div className="landing-left" style={{ flex:"0 0 58%", background:T.bg, display:"flex", flexDirection:"column", justifyContent:"center", padding:"60px 72px", position:"relative" }}>
            <div style={{ position:"absolute", top:36, left:72, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🌿</div>
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:T.ink }}>SecondInni<span style={{ color:T.red, fontStyle:"italic" }}>_</span>gs</div>
                <div style={{ fontSize:10, color:T.inkLight, fontStyle:"italic", letterSpacing:"0.04em", marginTop:1 }}>Yes — an N is missing. Come find yours. <a href="#find-the-n" style={{ color:T.accent, textDecoration:"none", fontWeight:700 }}>#FindTheN</a></div>
              </div>
            </div>
            {/* #FindTheN — hero left panel */}
            <div style={{ maxWidth:500 }}>
              <div style={{ display:"inline-block", fontSize:11, color:T.amber, textTransform:"uppercase", letterSpacing:"0.2em", fontWeight:700, marginBottom:20, background:T.amberLight, border:`1px solid ${T.amber}33`, borderRadius:20, padding:"5px 16px" }}>#FindTheN</div>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:52, color:T.ink, letterSpacing:"0.08em", margin:"0 0 4px", lineHeight:1 }}>
                secondinni<span style={{ color:T.red, fontStyle:"italic" }}>_</span>gs.in
              </div>
              <div style={{ display:"flex", gap:0, marginBottom:6 }}>
                {"secondinnigs.in".split("").map((_, i) => (
                  <div key={i} style={{ width:20, textAlign:"center", fontSize:9, color: i===10 ? T.red : "transparent", fontWeight:700 }}>{i===10 ? "↑" : "·"}</div>
                ))}
              </div>
              <div style={{ fontSize:13, color:T.inkLight, marginBottom:24, letterSpacing:"0.04em" }}>
                "innings" has <strong style={{color:T.ink}}>3 N's</strong> · our URL has <strong style={{color:T.red}}>2</strong> · one is missing
              </div>
              <h1 className="landing-h1" style={{ fontFamily:"'DM Serif Display',serif", fontSize:34, color:T.ink, lineHeight:1.2, margin:"0 0 10px" }}>
                That missing N is yours.<br/><span style={{ color:T.accent }}>What's the N you've been waiting for?</span>
              </h1>
              <p style={{ fontSize:13, color:T.inkMid, lineHeight:1.7, margin:"0 0 24px" }}>
                Pick it. Share it. Then come build it.
              </p>
              {/* N-word chips */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
                {[
                  { word:"Now", sub:"The time is now" }, { word:"Next", sub:"My next chapter" },
                  { word:"New Start", sub:"A clean slate" }, { word:"No Boss", sub:"Full autonomy" },
                  { word:"Nomad Life", sub:"Location freedom" }, { word:"Noble Purpose", sub:"Work that matters" },
                  { word:"No Regrets", sub:"Live intentionally" }, { word:"Navigate", sub:"Find my own way" },
                ].map(({ word, sub }) => {
                  const active = selectedN === word;
                  return (
                    <button key={word} onClick={() => setSelectedN(active ? null : word)}
                      style={{ background: active ? T.amber+"22" : T.bgMuted, border:`2px solid ${active ? T.amber : T.border}`, borderRadius:10, padding:"8px 16px", cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.18s", boxShadow: active ? `0 4px 16px ${T.amber}33` : "none" }}>
                      <div style={{ fontSize:13, fontWeight:700, color: active ? T.amber : T.ink }}><span style={{ color:T.amber }}>N</span>{word.slice(1)}</div>
                      <div style={{ fontSize:9, color:T.inkLight, marginTop:2 }}>{sub}</div>
                    </button>
                  );
                })}
              </div>
              {/* Share card — inline when chip selected */}
              {selectedN ? (
                <div style={{ background:T.bgMuted, border:`2px solid ${T.amber}44`, borderRadius:16, padding:"20px 24px", marginBottom:16, animation:"fadeUp 0.25s ease" }}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:28, color:T.ink, marginBottom:4 }}>
                    I'm missing the N of <span style={{ color:T.amber }}>N</span>{selectedN.slice(1)}.
                  </div>
                  <div style={{ fontSize:12, color:T.inkMid, marginBottom:16 }}>Starting my second innings — one N at a time.</div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I'm missing the N of "${selectedN}" — and I'm done waiting.\n\nStarting my second innings at secondinnigs.in\n\n#FindTheN #SecondInnigs`)}`, "_blank")}
                      style={{ background:"#000", border:"none", borderRadius:8, padding:"10px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
                      <span>𝕏</span> Share on X
                    </button>
                    <button onClick={()=>setStarted(true)} style={{ background:T.accent, border:"none", borderRadius:8, padding:"10px 20px", color:T.dark?"#111":"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>
                      Start Finding It →
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>setStarted(true)} style={{ background:T.accent, border:"none", borderRadius:10, padding:"13px 36px", color:T.dark?"#111":"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", boxShadow:`0 4px 20px ${T.accent}44`, marginBottom:16 }}>
                  Start Planning →
                </button>
              )}
              <div style={{ fontSize:11, color:T.inkLight }}>✓ Free &nbsp;·&nbsp; ✓ No account required &nbsp;·&nbsp; ✓ Data saved in your browser only</div>
            </div>
          </div>
          {/* RIGHT PANEL — visual */}
          <div className="landing-right" style={{ flex:1, background:"linear-gradient(145deg,#0D1F17 0%,#1C3A2E 35%,#3A6B4A 65%,#8B5E2A 100%)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute",top:-120,right:-120,width:500,height:500,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.06)" }}/>
            <div style={{ position:"absolute",top:-60,right:-60,width:350,height:350,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.04)" }}/>
            <div style={{ position:"absolute",bottom:-80,left:-40,width:280,height:280,borderRadius:"50%",background:"rgba(196,135,58,0.15)" }}/>
            <div style={{ position:"absolute",top:"30%",left:"15%",width:100,height:100,borderRadius:"50%",background:"rgba(92,138,110,0.3)" }}/>
            <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", gap:12, width:260 }}>
              {[
                { icon:"◆", label:"Financial Runway", value:"8.5 yrs",  note:"to full independence",  offset:0  },
                { icon:"⊕", label:"Top City Match",   value:"Mysuru",   note:"score 9.2 / 10",        offset:28 },
                { icon:"◉", label:"Career Roadmap",   value:"6 / 16",   note:"transition tasks done", offset:0  },
                { icon:"◐", label:"Readiness Score",  value:"7.2 / 10", note:"growing week on week",  offset:28 },
              ].map((c,i)=>(
                <div key={i} style={{ background:"rgba(255,255,255,0.09)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,marginLeft:c.offset }}>
                  <div style={{ width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"rgba(255,255,255,0.85)",flexShrink:0 }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize:10,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700 }}>{c.label}</div>
                    <div style={{ fontFamily:"'DM Serif Display',serif",fontSize:20,color:"#fff",marginTop:3,lineHeight:1 }}>{c.value}</div>
                    <div style={{ fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:3 }}>{c.note}</div>
                  </div>
                </div>
              ))}
              <div style={{ textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.3)",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:4 }}>+ 5 more tools inside</div>
            </div>
          </div>
          {/* Scroll hint */}
          <div style={{ position:"absolute", bottom:28, left:"29%", transform:"translateX(-50%)", display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{ fontSize:11, color:T.inkLight, letterSpacing:"0.1em", textTransform:"uppercase", opacity:0.6 }}>Scroll to explore</div>
            <div style={{ fontSize:18, color:T.inkLight, opacity:0.5 }}>↓</div>
          </div>
        </div>

        {/* ── SECTION: PITCH — YOUR NEXT CHAPTER ───────────────────────────── */}
        <div id="pitch" style={{ background:T.bg, padding:"80px 60px", borderTop:`1px solid ${T.border}` }}>
          <div style={{ maxWidth:1100, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"center" }}>
            {/* Left: headline + description */}
            <div>
              <div style={{ display:"inline-block", fontSize:11, color:T.accent, textTransform:"uppercase", letterSpacing:"0.2em", fontWeight:700, marginBottom:20, background:T.accentLight, border:`1px solid ${T.accent}33`, borderRadius:20, padding:"5px 16px" }}>Your Next Chapter</div>
              <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:48, color:T.ink, lineHeight:1.15, margin:"0 0 24px" }}>
                Your next chapter.<br/><span style={{ color:T.accent }}>Designed by you.</span>
              </h2>
              <p style={{ fontSize:16, color:T.inkMid, lineHeight:1.85, margin:"0 0 36px" }}>
                SecondInni<span style={{ color:T.red, fontStyle:"italic" }}>_</span>gs is a life design platform for mid-career professionals ready to move beyond burnout, boredom, or the golden cage — and build something that actually fits who they've become.
              </p>
              <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                <button onClick={()=>setStarted(true)} style={{ background:T.accent, border:"none", borderRadius:10, padding:"14px 36px", color:T.dark?"#111":"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", boxShadow:`0 4px 20px ${T.accent}44` }}>
                  Start for Free →
                </button>
                <button onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})} style={{ background:"transparent", border:`2px solid ${T.border}`, borderRadius:10, padding:"14px 36px", color:T.ink, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>
                  See Plans
                </button>
              </div>
            </div>
            {/* Right: feature list */}
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              {[
                { icon:"💰", title:"Financial Runway Calculator", desc:"Know exactly how many years your savings can fund the life you want — before you leap." },
                { icon:"🗺️", title:"Location Intelligence", desc:"Find cities worldwide that match your climate, cost of living, and lifestyle priorities." },
                { icon:"🧭", title:"Career Roadmap", desc:"A personalised, phase-by-phase plan to transition into your chosen post-career path." },
                { icon:"🤖", title:"AI Life Coach", desc:"An always-on coach that helps you think through every big decision — without judgment." },
              ].map((f, i) => (
                <div key={i} style={{ display:"flex", gap:18, alignItems:"flex-start", background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:"20px 24px" }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:T.accentLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{f.icon}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:4 }}>{f.title}</div>
                    <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.65 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── SECTION 1: PURPOSE — WHAT IS SECOND INNINGS ───────────────────── */}
        <div id="purpose" style={{ background:T.bgCard, padding:"90px 60px" }}>
          <div style={{ maxWidth:1100, margin:"0 auto" }}>
            <div style={{ textAlign:"center", marginBottom:64 }}>
              <div style={{ display:"inline-block", fontSize:11, color:T.accent, textTransform:"uppercase", letterSpacing:"0.2em", fontWeight:700, marginBottom:16, background:T.accentLight, border:`1px solid ${T.accent}33`, borderRadius:20, padding:"5px 14px" }}>Our Purpose</div>
              <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:42, color:T.ink, margin:"0 0 20px 0", lineHeight:1.18 }}>
                What is Second Innings?
              </h2>
              <p style={{ fontSize:16, color:T.inkMid, lineHeight:1.85, maxWidth:640, margin:"0 auto" }}>
                A platform built for mid-career professionals who are ready to design the next phase of their life — on their own terms, with clarity and confidence.
              </p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:24 }}>
              {[
                { icon:"🎯", title:"New Opportunities", desc:"Discover career paths, businesses, and lifestyles tailored to your skills, experience, and dreams — far beyond what a typical job board shows.", color:T.accent },
                { icon:"🧭", title:"Guided Planning", desc:"Real, actionable plans — not just inspiration. Financial runway, career roadmaps, and location intelligence to ground your vision.", color:T.amber },
                { icon:"🌍", title:"Location Freedom", desc:"Find cities worldwide that match your budget, climate preferences, and lifestyle priorities so your geography works for you.", color:T.accent },
                { icon:"🤖", title:"AI-Powered Insight", desc:"A personal AI life coach available 24/7, helping you think clearly through every transition decision — without judgment.", color:T.amber },
              ].map((card, i) => (
                <div key={i} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:18, padding:32, cursor:"default", transition:"transform 0.2s, box-shadow 0.2s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-5px)"; e.currentTarget.style.boxShadow=T.shadow; }}
                  onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                  <div style={{ width:56, height:56, borderRadius:14, background:card.color+"18", border:`1px solid ${card.color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, marginBottom:20 }}>{card.icon}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:T.ink, marginBottom:10, fontFamily:"'DM Serif Display',serif" }}>{card.title}</div>
                  <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.75 }}>{card.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign:"center", marginTop:48 }}>
              <button onClick={()=>setStarted(true)} style={{ background:T.accent, border:"none", borderRadius:10, padding:"14px 40px", color:T.dark?"#111":"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", boxShadow:`0 4px 20px ${T.accent}33` }}>
                Explore the Platform →
              </button>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: HOW IT HELPS — 3 STEPS ────────────────────────────── */}
        <div id="journey" style={{ background:T.bg, padding:"90px 60px" }}>
          <div style={{ maxWidth:1100, margin:"0 auto" }}>
            <div style={{ textAlign:"center", marginBottom:64 }}>
              <div style={{ display:"inline-block", fontSize:11, color:T.amber, textTransform:"uppercase", letterSpacing:"0.2em", fontWeight:700, marginBottom:16, background:T.amberLight, border:`1px solid ${T.amber}33`, borderRadius:20, padding:"5px 14px" }}>Your Journey</div>
              <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:42, color:T.ink, margin:"0 0 20px 0", lineHeight:1.18 }}>
                How Second Innings Helps You
              </h2>
              <p style={{ fontSize:16, color:T.inkMid, lineHeight:1.85, maxWidth:580, margin:"0 auto" }}>
                Three clear steps from feeling stuck to living with purpose — in the next phase of your life.
              </p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:32, position:"relative" }}>
              <div style={{ position:"absolute", top:68, left:"17%", right:"17%", height:2, background:`linear-gradient(90deg, ${T.accent}55, ${T.amber}55, ${T.accent}55)`, zIndex:0 }} />
              {[
                { step:"01", icon:"🔍", title:"Discover", subtitle:"Find What's Possible", desc:"Complete a 6-step personalised assessment revealing opportunities matched to your profession, life stage, values, and what truly matters to you.", highlight:T.accent, light:T.accentLight },
                { step:"02", icon:"📋", title:"Plan", subtitle:"Build Your Roadmap", desc:"Use our financial calculator, career roadmap, and location finder to create a concrete, data-driven plan — not just a vision board or a wish list.", highlight:T.amber, light:T.amberLight },
                { step:"03", icon:"🚀", title:"Start", subtitle:"Take the First Step", desc:"Your AI life coach guides you daily. Track readiness, celebrate progress, connect with experts, and launch your second innings with confidence.", highlight:T.accent, light:T.accentLight },
              ].map((s, i) => (
                <div key={i} style={{ position:"relative", zIndex:1, background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:22, padding:"40px 32px", textAlign:"center", boxShadow:T.shadow }}>
                  <div style={{ width:56, height:56, borderRadius:"50%", background:s.light, border:`2px solid ${s.highlight}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px auto", fontSize:12, fontWeight:700, color:s.highlight, letterSpacing:"0.1em" }}>{s.step}</div>
                  <div style={{ fontSize:36, marginBottom:14 }}>{s.icon}</div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:T.ink, marginBottom:6 }}>{s.title}</div>
                  <div style={{ fontSize:11, color:s.highlight, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:16 }}>{s.subtitle}</div>
                  <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.8 }}>{s.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign:"center", marginTop:52 }}>
              <button onClick={()=>setStarted(true)} style={{ background:"transparent", border:`2px solid ${T.accent}`, borderRadius:10, padding:"14px 40px", color:T.accent, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.2s" }}
                onMouseEnter={e=>{ e.currentTarget.style.background=T.accent; e.currentTarget.style.color=T.dark?"#111":"#fff"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=T.accent; }}>
                Begin Your Journey →
              </button>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: WHY IT MATTERS ─────────────────────────────────────── */}
        <div id="why" style={{ background:T.bgCard, padding:"90px 60px" }}>
          <div style={{ maxWidth:1100, margin:"0 auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:80, alignItems:"center" }}>
              <div>
                <div style={{ display:"inline-block", fontSize:11, color:T.accent, textTransform:"uppercase", letterSpacing:"0.2em", fontWeight:700, marginBottom:16, background:T.accentLight, border:`1px solid ${T.accent}33`, borderRadius:20, padding:"5px 14px" }}>Why It Matters</div>
                <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:42, color:T.ink, margin:"0 0 24px 0", lineHeight:1.18 }}>
                  Life doesn't stop<br/>at <span style={{ color:T.accent }}>one chapter.</span>
                </h2>
                <p style={{ fontSize:15, color:T.inkMid, lineHeight:1.85, marginBottom:20 }}>
                  Most people spend decades building a career — and then have no plan for what comes next. Second Innings exists because the second half of life can be the most fulfilling, if you design it intentionally.
                </p>
                <p style={{ fontSize:15, color:T.inkMid, lineHeight:1.85, marginBottom:40 }}>
                  Whether you're 40 or 60, burnt out or simply ready for more — you deserve a platform that takes your next chapter as seriously as your first.
                </p>
                <div style={{ display:"flex", gap:36, flexWrap:"wrap" }}>
                  {[["50M+","Mid-career professionals in India alone"],["8–12 yrs","Average remaining career runway"],["73%","Report wanting a major life change"]].map(([stat,label],i)=>(
                    <div key={i}>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:30, color:T.accent, lineHeight:1 }}>{stat}</div>
                      <div style={{ fontSize:11, color:T.inkMid, marginTop:8, lineHeight:1.5, maxWidth:100 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:40 }}>
                  <button onClick={()=>setStarted(true)} style={{ background:T.accent, border:"none", borderRadius:10, padding:"14px 36px", color:T.dark?"#111":"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", boxShadow:`0 4px 20px ${T.accent}33` }}>
                    Start My Journey →
                  </button>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                {[
                  { icon:"💼", quote:"I had 20 years of experience but no idea what to do next. Second Innings helped me see a path I never considered.", name:"Rajesh M., 52", role:"Former IT Director → Sustainable Farming", color:T.accentLight, border:T.accent },
                  { icon:"🎨", quote:"The financial calculator alone saved me 3 years of anxiety. I finally knew exactly when I could leave.", name:"Priya K., 47", role:"Senior Manager → Art & Wellness Coach", color:T.amberLight, border:T.amber },
                  { icon:"🌿", quote:"Moving to Mysuru was the best decision of our lives. Second Innings showed us what was truly possible.", name:"Suresh & Anita R., 55", role:"Corporate Couple → Location-Independent Life", color:T.accentLight, border:T.accent },
                ].map((t,i)=>(
                  <div key={i} style={{ background:t.color, border:`1px solid ${t.border}44`, borderRadius:16, padding:"22px 26px" }}>
                    <div style={{ fontSize:28, marginBottom:12 }}>{t.icon}</div>
                    <div style={{ fontSize:14, color:T.ink, lineHeight:1.75, fontStyle:"italic", marginBottom:14 }}>"{t.quote}"</div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{t.name}</div>
                    <div style={{ fontSize:12, color:T.inkMid, marginTop:3 }}>{t.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: MONETIZATION — HOW WE SUSTAIN THIS ─────────────────── */}
        <div id="pricing" style={{ background:T.bg, padding:"90px 60px" }}>
          <div style={{ maxWidth:1100, margin:"0 auto" }}>
            <div style={{ textAlign:"center", marginBottom:64 }}>
              <div style={{ display:"inline-block", fontSize:11, color:T.amber, textTransform:"uppercase", letterSpacing:"0.2em", fontWeight:700, marginBottom:16, background:T.amberLight, border:`1px solid ${T.amber}33`, borderRadius:20, padding:"5px 14px" }}>Go Deeper</div>
              <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:42, color:T.ink, margin:"0 0 20px 0", lineHeight:1.18 }}>
                Choose Your Path
              </h2>
              <p style={{ fontSize:16, color:T.inkMid, lineHeight:1.85, maxWidth:600, margin:"0 auto" }}>
                Start completely free. Unlock expert guidance and premium tools when you're ready to move from planning into action.
              </p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:28 }}>
              {[
                {
                  tier:"Free",
                  icon:"🌱",
                  price:"₹0",
                  period:"Always free",
                  color:T.accent,
                  features:["Full onboarding assessment","Financial Runway Calculator","Career Roadmap builder","Location Finder (3 cities)","Stress & Readiness Tracker","AI Coach (10 messages/day)"],
                  cta:"Get Started Free",
                  primary:false,
                },
                {
                  tier:"Premium",
                  icon:"🚀",
                  price:"₹499",
                  period:"per month",
                  color:T.amber,
                  badge:"Most Popular",
                  features:["Everything in Free","Unlimited AI Coach sessions","Unlimited city comparisons","Personalised transition report PDF","Weekly readiness check-ins","Expert referrals: financial advisors","Priority support & community access"],
                  cta:"Start 7-Day Free Trial",
                  primary:true,
                },
                {
                  tier:"Annual",
                  icon:"⭐",
                  price:"₹3,999",
                  period:"per year · Save 33%",
                  color:T.accent,
                  badge:"Best Value",
                  features:["Everything in Monthly Premium","2 months free vs monthly","Annual Transition Milestones Report","Early access to new features","Personalised plan PDF export","Priority community access","Lifetime download of all reports"],
                  cta:"Start Annual Plan",
                  primary:false,
                },
              ].map((plan, i) => (
                <div key={i} style={{ background:T.bgCard, border:`2px solid ${plan.primary ? plan.color : T.border}`, borderRadius:22, padding:"40px 32px", position:"relative", boxShadow: plan.primary ? `0 8px 40px ${plan.color}33` : T.shadow }}>
                  {plan.badge && <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", background:plan.color, color:T.dark?"#111":"#fff", fontSize:11, fontWeight:700, padding:"5px 18px", borderRadius:20, letterSpacing:"0.1em", whiteSpace:"nowrap" }}>{plan.badge}</div>}
                  <div style={{ width:52, height:52, borderRadius:14, background:plan.color+"18", border:`1px solid ${plan.color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, marginBottom:16 }}>{plan.icon}</div>
                  <div style={{ fontSize:11, color:plan.color, textTransform:"uppercase", letterSpacing:"0.15em", fontWeight:700, marginBottom:8 }}>{plan.tier}</div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:38, color:T.ink, lineHeight:1 }}>{plan.price}</div>
                  <div style={{ fontSize:12, color:T.inkMid, marginBottom:28, marginTop:4 }}>{plan.period}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:11, marginBottom:32 }}>
                    {plan.features.map((f,fi)=>(
                      <div key={fi} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                        <span style={{ color:plan.color, fontSize:14, flexShrink:0, marginTop:1 }}>✓</span>
                        <span style={{ fontSize:13, color:T.inkMid, lineHeight:1.5 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>{ if(plan.tier==="Free"){ setStarted(true); } else { setPayPlan(plan); setShowPayModal(true); } }} style={{ width:"100%", background: plan.primary ? plan.color : "transparent", border:`2px solid ${plan.color}`, borderRadius:10, padding:"14px 24px", color: plan.primary ? (T.dark?"#111":"#fff") : plan.color, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.2s" }}>
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop:52, display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:22 }}>
              {[
                { icon:"🤝", title:"Partner Referrals", desc:"Connect with vetted financial advisors, career coaches, and relocation consultants through our trusted partner network. Earn commissions on every referral." },
                { icon:"📚", title:"Curated Skill Courses", desc:"Access hand-picked upskilling courses for your chosen post-career path — from consulting to creative arts to agri-tourism and sustainable farming." },
                { icon:"🏢", title:"Corporate Packages", desc:"For HR teams and companies supporting employee transitions. Help your people plan their next chapter with structure, dignity, and expert guidance." },
              ].map((item,i)=>(
                <div key={i} style={{ background:T.bgMuted, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 30px" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:T.accentLight, border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, marginBottom:16 }}>{item.icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:T.ink, marginBottom:10 }}>{item.title}</div>
                  <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.75 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA SECTION ───────────────────────────────────────────────────── */}
        <div style={{ background:"linear-gradient(135deg, #0D1F17 0%, #1C3A2E 50%, #3A6B4A 100%)", padding:"110px 60px", textAlign:"center", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-100, left:-100, width:500, height:500, borderRadius:"50%", border:"1px solid rgba(255,255,255,0.04)" }}/>
          <div style={{ position:"absolute", bottom:-80, right:-80, width:400, height:400, borderRadius:"50%", background:"rgba(196,135,58,0.1)" }}/>
          <div style={{ position:"relative", zIndex:1, maxWidth:680, margin:"0 auto" }}>
            <div style={{ display:"inline-block", fontSize:11, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.2em", fontWeight:700, marginBottom:20, border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:"5px 16px" }}>Your Time is Now</div>
            <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:50, color:"#fff", margin:"0 0 24px 0", lineHeight:1.14 }}>
              Start Your Second<br/>Innings Today
            </h2>
            <p style={{ fontSize:16, color:"rgba(255,255,255,0.65)", lineHeight:1.9, maxWidth:520, margin:"0 auto 52px auto" }}>
              Join thousands of mid-career professionals designing their next chapter — not leaving it to chance. Your best years may still be ahead of you.
            </p>
            <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap", marginBottom:36 }}>
              <button onClick={()=>setStarted(true)} style={{ background:"rgba(255,255,255,0.95)", border:"none", borderRadius:12, padding:"18px 52px", color:"#1C3A2E", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", letterSpacing:"0.02em", boxShadow:"0 8px 40px rgba(0,0,0,0.35)", transition:"all 0.2s" }}>
                Explore Opportunities →
              </button>
              <button onClick={()=>setStarted(true)} style={{ background:"transparent", border:"2px solid rgba(255,255,255,0.3)", borderRadius:12, padding:"18px 52px", color:"rgba(255,255,255,0.85)", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", letterSpacing:"0.02em", transition:"all 0.2s" }}>
                Start Planning Free
              </button>
            </div>
            <div style={{ display:"flex", gap:28, justifyContent:"center", flexWrap:"wrap" }}>
              {["✓ Free to start","✓ No account needed","✓ Data saved in your browser only","✓ First insight in 5 minutes"].map((t,i)=>(
                <div key={i} style={{ fontSize:13, color:"rgba(255,255,255,0.45)", fontWeight:600 }}>{t}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <div style={{ background:T.bgCard, borderTop:`1px solid ${T.border}`, padding:"32px 60px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:20 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:6, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🌿</div>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:T.ink }}>SecondInni<span style={{ color:T.red, fontStyle:"italic" }}>_</span>gs</div>
            </div>
            <div style={{ fontSize:12, color:T.inkLight, marginTop:5 }}>Life Design Portal · secondinnigs.in</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {["Dashboard","Location Finder","Career Roadmap","Financial Runway","AI Coach","Decision Tool"].map(link=>(
              <button key={link} onClick={()=>setStarted(true)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, color:T.inkMid, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif", padding:"6px 14px", transition:"all 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.accent; e.currentTarget.style.color=T.accent; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.inkMid; }}>
                {link}
              </button>
            ))}
          </div>
          <div style={{ fontSize:12, color:T.inkLight }}>© 2025 SecondInnigs · Designed with care</div>
        </div>

        {/* ── Payment Modal ── */}
        {/* ── Scroll-to-top (landing) ── */}
        {landingScrolled && (
          <button
            onClick={() => window.scrollTo({ top:0, behavior:"smooth" })}
            aria-label="Scroll to top"
            style={{ position:"fixed", bottom:28, right:28, zIndex:500, width:44, height:44, borderRadius:"50%", background:T.accent, border:"none", color:T.dark?"#111":"#fff", fontSize:20, cursor:"pointer", boxShadow:`0 4px 16px ${T.accent}55`, display:"flex", alignItems:"center", justifyContent:"center" }}
          >↑</button>
        )}

        {showPayModal && payPlan && (
          <div style={{ position:"fixed", inset:0, zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)" }} onClick={()=>setShowPayModal(false)}>
            <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:24, padding:40, maxWidth:500, width:"90%", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }} onClick={e=>e.stopPropagation()}>
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ fontSize:40, marginBottom:10 }}>💳</div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:T.ink, marginBottom:6 }}>{payPlan.tier} Plan</div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:34, color:payPlan.color }}>{payPlan.price}</div>
                <div style={{ fontSize:13, color:T.inkMid, marginTop:4 }}>{payPlan.period}</div>
              </div>
              {/* ── Payments Under Construction ── */}
              <div style={{ background:T.amberLight, border:`2px solid ${T.amber}`, borderRadius:14, padding:"18px 20px", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:20 }}>🚧</span>
                  <div style={{ fontSize:14, fontWeight:700, color:T.amber }}>Payments — Coming Soon</div>
                </div>
                <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.7 }}>
                  Our payment system is currently being set up. To join the Pro waitlist and be notified the moment it goes live, drop us a line and we'll reach out as soon as it's ready.
                </div>
                <button
                  onClick={() => window.open("mailto:hello@secondinnigs.in?subject=SecondInnigs Pro Waitlist — Notify Me","_blank")}
                  style={{ marginTop:14, background:T.amber, border:"none", borderRadius:8, padding:"10px 22px", color:T.dark?"#111":"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>
                  Notify Me When Ready →
                </button>
              </div>
              <div style={{ background:T.bgMuted, borderRadius:14, padding:20, marginBottom:16, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", inset:0, background:T.bgCard+"CC", backdropFilter:"blur(3px)", zIndex:1, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:14 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🔒</div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.inkMid }}>Payment details masked</div>
                    <div style={{ fontSize:11, color:T.inkLight, marginTop:4 }}>Available once payments go live</div>
                  </div>
                </div>
                <div style={{ fontWeight:700, color:T.ink, marginBottom:12, fontSize:14 }}>Pay via UPI or Bank Transfer</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10, filter:"blur(4px)", userSelect:"none" }}>
                  <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>📱</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>UPI Payment</div>
                      <div style={{ fontSize:12, color:T.inkMid, marginTop:2 }}>UPI ID: <strong>██████████@upi</strong></div>
                      <div style={{ fontSize:11, color:T.inkLight, marginTop:2 }}>GPay · PhonePe · Paytm · BHIM</div>
                    </div>
                  </div>
                  <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>💳</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>Debit / Credit Card</div>
                      <div style={{ fontSize:12, color:T.inkMid, marginTop:2 }}>Razorpay secure checkout — Visa, Mastercard, RuPay</div>
                    </div>
                  </div>
                  <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>✉️</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>Net Banking / NEFT</div>
                      <div style={{ fontSize:12, color:T.inkMid, marginTop:2 }}>Email <strong>██████@secondinnigs.in</strong> for bank details</div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:12 }}>
                <button onClick={()=>setShowPayModal(false)} style={{ flex:1, background:"transparent", border:`1.5px solid ${T.border}`, borderRadius:10, padding:"12px 20px", color:T.inkMid, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>
                  Cancel
                </button>
                <button onClick={()=>{ setShowPayModal(false); setStarted(true); }} style={{ flex:2, background:payPlan.color, border:"none", borderRadius:10, padding:"12px 20px", color:T.dark?"#111":"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>
                  Continue to App →
                </button>
              </div>
              <div style={{ textAlign:"center", marginTop:14, fontSize:11, color:T.inkLight }}>🔒 Secure · No card data stored on this site · Cancel anytime</div>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", marginBottom:40, position:"relative" }}>
        {isEditing && onCancelEdit && (
          <button onClick={onCancelEdit} style={{ position:"absolute", right:0, top:0, background:"transparent", border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 14px", color:T.inkMid, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>✕ Cancel</button>
        )}
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:30, color:T.ink }}>SecondInni<span style={{ color:T.red, fontStyle:"italic" }}>_</span>gs</div>
        <div style={{ fontSize:11, color:T.inkLight, letterSpacing:"0.15em", textTransform:"uppercase", marginTop:5 }}>{isEditing ? "Update Your Profile" : "Design Your Next Chapter"}</div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:32 }}>
        {STEPS.map((_,i)=><div key={i} style={{ width:i<=step?28:8, height:8, borderRadius:4, background: i<step?T.accent:i===step?T.amber:T.border, transition:"all 0.3s" }} />)}
      </div>
      <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:16, padding:32, width:"100%", maxWidth:560, boxShadow:T.shadow }}>
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:T.ink, margin:0 }}>{STEPS[step].title}</h2>
          <p style={{ fontSize:13, color:T.inkLight, marginTop:6 }}>{STEPS[step].subtitle}</p>
        </div>

        {step===0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:6 }}>Your Name <span style={{color:T.red}}>*</span></label>
              <input style={inputStyle(triedNext && errs.name)} placeholder="What shall we call you?" value={form.name}
                onBlur={()=>setTouched(t=>({...t,name:true}))}
                onChange={e=>setForm({...form,name:e.target.value})} />
              {(touched.name || triedNext) && <FieldError msg={errs.name} T={T}/>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:6 }}>Current Age <span style={{color:T.red}}>*</span></label>
                <input type="number" style={inputStyle(triedNext && errs.age)} placeholder="e.g. 47" value={form.age}
                  onBlur={()=>setTouched(t=>({...t,age:true}))}
                  onChange={e=>setForm({...form,age:e.target.value})} />
                {(touched.age || triedNext) && <FieldError msg={errs.age} T={T}/>}
              </div>
              <div>
                <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:6 }}>Target Transition Age <span style={{color:T.red}}>*</span></label>
                <input type="number" style={inputStyle(triedNext && errs.transitionAge)} placeholder="e.g. 55" value={form.transitionAge}
                  onBlur={()=>setTouched(t=>({...t,transitionAge:true}))}
                  onChange={e=>setForm({...form,transitionAge:e.target.value})} />
                {(touched.transitionAge || triedNext) && <FieldError msg={errs.transitionAge} T={T}/>}
              </div>
            </div>
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:8 }}>Current Profession <span style={{color:T.red}}>*</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {PROFESSIONS.map(p=><button key={p} style={chip(form.profession===p)} onClick={()=>setForm({...form,profession:p})}>{p}</button>)}
              </div>
              {triedNext && <FieldError msg={errs.profession} T={T}/>}
            </div>
          </div>
        )}

        {step===1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {STRESS_DRIVERS.map(d=>(
              <label key={d} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, border:`1.5px solid ${form.stressDrivers.includes(d)?T.accent:T.border}`, background:form.stressDrivers.includes(d)?T.accentLight:T.bgMuted, cursor:"pointer", transition:"all 0.15s" }}>
                <input type="checkbox" checked={form.stressDrivers.includes(d)} onChange={()=>toggle("stressDrivers",d)} style={{ accentColor:T.accent }} />
                <span style={{ fontSize:14, color:T.ink }}>{d}</span>
              </label>
            ))}
            {triedNext && <FieldError msg={errs.stressDrivers} T={T}/>}
          </div>
        )}

        {step===2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {POST_PATHS.map(p=>(
              <label key={p} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, border:`1.5px solid ${form.postPath===p?T.amber:T.border}`, background:form.postPath===p?T.amberLight:T.bgMuted, cursor:"pointer", transition:"all 0.15s" }}>
                <input type="radio" name="postPath" checked={form.postPath===p} onChange={()=>setForm({...form,postPath:p})} style={{ accentColor:T.amber }} />
                <span style={{ fontSize:14, color:T.ink }}>{p}</span>
              </label>
            ))}
            {triedNext && <FieldError msg={errs.postPath} T={T}/>}
          </div>
        )}

        {step===3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:8 }}>Climate Preference <span style={{color:T.red}}>*</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {CLIMATES.map(o=><button key={o} style={chip(form.climate===o,T.accent)} onClick={()=>setForm({...form,climate:o})}>{o}</button>)}
              </div>
              {triedNext && <FieldError msg={errs.climate} T={T}/>}
            </div>
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:8 }}>Monthly Living Budget (post-transition) <span style={{color:T.red}}>*</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {BUDGETS.map(o=><button key={o} style={chip(form.budget===o,T.amber)} onClick={()=>setForm({...form,budget:o})}>{o}</button>)}
              </div>
              {triedNext && <FieldError msg={errs.budget} T={T}/>}
            </div>
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:4 }}>What Matters Most? <span style={{color:T.inkLight, fontWeight:400, textTransform:"none", letterSpacing:0}}>(pick up to 3)</span> <span style={{color:T.red}}>*</span></label>
              <div style={{ fontSize:12, color:T.inkLight, marginBottom:10 }}>These directly influence your location and lifestyle recommendations.</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {PRIORITIES_LIST.map(p=>{
                  const active = form.priorities.includes(p.id);
                  return (
                    <button key={p.id}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:10, border:`1.5px solid ${active?T.accent:T.border}`, background:active?T.accentLight:T.bgMuted, cursor:"pointer", transition:"all 0.15s", textAlign:"left", width:"100%" }}
                      onClick={()=>{ if(active) toggle("priorities",p.id); else if(form.priorities.length<3) toggle("priorities",p.id); }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{p.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:active?700:500, color:active?T.accent:T.ink }}>{p.id}</div>
                        <div style={{ fontSize:11, color:active?T.accent:T.inkLight, marginTop:1 }}>{p.desc}</div>
                      </div>
                      {active && <span style={{ fontSize:16, color:T.accent, flexShrink:0 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize:11, color:T.inkLight, marginTop:8 }}>{form.priorities.length}/3 selected</div>
              {triedNext && <FieldError msg={errs.priorities} T={T}/>}
            </div>
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:4 }}>Languages You're Comfortable In</label>
              <div style={{ fontSize:12, color:T.inkLight, marginBottom:10 }}>We'll prioritise cities where daily life is easy in these languages.</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {LANGUAGES.map(l=>(
                  <button key={l} style={chip(form.languages.includes(l),T.accent)} onClick={()=>toggle("languages",l)}>{l}</button>
                ))}
              </div>
              {form.languages.length > 0 && <div style={{ fontSize:11, color:T.inkLight, marginTop:6 }}>{form.languages.length} language{form.languages.length>1?"s":""} selected</div>}
            </div>
          </div>
        )}

        {step===4 && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {/* Dependents count */}
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:8 }}>Do you have dependents? <span style={{color:T.red}}>*</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {["None — just me","Partner only","Partner + 1 child","Partner + 2 children","Partner + 3+ children","Single parent","Ageing parents only","Mix of the above"].map(o=>(
                  <button key={o} style={chip(form.dependents===o,T.accent)} onClick={()=>setForm({...form,dependents:o})}>{o}</button>
                ))}
              </div>
              {triedNext && <FieldError msg={errs.dependents} T={T}/>}
            </div>

            {/* Kids schooling — show if children mentioned */}
            {(form.dependents||"").toLowerCase().includes("child") && (
              <div>
                <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:8 }}>Children's Schooling Needs</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {["Pre-school / Daycare","Primary (grades 1–5)","Middle school (grades 6–8)","High school (grades 9–12)","College / University","Already graduated","Not applicable"].map(o=>(
                    <button key={o} style={chip(form.kidsSchooling===o,T.amber)} onClick={()=>setForm({...form,kidsSchooling:o})}>{o}</button>
                  ))}
                </div>
                <div style={{ fontSize:12, color:T.inkLight, marginTop:6 }}>This helps us recommend cities with good international / CBSE / IB schools.</div>
              </div>
            )}

            {/* Kids age range */}
            {(form.dependents||"").toLowerCase().includes("child") && (
              <div>
                <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:8 }}>Children's Age Range</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {["Under 5","5–10 years","10–15 years","15–18 years","18+ (young adult)","Mixed ages"].map(o=>(
                    <button key={o} style={chip(form.kidsAge===o,T.amber)} onClick={()=>setForm({...form,kidsAge:o})}>{o}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Ageing parents */}
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:8 }}>Ageing Parents / Elderly Dependents</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {["Not applicable","Parents are independent","One parent needs occasional support","Parents need regular care","Parents live with me","Parents in care facility"].map(o=>(
                  <button key={o} style={chip(form.agingParents===o,T.accent)} onClick={()=>setForm({...form,agingParents:o})}>{o}</button>
                ))}
              </div>
            </div>

            {/* Freeform notes */}
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:6 }}>Anything else about your family situation? <span style={{color:T.inkLight, fontWeight:400, textTransform:"none", letterSpacing:0}}>(optional)</span></label>
              <textarea
                rows={3}
                placeholder="e.g. My daughter is appearing for boards in 2 years, or my parents are in Hyderabad and I can't move too far…"
                style={{ background:T.bgMuted, border:`1.5px solid ${T.border}`, borderRadius:8, padding:"10px 14px", color:T.ink, fontSize:13, width:"100%", fontFamily:"'Lato',sans-serif", outline:"none", boxSizing:"border-box", resize:"vertical", lineHeight:1.6 }}
                value={form.dependentNotes}
                onChange={e=>setForm({...form,dependentNotes:e.target.value})}
              />
            </div>
          </div>
        )}

        {step===5 && (
          <div>
            <div style={{ background:T.accentLight, borderRadius:12, padding:20, marginBottom:16, border:`1px solid ${T.accent}33` }}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:T.accent, marginBottom:12 }}>{form.name?`Welcome, ${form.name}.`:"Your plan is ready."}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[["Age",form.age||"—"],["Target Transition",`Age ${form.transitionAge||"—"}`],["Years Runway",yearsToTransition?`${yearsToTransition} years`:"—"],["Profession",form.profession||"—"],["Post-Career",form.postPath||"—"],["Climate",form.climate||"—"]].map(([k,v])=>(
                  <div key={k}>
                    <div style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{k}</div>
                    <div style={{ fontSize:14, color:T.ink, fontWeight:600, marginTop:3 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            {form.stressDrivers.length>0 && <div style={{ marginBottom:10 }}><div style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:6 }}>Stress drivers</div><div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>{form.stressDrivers.map(d=><span key={d} style={{ background:T.redLight, border:`1px solid ${T.red}44`, borderRadius:20, padding:"3px 10px", fontSize:11, color:T.red, fontWeight:600 }}>{d}</span>)}</div></div>}
            {form.priorities.length>0 && <div style={{marginBottom:10}}><div style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:6 }}>Top priorities</div><div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>{form.priorities.map(p=><span key={p} style={{ background:T.accentLight, border:`1px solid ${T.accent}44`, borderRadius:20, padding:"3px 10px", fontSize:11, color:T.accent, fontWeight:600 }}>{p}</span>)}</div></div>}
            {form.languages.length>0 && <div style={{marginBottom:10}}><div style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:6 }}>Languages</div><div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>{form.languages.map(l=><span key={l} style={{ background:T.bgMuted, border:`1px solid ${T.border}`, borderRadius:20, padding:"3px 10px", fontSize:11, color:T.inkMid, fontWeight:600 }}>{l}</span>)}</div></div>}
            {form.dependents && <div><div style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:6 }}>Family</div><div style={{ display:"flex", flexWrap:"wrap", gap:6 }}><span style={{ background:T.bgMuted, border:`1px solid ${T.border}`, borderRadius:20, padding:"3px 10px", fontSize:11, color:T.inkMid, fontWeight:600 }}>{form.dependents}</span>{form.kidsSchooling&&<span style={{ background:T.amberLight, border:`1px solid ${T.amber}44`, borderRadius:20, padding:"3px 10px", fontSize:11, color:T.amber, fontWeight:600 }}>{form.kidsSchooling}</span>}{form.agingParents&&form.agingParents!=="Not applicable"&&<span style={{ background:T.bgMuted, border:`1px solid ${T.border}`, borderRadius:20, padding:"3px 10px", fontSize:11, color:T.inkMid, fontWeight:600 }}>{form.agingParents}</span>}</div></div>}
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:24 }}>
          {step>0 ? <button style={btn("ghost")} onClick={()=>{ setStep(step-1); setTriedNext(false); }}>← Back</button> : <div/>}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {!canProceed && triedNext && step < STEPS.length-1 && (
              <span style={{ fontSize:12, color:T.red }}>Please complete all required fields</span>
            )}
            {step<STEPS.length-1
              ? <button style={{ ...btn(), opacity: (!canProceed && triedNext) ? 0.7 : 1 }} onClick={()=>{
                  setTriedNext(true);
                  if (!canProceed) return;
                  setTriedNext(false);
                  setStep(step+1);
                }}>Continue →</button>
              : <button style={btn("amber")} onClick={()=>onComplete(form)}>Open My Portal →</button>}
          </div>
        </div>
      </div>
      <div style={{ marginTop:16, fontSize:11, color:T.inkLight, letterSpacing:"0.08em" }}>Your data is saved in your browser — never on our servers · No account required</div>
    </div>
  );
}

// ── Subscription Modal ────────────────────────────────────────────────────────
function SubscriptionModal({ user, onClose, googleBtnRef, T }) {
  const PLANS = [
    {
      id:"guest", name:"Guest", price:"Free", sub:"No sign-in needed",
      color:T.inkMid,
      features:["Full life design portal","AI location finder","Career roadmap","Financial runway calculator","AI Coach (standard)","Session only — resets on refresh"],
      cta:"Current", ctaDisabled:true,
    },
    {
      id:"starter", name:"Starter", price:"Free", sub:"Sign in with Google",
      color:T.accent,
      features:["Everything in Guest","Profile saved across sessions","Readiness log persisted","Name personalisation throughout","AI Coach — extended context"],
      cta: user ? "Active" : null, // null = render Google button
      ctaDisabled: !!user,
      highlight: !user,
    },
    {
      id:"pro", name:"Pro", price:"₹499/mo", sub:"or ₹3,999/year · save 33%",
      color:T.amber,
      badge:"Best Value",
      features:["Everything in Starter","Unlimited AI coaching depth","PDF life plan export (branded)","Advanced roadmap templates","Email progress reminders","Multi-device sync"],
      cta:"Join Waitlist", ctaDisabled:false, waitlist:true,
    },
  ];
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Choose your plan" style={{ position:"fixed", inset:0, zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <button onClick={onClose} aria-label="Close plan modal" style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(2px)", border:"none", cursor:"pointer", width:"100%", height:"100%" }}/>
      <div style={{ position:"relative", width:"min(860px,95vw)", background:T.bgCard, borderRadius:20, border:`1px solid ${T.border}`, boxShadow:"0 24px 80px rgba(0,0,0,0.4)", padding:"36px 32px", maxHeight:"90vh", overflowY:"auto" }}>
        <button onClick={onClose} aria-label="Close plan modal" style={{ position:"absolute", top:16, right:18, background:"transparent", border:`1px solid ${T.border}`, borderRadius:8, padding:"5px 12px", color:T.inkMid, cursor:"pointer", fontSize:13 }}>✕</button>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:T.ink, marginBottom:6 }}>Choose your plan</div>
          <div style={{ fontSize:13, color:T.inkMid }}>Start free. Upgrade when you're ready to go deeper.</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          {PLANS.map(p=>(
            <div key={p.id} style={{ background:T.bgMuted, borderRadius:16, padding:24, border:`2px solid ${p.highlight?p.color:T.border}`, position:"relative", display:"flex", flexDirection:"column" }}>
              {p.badge && (
                <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:p.color, color:T.dark?"#111":"#fff", fontSize:10, fontWeight:700, padding:"3px 14px", borderRadius:20, letterSpacing:"0.08em", whiteSpace:"nowrap" }}>{p.badge}</div>
              )}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:T.ink }}>{p.name}</div>
                <div style={{ fontSize:24, color:p.color, fontWeight:700, margin:"6px 0 2px" }}>{p.price}</div>
                <div style={{ fontSize:11, color:T.inkLight }}>{p.sub}</div>
              </div>
              <ul style={{ listStyle:"none", padding:0, margin:"0 0 20px", flex:1 }}>
                {p.features.map((f,i)=>(
                  <li key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", fontSize:12, color:T.inkMid, padding:"5px 0", borderBottom:i<p.features.length-1?`1px solid ${T.border}`:"none" }}>
                    <span style={{ color:p.color, flexShrink:0, marginTop:1 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              {/* CTA */}
              {p.cta && (
                <button
                  disabled={p.ctaDisabled}
                  onClick={p.waitlist ? ()=>window.open("mailto:hello@secondinnigs.in?subject=SecondInnigs Pro Waitlist","_blank") : undefined}
                  style={{ width:"100%", padding:"11px 0", borderRadius:10, border:`1.5px solid ${p.ctaDisabled?T.border:p.color}`, background:p.ctaDisabled?"transparent":p.color, color:p.ctaDisabled?T.inkLight:T.dark?"#111":"#fff", fontSize:13, fontWeight:700, cursor:p.ctaDisabled?"default":"pointer", fontFamily:"'Lato',sans-serif" }}>
                  {p.cta}
                </button>
              )}
              {/* Google Sign-In button slot for Starter when not logged in */}
              {!p.cta && !user && (
                <div ref={googleBtnRef} style={{ width:"100%", minHeight:44, display:"flex", alignItems:"center", justifyContent:"center" }}/>
              )}
            </div>
          ))}
        </div>
        <div style={{ textAlign:"center", marginTop:20, fontSize:11, color:T.inkLight }}>No credit card required for Starter · Cancel Pro anytime · Your data stays in your browser — never on our servers</div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [themeId, setThemeId] = useState("warm-ivory");
  const [showThemes, setShowThemes] = useState(false);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [fin, setFin] = useState({ income:150000, expenses:65000, savings:800000, targetYears:5 });
  const [readinessLog, setReadinessLog] = useState([]);
  const [newReadiness, setNewReadiness] = useState({ financial:6, direction:6, energy:7, family:7, progress:6 });
  const [selLoc, setSelLoc] = useState([]);
  const [locFilter, setLocFilter] = useState("All");
  const [aiLocs, setAiLocs] = useState([]);
  const [aiLocsLoading, setAiLocsLoading] = useState(false);
  const [aiLocsError, setAiLocsError] = useState(null);
  const [aiLocsSearched, setAiLocsSearched] = useState(false);
  const [careerChecks, setCareerChecks] = useState({});
  const [decInput, setDecInput] = useState({ text:"" });
  const [decAnswers, setDecAnswers] = useState({});
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatIn, setChatIn] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [decAiAnalysis, setDecAiAnalysis] = useState(null);
  const [decAiLoading, setDecAiLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [user, setUser] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [fin2, setFin2] = useState(null); // null = scenario B hidden
  const [scrollVisible, setScrollVisible] = useState(false);
  const chatRef = useRef(null);
  const googleBtnRef = useRef(null);
  const mainBodyRef = useRef(null);

  const T = THEMES[themeId];

  // ── Google OAuth init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          const info = parseGoogleJwt(response.credential);
          if (!info) return;
          const newUser = { name: info.name, email: info.email, picture: info.picture };
          setUser(newUser);
          try { localStorage.setItem("si_user", JSON.stringify(newUser)); } catch {}
          setShowSubModal(false);
        },
        auto_select: false,
      });
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  // Render Google button whenever the modal slot mounts
  useEffect(() => {
    if (!showSubModal || !googleBtnRef.current || !window.google?.accounts?.id) return;
    const timer = setTimeout(() => {
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: T.dark ? "filled_black" : "outline",
          size: "large", text: "signin_with", shape: "rectangular",
          width: googleBtnRef.current.offsetWidth || 220,
        });
      }
    }, 80); // small delay to ensure DOM is ready
    return () => clearTimeout(timer);
  }, [showSubModal, T.dark]);

  // ── Restore all state from localStorage on mount (works for everyone) ────────
  useEffect(() => {
    try {
      const savedUser    = JSON.parse(localStorage.getItem("si_user"));
      const savedProfile = JSON.parse(localStorage.getItem("si_profile"));
      const savedFin     = JSON.parse(localStorage.getItem("si_fin"));
      const savedFin2    = JSON.parse(localStorage.getItem("si_fin2"));
      const savedTheme   = localStorage.getItem("si_theme");
      const savedLog     = JSON.parse(localStorage.getItem("si_readiness_log"));
      const savedChecks  = JSON.parse(localStorage.getItem("si_career_checks"));
      const savedAiLocs  = JSON.parse(localStorage.getItem("si_ai_locs"));
      const savedSelLoc  = JSON.parse(localStorage.getItem("si_sel_loc"));
      const savedDecIn   = JSON.parse(localStorage.getItem("si_dec_input"));
      const savedDecAns  = JSON.parse(localStorage.getItem("si_dec_answers"));
      const savedChat    = JSON.parse(localStorage.getItem("si_chat"));

      if (savedProfile) {
        setProfile(savedProfile);
        if (savedUser) setUser(savedUser);
        const yl = savedProfile.transitionAge && savedProfile.age
          ? parseInt(savedProfile.transitionAge) - parseInt(savedProfile.age) : null;
        // restore chat or generate welcome-back message
        if (savedChat && savedChat.length > 0) {
          setChatMsgs(savedChat);
        } else {
          setChatMsgs([{ role:"assistant", content:`Welcome back${savedProfile.name?`, ${savedProfile.name}`:""}. Good to see you again.\n\nYou're ${yl?`${yl} year${yl===1?"":"s"} away from`:"working toward"} your transition at age ${savedProfile.transitionAge||"your target"} from ${savedProfile.profession||"your current role"}.\n\nWhat would you like to work on today?` }]);
        }
      }
      if (savedFin)    setFin(savedFin);
      if (savedFin2)   setFin2(savedFin2);
      if (savedTheme && THEMES[savedTheme]) setThemeId(savedTheme);
      if (savedLog)    setReadinessLog(savedLog);
      if (savedChecks) setCareerChecks(savedChecks);
      if (savedAiLocs && savedAiLocs.length > 0) { setAiLocs(savedAiLocs); setAiLocsSearched(true); }
      if (savedSelLoc) setSelLoc(savedSelLoc);
      if (savedDecIn)  setDecInput(savedDecIn);
      if (savedDecAns) setDecAnswers(savedDecAns);
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist all state to localStorage on every change ─────────────────────
  useEffect(() => { try { if (profile) localStorage.setItem("si_profile", JSON.stringify(profile)); } catch {} }, [profile]);
  useEffect(() => { try { localStorage.setItem("si_fin", JSON.stringify(fin)); } catch {} }, [fin]);
  useEffect(() => { try { if (fin2) localStorage.setItem("si_fin2", JSON.stringify(fin2)); else localStorage.removeItem("si_fin2"); } catch {} }, [fin2]);
  useEffect(() => { try { localStorage.setItem("si_theme", themeId); } catch {} }, [themeId]);
  useEffect(() => { try { localStorage.setItem("si_readiness_log", JSON.stringify(readinessLog)); } catch {} }, [readinessLog]);
  useEffect(() => { try { localStorage.setItem("si_career_checks", JSON.stringify(careerChecks)); } catch {} }, [careerChecks]);
  useEffect(() => { try { localStorage.setItem("si_ai_locs", JSON.stringify(aiLocs)); } catch {} }, [aiLocs]);
  useEffect(() => { try { localStorage.setItem("si_sel_loc", JSON.stringify(selLoc)); } catch {} }, [selLoc]);
  useEffect(() => { try { localStorage.setItem("si_dec_input", JSON.stringify(decInput)); } catch {} }, [decInput]);
  useEffect(() => { try { localStorage.setItem("si_dec_answers", JSON.stringify(decAnswers)); } catch {} }, [decAnswers]);
  useEffect(() => { try { if (chatMsgs.length > 0) localStorage.setItem("si_chat", JSON.stringify(chatMsgs.slice(-40))); } catch {} }, [chatMsgs]);

  // ── Document title update on tab change ───────────────────────────────────
  useEffect(() => {
    const tabLabel = TABS.find(t => t.id === tab)?.label || "Overview";
    document.title = `${tabLabel} — SecondInnigs`;
  }, [tab]);

  // ── Scroll-to-top button visibility ───────────────────────────────────────
  useEffect(() => {
    const el = mainBodyRef.current;
    if (!el) return;
    const onScroll = () => setScrollVisible(el.scrollTop > 300);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const latestReadiness = readinessLog[readinessLog.length - 1] || { financial:0, direction:0, energy:0, family:0, progress:0 };
  const overallReadiness = ((latestReadiness.financial + latestReadiness.direction + latestReadiness.energy + latestReadiness.family + latestReadiness.progress) / 5).toFixed(1);

  // Style helpers (theme-aware)
  const card = { background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:16, padding:24, boxShadow:T.shadow };
  const cardSm = { background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:16, boxShadow:T.shadow };
  const sTitle = { fontFamily:"'DM Serif Display',serif", fontSize:22, color:T.ink, fontWeight:400, margin:0 };
  const sLabel = { fontSize:11, color:T.inkLight, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:700 };
  const sInput = { background:T.bgMuted, border:`1.5px solid ${T.border}`, borderRadius:8, padding:"10px 14px", color:T.ink, fontSize:14, width:"100%", fontFamily:"'Lato',sans-serif", boxSizing:"border-box" };
  const sBtn = (v="primary") => ({ background:v==="primary"?T.accent:v==="amber"?T.amber:"transparent", border:`1.5px solid ${v==="primary"?T.accent:v==="amber"?T.amber:T.border}`, borderRadius:8, padding:"10px 22px", color:v==="ghost"?T.inkMid:T.dark?"#111":"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.18s" });
  const sChip = (active, color=T.accent) => ({ background:active?color+"22":T.bgMuted, border:`1.5px solid ${active?color:T.border}`, borderRadius:20, padding:"6px 14px", fontSize:12, color:active?color:T.inkMid, cursor:"pointer", fontWeight:active?700:400, transition:"all 0.15s" });
  const sTag = (color=T.accent) => ({ background:color+"18", border:`1px solid ${color+"44"}`, borderRadius:20, padding:"3px 10px", fontSize:11, color, fontWeight:600 });
  const navBtn = (active) => ({ background:active?T.accentLight:"transparent", border:`1.5px solid ${active?T.accent:"transparent"}`, borderRadius:8, padding:"8px 16px", color:active?T.accent:T.inkMid, fontSize:12, fontWeight:active?700:400, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Lato',sans-serif", transition:"all 0.15s" });

  const signOut = () => {
    window.google?.accounts.id.disableAutoSelect();
    setUser(null);
    try { localStorage.removeItem("si_user"); localStorage.removeItem("si_profile"); } catch {}
  };

  const onboard = (form) => {
    setProfile(form);
    // AI locations will be fetched on demand in the location tab
    setSelLoc([]);
    const yearsLeft = form.transitionAge && form.age ? parseInt(form.transitionAge)-parseInt(form.age) : null;
    const familyCtx = form.dependents && form.dependents !== "None — just me"
      ? `I also see you're navigating this with ${form.dependents.toLowerCase()} — that's an important part of your plan.`
      : "";
    const greeting = `Welcome${form.name?`, ${form.name}`:""}. I'm your SecondInnigs Life Coach.\n\nYou're ${form.age}, working in ${form.profession||"your field"}, aiming to transition around age ${form.transitionAge||"your target"}. That gives you ${yearsLeft||"several"} year${yearsLeft===1?"":"s"} of runway. ${familyCtx}\n\nLet me start with one question:\n\n${form.stressDrivers.length>0?`You flagged "${form.stressDrivers[0]}" as a key stress driver. If that pressure disappeared tomorrow — would you still want to transition, or is it partly what's pushing you?`:"If your work environment became ideal tomorrow — would you still want to transition, or is something specific driving the urge?"}`;
    setChatMsgs([{ role:"assistant", content:greeting }]);
  };

  const updateProfile = (form) => {
    setProfile(form);
    setShowEditProfile(false);
  };

  const resetAll = () => {
    // Clear state
    setProfile(null);
    setTab("dashboard");
    setFin({ income:150000, expenses:65000, savings:800000, targetYears:5 });
    setFin2(null);
    setReadinessLog([]);
    setNewReadiness({ financial:6, direction:6, energy:7, family:7, progress:6 });
    setSelLoc([]); setLocFilter("All");
    setAiLocs([]); setAiLocsLoading(false); setAiLocsError(null); setAiLocsSearched(false);
    setCareerChecks({});
    setDecInput({ text:"" }); setDecAnswers({});
    setChatMsgs([]); setChatIn(""); setChatLoading(false);
    setShowResetConfirm(false);
    // Clear all persisted data from localStorage
    try {
      ["si_profile","si_fin","si_fin2","si_readiness_log","si_career_checks",
       "si_ai_locs","si_sel_loc","si_dec_input","si_dec_answers","si_chat",
       "si_user"].forEach(k => localStorage.removeItem(k));
    } catch {}
  };

  const printProfile = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const safeName = escapeHtml(profile?.name);
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SecondInnigs — Life Plan${safeName?` · ${safeName}`:""}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Lato:wght@400;700&display=swap" rel="stylesheet"/>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Lato',sans-serif;max-width:800px;margin:40px auto;padding:0 28px;color:#1C3A2E;background:#fff;line-height:1.6}h2{font-family:'DM Serif Display',serif;font-size:20px;font-weight:400;border-bottom:1px solid #E2DAD0;padding-bottom:8px;margin:30px 0 14px}.hdr{text-align:center;padding:28px 0;border-bottom:2px solid #5C8A6E;margin-bottom:8px}.brand{font-family:'DM Serif Display',serif;font-size:30px}.meta{font-size:11px;color:#8BA396;margin-top:6px;letter-spacing:0.08em}.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:10px 0}.card{background:#F7F3EE;border-radius:8px;padding:12px 14px;border:1px solid #E2DAD0}.lbl{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#8BA396;font-weight:700}.val{font-size:22px;color:#5C8A6E;font-family:'DM Serif Display',serif;margin-top:3px}.val.sm{font-size:15px;font-family:'Lato',sans-serif;font-weight:700}.tag{display:inline-block;background:#EBF3EF;color:#5C8A6E;border:1px solid rgba(92,138,110,0.2);padding:3px 11px;border-radius:20px;font-size:11px;margin:2px;font-weight:600}.tag.s{background:#FDECEA;color:#C0564A;border-color:rgba(192,86,74,0.2)}.track{border-left:3px solid #5C8A6E;padding:11px 14px;margin:8px 0;background:#F7F3EE;border-radius:0 8px 8px 0}.tt{font-weight:700;font-size:14px}.td{font-size:12px;color:#4A6358;margin-top:3px}.footer{margin-top:40px;padding-top:14px;border-top:1px solid #E2DAD0;font-size:11px;color:#8BA396;text-align:center}.btn{display:block;margin:20px auto 0;padding:11px 28px;background:#5C8A6E;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Lato',sans-serif}@media print{.btn{display:none}}</style>
</head><body>
<div class="hdr"><div class="brand">SecondInnigs</div><div class="meta">Personal Life Plan · ${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}${safeName?` · ${safeName}`:""}</div></div>
<h2>Profile</h2>
<div class="g3"><div class="card"><div class="lbl">Current Age</div><div class="val">${profile?.age||"—"}</div></div><div class="card"><div class="lbl">Target Transition</div><div class="val">Age ${profile?.transitionAge||"—"}</div></div><div class="card"><div class="lbl">Runway Left</div><div class="val">${yearsLeft} yrs</div></div></div>
<div class="g2"><div class="card"><div class="lbl">Profession</div><div class="val sm">${profile?.profession||"—"}</div></div><div class="card"><div class="lbl">Post-Career Path</div><div class="val sm">${profile?.postPath||"—"}</div></div></div>
<h2>Stress Drivers</h2><div style="margin:8px 0">${profile?.stressDrivers?.map(d=>`<span class="tag s">${d}</span>`).join("")||"—"}</div>
<h2>Lifestyle Priorities</h2><div style="margin:8px 0">${profile?.priorities?.map(p=>`<span class="tag">${p}</span>`).join("")||"—"}</div>
<h2>Financial Snapshot</h2>
<div class="g3"><div class="card"><div class="lbl">Monthly Income</div><div class="val">₹${(fin.income/1000).toFixed(0)}k</div></div><div class="card"><div class="lbl">Monthly Expenses</div><div class="val">₹${(fin.expenses/1000).toFixed(0)}k</div></div><div class="card"><div class="lbl">Monthly Savings</div><div class="val" style="color:${monthlySave>0?"#5C8A6E":"#C0564A"}">₹${Math.abs(monthlySave/1000).toFixed(0)}k</div></div><div class="card"><div class="lbl">Current Savings</div><div class="val">₹${(fin.savings/100000).toFixed(1)}L</div></div><div class="card"><div class="lbl">Target Corpus</div><div class="val">₹${(targetCorpus/100000).toFixed(1)}L</div></div><div class="card"><div class="lbl">Progress</div><div class="val">${Math.round(progress)}%</div></div></div>
<h2>Transition Tracks — ${profile?.profession}</h2>
${tracks.map((t,i)=>`<div class="track"><div class="tt">${["🥇","🥈","🥉"][i]||"•"} ${t.title} <span style="font-size:11px;color:#8BA396;font-weight:400">(${t.fit}/10)</span></div><div class="td">${t.desc}</div></div>`).join("")}
<h2>Career Roadmap</h2>
${careerSteps.map(s=>`<div class="track"><div class="tt">${s.phase} — ${s.title}</div><div class="td">${s.tasks.join(" · ")}</div></div>`).join("")}
${sortedLocs.length>0?`<h2>Top Location Matches</h2><div class="g3">${sortedLocs.slice(0,3).map(l=>`<div class="card"><div class="lbl">${escapeHtml(l.region)}</div><div class="val sm">${escapeHtml(l.name)}</div><div style="font-size:11px;color:#4A6358;margin-top:4px">${escapeHtml(l.whyYou)}</div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${(l.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("")}</div><div style="margin-top:8px;font-size:10px;color:#8BA396">Overall ${l.overall}/10 · Cost ${l.cost}/10 · Health ${l.healthcare}/10</div></div>`).join("")}</div>`:""}
<h2>Readiness Check — Latest</h2>
<div class="g3">${READINESS_DIMS.map(d=>`<div class="card"><div class="lbl">${d.label}</div><div class="val">${latestReadiness[d.key]}<span style="font-size:14px">/10</span></div></div>`).join("")}<div class="card"><div class="lbl">Overall</div><div class="val">${overallReadiness}<span style="font-size:14px">/10</span></div></div></div>
<button class="btn" onclick="window.print()">⬇ Save as PDF / Print</button>
<div class="footer">SecondInnigs · secondinnigs.in · For personal planning purposes only. Not financial, legal, or professional advice.</div>
</body></html>`);
    win.document.close();
    win.focus();
  };

  const sendChat = async () => {
    if(!chatIn.trim() || chatLoading) return;
    const userMsg = chatIn.trim();
    const next = [...chatMsgs, { role:"user", content:userMsg }];
    setChatMsgs(next); setChatIn(""); setChatLoading(true);
    setTimeout(()=>chatRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
    const system = `You are a calm, wise, and insightful life design coach specialising in career transitions and second innings planning.

User profile:
- Name: ${profile?.name || "not provided"}
- Age: ${profile?.age}
- Profession: ${profile?.profession}
- Target transition age: ${profile?.transitionAge} (${profile?.transitionAge && profile?.age ? parseInt(profile.transitionAge)-parseInt(profile.age) : "?"} years away)
- Post-career path: ${profile?.postPath}
- Stress drivers: ${profile?.stressDrivers?.join(", ")}
- Top priorities: ${profile?.priorities?.join(", ")}
- Languages comfortable in: ${profile?.languages?.join(", ") || "not specified"}
- Dependents: ${profile?.dependents || "not specified"}
- Children's schooling: ${profile?.kidsSchooling || "not applicable"}
- Children's ages: ${profile?.kidsAge || "not applicable"}
- Ageing parents: ${profile?.agingParents || "not specified"}
- Family notes: ${profile?.dependentNotes || "none"}
- Latest readiness scores (1–10): Financial clarity: ${latestReadiness.financial}, Career direction: ${latestReadiness.direction}, Energy & wellbeing: ${latestReadiness.energy}, Family alignment: ${latestReadiness.family}, Weekly progress: ${latestReadiness.progress}. Overall readiness: ${overallReadiness}/10. Weakest dimension: ${weakestDim.label}.

Live progress data:
- Financial: ₹${(fin.savings/100000).toFixed(1)}L saved, target ₹${(targetCorpus/100000).toFixed(1)}L (${Math.round(progress)}% built), monthly savings ₹${(monthlySave/1000).toFixed(0)}k, ${monthsLeft>600?"rate needs adjustment":`${Math.ceil(monthsLeft/12)}y ${monthsLeft%12}m to goal`}
- Career roadmap: ${doneTasks}/${totalTasks} tasks complete (${careerPct}%)
- Top location match: ${topLoc ? `${topLoc.name}, ${topLoc.region} (score ${topLoc.overall}/10)` : "not searched yet"}
- Readiness entries logged: ${readinessLog.length} week${readinessLog.length===1?"":"s"}

Guidelines:
- Ask ONE deep, thoughtful question at a time — never multiple questions
- Be warm, direct, and analytically sharp
- Avoid generic life-coach clichés
- When relevant, acknowledge family constraints — e.g. if children are in board years, factor that into timing advice
- If ageing parents are a factor, gently explore how they're being considered in the transition plan
- Reference the user's specific profile details when relevant
- Keep responses concise (3–5 sentences max unless elaboration is explicitly asked for)
- Help them think clearly, not just feel better`;
    try {
      const reply = await askClaude(next.map(m=>({ role:m.role, content:m.content })), system);
      setChatMsgs(prev=>[...prev, { role:"assistant", content:reply }]);
    } catch(e) {
      setChatMsgs(prev=>[...prev, { role:"assistant", content:"I had trouble connecting. Please check the API key in your .env file and try again." }]);
    }
    setChatLoading(false);
    setTimeout(()=>chatRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
  };

  // ── Decision Tool AI Analysis ─────────────────────────────────────────────
  const analyzeDecision = async () => {
    if (!decInput.text.trim() || decAiLoading) return;
    setDecAiLoading(true);
    setDecAiAnalysis(null);
    const filterSummary = DECISION_FILTERS.map((f,i) => `${f.tag}: ${decAnswers[i] || "Not answered"}`).join("\n");
    const system = `You are a calm, strategic life design advisor helping mid-career professionals make high-stakes decisions before their career transition.`;
    const prompt = `Evaluate this decision for a ${profile?.profession || "professional"} planning to transition to ${profile?.postPath || "their next chapter"} in ${profile?.transitionAge && profile?.age ? parseInt(profile.transitionAge)-parseInt(profile.age) : "?"} years.

Decision: "${decInput.text}"

Filter scores:
${filterSummary}

Provide:
1. A clear recommendation (1 sentence): Proceed / Reconsider / Avoid — and why
2. The strongest reason TO do it (1 sentence)
3. The biggest risk or concern (1 sentence)
4. One specific action to reduce the risk or validate the decision before committing

Keep it sharp, honest, and grounded in the person's transition context. No filler.`;
    try {
      const reply = await askClaude([{ role:"user", content:prompt }], system, 600);
      setDecAiAnalysis(reply);
    } catch(e) {
      setDecAiAnalysis("Could not reach the AI. Please check your connection and try again.");
    }
    setDecAiLoading(false);
  };

  // ── AI Location Search ────────────────────────────────────────────────────
  const fetchAiLocations = async () => {
    setAiLocsLoading(true);
    setAiLocsError(null);
    setAiLocsSearched(true);
    setSelLoc([]);
    const prompt = `You are a global career transition and lifestyle relocation expert. Based on this person's profile, recommend exactly 9 cities worldwide that best match their needs.

Profile:
- Climate preference: ${profile?.climate || "Any"}
- Monthly budget: ${profile?.budget || "Moderate"}
- Top priorities: ${profile?.priorities?.join(", ") || "general quality of life"}
- Languages comfortable in: ${profile?.languages?.length > 0 ? profile.languages.join(", ") : "English (default)"}
- Post-career path: ${profile?.postPath || "flexible"}
- Profession: ${profile?.profession || "professional"}
- Stress drivers to escape: ${profile?.stressDrivers?.join(", ") || "general burnout"}
- Family / dependents: ${profile?.dependents || "not specified"}
- Children's schooling needs: ${profile?.kidsSchooling || "not applicable"}
- Children's age range: ${profile?.kidsAge || "not applicable"}
- Ageing parents situation: ${profile?.agingParents || "not specified"}
- Additional family notes: ${profile?.dependentNotes || "none"}

Key considerations:
- LANGUAGE FILTER (critical): The user is comfortable in: ${profile?.languages?.length > 0 ? profile.languages.join(", ") : "English"}. Only recommend cities where at least one of these languages is widely spoken, taught in schools, or used by a significant expat community. Do NOT recommend cities where daily life would require a completely different language.
- If children's schooling is mentioned, only recommend cities with good international / CBSE / IB schools
- If ageing parents need care, factor in quality geriatric care infrastructure
- Search globally — consider cities across Asia, Europe, Americas, Africa, Oceania
- Prioritise lesser-known gems that genuinely fit the profile, not just obvious tourist cities

Respond ONLY with a valid JSON array. No explanation, no markdown, no code fences. Just raw JSON like this:
[
  {
    "name": "City Name",
    "region": "Country/Region",
    "climate": "Cool|Mild|Warm|Tropical",
    "healthcare": 8,
    "academic": 7,
    "cost": 9,
    "calm": 8,
    "crowd": 8,
    "overall": 8.0,
    "tags": ["tag1", "tag2", "tag3"],
    "whyYou": "One sentence explaining why this city fits THIS person specifically."
  }
]

Score each dimension from 1–10. overall should be a weighted average. Return exactly 9 cities.`;

    try {
      const raw = await askClaude([{ role:"user", content:prompt }], "", 2000);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setAiLocs(parsed);
    } catch(e) {
      setAiLocsError("Could not load recommendations. Check your API key or try again.");
    }
    setAiLocsLoading(false);
  };

  const { monthlySave, targetCorpus, progress, monthsLeft } = calcFinancials(fin.income, fin.expenses, fin.savings, fin.targetYears);
  const tracks = TRANSITION_TRACKS[profile?.profession] || TRANSITION_TRACKS["Other Professional"];
  const yearsLeft = profile?.transitionAge && profile?.age ? parseInt(profile.transitionAge) - parseInt(profile.age) : 8;
  const careerSteps = buildCareerSteps(profile?.profession, profile?.postPath, yearsLeft);
  const dynamicPhases = buildTimelinePhases(profile?.postPath, profile?.stressDrivers, yearsLeft);

  const totalTasks = careerSteps.length * 4;
  const doneTasks = Object.values(careerChecks).filter(Boolean).length;
  const careerPct = Math.round((doneTasks / totalTasks) * 100);
  const REGION_MAP = {
    Asia: ["japan","china","india","thailand","malaysia","vietnam","indonesia","philippines","singapore","south korea","korea","taiwan","cambodia","myanmar","laos","nepal","sri lanka","bangladesh","pakistan","hong kong","macao","mongolia","kyrgyzstan","uzbekistan","kazakhstan","georgia","armenia","azerbaijan"],
    Europe: ["portugal","spain","france","germany","italy","greece","poland","czech","slovakia","hungary","austria","switzerland","belgium","netherlands","denmark","sweden","norway","finland","estonia","latvia","lithuania","romania","bulgaria","croatia","slovenia","serbia","albania","malta","cyprus","ireland","scotland","wales","england","uk","united kingdom"],
    Americas: ["mexico","colombia","brazil","argentina","chile","peru","ecuador","bolivia","uruguay","costa rica","panama","guatemala","belize","canada","united states","usa","cuba","dominican","puerto rico"],
    Africa: ["south africa","kenya","morocco","egypt","ethiopia","ghana","tanzania","rwanda","namibia","botswana","mauritius","tunisia","senegal","nigeria"],
    Oceania: ["australia","new zealand","fiji","papua","vanuatu"],
  };
  const sortedLocs = [...aiLocs].sort((a,b) => (b.overall||0) - (a.overall||0));
  const filteredLocs = locFilter==="All" ? sortedLocs : sortedLocs.filter(l => matchRegionUtil(l, locFilter, REGION_MAP));
  const topLoc = sortedLocs[0] || null;
  const compLocs = sortedLocs.filter(l=>selLoc.includes(l.name));
  const answered = DECISION_FILTERS.map((_,i)=>decAnswers[i]);
  const yesCount = answered.filter(a=>a==="Yes").length;
  const noCount = answered.filter(a=>a==="No").length;
  const answeredCount = answered.filter(Boolean).length;
  const decScore = answeredCount > 0 ? Math.round((yesCount / DECISION_FILTERS.length) * 100) : null;

  // ── "This week's focus" logic ─────────────────────────────────────────────
  const weakestDim = READINESS_DIMS.reduce((a,b) => latestReadiness[a.key] <= latestReadiness[b.key] ? a : b);
  const weeklyFocus = (() => {
    const items = [];
    if (readinessLog.length === 0) {
      items.push({ icon:"📋", text:"Log your first readiness check", tab:"stress", cta:"Open Readiness Check" });
    } else if (latestReadiness[weakestDim.key] < 6) {
      items.push({ icon:"⚠", text:`Weakest area: ${weakestDim.label} (${latestReadiness[weakestDim.key]}/10) — focus here first`, tab:"stress", cta:"Log this week" });
    }
    if (careerPct < 50) {
      const nextStep = careerSteps.find((s,si) => s.tasks.some((_,ti) => !careerChecks[`${si}-${ti}`]));
      const nextTask = nextStep ? nextStep.tasks.find((_,ti) => !careerChecks[`${careerSteps.indexOf(nextStep)}-${ti}`]) : null;
      items.push({ icon:"🧭", text: nextTask ? `Next career task: ${nextTask}` : "Continue your career roadmap", tab:"career", cta:"Open Roadmap" });
    }
    if (progress < 50) {
      items.push({ icon:"💰", text:`Financial corpus ${Math.round(progress)}% built — review your savings rate`, tab:"runway", cta:"Open Runway" });
    }
    if (!aiLocsSearched) {
      items.push({ icon:"🗺️", text:"Discover cities that match your lifestyle — location search pending", tab:"location", cta:"Find Cities" });
    }
    return items.slice(0, 3);
  })();

  if (!profile) return (<><link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Lato:wght@300;400;700&display=swap" rel="stylesheet"/><Onboarding onComplete={onboard} T={T}/></>);

  const phaseColors = [T.accent, T.amber, T.inkMid, T.ink];

  return (
    <div style={{ height:"100vh", background:T.bg, fontFamily:"'Lato',sans-serif", color:T.ink, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Lato:wght@300;400;700&display=swap" rel="stylesheet"/>
      <style>{`.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0} *{box-sizing:border-box} input[type=range]{accent-color:${T.accent}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .fade{animation:fadeUp 0.35s ease forwards} @keyframes dot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}} button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid ${T.accent}!important;outline-offset:2px!important} .si-input:focus{border-color:${T.accent}!important;box-shadow:0 0 0 3px ${T.accent}33!important} .tab-bar::-webkit-scrollbar{height:3px} .tab-bar::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px} @media(max-width:900px){.g4{grid-template-columns:1fr 1fr!important}.g3{grid-template-columns:1fr 1fr!important}.g2-fin{grid-template-columns:1fr!important}.hdr-info{display:none!important}.hdr-actions{gap:8px!important}} @media(max-width:600px){.g4{grid-template-columns:1fr!important}.g3{grid-template-columns:1fr!important}.g2{grid-template-columns:1fr!important}.mob-stack{flex-direction:column!important}.mob-pad{padding:16px 14px!important}.landing-right{display:none!important}.landing-left{flex:unset!important;width:100%!important;padding:40px 24px!important}.landing-h1{font-size:34px!important}.tab-bar{gap:2px!important}.tab-bar button{padding:6px 10px!important;font-size:11px!important}}`}</style>

      {showThemes && <ThemePanel current={themeId} onSelect={id=>{setThemeId(id)}} onClose={()=>setShowThemes(false)} T={T}/>}
      {showSubModal && <SubscriptionModal user={user} onClose={()=>setShowSubModal(false)} googleBtnRef={googleBtnRef} T={T}/>}

      {/* Header */}
      <div style={{ background:T.bgCard, borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, zIndex:200, boxShadow:T.shadow }}>
        <div style={{ padding:"0 28px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:58 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:21, color:T.ink }}>SecondInni<span style={{ color:T.red, fontStyle:"italic" }}>_</span>gs</div>
              <div style={{ width:1, height:24, background:T.border }}/>
              <div className="hdr-info" style={{ fontSize:13, color:T.inkMid }}>{profile.name||"Your"} · {profile.profession} · Age {profile.age} → {profile.transitionAge}</div>
            </div>
            <div className="hdr-actions" style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ textAlign:"right" }}>
                <div style={sLabel}>Roadmap</div>
                <div style={{ fontSize:13, color:T.accent, fontWeight:700 }}>{careerPct}% done</div>
              </div>
              <div style={{ width:80, height:6, background:T.bgMuted, borderRadius:3, overflow:"hidden" }}>
                <div style={{ width:`${careerPct}%`, height:"100%", background:T.accent, borderRadius:3, transition:"width 0.6s" }}/>
              </div>
              {/* Theme button */}
              <button onClick={()=>setShowThemes(true)} style={{ background:T.bgMuted, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 14px", color:T.inkMid, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:"'Lato',sans-serif" }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:T.accent }}/>
                <div style={{ width:10, height:10, borderRadius:"50%", background:T.amber }}/>
                Theme
              </button>
              {/* User / login area */}
              {user ? (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {user.picture
                    ? <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" style={{ width:30, height:30, borderRadius:"50%", border:`2px solid ${T.accent}` }}/>
                    : <div style={{ width:30, height:30, borderRadius:"50%", background:T.accentLight, border:`2px solid ${T.accent}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:T.accent }}>{user.name?.[0]}</div>
                  }
                  <div style={{ lineHeight:1.3 }}>
                    <div style={{ fontSize:12, color:T.ink, fontWeight:700, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name?.split(" ")[0]}</div>
                    <button onClick={signOut} style={{ fontSize:10, color:T.inkLight, background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:"'Lato',sans-serif" }}>Sign out</button>
                  </div>
                  <button onClick={()=>setShowSubModal(true)} style={{ background:T.amberLight, border:`1px solid ${T.amber}44`, borderRadius:8, padding:"5px 12px", color:T.amber, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>★ Pro</button>
                </div>
              ) : (
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setShowSubModal(true)} style={{ background:T.bgMuted, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 14px", color:T.inkMid, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>Sign In</button>
                  <button onClick={()=>setShowSubModal(true)} style={{ background:T.accent, border:`1px solid ${T.accent}`, borderRadius:8, padding:"7px 14px", color:T.dark?"#111":"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>↑ Upgrade</button>
                </div>
              )}
              <button style={{ ...sBtn("ghost"), fontSize:11, padding:"6px 12px" }} onClick={()=>setShowResetConfirm(true)}>↺ Re-do</button>
            </div>
          </div>
          <div className="tab-bar" role="tablist" aria-label="Portal sections" style={{ display:"flex", gap:4, paddingBottom:10, overflowX:"auto" }}>
            {TABS.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} style={navBtn(tab===t.id)} onClick={()=>setTab(t.id)}><span aria-hidden="true" style={{ marginRight:5 }}>{t.icon}</span>{t.label}</button>)}
          </div>
        </div>
      </div>

      {/* Scrollable content wrapper */}
      <div ref={mainBodyRef} style={{ flex:1, overflowY:"auto" }} id="main-body">

      {/* ── AI Disclaimer Banner ── */}
      <div style={{ background:T.amberLight, borderBottom:`1px solid ${T.amber}22`, padding:"7px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span aria-hidden="true" style={{ fontSize:13 }}>🤖</span>
          <span style={{ fontSize:11, color:T.amber, fontWeight:700, flexShrink:0 }}>AI-generated content</span>
          <span style={{ fontSize:11, color:T.inkMid }}>· For personal planning only · Not financial, legal, or medical advice · Saved locally in your browser — never on our servers</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:"32px 28px" }} className="fade">

        {/* ── OVERVIEW ── */}
        {tab==="dashboard" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
              <div>
                <h1 style={{ ...sTitle, fontSize:30 }}>{profile.name?`Good to have you, ${profile.name}.`:"Your Life Design Overview"}</h1>
                <p style={{ fontSize:13, color:T.inkLight, marginTop:6 }}>Track your key metrics and milestones — all in one place.</p>
              </div>
              <button onClick={printProfile} style={{ ...sBtn("ghost"), display:"flex", alignItems:"center", gap:7, flexShrink:0, marginTop:4 }}>⬇ Download Summary</button>
            </div>
            <div className="g4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>

              {/* Years to Transition */}
              <div style={{ ...card, borderTop:`3px solid ${T.accent}` }}>
                <div style={sLabel}>Years to Transition</div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:T.accent, margin:"8px 0 4px" }}>{yearsLeft>0?`${yearsLeft}y`:"—"}</div>
                <div style={{ fontSize:12, color:T.inkLight }}>Target age {profile.transitionAge||"—"}</div>
              </div>

              {/* Financial Runway — always shows link to update */}
              <div style={{ ...card, borderTop:`3px solid ${T.amber}` }}>
                <div style={sLabel}>Financial Runway</div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:T.amber, margin:"8px 0 4px" }}>
                  {monthsLeft>600 ? "—" : `${Math.ceil(monthsLeft/12)}y ${monthsLeft%12}m`}
                </div>
                <div style={{ fontSize:12, color:T.inkLight, marginBottom:4 }}>
                  {Math.round(progress)}% of target corpus reached
                </div>
                <button onClick={()=>setTab("runway")} style={{ background:"none", border:"none", padding:0, color:T.amber, fontSize:11, fontWeight:700, cursor:"pointer", textDecoration:"underline", fontFamily:"'Lato',sans-serif" }}>
                  → Update in Financial Runway
                </button>
              </div>

              {/* Career Roadmap */}
              <div style={{ ...card, borderTop:`3px solid ${T.accent}` }}>
                <div style={sLabel}>Career Roadmap</div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:T.accent, margin:"8px 0 4px" }}>{doneTasks}/{totalTasks}</div>
                <div style={{ fontSize:12, color:T.inkLight, marginBottom:4 }}>{careerPct}% complete</div>
                <button onClick={()=>setTab("career")} style={{ background:"none", border:"none", padding:0, color:T.accent, fontSize:11, fontWeight:700, cursor:"pointer", textDecoration:"underline", fontFamily:"'Lato',sans-serif" }}>
                  → Open Career Roadmap
                </button>
              </div>

              {/* Top Location */}
              <div style={{ ...card, borderTop:`3px solid ${T.ink}` }}>
                <div style={sLabel}>Top Location</div>
                {topLoc ? (
                  <>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:T.ink, margin:"8px 0 2px" }}>{topLoc.name}</div>
                    <div style={{ fontSize:12, color:T.inkLight, marginBottom:4 }}>Score {topLoc.overall}/10 · {topLoc.region}</div>
                    <button onClick={()=>setTab("location")} style={{ background:"none", border:"none", padding:0, color:T.accent, fontSize:11, fontWeight:700, cursor:"pointer", textDecoration:"underline", fontFamily:"'Lato',sans-serif" }}>
                      → Open Location Finder
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:T.inkLight, margin:"8px 0 4px" }}>Not searched yet</div>
                    <button onClick={()=>setTab("location")} style={{ background:"none", border:"none", padding:0, color:T.accent, fontSize:11, fontWeight:700, cursor:"pointer", textDecoration:"underline", fontFamily:"'Lato',sans-serif" }}>
                      → Open Location Finder
                    </button>
                  </>
                )}
              </div>

            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
              <div style={card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink }}>Transition Readiness</div>
                  <button onClick={()=>setTab("stress")} style={{ background:"none", border:"none", padding:0, color:T.accent, fontSize:11, fontWeight:700, cursor:"pointer", textDecoration:"underline", fontFamily:"'Lato',sans-serif" }}>→ Log this week</button>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
                  <CircleScore value={parseFloat(overallReadiness)} color={T.accent} bg={T.bgMuted} size={90}/>
                  <div>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:13, color:T.ink }}>Overall Readiness</div>
                    <div style={{ fontSize:11, color:T.inkLight, marginTop:2 }}>Composite of 5 dimensions</div>
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", paddingTop:8, borderTop:`1px solid ${T.border}` }}>
                  {READINESS_DIMS.map(d=>(
                    <CircleScore key={d.key} value={latestReadiness[d.key]} color={T.accent} bg={T.bgMuted} size={62} label={d.label.split(" ")[0]}/>
                  ))}
                </div>
              </div>
              <div style={card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink }}>Your Profile</div>
                  <button onClick={()=>setShowEditProfile(true)} style={{ ...sBtn("ghost"), padding:"5px 12px", fontSize:11 }}>✎ Edit</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[
                    ["Profession",profile.profession||"—"],
                    ["Post-career",profile.postPath||"—"],
                    ["Climate",profile.climate||"—"],
                    ["Budget",profile.budget||"—"],
                    ["Dependents",profile.dependents||"—"],
                    ["Languages",profile.languages?.length>0?profile.languages.slice(0,3).join(", "):"—"],
                  ].map(([k,v])=>(
                    <div key={k} style={{ background:T.bgMuted, borderRadius:8, padding:"10px 12px" }}>
                      <div style={sLabel}>{k}</div>
                      <div style={{ fontSize:13, color:T.ink, fontWeight:600, marginTop:4 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {profile.priorities?.length>0 && <div style={{ marginTop:12, display:"flex", gap:6, flexWrap:"wrap" }}>{profile.priorities.map(p=><span key={p} style={sTag(T.accent)}>{p}</span>)}</div>}
              </div>
            </div>
            {/* This week's focus */}
            {weeklyFocus.length > 0 && (
              <div style={{ ...card, borderLeft:`4px solid ${T.amber}`, marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                  <span style={{ fontSize:16 }}>🎯</span>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink }}>This week's focus</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {weeklyFocus.map((f,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:T.bgMuted, borderRadius:10, padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <span style={{ fontSize:15 }}>{f.icon}</span>
                        <span style={{ fontSize:13, color:T.ink }}>{f.text}</span>
                      </div>
                      <button onClick={()=>setTab(f.tab)} style={{ ...sBtn("ghost"), padding:"5px 14px", fontSize:11, flexShrink:0, marginLeft:12 }}>{f.cta} →</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={card}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:16 }}>Recommended Transition Tracks — {profile.profession}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {tracks.map((t,i)=>(
                  <div key={i} style={{ background:T.bgMuted, borderRadius:12, padding:16, border:`1px solid ${T.border}`, borderTop:`2px solid ${[T.accent,T.amber,T.inkLight][i]}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:14, color:T.ink, lineHeight:1.4 }}>{t.title}</div>
                      <span style={{ ...sTag(T.accent), marginLeft:8, flexShrink:0 }}>{t.fit}/10</span>
                    </div>
                    <div style={{ fontSize:12, color:T.inkMid, lineHeight:1.6 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LOCATION ── */}
        {tab==="location" && (
          <div>
            <h2 style={sTitle}>⊕ AI-Powered Location Finder</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4, marginBottom:20 }}>
              Personalised city recommendations based on your climate, budget, and priorities. Select up to 3 to compare.
            </p>

            {/* Search / Re-search bar */}
            <div style={{ ...card, marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:16, color:T.ink, marginBottom:6 }}>
                  {aiLocsSearched ? "Showing recommendations for your profile" : "Ready to find your ideal city?"}
                </div>
                <div style={{ fontSize:12, color:T.inkLight, marginBottom:3 }}>
                  Climate: <strong style={{color:T.ink}}>{profile?.climate||"Any"}</strong> &nbsp;·&nbsp;
                  Budget: <strong style={{color:T.ink}}>{profile?.budget||"—"}</strong> &nbsp;·&nbsp;
                  Priorities: <strong style={{color:T.ink}}>{profile?.priorities?.join(", ")||"—"}</strong>
                </div>
                <div style={{ fontSize:12, color:T.inkLight, marginBottom:3 }}>
                  Languages: <strong style={{color:T.accent}}>{profile?.languages?.length>0 ? profile.languages.join(", ") : "Not specified — defaulting to English"}</strong>
                  {profile?.languages?.length>0 && <span style={{ marginLeft:6, fontSize:11, background:T.accentLight, border:`1px solid ${T.accent}33`, borderRadius:10, padding:"1px 7px", color:T.accent }}>✓ Filtering cities by language</span>}
                </div>
                {profile?.dependents && profile.dependents !== "None — just me" && (
                  <div style={{ fontSize:12, color:T.inkLight }}>
                    Family: <strong style={{color:T.ink}}>{profile.dependents}</strong>
                    {profile?.kidsSchooling && <span> &nbsp;·&nbsp; Schools: <strong style={{color:T.ink}}>{profile.kidsSchooling}</strong></span>}
                  </div>
                )}
              </div>
              <button
                style={{ ...sBtn(), display:"flex", alignItems:"center", gap:8, opacity:aiLocsLoading?0.6:1 }}
                onClick={fetchAiLocations}
                disabled={aiLocsLoading}
                aria-disabled={aiLocsLoading}
              >
                {aiLocsLoading
                  ? <><span style={{fontSize:16}}>⟳</span> Searching globally…</>
                  : aiLocsSearched
                    ? <><span style={{fontSize:14}}>↺</span> Refresh Recommendations</>
                    : <><span style={{fontSize:14}}>✦</span> Find My Cities</>
                }
              </button>
            </div>

            {/* Loading state */}
            {aiLocsLoading && (
              <div role="status" aria-live="polite" style={{ ...card, textAlign:"center", padding:60 }}>
                <div aria-hidden="true" style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:20 }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:10, height:10, borderRadius:"50%", background:T.accent, animation:`dot 1.4s ${i*0.2}s infinite` }}/>)}
                </div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:T.ink, marginBottom:8 }}>Searching the world for you…</div>
                <div style={{ fontSize:13, color:T.inkLight }}>Analysing cities across Asia, Europe, Americas, Africa & Oceania</div>
              </div>
            )}

            {/* Error state */}
            {aiLocsError && !aiLocsLoading && (
              <div role="alert" style={{ ...card, background:T.redLight, border:`1px solid ${T.red}44`, textAlign:"center", padding:32 }}>
                <div aria-hidden="true" style={{ fontSize:18, marginBottom:8 }}>⚠</div>
                <div style={{ color:T.red, fontSize:14 }}>{aiLocsError}</div>
              </div>
            )}

            {/* Empty / not searched yet */}
            {!aiLocsSearched && !aiLocsLoading && (
              <div style={{ ...card, textAlign:"center", padding:60 }}>
                <div style={{ fontSize:48, marginBottom:20 }}>🌍</div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:T.ink, marginBottom:12 }}>
                  Your personalised city shortlist awaits
                </div>
                <p style={{ fontSize:14, color:T.inkMid, maxWidth:420, margin:"0 auto 28px" }}>
                  Click "Find My Cities" and we'll search globally — considering your climate preference, budget tier, and what matters most to you.
                </p>
                <button style={sBtn()} onClick={fetchAiLocations}>✦ Find My Cities</button>
              </div>
            )}

            {/* Results grid */}
            {!aiLocsLoading && aiLocs.length > 0 && (
              <>
                {/* Region filters */}
                <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
                  {["All","Asia","Europe","Americas","Africa","Oceania"].map(f=>(
                    <button key={f} style={sChip(locFilter===f)} onClick={()=>setLocFilter(f)}>{f}</button>
                  ))}
                </div>
                <div style={{ ...cardSm, background:T.accentLight, border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>💡</span>
                  <div style={{ fontSize:13, color:T.inkMid }}>
                    <strong style={{ color:T.accent }}>How to compare: </strong>
                    Click any city card to select it — a coloured border means selected. Pick <strong style={{ color:T.ink }}>2 or 3 cities</strong> to unlock the side-by-side comparison panel below.
                    <span style={{ marginLeft:10, fontWeight:700, color:T.accent }}>{selLoc.length}/3 selected</span>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:28 }}>
                  {filteredLocs.map((loc)=>{
                    const sel=selLoc.includes(loc.name);
                    const isTop = topLoc && loc.name === topLoc.name && locFilter === "All";
                    return (
                      <div key={loc.name}
                        onClick={()=>setSelLoc(prev=>sel?prev.filter(x=>x!==loc.name):prev.length<3?[...prev,loc.name]:prev)}
                        style={{ ...cardSm, cursor:"pointer", border:`1.5px solid ${isTop?T.amber:sel?T.accent:T.border}`, background:sel?T.accentLight:isTop?T.amberLight:T.bgCard, transition:"all 0.18s", position:"relative" }}>
                        {isTop && (
                          <div style={{ position:"absolute", top:-11, left:14, background:T.amber, color:T.dark?"#111":"#fff", fontSize:10, fontWeight:700, padding:"2px 10px", borderRadius:20, letterSpacing:"0.06em" }}>
                            ★ TOP PICK
                          </div>
                        )}
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:16, color:T.ink }}>{loc.name}</div>
                            <div style={{ fontSize:11, color:T.inkLight, marginTop:2 }}>{loc.region}</div>
                            <a
                              href={`https://en.wikipedia.org/wiki/${encodeURIComponent(loc.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e=>e.stopPropagation()}
                              style={{ fontSize:10, color:T.accent, textDecoration:"none", fontWeight:600, marginTop:4, display:"inline-flex", alignItems:"center", gap:3, opacity:0.8 }}>
                              📖 Wikipedia
                            </a>
                          </div>
                          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:isTop?T.amber:sel?T.accent:T.inkMid }}>{loc.overall}</div>
                        </div>
                        {loc.whyYou && (
                          <div style={{ fontSize:11, color:T.accent, background:T.accentLight, border:`1px solid ${T.accent}33`, borderRadius:6, padding:"5px 8px", marginBottom:8, lineHeight:1.5 }}>
                            ✦ {loc.whyYou}
                          </div>
                        )}
                        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                          {loc.tags.map(t=><span key={t} style={{ ...sTag(sel?T.accent:T.inkLight), fontSize:10 }}>{t}</span>)}
                        </div>
                        <Bar value={loc.overall} color={sel?T.accent:T.inkLight} bg={T.bgMuted}/>
                      </div>
                    );
                  })}
                  {filteredLocs.length === 0 && (
                    <div style={{ gridColumn:"1/-1", textAlign:"center", padding:32, color:T.inkLight }}>No cities match this region filter. Try "All".</div>
                  )}
                </div>

                {/* Side-by-side comparison */}
                {compLocs.length>=2 && (
                  <div>
                    <h3 style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:T.ink, marginBottom:16 }}>Side-by-side Comparison</h3>
                    <div style={{ display:"grid", gridTemplateColumns:`repeat(${compLocs.length},1fr)`, gap:16, marginBottom:20 }}>
                      {compLocs.map(loc=>(
                        <div key={loc.name} style={card}>
                          <div style={{ textAlign:"center", marginBottom:12 }}>
                            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:T.ink }}>{loc.name}</div>
                            <div style={{ fontSize:11, color:T.inkLight }}>{loc.region}</div>
                            <a
                              href={`https://en.wikipedia.org/wiki/${encodeURIComponent(loc.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize:11, color:T.accent, textDecoration:"none", fontWeight:600, display:"inline-flex", alignItems:"center", gap:3, margin:"4px 0 2px" }}>
                              📖 Wikipedia
                            </a>
                            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:32, color:T.accent, margin:"8px 0 4px" }}>{loc.overall}<span style={{ fontSize:14 }}>/10</span></div>
                          </div>
                          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
                            <Radar data={[loc.healthcare,loc.academic,loc.cost,loc.calm,loc.crowd,loc.overall]} labels={["Health","Academic","Cost","Calm","Crowd","Score"]} color={T.accent} border={T.border}/>
                          </div>
                          {[["Healthcare",loc.healthcare],["Academic",loc.academic],["Cost-friendly",loc.cost],["Calm",loc.calm],["Low crowds",loc.crowd]].map(([k,v])=>(
                            <div key={k} style={{ marginBottom:8 }}><div style={{ fontSize:12, color:T.inkMid, marginBottom:3 }}>{k}</div><Bar value={v} color={T.accent} bg={T.bgMuted}/></div>
                          ))}
                          {loc.whyYou && <div style={{ marginTop:12, fontSize:12, color:T.accent, background:T.accentLight, borderRadius:8, padding:"8px 10px", lineHeight:1.6 }}>✦ {loc.whyYou}</div>}
                        </div>
                      ))}
                    </div>
                    <div style={card}>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:16 }}>Comparison Table</div>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                        <thead><tr style={{ borderBottom:`2px solid ${T.border}` }}>
                          <th style={{ textAlign:"left", padding:"8px 12px", color:T.inkLight, fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em" }}>Dimension</th>
                          {compLocs.map(l=><th key={l.name} style={{ textAlign:"center", padding:"8px 12px", fontFamily:"'DM Serif Display',serif", color:T.ink, fontWeight:400, fontSize:16 }}>{l.name}</th>)}
                        </tr></thead>
                        <tbody>
                          {[["Healthcare","healthcare"],["Academic Density","academic"],["Cost of Living","cost"],["Calm Factor","calm"],["Low Crowds","crowd"],["Overall Score","overall"]].map(([label,key])=>{
                            const best=Math.max(...compLocs.map(x=>x[key]));
                            return (<tr key={key} style={{ borderBottom:`1px solid ${T.border}` }}>
                              <td style={{ padding:"10px 12px", color:T.inkMid }}>{label}</td>
                              {compLocs.map(l=><td key={l.name} style={{ textAlign:"center", padding:"10px 12px", fontWeight:l[key]===best?700:400, color:l[key]===best?T.accent:T.inkMid }}>{l[key]}{l[key]===best?" ★":""}</td>)}
                            </tr>);
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

                {/* ── TIMELINE ── */}
        {tab==="timeline" && (
          <div>
            <h2 style={sTitle}>◎ Life Phase Timeline</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4, marginBottom:24 }}>A controlled, intentional path — built around your transition at age {profile.transitionAge||"your target"}.</p>
            <div className="g4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
              {dynamicPhases.map((p,i)=>(
                <div key={i} style={{ ...card, borderTop:`3px solid ${phaseColors[i]}` }}>
                  <div style={{ display:"inline-block", background:phaseColors[i]+"22", border:`1px solid ${phaseColors[i]+"55"}`, borderRadius:20, padding:"4px 12px", fontSize:11, color:phaseColors[i], fontWeight:700, marginBottom:10 }}>{p.label}</div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:16, color:T.ink, marginBottom:8 }}>{p.title}</div>
                  <div style={{ fontSize:12, color:T.inkMid, lineHeight:1.7 }}>{p.desc}</div>
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:19, color:T.ink, marginBottom:20 }}>Core Operating Principles</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                {buildPrinciples(profile).map(pr=>(
                  <div key={pr.title} style={{ background:T.bgMuted, borderRadius:10, padding:16, border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:20, color:T.accent, marginBottom:6 }}>{pr.icon}</div>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:14, color:T.ink, marginBottom:6 }}>{pr.title}</div>
                    <div style={{ fontSize:12, color:T.inkMid, lineHeight:1.6 }}>{pr.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FINANCIAL RUNWAY ── */}
        {tab==="runway" && (
          <div>
            <h2 style={sTitle}>◆ Financial Runway Calculator</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4, marginBottom:24 }}>The point where corporate has no psychological power over you.</p>
            <div className="g2-fin" style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:20 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={card}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:16 }}>Your Numbers</div>
                  {[["Monthly Income","income","₹"],["Monthly Expenses","expenses","₹"],["Current Savings","savings","₹"],["Target Runway (years)","targetYears",""]].map(([lbl,key,prefix])=>(
                    <div key={key} style={{ marginBottom:14 }}>
                      <label style={{ ...sLabel, display:"block", marginBottom:6 }}>{lbl}</label>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>{prefix&&<span style={{ color:T.inkMid, fontSize:14 }}>{prefix}</span>}<input type="number" style={sInput} value={fin[key]} onChange={e=>setFin({...fin,[key]:+e.target.value})} step={key==="targetYears"?1:10000}/></div>
                    </div>
                  ))}
                </div>
                <div style={{ ...cardSm, background:T.accentLight, border:`1px solid ${T.accent}33` }}>
                  <div style={sLabel}>Monthly savings rate</div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:28, color:monthlySave>0?T.accent:T.red }}>{monthlySave>0?"+":""}₹{Math.abs(monthlySave/1000).toFixed(0)}k</div>
                  <div style={{ fontSize:12, color:T.inkMid, marginTop:4 }}>{monthlySave>0?"Positive cash flow":"⚠ Expenses exceed income"}</div>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                  {[{ label:"Target Corpus", value:`₹${(targetCorpus/100000).toFixed(1)}L`, color:T.ink },{ label:"Current Progress", value:`${Math.round(progress)}%`, color:T.accent },{ label:"Time Remaining", value:monthsLeft>600?"Adjust rate":`${Math.ceil(monthsLeft/12)}y ${monthsLeft%12}m`, color:monthsLeft<120?T.accent:T.amber }].map(k=>(
                    <div key={k.label} style={{ ...cardSm, textAlign:"center" }}><div style={sLabel}>{k.label}</div><div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, color:k.color, margin:"8px 0" }}>{k.value}</div></div>
                  ))}
                </div>
                <div style={card}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:6 }}>Progress to Independence</div>
                  <div style={{ fontSize:12, color:T.inkLight, marginBottom:14 }}>₹{(fin.savings/100000).toFixed(1)}L saved of ₹{(targetCorpus/100000).toFixed(1)}L target</div>
                  <div style={{ height:14, background:T.bgMuted, borderRadius:7, overflow:"hidden", marginBottom:20 }}>
                    <div style={{ width:`${progress}%`, height:"100%", background:`linear-gradient(90deg,${T.accent},${T.amber})`, borderRadius:7, transition:"width 0.8s" }}/>
                  </div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, color:T.ink, marginBottom:12 }}>10-year projection</div>
                  <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:100 }}>
                    {Array.from({length:10},(_,i)=>{
                      const proj=fin.savings+monthlySave*(i+1)*12;
                      const pct=Math.min((proj/targetCorpus)*100,100);
                      return (<div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                        <div style={{ width:"100%", height:`${pct}px`, background:proj>=targetCorpus?T.accent:T.amber+"88", borderRadius:"3px 3px 0 0", minHeight:4 }} title={`Y${i+1}: ₹${(proj/100000).toFixed(1)}L`}/>
                        <div style={{ fontSize:9, color:T.inkLight }}>Y{i+1}</div>
                      </div>);
                    })}
                  </div>
                  <div style={{ marginTop:8, fontSize:11, color:T.inkLight }}><span style={{ color:T.accent }}>■</span> Target reached &nbsp;<span style={{ color:T.amber+"88" }}>■</span> In progress</div>
                </div>
              </div>
            </div>

            {/* Scenario B */}
            <div style={{ marginTop:24 }}>
              {!fin2 ? (
                <button onClick={()=>setFin2({...fin})} style={{ ...sBtn("ghost"), display:"flex", alignItems:"center", gap:8 }}>
                  + Add Scenario B — compare a different set of numbers
                </button>
              ) : (
                <div style={{ ...card, border:`2px solid ${T.amber}44` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.amber }}>Scenario B</div>
                    <button onClick={()=>setFin2(null)} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:7, padding:"4px 10px", color:T.inkMid, fontSize:11, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>Remove</button>
                  </div>
                  {(() => {
                    const { monthlySave:ms2, targetCorpus:tc2, progress:pr2, monthsLeft:ml2 } = calcFinancials(fin2.income, fin2.expenses, fin2.savings, fin2.targetYears);
                    return (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                        <div>
                          <div style={{ fontSize:13, color:T.inkMid, marginBottom:12 }}>Adjust numbers for Scenario B:</div>
                          {[["Monthly Income","income","₹"],["Monthly Expenses","expenses","₹"],["Current Savings","savings","₹"],["Target Runway (years)","targetYears",""]].map(([lbl,key,prefix])=>(
                            <div key={key} style={{ marginBottom:10 }}>
                              <label style={{ ...sLabel, display:"block", marginBottom:4 }}>{lbl}</label>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>{prefix&&<span style={{ color:T.inkMid, fontSize:14 }}>{prefix}</span>}<input type="number" style={sInput} value={fin2[key]} onChange={e=>setFin2({...fin2,[key]:+e.target.value})} step={key==="targetYears"?1:10000}/></div>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize:13, color:T.inkMid, marginBottom:12 }}>Side-by-side comparison:</div>
                          {[
                            ["Monthly Savings", `₹${(monthlySave/1000).toFixed(0)}k`, `₹${(ms2/1000).toFixed(0)}k`, ms2>monthlySave],
                            ["Target Corpus",   `₹${(targetCorpus/100000).toFixed(1)}L`, `₹${(tc2/100000).toFixed(1)}L`, tc2<targetCorpus],
                            ["Progress",        `${Math.round(progress)}%`, `${Math.round(pr2)}%`, pr2>progress],
                            ["Time to Goal",    monthsLeft>600?"—":`${Math.ceil(monthsLeft/12)}y ${monthsLeft%12}m`, ml2>600?"—":`${Math.ceil(ml2/12)}y ${ml2%12}m`, ml2<monthsLeft],
                          ].map(([label,a,b,bWins])=>(
                            <div key={label} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                              <div style={{ fontSize:12, color:T.inkLight }}>{label}</div>
                              <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{a}</div>
                              <div style={{ fontSize:13, fontWeight:700, color:bWins?T.accent:T.inkMid }}>{b}{bWins?" ✓":""}</div>
                            </div>
                          ))}
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, paddingTop:8 }}>
                            <div style={{ fontSize:11, color:T.inkLight }}/><div style={{ fontSize:11, color:T.inkLight }}>Scenario A</div><div style={{ fontSize:11, color:T.accent, fontWeight:700 }}>Scenario B</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CAREER ROADMAP ── */}
        {tab==="career" && (
          <div>
            <h2 style={sTitle}>◉ Career Transition Roadmap</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4 }}>{profile.profession} → {profile.postPath||"Your next chapter"} · {yearsLeft}-year runway</p>
            <div style={{ display:"flex", gap:16, alignItems:"center", margin:"20px 0" }}>
              <div style={{ height:10, flex:1, background:T.bgMuted, borderRadius:5, overflow:"hidden" }}><div style={{ width:`${careerPct}%`, height:"100%", background:`linear-gradient(90deg,${T.accent},${T.amber})`, borderRadius:5, transition:"width 0.6s" }}/></div>
              <div style={{ fontSize:14, color:T.accent, fontWeight:700 }}>{doneTasks}/{totalTasks} done</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:24 }}>
              {careerSteps.map((step,si)=>{
                const done=step.tasks.filter((_,ti)=>careerChecks[`${si}-${ti}`]).length;
                return (
                  <div key={si} style={{ ...card, borderLeft:`3px solid ${done===4?T.accent:T.border}` }}>
                    <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
                      <div style={{ minWidth:90, padding:"8px 12px", background:T.bgMuted, borderRadius:8, textAlign:"center" }}>
                        <div style={sLabel}>Phase</div>
                        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:12, color:T.ink, lineHeight:1.4, marginTop:4 }}>{step.phase}</div>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:T.ink }}>{step.title}</div>
                          <span style={{ ...sTag(done===4?T.accent:T.amber), fontSize:12 }}>{done}/4</span>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                          {step.tasks.map((task,ti)=>{
                            const key=`${si}-${ti}`, checked=!!careerChecks[key];
                            return (
                              <label key={ti} style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", padding:"10px 12px", borderRadius:8, background:checked?T.accentLight:T.bgMuted, border:`1.5px solid ${checked?T.accent+"55":T.border}`, transition:"all 0.15s" }}>
                                <input type="checkbox" checked={checked} onChange={()=>setCareerChecks(prev=>({...prev,[key]:!prev[key]}))} style={{ marginTop:2, accentColor:T.accent }}/>
                                <span style={{ fontSize:13, color:checked?T.accent:T.ink, lineHeight:1.5 }}>{task}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={card}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:19, color:T.ink, marginBottom:16 }}>Best-Fit Transition Tracks</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                {tracks.map((t,i)=>(
                  <div key={i} style={{ background:T.bgMuted, borderRadius:12, padding:18, border:`1px solid ${T.border}`, borderTop:`2px solid ${[T.accent,T.amber,T.inkLight][i]}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}><span style={{ fontSize:20 }}>{["🥇","🥈","🥉"][i]}</span><span style={sTag(T.accent)}>{t.fit}/10</span></div>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, color:T.ink, marginBottom:8 }}>{t.title}</div>
                    <div style={{ fontSize:12, color:T.inkMid, lineHeight:1.7 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── READINESS CHECK ── */}
        {tab==="stress" && (
          <div>
            <h2 style={sTitle}>◐ Transition Readiness Check</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4, marginBottom:24 }}>Track 5 key dimensions of your readiness each week. Scores rise as your plan takes shape and confidence grows.</p>
            <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:20 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={card}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:20 }}>Log This Week</div>
                  {READINESS_DIMS.map(d=>(
                    <div key={d.key} style={{ marginBottom:20 }}>
                      <label style={{ ...sLabel, display:"block", marginBottom:4 }}>{d.label}: {newReadiness[d.key]}/10</label>
                      <div style={{ fontSize:11, color:T.inkLight, marginBottom:6 }}>{d.q}</div>
                      <input type="range" min="1" max="10" value={newReadiness[d.key]} onChange={e=>setNewReadiness({...newReadiness,[d.key]:+e.target.value})} style={{ width:"100%" }}/>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:T.inkLight, marginTop:3 }}><span>Low</span><span>High</span></div>
                    </div>
                  ))}
                  <button style={{ ...sBtn(), width:"100%" }} onClick={()=>setReadinessLog([...readinessLog,{ week:`Wk ${readinessLog.length+1}`, ...newReadiness }])}>Save Entry</button>
                </div>
                <div style={card}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, color:T.ink, marginBottom:12 }}>Recent Entries</div>
                  {readinessLog.length === 0
                    ? <div style={{ fontSize:12, color:T.inkLight, textAlign:"center", padding:"16px 0" }}>No entries yet — log your first week above.</div>
                    : readinessLog.slice(-5).reverse().map((w,i)=>{
                        const avg = ((w.financial+w.direction+w.energy+w.family+w.progress)/5).toFixed(1);
                        return (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                            <span style={{ fontSize:13, color:T.inkMid }}>{w.week}</span>
                            <span style={{ fontSize:13, color:T.accent, fontWeight:700 }}>{avg}/10</span>
                          </div>
                        );
                      })
                  }
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {readinessLog.length === 0 && (
                  <div style={{ ...card, textAlign:"center", padding:48 }}>
                    <div style={{ fontSize:40, marginBottom:16 }}>◐</div>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:T.ink, marginBottom:10 }}>Log your first week</div>
                    <p style={{ fontSize:13, color:T.inkMid, maxWidth:320, margin:"0 auto" }}>Use the sliders on the left to rate each dimension and click <strong style={{color:T.ink}}>Save Entry</strong>. Your readiness chart and trend will appear here as you build up your log week by week.</p>
                  </div>
                )}
                {readinessLog.length > 0 && (<>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                  {[
                    { label:"Overall Readiness", value:`${overallReadiness}/10`, color:T.accent, sub:"Composite score" },
                    { label:"Strongest Area", value:READINESS_DIMS.reduce((a,b)=>latestReadiness[a.key]>=latestReadiness[b.key]?a:b).label, color:T.amber, sub:"Best dimension" },
                    { label:"Trend", value:readinessLog.length>1?((readinessLog[readinessLog.length-1].financial+readinessLog[readinessLog.length-1].direction+readinessLog[readinessLog.length-1].energy+readinessLog[readinessLog.length-1].family+readinessLog[readinessLog.length-1].progress)/5)>((readinessLog[readinessLog.length-2].financial+readinessLog[readinessLog.length-2].direction+readinessLog[readinessLog.length-2].energy+readinessLog[readinessLog.length-2].family+readinessLog[readinessLog.length-2].progress)/5)?"↑ Improving":"→ Stable":"→ Baseline", color:T.accent, sub:"Week over week" },
                  ].map(k=>(
                    <div key={k.label} style={{ ...card, textAlign:"center" }}>
                      <div style={sLabel}>{k.label}</div>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:k.label==="Strongest Area"?16:28, color:k.color, margin:"8px 0 4px" }}>{k.value}</div>
                      <div style={{ fontSize:11, color:T.inkLight }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  <div style={card}>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:8 }}>Latest Snapshot</div>
                    <div style={{ display:"flex", justifyContent:"center" }}>
                      <Radar data={READINESS_DIMS.map(d=>latestReadiness[d.key]||0)} labels={["Finance","Direction","Energy","Family","Progress"]} color={T.accent} border={T.border}/>
                    </div>
                  </div>
                  <div style={card}>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:20 }}>Dimension Breakdown</div>
                    <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-around", gap:16 }}>
                      {READINESS_DIMS.map(d=>(
                        <CircleScore key={d.key} value={latestReadiness[d.key]} color={T.accent} bg={T.bgMuted} size={82} label={d.label}/>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={card}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:20 }}>Readiness Trend</div>
                  <div style={{ display:"flex", gap:8, alignItems:"flex-end", height:120 }}>
                    {readinessLog.map((w,i)=>{
                      const avg = (w.financial+w.direction+w.energy+w.family+w.progress)/5;
                      return (
                        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                          <div style={{ width:"100%", height:`${(avg/10)*110}px`, background:avg>=7?T.accent:avg>=5?T.amber:T.red+"88", borderRadius:"4px 4px 0 0", transition:"height 0.4s", minHeight:4 }}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:6 }}>{readinessLog.map((w,i)=><div key={i} style={{ flex:1, textAlign:"center", fontSize:10, color:T.inkLight }}>{w.week}</div>)}</div>
                  <div style={{ display:"flex", gap:16, marginTop:12, fontSize:12 }}>
                    <span><span style={{ color:T.accent }}>■</span> Confident (≥7)</span>
                    <span><span style={{ color:T.amber }}>■</span> Building (5–7)</span>
                    <span><span style={{ color:T.red+"88" }}>■</span> Needs work (&lt;5)</span>
                  </div>
                </div>
                {(() => {
                  const insights = computeReadinessInsights(readinessLog);
                  if (!insights.length) return null;
                  return (
                    <div style={{ ...card, borderLeft:`3px solid ${T.amber}` }}>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, color:T.ink, marginBottom:12 }}>Trend Insights</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        {insights.map((ins,i) => (
                          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                            <span style={{ fontSize:16, flexShrink:0 }}>{ins.type==="drop"?"↘":ins.type==="rise"?"↗":"⚠"}</span>
                            <span style={{ fontSize:13, color:T.inkMid, lineHeight:1.6 }}>{ins.msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>)}
              </div>
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES ── */}
        {tab==="academic" && (
          <div>
            <h2 style={sTitle}>◳ Learning & Community Resources</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4, marginBottom:24 }}>Curated for <strong style={{ color:T.ink }}>{profile.postPath || "your chosen path"}</strong> — courses, communities, books, and channels worth exploring</p>
            {(() => {
              const res = RESOURCES[profile.postPath] || RESOURCES["Not sure yet"];
              const sections = [
                { label:"Courses", icon:"◎", items:res.courses.map(c=>({ text:`${c.title} (${c.platform})`, url:c.url })), color:T.accent },
                { label:"Communities & Networks", icon:"◉", items:res.communities.map(c=>({ text:c.name, url:c.url })), color:T.amber },
                { label:"Books", icon:"◈", items:res.books.map(b=>({ text:`${b.title} — ${b.author}`, url:b.url })), color:T.inkMid },
                { label:"Channels & Podcasts", icon:"◐", items:res.channels.map(c=>({ text:c.name, url:c.url })), color:T.accent },
              ];
              return (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16, marginBottom:24 }}>
                  {sections.map(sec=>(
                    <div key={sec.label} style={{ ...card, borderTop:`3px solid ${sec.color}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                        <span style={{ color:sec.color, fontSize:16 }}>{sec.icon}</span>
                        <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink }}>{sec.label}</span>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {sec.items.map((item,i)=>(
                          <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                            <span style={{ color:sec.color, fontWeight:700, fontSize:12, marginTop:2, flexShrink:0 }}>→</span>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:13, color:T.inkMid, lineHeight:1.5, textDecoration:"none", borderBottom:`1px dotted ${T.border}` }} onMouseEnter={e=>e.currentTarget.style.color=sec.color} onMouseLeave={e=>e.currentTarget.style.color=T.inkMid}>{item.text}</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={card}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:19, color:T.ink, marginBottom:20 }}>3-Step Outreach Strategy</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {buildOutreachStrategy(profile?.postPath).map(s2=>(
                  <div key={s2.step} style={{ background:T.bgMuted, borderRadius:12, padding:20, border:`1px solid ${T.border}` }}>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:36, color:T.border, marginBottom:8 }}>{s2.step}</div>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, color:T.ink, marginBottom:8 }}>{s2.title}</div>
                    <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.7 }}>{s2.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DECISION TOOL ── */}
        {tab==="decision" && (
          <div>
            <h2 style={sTitle}>⊗ Decision Framework Tool</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4, marginBottom:24 }}>Run any major decision through your 6 personal filters before committing.</p>
            <div style={{ ...card, marginBottom:20 }}>
              <label style={{ ...sLabel, display:"block", marginBottom:8 }}>Decision to evaluate</label>
              <input style={sInput} placeholder={`e.g. "Take a 2-year international role to accelerate savings"`} value={decInput.text} onChange={e=>setDecInput({text:e.target.value})}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:24 }}>
              {DECISION_FILTERS.map((d,i)=>(
                <div key={i} style={{ ...card, borderLeft:`3px solid ${decAnswers[i]==="Yes"?T.accent:decAnswers[i]==="No"?T.red:T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <span style={sTag(T.inkLight)}>{d.tag}</span>
                    <div style={{ display:"flex", gap:6 }}>
                      {["Yes","Maybe","No"].map(opt=>(
                        <button key={opt} aria-pressed={decAnswers[i]===opt} onClick={()=>setDecAnswers({...decAnswers,[i]:opt})} style={{ padding:"5px 14px", borderRadius:6, fontSize:12, cursor:"pointer", fontWeight:decAnswers[i]===opt?700:400, border:`1.5px solid ${decAnswers[i]===opt?(opt==="Yes"?T.accent:opt==="No"?T.red:T.amber):T.border}`, background:decAnswers[i]===opt?(opt==="Yes"?T.accentLight:opt==="No"?T.redLight:T.amberLight):"transparent", color:decAnswers[i]===opt?(opt==="Yes"?T.accent:opt==="No"?T.red:T.amber):T.inkLight, transition:"all 0.15s" }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize:14, color:T.ink, lineHeight:1.6 }}>{d.q}</div>
                </div>
              ))}
            </div>
            {answeredCount>=3 && decScore!==null && (
              <>
                <div style={{ ...card, borderTop:`3px solid ${decScore>=70?T.accent:decScore>=40?T.amber:T.red}`, marginBottom:16 }}>
                  <div style={{ display:"flex", gap:32, alignItems:"center" }}>
                    <div style={{ textAlign:"center", minWidth:120 }}>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:52, color:decScore>=70?T.accent:decScore>=40?T.amber:T.red }}>{decScore}%</div>
                      <div style={{ fontSize:14, fontWeight:700, color:decScore>=70?T.accent:decScore>=40?T.amber:T.red, letterSpacing:"0.08em", textTransform:"uppercase" }}>{decScore>=70?"Proceed":decScore>=40?"Reconsider":"Avoid"}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:8 }}>{decInput.text?`"${decInput.text.slice(0,60)}${decInput.text.length>60?"…":""}"`:"Your decision"}</div>
                      <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.8, marginBottom:14 }}>{yesCount} of 6 filters passed · {noCount} concerns raised.{decScore<70?" A decision that fails your core filters increases the volatility you're working to reduce.":" This aligns with your life design principles. Proceed with intention."}</div>
                      <button onClick={analyzeDecision} disabled={decAiLoading} style={{ ...sBtn("primary"), opacity:decAiLoading?0.6:1 }}>
                        {decAiLoading?"Analysing…":"◑ Get AI Analysis"}
                      </button>
                    </div>
                  </div>
                </div>
                {decAiAnalysis && (
                  <div style={{ ...card, borderLeft:`3px solid ${T.accent}`, background:T.accentLight }}>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:T.accent+"22", border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>◑</div>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, color:T.ink }}>AI Analysis</div>
                    </div>
                    <div style={{ fontSize:13, color:T.ink, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{decAiAnalysis}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── AI COACH ── */}
        {tab==="coach" && (
          <div>
            <h2 style={sTitle}>◑ AI Life Coach</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4, marginBottom:24 }}>One question at a time. Calm, strategic, personalised to your profile.</p>
            <div style={{ ...card, display:"flex", flexDirection:"column", height:580 }}>

              {/* Messages */}
              <div role="log" aria-live="polite" aria-label="Chat conversation" style={{ flex:1, overflowY:"auto", paddingBottom:12, paddingRight:4 }}>
                {chatMsgs.map((m,i)=>(
                  <div key={i} style={{ marginBottom:16, display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                    {m.role==="assistant" && (
                      <div style={{ width:32, height:32, borderRadius:"50%", background:T.accentLight, border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, marginRight:10, flexShrink:0, marginTop:4 }}>◑</div>
                    )}
                    <div style={{ maxWidth:"75%", padding:"12px 16px", borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px", background:m.role==="user"?T.accentLight:T.bgMuted, border:`1px solid ${m.role==="user"?T.accent+"44":T.border}`, fontSize:14, lineHeight:1.7, color:T.ink, whiteSpace:"pre-wrap" }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display:"flex", gap:6, padding:"8px 12px", alignItems:"center" }}>
                    <div aria-hidden="true" style={{ width:32, height:32, borderRadius:"50%", background:T.accentLight, border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, marginRight:10, flexShrink:0 }}>◑</div>
                    {[0,1,2].map(i=><div aria-hidden="true" key={i} style={{ width:7, height:7, borderRadius:"50%", background:T.accent, animation:`dot 1.4s ${i*0.2}s infinite` }}/>)}
                    <span className="sr-only" aria-live="assertive">AI is responding…</span>
                  </div>
                )}
                <div ref={chatRef}/>
              </div>

              {/* Suggested prompts — shown only when only the greeting is present */}
              {chatMsgs.length === 1 && !chatLoading && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:T.inkLight, marginBottom:8, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:700 }}>Suggested questions</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {[
                      "What should I do in the next 12 months?",
                      "How do I reduce my dependency on my current employer?",
                      "I'm scared of losing my identity after transition — help.",
                      "How do I know if I'm financially ready?",
                    ].map(q=>(
                      <button key={q} onClick={()=>setChatIn(q)} style={{ background:T.bgMuted, border:`1px solid ${T.border}`, borderRadius:20, padding:"6px 14px", fontSize:12, color:T.inkMid, cursor:"pointer", textAlign:"left" }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ height:1, background:T.border, margin:"12px 0" }}/>
              <div style={{ display:"flex", gap:10 }}>
                <input
                  aria-label="Message the AI coach"
                  value={chatIn}
                  onChange={e=>setChatIn(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendChat(); }}}
                  placeholder="Share your thoughts or ask a question…"
                  style={{ ...sInput, flex:1 }}
                  disabled={chatLoading}
                  aria-disabled={chatLoading}
                />
                <button style={{ ...sBtn(), opacity:chatLoading||!chatIn.trim()?0.5:1 }} onClick={sendChat} disabled={chatLoading||!chatIn.trim()} aria-disabled={chatLoading||!chatIn.trim()}>Send</button>
              </div>
            </div>
          </div>
        )}

      </div>  {/* end body */}

      {/* ── Footer ── */}
      <footer style={{ background:T.bgCard, borderTop:`3px solid ${T.accent}22`, marginTop:0 }}>
        {/* Main footer row */}
        <div style={{ padding:"18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, borderBottom:`1px solid ${T.border}` }}>
          {/* Brand */}
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, flexShrink:0 }}>
            SecondInni<span style={{ color:T.red, fontStyle:"italic" }}>_</span>gs
          </div>
          {/* Quick nav */}
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {[["Overview","dashboard"],["Locations","location"],["Runway","runway"],["Career","career"],["Timeline","timeline"],["Readiness","stress"],["Opportunities","academic"],["Decisions","decision"],["AI Coach","coach"]].map(([label,tabId])=>(
              <button key={tabId} onClick={()=>{ mainBodyRef.current?.scrollTo({top:0,behavior:"smooth"}); setTab(tabId); }}
                style={{ background:"none", border:"none", padding:"4px 10px", color:T.inkLight, fontSize:11, cursor:"pointer", fontFamily:"'Lato',sans-serif", borderRadius:6, transition:"color 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.color=T.accent}
                onMouseLeave={e=>e.currentTarget.style.color=T.inkLight}>
                {label}
              </button>
            ))}
          </div>
          {/* Copyright */}
          <div style={{ fontSize:11, color:T.inkLight, flexShrink:0 }}>© 2026 SecondInnigs</div>
        </div>
        {/* Disclaimer strip */}
        <div style={{ padding:"10px 28px", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:10, color:T.inkLight, lineHeight:1.6 }}>
            <strong style={{ color:T.inkMid }}>Disclaimer:</strong> AI-generated content is for personal planning only — not financial, legal, medical, or immigration advice. Verify important decisions with qualified professionals. Financial figures are illustrative. City data is AI-estimated and may not reflect current conditions. Your data is saved locally in your browser and never sent to our servers (AI coaching messages are processed via Anthropic's API and not retained). Powered by Claude (Anthropic). © 2026 SecondInnigs · <a href="https://secondinnigs.in" style={{ color:T.inkLight, textDecoration:"none" }}>secondinnigs.in</a>
          </span>
        </div>
      </footer>
      </div>{/* end scrollable wrapper */}

      {/* ── Scroll-to-top button ── */}
      {scrollVisible && (
        <button
          onClick={() => mainBodyRef.current?.scrollTo({ top:0, behavior:"smooth" })}
          aria-label="Scroll to top"
          style={{ position:"fixed", bottom:28, right:28, zIndex:500, width:44, height:44, borderRadius:"50%", background:T.accent, border:"none", color:T.dark?"#111":"#fff", fontSize:20, cursor:"pointer", boxShadow:`0 4px 16px ${T.accent}55`, display:"flex", alignItems:"center", justifyContent:"center", transition:"opacity 0.2s" }}
        >↑</button>
      )}

      {/* ── Edit Profile Modal ── */}
      {showEditProfile && (
        <div role="dialog" aria-modal="true" aria-label="Edit your profile" style={{ position:"fixed", inset:0, zIndex:3000, background:T.bg, overflowY:"auto" }}>
          <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Lato:wght@300;400;700&display=swap" rel="stylesheet"/>
          <Onboarding onComplete={updateProfile} T={T} isEditing={true} initialForm={profile} onCancelEdit={()=>setShowEditProfile(false)}/>
        </div>
      )}

      {/* ── Reset Confirmation Modal ── */}
      {showResetConfirm && (
      <div role="alertdialog" aria-modal="true" aria-label="Confirm reset" onKeyDown={e=>{ if(e.key==="Escape") setShowResetConfirm(false); }} style={{ position:"fixed", inset:0, zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)" }}>
        <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:20, padding:40, maxWidth:440, width:"90%", boxShadow:"0 24px 64px rgba(0,0,0,0.4)", textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:16 }}>⚠</div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, color:T.ink, marginBottom:12 }}>Start Over?</div>
          <p style={{ fontSize:14, color:T.inkMid, lineHeight:1.8, marginBottom:28 }}>
            This will reset <strong style={{color:T.ink}}>everything</strong> — your profile, location searches, financial inputs, stress logs, career progress, and chat history. You'll go back to the beginning.
          </p>
          <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
            <button
              style={{ ...sBtn("ghost"), padding:"12px 28px" }}
              onClick={()=>setShowResetConfirm(false)}>
              Cancel — Keep my data
            </button>
            <button
              style={{ background:T.red, border:`1.5px solid ${T.red}`, borderRadius:8, padding:"12px 28px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}
              onClick={resetAll}>
              Yes, reset everything
            </button>
          </div>
        </div>
      </div>
      )}

    </div>
  );
}
