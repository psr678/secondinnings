// ── Pure utility functions (extracted for testability) ─────────────────────

/**
 * Escapes HTML special characters to prevent XSS when injecting
 * user-supplied strings into document.write() or innerHTML.
 */
export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Compute financial runway metrics from raw inputs.
 * All monetary values in the same unit (e.g. rupees/month).
 */
export function calcFinancials(income, expenses, savings, targetYears) {
  const monthlySave = income - expenses;
  const targetCorpus = expenses * 12 * targetYears;
  const progress = targetCorpus > 0 ? Math.min((savings / targetCorpus) * 100, 100) : 0;
  const monthsLeft = monthlySave > 0
    ? Math.ceil((targetCorpus - savings) / monthlySave)
    : 9999;
  return { monthlySave, targetCorpus, progress, monthsLeft };
}

/**
 * Validate a single onboarding step.
 * Returns an object of { fieldName: errorMessage } — empty means valid.
 */
export function validateStep(step, form) {
  const errs = {};
  if (step === 0) {
    if (!form.name) errs.name = "Your name is required.";
    if (!form.age) errs.age = "Current age is required.";
    else if (parseInt(form.age) < 18 || parseInt(form.age) > 125)
      errs.age = "Please enter a valid age between 18 and 125.";
    if (!form.transitionAge) errs.transitionAge = "Target transition age is required.";
    else if (parseInt(form.transitionAge) <= parseInt(form.age))
      errs.transitionAge = `Must be greater than your current age (${form.age}).`;
    if (!form.profession) errs.profession = "Please select your current profession.";
  }
  if (step === 1) {
    if (!form.stressDrivers || form.stressDrivers.length === 0)
      errs.stressDrivers = "Please select at least one stress driver — this helps personalise your plan.";
  }
  if (step === 2) {
    if (!form.postPath)
      errs.postPath = "Please select where you'd like to go after your transition.";
  }
  if (step === 3) {
    if (!form.climate) errs.climate = "Please select a climate preference.";
    if (!form.budget) errs.budget = "Please select a monthly budget range.";
    if (!form.priorities || form.priorities.length === 0)
      errs.priorities = "Please select at least one priority.";
  }
  if (step === 4) {
    if (!form.dependents) errs.dependents = "Please indicate your dependent situation.";
  }
  return errs;
}

/**
 * Returns true when a location's region string matches the given filter key.
 */
export function matchRegion(loc, filter, REGION_MAP) {
  const r = (loc.region || "").toLowerCase();
  const countries = REGION_MAP[filter] || [];
  return countries.some(c => r.includes(c));
}

/**
 * Build the AI Coach system prompt from the user's full profile + live progress data.
 * Extracted here so every field can be unit-tested independently of the React component.
 *
 * @param {object} profile         — the full profile object from onboarding
 * @param {object} readinessLatest — { financial, direction, energy, family, progress }
 * @param {string} overallReadiness
 * @param {object} weakestDim      — { label }
 * @param {object} liveData        — { fin, monthlySave, targetCorpus, progress, monthsLeft,
 *                                     doneTasks, totalTasks, careerPct, topLoc, readinessLogLen }
 */
export function buildCoachSystemPrompt(profile, readinessLatest, overallReadiness, weakestDim, liveData) {
  const { fin, monthlySave, targetCorpus, progress, monthsLeft,
          doneTasks, totalTasks, careerPct, topLoc, readinessLogLen } = liveData;
  const yearsAway = profile?.transitionAge && profile?.age
    ? parseInt(profile.transitionAge) - parseInt(profile.age) : "?";
  return `You are a calm, wise, and insightful life design coach specialising in career transitions and second innings planning.

User profile:
- Name: ${profile?.name || "not provided"}
- Age: ${profile?.age}
- Profession: ${profile?.profession}
- Target transition age: ${profile?.transitionAge} (${yearsAway} years away)
- Post-career path: ${profile?.postPath}
- Stress drivers: ${profile?.stressDrivers?.join(", ")}
- Top priorities: ${profile?.priorities?.join(", ")}
- Climate preference: ${profile?.climate || "not specified"}
- Monthly budget tier: ${profile?.budget || "not specified"}
- Languages comfortable in: ${profile?.languages?.join(", ") || "not specified"}
- Dependents: ${profile?.dependents || "not specified"}
- Children's schooling: ${profile?.kidsSchooling || "not applicable"}
- Children's ages: ${profile?.kidsAge || "not applicable"}
- Ageing parents: ${profile?.agingParents || "not specified"}
- Family notes: ${profile?.dependentNotes || "none"}
- Latest readiness scores (1–10): Financial clarity: ${readinessLatest.financial}, Career direction: ${readinessLatest.direction}, Energy & wellbeing: ${readinessLatest.energy}, Family alignment: ${readinessLatest.family}, Weekly progress: ${readinessLatest.progress}. Overall readiness: ${overallReadiness}/10. Weakest dimension: ${weakestDim.label}.

Live progress data:
- Financial: ₹${(fin.savings/100000).toFixed(1)}L saved, target ₹${(targetCorpus/100000).toFixed(1)}L (${Math.round(progress)}% built), monthly savings ₹${(monthlySave/1000).toFixed(0)}k, ${monthsLeft>600?"rate needs adjustment":`${Math.ceil(monthsLeft/12)}y ${monthsLeft%12}m to goal`}
- Career roadmap: ${doneTasks}/${totalTasks} tasks complete (${careerPct}%)
- Top location match: ${topLoc ? `${topLoc.name}, ${topLoc.region} (score ${topLoc.overall}/10)` : "not searched yet"}
- Readiness entries logged: ${readinessLogLen} week${readinessLogLen===1?"":"s"}

Guidelines:
- Ask ONE deep, thoughtful question at a time — never multiple questions
- Be warm, direct, and analytically sharp
- Avoid generic life-coach clichés
- When relevant, acknowledge family constraints — e.g. if children are in board years, factor that into timing advice
- If ageing parents are a factor, gently explore how they're being considered in the transition plan
- Reference the user's specific profile details when relevant
- Keep responses concise (3–5 sentences max unless elaboration is explicitly asked for)
- Help them think clearly, not just feel better`;
}

/**
 * Build the Decision Tool AI analysis prompt from the user's full profile + filter answers.
 * Extracted here so every field can be unit-tested independently of the React component.
 *
 * @param {object} profile       — full profile object
 * @param {string} decisionText  — the decision the user typed
 * @param {string} filterSummary — formatted string of all 6 filter answers
 * @param {number} progress      — financial progress % (0–100)
 */
export function buildDecisionPrompt(profile, decisionText, filterSummary, progress) {
  const yearsAway = profile?.transitionAge && profile?.age
    ? parseInt(profile.transitionAge) - parseInt(profile.age) : null;
  return `Evaluate this decision for ${profile?.name || "a professional"}, a ${profile?.profession || "professional"} planning to transition to ${profile?.postPath || "their next chapter"}${yearsAway ? ` in ${yearsAway} years` : ""}.

Decision: "${decisionText}"

Full profile context:
- Stress drivers they want to escape: ${profile?.stressDrivers?.join(", ") || "not specified"}
- Top lifestyle priorities: ${profile?.priorities?.join(", ") || "not specified"}
- Climate preference: ${profile?.climate || "not specified"}
- Monthly budget tier: ${profile?.budget || "not specified"}
- Languages comfortable in: ${profile?.languages?.join(", ") || "not specified"}
- Family situation: ${profile?.dependents || "not specified"}${profile?.kidsSchooling ? ` · Schooling: ${profile.kidsSchooling}` : ""}${profile?.kidsAge ? ` · Ages: ${profile.kidsAge}` : ""}${profile?.agingParents && profile.agingParents !== "Not applicable" ? ` · Ageing parents: ${profile.agingParents}` : ""}
- Family notes: ${profile?.dependentNotes || "none"}
- Financial progress: ${Math.round(progress)}% of target corpus built

Filter scores (Yes = passes, Maybe = partial, No = concern):
${filterSummary}

Provide:
1. A clear recommendation (1 sentence): Proceed / Reconsider / Avoid — and why
2. The strongest reason TO do it given their specific context (1 sentence)
3. The biggest risk given their family or financial situation (1 sentence)
4. One specific action to reduce the risk or validate before committing

Be direct, personal, and grounded in their actual situation. No generic life-coach filler.`;
}
