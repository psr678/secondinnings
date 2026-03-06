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
