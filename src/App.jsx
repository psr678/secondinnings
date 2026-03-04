import React, { useState, useRef } from "react";

// ── Anthropic API ─────────────────────────────────────────────────────────────
const CLAUDE_API_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";

async function askClaude(messages, systemPrompt, maxTokens=1000) {
  if (!CLAUDE_API_KEY) throw new Error("API key not configured");
  const body = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages };
  if (systemPrompt) body.system = systemPrompt;   // only include system when non-empty
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map((b) => b.text || "").join("") || "…";
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
const GENERIC_PHASES = [
  { label:"Now – T-5", title:"Authority Accumulation", desc:"Build leverage, deepen expertise, reduce political exposure, accelerate financial runway." },
  { label:"T-5 – T-3", title:"Optionality Building", desc:"Make current role optional. Build external reputation. Warm your transition path." },
  { label:"T-3 – T", title:"Controlled Deceleration", desc:"Reduce intensity. Test your post-career path part-time. Prepare clean exit." },
  { label:"T onwards", title:"Selective Engagement", desc:"Work only on your terms. No targets. No politics. Full autonomy." },
];
const DECISION_FILTERS = [
  { q:"Does this increase my options / leverage?", tag:"Optionality" },
  { q:"Does this preserve my cognitive energy?", tag:"Energy" },
  { q:"Does this reduce my dependency on one employer?", tag:"Independence" },
  { q:"Will this still feel worth it at my transition age?", tag:"Future Self" },
  { q:"Does this reduce volatility in my life?", tag:"Stability" },
  { q:"Does this align with my post-career path?", tag:"Direction" },
];
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
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {grids.map((ring,ri)=><polygon key={ri} points={ring.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={border} strokeWidth="1"/>)}
      {axes.map((a,i)=><line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke={border} strokeWidth="1"/>)}
      <polygon points={poly} fill={color+"28"} stroke={color} strokeWidth="2"/>
      {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color}/>)}
      {lbls.map((l,i)=><text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill={color} fontFamily="'Lato',sans-serif" fontWeight="700">{l.l}</text>)}
    </svg>
  );
}

// ── Theme Switcher Panel ──────────────────────────────────────────────────────
function ThemePanel({ current, onSelect, onClose, T }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"flex-end" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.5)" }} />
      <div style={{ position:"relative", width:400, height:"100vh", background:T.bgCard, borderLeft:`1px solid ${T.border}`, overflowY:"auto", padding:24, boxShadow:"-8px 0 32px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:T.ink }}>Choose Theme</div>
            <div style={{ fontSize:12, color:T.inkLight, marginTop:3 }}>Changes apply instantly</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 12px", color:T.inkMid, cursor:"pointer", fontSize:13 }}>✕ Close</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {Object.entries(THEMES).map(([id, theme]) => {
            const active = current === id;
            return (
              <div key={id} onClick={() => onSelect(id)} style={{ cursor:"pointer", borderRadius:12, border:`2px solid ${active ? theme.accent : T.border}`, overflow:"hidden", transition:"all 0.2s", boxShadow: active ? `0 0 0 2px ${theme.accent}44` : "none" }}>
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
              </div>
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
    <div style={{ marginTop:6, padding:"8px 12px", background:T.redLight, border:`1px solid ${T.red}44`, borderRadius:7, fontSize:12, color:T.red, display:"flex", alignItems:"center", gap:6 }}>
      ⚠ {msg}
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({ onComplete, T }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name:"", age:"", transitionAge:"", profession:"",
    stressDrivers:[], postPath:"",
    climate:"", budget:"", priorities:[],
    languages:[],
    dependents:"", kidsAge:"", kidsSchooling:"",
    agingParents:"", dependentNotes:""
  });
  const [touched, setTouched] = useState({});
  const [triedNext, setTriedNext] = useState(false);

  const toggle = (field, val) => setForm(f=>({ ...f, [field]: f[field].includes(val) ? f[field].filter(x=>x!==val) : [...f[field], val] }));
  const yearsToTransition = form.transitionAge && form.age ? parseInt(form.transitionAge)-parseInt(form.age) : null;

  // Per-step validation rules
  const validate = (s) => {
    const errs = {};
    if (s === 0) {
      if (!form.age) errs.age = "Current age is required.";
      else if (parseInt(form.age) < 18 || parseInt(form.age) > 80) errs.age = "Please enter a valid age between 18 and 80.";
      if (!form.transitionAge) errs.transitionAge = "Target transition age is required.";
      else if (parseInt(form.transitionAge) <= parseInt(form.age)) errs.transitionAge = `Must be greater than your current age (${form.age}).`;
      else if (parseInt(form.transitionAge) - parseInt(form.age) < 1) errs.transitionAge = "You need at least 1 year of runway.";
      if (!form.profession) errs.profession = "Please select your current profession.";
    }
    if (s === 1) {
      if (form.stressDrivers.length === 0) errs.stressDrivers = "Please select at least one stress driver — this helps personalise your plan.";
    }
    if (s === 2) {
      if (!form.postPath) errs.postPath = "Please select where you'd like to go after your transition.";
    }
    if (s === 3) {
      if (!form.climate) errs.climate = "Please select a climate preference.";
      if (!form.budget) errs.budget = "Please select a monthly budget range.";
      if (form.priorities.length === 0) errs.priorities = "Please select at least one priority.";
    }
    if (s === 4) {
      if (!form.dependents) errs.dependents = "Please indicate your dependent situation.";
    }
    return errs;
  };

  const chip = (active, color=T.accent) => ({ background: active ? color+"22" : T.bgMuted, border:`1.5px solid ${active ? color : T.border}`, borderRadius:20, padding:"7px 15px", fontSize:12, color: active ? color : T.inkMid, cursor:"pointer", fontWeight: active ? 700 : 400, transition:"all 0.15s", fontFamily:"'Lato',sans-serif" });
  const btn = (variant="primary") => ({ background: variant==="primary" ? T.accent : variant==="amber" ? T.amber : "transparent", border:`1.5px solid ${variant==="primary" ? T.accent : variant==="amber" ? T.amber : T.border}`, borderRadius:8, padding:"10px 24px", color: variant==="ghost" ? T.inkMid : T.dark ? "#111" : "#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.18s" });
  const inputStyle = (fieldErr) => ({ background:T.bgMuted, border:`1.5px solid ${fieldErr ? T.red : T.border}`, borderRadius:8, padding:"10px 14px", color:T.ink, fontSize:14, width:"100%", fontFamily:"'Lato',sans-serif", outline:"none", boxSizing:"border-box" });

  const errs = validate(step);
  const canProceed = Object.keys(errs).length === 0;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", marginBottom:40 }}>
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:30, color:T.ink }}>SecondInnings</div>
        <div style={{ fontSize:11, color:T.inkLight, letterSpacing:"0.15em", textTransform:"uppercase", marginTop:5 }}>Design Your Next Chapter</div>
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
            <div style={{ background:T.bgMuted, borderRadius:10, padding:"14px 16px", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.75, marginBottom:10 }}>
                A personal life design portal for professionals planning a <strong style={{color:T.ink}}>career transition</strong>, a <strong style={{color:T.ink}}>second innings</strong>, or a thoughtful exit from the corporate world — at any stage.
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {["Financial Runway","Career Roadmap","Location Finder","Life Timeline","AI Coach","Decision Tool","Opportunities","Readiness Check"].map(f=>(
                  <span key={f} style={{ fontSize:11, background:T.accentLight, border:`1px solid ${T.accent}33`, borderRadius:20, padding:"3px 10px", color:T.accent, fontWeight:600 }}>{f}</span>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize:11, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, display:"block", marginBottom:6 }}>Your Name (optional)</label>
              <input style={inputStyle(false)} placeholder="What shall we call you?" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
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
      <div style={{ marginTop:16, fontSize:11, color:T.inkLight, letterSpacing:"0.08em" }}>Your data stays in this session only · No account required</div>
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
  const [readinessLog, setReadinessLog] = useState([{ week:"Wk 1",financial:5,direction:5,energy:7,family:7,progress:5 },{ week:"Wk 2",financial:6,direction:5,energy:7,family:7,progress:6 },{ week:"Wk 3",financial:6,direction:6,energy:6,family:8,progress:6 },{ week:"Wk 4",financial:7,direction:6,energy:8,family:8,progress:7 },{ week:"Wk 5",financial:7,direction:7,energy:8,family:8,progress:7 },{ week:"Wk 6",financial:8,direction:7,energy:8,family:9,progress:8 }]);
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const chatRef = useRef(null);

  const T = THEMES[themeId];

  const latestReadiness = readinessLog[readinessLog.length - 1] || { financial:0, direction:0, energy:0, family:0, progress:0 };
  const overallReadiness = ((latestReadiness.financial + latestReadiness.direction + latestReadiness.energy + latestReadiness.family + latestReadiness.progress) / 5).toFixed(1);

  // Style helpers (theme-aware)
  const card = { background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:16, padding:24, boxShadow:T.shadow };
  const cardSm = { background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:16, boxShadow:T.shadow };
  const sTitle = { fontFamily:"'DM Serif Display',serif", fontSize:22, color:T.ink, fontWeight:400, margin:0 };
  const sLabel = { fontSize:11, color:T.inkLight, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:700 };
  const sInput = { background:T.bgMuted, border:`1.5px solid ${T.border}`, borderRadius:8, padding:"10px 14px", color:T.ink, fontSize:14, width:"100%", fontFamily:"'Lato',sans-serif", outline:"none", boxSizing:"border-box" };
  const sBtn = (v="primary") => ({ background:v==="primary"?T.accent:v==="amber"?T.amber:"transparent", border:`1.5px solid ${v==="primary"?T.accent:v==="amber"?T.amber:T.border}`, borderRadius:8, padding:"10px 22px", color:v==="ghost"?T.inkMid:T.dark?"#111":"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif", transition:"all 0.18s" });
  const sChip = (active, color=T.accent) => ({ background:active?color+"22":T.bgMuted, border:`1.5px solid ${active?color:T.border}`, borderRadius:20, padding:"6px 14px", fontSize:12, color:active?color:T.inkMid, cursor:"pointer", fontWeight:active?700:400, transition:"all 0.15s" });
  const sTag = (color=T.accent) => ({ background:color+"18", border:`1px solid ${color+"44"}`, borderRadius:20, padding:"3px 10px", fontSize:11, color, fontWeight:600 });
  const navBtn = (active) => ({ background:active?T.accentLight:"transparent", border:`1.5px solid ${active?T.accent:"transparent"}`, borderRadius:8, padding:"8px 16px", color:active?T.accent:T.inkMid, fontSize:12, fontWeight:active?700:400, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Lato',sans-serif", transition:"all 0.15s" });

  const onboard = (form) => {
    setProfile(form);
    // AI locations will be fetched on demand in the location tab
    setSelLoc([]);
    const yearsLeft = form.transitionAge && form.age ? parseInt(form.transitionAge)-parseInt(form.age) : null;
    const familyCtx = form.dependents && form.dependents !== "None — just me"
      ? `I also see you're navigating this with ${form.dependents.toLowerCase()} — that's an important part of your plan.`
      : "";
    const greeting = `Welcome${form.name?`, ${form.name}`:""}. I'm your SecondInnings Life Coach.\n\nYou're ${form.age}, working in ${form.profession||"your field"}, aiming to transition around age ${form.transitionAge||"your target"}. That gives you ${yearsLeft||"several"} year${yearsLeft===1?"":"s"} of runway. ${familyCtx}\n\nLet me start with one question:\n\n${form.stressDrivers.length>0?`You flagged "${form.stressDrivers[0]}" as a key stress driver. If that pressure disappeared tomorrow — would you still want to transition, or is it partly what's pushing you?`:"If your work environment became ideal tomorrow — would you still want to transition, or is something specific driving the urge?"}`;
    setChatMsgs([{ role:"assistant", content:greeting }]);
  };

  const resetAll = () => {
    setProfile(null);
    setTab("dashboard");
    setFin({ income:150000, expenses:65000, savings:800000, targetYears:5 });
    setReadinessLog([{ week:"Wk 1",financial:5,direction:5,energy:7,family:7,progress:5 },{ week:"Wk 2",financial:6,direction:5,energy:7,family:7,progress:6 },{ week:"Wk 3",financial:6,direction:6,energy:6,family:8,progress:6 },{ week:"Wk 4",financial:7,direction:6,energy:8,family:8,progress:7 },{ week:"Wk 5",financial:7,direction:7,energy:8,family:8,progress:7 },{ week:"Wk 6",financial:8,direction:7,energy:8,family:9,progress:8 }]);
    setNewReadiness({ financial:6, direction:6, energy:7, family:7, progress:6 });
    setSelLoc([]); setLocFilter("All");
    setAiLocs([]); setAiLocsLoading(false); setAiLocsError(null); setAiLocsSearched(false);
    setCareerChecks({});
    setDecInput({ text:"" }); setDecAnswers({});
    setChatMsgs([]); setChatIn(""); setChatLoading(false);
    setShowResetConfirm(false);
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
- Latest readiness scores (1–10): Financial clarity: ${latestReadiness.financial}, Career direction: ${latestReadiness.direction}, Energy & wellbeing: ${latestReadiness.energy}, Family alignment: ${latestReadiness.family}, Weekly progress: ${latestReadiness.progress}. Overall readiness: ${overallReadiness}/10.

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

  const monthlySave = fin.income - fin.expenses;
  const targetCorpus = fin.expenses * 12 * fin.targetYears;
  const progress = Math.min((fin.savings / targetCorpus) * 100, 100);
  const monthsLeft = monthlySave > 0 ? Math.ceil((targetCorpus - fin.savings) / Math.max(monthlySave, 1)) : 9999;
  const tracks = TRANSITION_TRACKS[profile?.profession] || TRANSITION_TRACKS["Other Professional"];
  const yearsLeft = profile?.transitionAge && profile?.age ? parseInt(profile.transitionAge) - parseInt(profile.age) : 8;
  const careerSteps = [
    { phase:`Now – ${Math.max(1,yearsLeft-4)}y`, title:"Reposition & Rebrand", tasks:["Reframe professional identity externally","Start writing / speaking in your domain","Deliver 3–5 guest sessions or workshops","Build a signature topic or framework"] },
    { phase:`${Math.max(1,yearsLeft-4)}y – ${Math.max(2,yearsLeft-2)}y`, title:"Build Credibility", tasks:["Publish 2–3 thought papers or articles","Speak at a relevant conference","Join one advisory or board-level role","Develop a signature program or course"] },
    { phase:`${Math.max(2,yearsLeft-2)}y – ${Math.max(3,yearsLeft-1)}y`, title:"Formal Alignment", tasks:["Identify 3 target organisations / institutions","Submit a structured proposal or pilot","Explore contractual / flexible arrangements","Test income optionality (first small retainer)"] },
    { phase:`${Math.max(3,yearsLeft-1)}y – Transition`, title:"Pilot & Validate", tasks:["Run a part-time trial of new role","Validate lifestyle fit and energy levels","Adjust financial model based on new income","Prepare for full transition logistics"] },
  ];
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
  const matchRegion = (loc, filter) => {
    const r = (loc.region || "").toLowerCase();
    const countries = REGION_MAP[filter] || [];
    return countries.some(c => r.includes(c));
  };
  const sortedLocs = [...aiLocs].sort((a,b) => (b.overall||0) - (a.overall||0));
  const filteredLocs = locFilter==="All" ? sortedLocs : sortedLocs.filter(l => matchRegion(l, locFilter));
  const topLoc = sortedLocs[0] || null;
  const compLocs = sortedLocs.filter(l=>selLoc.includes(l.name));
  const answered = DECISION_FILTERS.map((_,i)=>decAnswers[i]);
  const yesCount = answered.filter(a=>a==="Yes").length;
  const noCount = answered.filter(a=>a==="No").length;
  const answeredCount = answered.filter(Boolean).length;
  const decScore = answeredCount > 0 ? Math.round((yesCount / DECISION_FILTERS.length) * 100) : null;

  if (!profile) return (<><link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Lato:wght@300;400;700&display=swap" rel="stylesheet"/><Onboarding onComplete={onboard} T={T}/></>);

  const phaseColors = [T.accent, T.amber, T.inkMid, T.ink];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'Lato',sans-serif", color:T.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Lato:wght@300;400;700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box} input[type=range]{accent-color:${T.accent}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .fade{animation:fadeUp 0.35s ease forwards} @keyframes dot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>

      {showThemes && <ThemePanel current={themeId} onSelect={id=>{setThemeId(id)}} onClose={()=>setShowThemes(false)} T={T}/>}

      {/* Header */}
      <div style={{ background:T.bgCard, borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, zIndex:200, boxShadow:T.shadow }}>
        <div style={{ maxWidth:1380, margin:"0 auto", padding:"0 28px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:58 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:21, color:T.ink }}>SecondInnings</div>
              <div style={{ width:1, height:24, background:T.border }}/>
              <div style={{ fontSize:13, color:T.inkMid }}>{profile.name||"Your"} · {profile.profession} · Age {profile.age} → {profile.transitionAge}</div>
            </div>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
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
              <button style={{ ...sBtn("ghost"), fontSize:11, padding:"6px 12px" }} onClick={()=>setShowResetConfirm(true)}>↺ Re-do Profile</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:4, paddingBottom:10, overflowX:"auto" }}>
            {TABS.map(t=><button key={t.id} style={navBtn(tab===t.id)} onClick={()=>setTab(t.id)}><span style={{ marginRight:5 }}>{t.icon}</span>{t.label}</button>)}
          </div>
        </div>
      </div>

      {/* ── AI Disclaimer Banner ── */}
      <div style={{ background:T.amberLight, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.amber}33`, padding:"9px 28px" }}>
        <div style={{ maxWidth:1380, margin:"0 auto", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:15 }}>🤖</span>
          <span style={{ fontSize:11, color:T.amber, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", flexShrink:0 }}>AI-Generated Content</span>
          <span style={{ fontSize:11, color:T.inkMid, lineHeight:1.6 }}>
            All recommendations, city scores, career paths, and coaching responses are generated by AI and are for <strong style={{color:T.ink}}>personal planning purposes only</strong>. They do not constitute financial, legal, medical, immigration, or investment advice. Consult qualified professionals before making major life decisions.
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth:1380, margin:"0 auto", padding:"32px 28px" }} className="fade">

        {/* ── OVERVIEW ── */}
        {tab==="dashboard" && (
          <div>
            <div style={{ marginBottom:28 }}>
              <h1 style={{ ...sTitle, fontSize:30 }}>{profile.name?`Good to have you, ${profile.name}.`:"Your Life Design Overview"}</h1>
              <p style={{ fontSize:13, color:T.inkLight, marginTop:6 }}>Everything you need to design a confident, peaceful transition — at a glance.</p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>

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
                <div style={{ textAlign:"center", marginBottom:12 }}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:34, color:T.accent }}>{overallReadiness}<span style={{ fontSize:13 }}>/10</span></div>
                  <div style={{ fontSize:11, color:T.inkLight }}>Overall readiness score</div>
                </div>
                {READINESS_DIMS.map(d=>(
                  <div key={d.key} style={{ marginBottom:6 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.inkMid, marginBottom:2 }}>
                      <span>{d.label}</span><span>{latestReadiness[d.key]}/10</span>
                    </div>
                    <Bar value={latestReadiness[d.key]} color={T.accent} bg={T.bgMuted}/>
                  </div>
                ))}
              </div>
              <div style={card}>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:16 }}>Your Profile</div>
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
              <div style={{ ...card, textAlign:"center", padding:60 }}>
                <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:20 }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:10, height:10, borderRadius:"50%", background:T.accent, animation:`dot 1.4s ${i*0.2}s infinite` }}/>)}
                </div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:T.ink, marginBottom:8 }}>Searching the world for you…</div>
                <div style={{ fontSize:13, color:T.inkLight }}>Analysing cities across Asia, Europe, Americas, Africa & Oceania</div>
              </div>
            )}

            {/* Error state */}
            {aiLocsError && !aiLocsLoading && (
              <div style={{ ...card, background:T.redLight, border:`1px solid ${T.red}44`, textAlign:"center", padding:32 }}>
                <div style={{ fontSize:18, marginBottom:8 }}>⚠</div>
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
                <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
                  {["All","Asia","Europe","Americas","Africa","Oceania"].map(f=>(
                    <button key={f} style={sChip(locFilter===f)} onClick={()=>setLocFilter(f)}>{f}</button>
                  ))}
                  <div style={{ marginLeft:"auto", fontSize:12, color:T.inkLight }}>{selLoc.length}/3 selected for comparison</div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:28 }}>
                  {filteredLocs.map((loc, idx)=>{
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
              {GENERIC_PHASES.map((p,i)=>(
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
                {[
                  { icon:"◆", title:"Contribute. Don't carry.", desc:"Give structured input. Detach from outcome ownership. Outcome belongs to the system — input quality belongs to you." },
                  { icon:"◈", title:"The Transition Age Test", desc:`Before any major decision: "Will this serve my future self at ${profile.transitionAge||"my target age"}?" If not — reduce investment.` },
                  { icon:"◎", title:"Build portable identity.", desc:"Writing, speaking, advising. Your reputation must outlive your employer." },
                  { icon:"◉", title:"Energy over income.", desc:"From mid-transition, cognitive energy is your scarcest asset. Protect it ruthlessly." },
                  { icon:"◐", title:"Criteria over arbitration.", desc:"Stop solving others' misalignments. Set frameworks. Let teams own decisions." },
                  { icon:"◑", title:"Exit from strength.", desc:"Don't escape — design. Leave when you choose, not when forced." },
                ].map(pr=>(
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
            <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:20 }}>
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
                  {readinessLog.slice(-5).reverse().map((w,i)=>{
                    const avg = ((w.financial+w.direction+w.energy+w.family+w.progress)/5).toFixed(1);
                    return (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                        <span style={{ fontSize:13, color:T.inkMid }}>{w.week}</span>
                        <span style={{ fontSize:13, color:T.accent, fontWeight:700 }}>{avg}/10</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
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
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:16 }}>Dimension Breakdown</div>
                    {READINESS_DIMS.map(d=>(
                      <div key={d.key} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:T.inkMid, marginBottom:3 }}><span>{d.label}</span><span>{latestReadiness[d.key]}/10</span></div>
                        <Bar value={latestReadiness[d.key]} color={T.accent} bg={T.bgMuted}/>
                      </div>
                    ))}
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
              </div>
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES ── */}
        {tab==="academic" && (
          <div>
            <h2 style={sTitle}>◳ Transition Opportunities</h2>
            <p style={{ fontSize:13, color:T.inkLight, marginTop:4, marginBottom:24 }}>Tailored to {profile.profession} professionals pursuing {profile.postPath||"their next chapter"}</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16, marginBottom:24 }}>
              {tracks.map((t,i)=>(
                <div key={i} style={{ ...card, borderLeft:`3px solid ${[T.accent,T.amber,T.inkLight][i]}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:T.ink }}>{t.title}</div>
                    <span style={sTag(T.accent)}>Fit {t.fit}/10</span>
                  </div>
                  <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.7, marginBottom:14 }}>{t.desc}</div>
                  <Bar value={t.fit} color={[T.accent,T.amber,T.inkLight][i]} bg={T.bgMuted} height={8}/>
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:19, color:T.ink, marginBottom:20 }}>3-Step Outreach Strategy</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {[{ step:"01",title:"Demonstrate First",desc:"Start with a free workshop or guest session. Don't pitch — let the quality of your thinking open the door." },{ step:"02",title:"Publish Your Thinking",desc:"Write one strong position paper in your domain. This elevates you above typical candidates immediately." },{ step:"03",title:"Propose a Module",desc:"Submit a structured 8–12 week course outline. Solving a real curriculum gap is more powerful than any CV." }].map(s2=>(
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
                        <button key={opt} onClick={()=>setDecAnswers({...decAnswers,[i]:opt})} style={{ padding:"5px 14px", borderRadius:6, fontSize:12, cursor:"pointer", fontWeight:decAnswers[i]===opt?700:400, border:`1.5px solid ${decAnswers[i]===opt?(opt==="Yes"?T.accent:opt==="No"?T.red:T.amber):T.border}`, background:decAnswers[i]===opt?(opt==="Yes"?T.accentLight:opt==="No"?T.redLight:T.amberLight):"transparent", color:decAnswers[i]===opt?(opt==="Yes"?T.accent:opt==="No"?T.red:T.amber):T.inkLight, transition:"all 0.15s" }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize:14, color:T.ink, lineHeight:1.6 }}>{d.q}</div>
                </div>
              ))}
            </div>
            {answeredCount>=3 && decScore!==null && (
              <div style={{ ...card, borderTop:`3px solid ${decScore>=70?T.accent:decScore>=40?T.amber:T.red}` }}>
                <div style={{ display:"flex", gap:32, alignItems:"center" }}>
                  <div style={{ textAlign:"center", minWidth:120 }}>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:52, color:decScore>=70?T.accent:decScore>=40?T.amber:T.red }}>{decScore}%</div>
                    <div style={{ fontSize:14, fontWeight:700, color:decScore>=70?T.accent:decScore>=40?T.amber:T.red, letterSpacing:"0.08em", textTransform:"uppercase" }}>{decScore>=70?"Proceed":decScore>=40?"Reconsider":"Avoid"}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:17, color:T.ink, marginBottom:8 }}>{decInput.text?`"${decInput.text.slice(0,60)}${decInput.text.length>60?"…":""}"`:"Your decision"}</div>
                    <div style={{ fontSize:13, color:T.inkMid, lineHeight:1.8 }}>{yesCount} of 6 filters passed · {noCount} concerns raised.{decScore<70?" A decision that fails your core filters increases the volatility you're working to reduce.":" This aligns with your life design principles. Proceed with intention."}</div>
                  </div>
                </div>
              </div>
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
              <div style={{ flex:1, overflowY:"auto", paddingBottom:12, paddingRight:4 }}>
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
                    <div style={{ width:32, height:32, borderRadius:"50%", background:T.accentLight, border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, marginRight:10, flexShrink:0 }}>◑</div>
                    {[0,1,2].map(i=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:T.accent, animation:`dot 1.4s ${i*0.2}s infinite` }}/>)}
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
                  value={chatIn}
                  onChange={e=>setChatIn(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendChat(); }}}
                  placeholder="Share your thoughts or ask a question…"
                  style={{ ...sInput, flex:1 }}
                  disabled={chatLoading}
                />
                <button style={{ ...sBtn(), opacity:chatLoading||!chatIn.trim()?0.5:1 }} onClick={sendChat} disabled={chatLoading||!chatIn.trim()}>Send</button>
              </div>
            </div>
          </div>
        )}

      </div>  {/* end body */}

      {/* ── Footer ── */}
      <footer style={{ background:T.bgCard, borderTop:`1px solid ${T.border}`, marginTop:0, padding:"36px 28px 28px" }}>
        <div style={{ maxWidth:1380, margin:"0 auto" }}>

          {/* Top row — brand + nav links */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:24, marginBottom:28 }}>
            <div style={{ maxWidth:340 }}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:T.ink, marginBottom:8 }}>SecondInnings</div>
              <div style={{ fontSize:12, color:T.inkMid, lineHeight:1.8 }}>
                A personal life design portal for professionals planning their career transition or second innings. Built to help you think clearly — not to think for you.
              </div>
            </div>
            <div style={{ display:"flex", gap:40, flexWrap:"wrap" }}>
              {[
                { label:"Portal Tabs", links:[["Overview","dashboard"],["Location Finder","location"],["Financial Runway","runway"],["Career Roadmap","career"],["AI Coach","coach"]] },
                { label:"Tools", links:[["Readiness Check","stress"],["Life Timeline","timeline"],["Opportunities","academic"],["Decision Tool","decision"]] },
              ].map(col=>(
                <div key={col.label}>
                  <div style={{ fontSize:11, color:T.inkLight, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>{col.label}</div>
                  {col.links.map(([label, tabId])=>(
                    <div key={label} style={{ marginBottom:6 }}>
                      <button onClick={()=>{ window.scrollTo({top:0,behavior:"smooth"}); setTimeout(()=>document.getElementById("main-body")?.scrollTo({top:0}),50); setTab(tabId); }} style={{ background:"none", border:"none", padding:0, color:T.inkMid, fontSize:12, cursor:"pointer", fontFamily:"'Lato',sans-serif", textAlign:"left" }}>
                        {label}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height:1, background:T.border, marginBottom:20 }}/>

          {/* Disclaimer block */}
          <div style={{ background:T.bgMuted, borderRadius:12, padding:"16px 20px", marginBottom:20, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.inkLight, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Important Disclaimers</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { icon:"🤖", title:"AI-Generated Content", text:"All recommendations, scores, city comparisons, career paths, and coaching conversations are produced by an AI language model (Claude by Anthropic). They reflect patterns in training data, not verified real-world facts. Treat all outputs as a starting point for your own research." },
                { icon:"💰", title:"Not Financial Advice", text:"The financial runway calculator, savings projections, and corpus estimates are illustrative tools only. They do not account for taxation, inflation variability, portfolio risk, or personal liabilities. Consult a SEBI-registered financial advisor or a certified financial planner before making investment or retirement decisions." },
                { icon:"🏥", title:"Not Medical or Mental Health Advice", text:"Stress scores, energy tracking, and coach responses are self-reported wellness tools. They are not diagnostic instruments. If you are experiencing serious mental health concerns, please consult a qualified mental health professional." },
                { icon:"⚖", title:"Not Legal or Immigration Advice", text:"City recommendations, visa mentions, and relocation suggestions are general and may be outdated. Immigration rules, tax treaties, and residency requirements vary and change frequently. Always verify with an immigration lawyer or official government sources before relocating." },
                { icon:"📊", title:"Data Accuracy", text:"City scores, quality-of-life ratings, and comparisons are AI-estimated and may not reflect current conditions. Cost of living, healthcare quality, and infrastructure can change. Independently verify all location data before making relocation decisions." },
                { icon:"🔒", title:"Your Data & Privacy", text:"All data you enter stays in your browser session only. Nothing is sent to any server or stored beyond your current visit. Closing the browser tab permanently deletes your session data. The AI Coach sends your messages to the Anthropic API to generate responses — please do not share sensitive personal information." },
                { icon:"(c)", title:"Intellectual Property", text:"SecondInnings is an independent tool. City names, country names, and geographic references are factual identifiers. All original content, UI design, and branding on this platform are copyright 2026 SecondInnings. AI-generated coaching responses and recommendations are produced dynamically and are not owned or endorsed by Anthropic." },
              ].map(d=>(
                <div key={d.icon} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <span style={{ fontSize:13, flexShrink:0, marginTop:1 }}>{d.icon}</span>
                  <div style={{ fontSize:11, color:T.inkMid, lineHeight:1.7 }}>
                    <strong style={{ color:T.ink }}>{d.title}: </strong>{d.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div style={{ fontSize:11, color:T.inkLight }}>
              © 2026 SecondInnings · secondinnings.in · All rights reserved
            </div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              {[
                "AI responses powered by Claude (Anthropic)",
                "Data stays in your browser only",
                "For planning purposes only — not professional advice",
              ].map(t=>(
                <span key={t} style={{ fontSize:10, color:T.inkLight, background:T.bgMuted, border:`1px solid ${T.border}`, borderRadius:20, padding:"3px 10px" }}>{t}</span>
              ))}
            </div>
          </div>

        </div>
      </footer>

      {/* ── Reset Confirmation Modal ── */}
      {showResetConfirm && (
      <div style={{ position:"fixed", inset:0, zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)" }}>
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
