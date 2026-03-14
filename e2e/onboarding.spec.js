/**
 * E2E smoke test — onboarding → dashboard journey.
 *
 * Verifies that:
 *  1. The landing/pitch page loads
 *  2. All 6 onboarding steps can be completed with valid data
 *  3. The dashboard renders and displays the entered profile data
 *
 * AI calls are NOT made in this test (no real API key in CI).
 * Tabs that require AI (Location Finder, AI Coach) are not tested here.
 */

import { test, expect } from "@playwright/test";

// Test profile data
const PROFILE = {
  name: "Ravi Sharma",
  age: "47",
  transitionAge: "55",
};

test.describe("Onboarding → Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage so we always start fresh
    await page.goto("/");
    await page.evaluate(() => {
      ["si_profile", "si_user", "si_fin", "si_theme"].forEach((k) =>
        localStorage.removeItem(k)
      );
    });
    await page.reload();
  });

  test("landing page loads with a CTA button", async ({ page }) => {
    await expect(page).toHaveTitle(/SecondInni/i);
    // The pitch page has a "Begin" / "Start" / "Design" CTA
    const cta = page.getByRole("button", { name: /begin|start|design|get started/i }).first();
    await expect(cta).toBeVisible();
  });

  test("completes full onboarding and reaches dashboard", async ({ page }) => {
    // ── Start onboarding ─────────────────────────────────────────────────────
    const cta = page.getByRole("button", { name: /begin|start|design|get started/i }).first();
    await cta.click();

    // ── Step 0: Basic info ──────────────────────────────────────────────────
    await page.getByPlaceholder("What shall we call you?").fill(PROFILE.name);
    await page.getByPlaceholder("e.g. 47").fill(PROFILE.age);
    await page.getByPlaceholder("e.g. 55").fill(PROFILE.transitionAge);
    // Pick profession
    await page.getByRole("button", { name: "IT / Technology" }).click();
    await page.getByRole("button", { name: "Continue →" }).click();

    // ── Step 1: Stress drivers ──────────────────────────────────────────────
    await page.getByLabel("Heavy workload").check();
    await page.getByRole("button", { name: "Continue →" }).click();

    // ── Step 2: Post-career path ────────────────────────────────────────────
    await page.getByLabel("Freelance / Advisory roles").check();
    await page.getByRole("button", { name: "Continue →" }).click();

    // ── Step 3: Lifestyle preferences ──────────────────────────────────────
    await page.getByRole("button", { name: "Mild / Plateau (15–25°C)" }).click();
    await page.getByRole("button", { name: "₹40k–₹75k/month" }).click();
    // Pick one priority (they are buttons containing the priority text)
    await page.getByRole("button", { name: /Mental peace/i }).click();
    await page.getByRole("button", { name: "Continue →" }).click();

    // ── Step 4: Family / dependents ─────────────────────────────────────────
    await page.getByRole("button", { name: "None — just me" }).click();
    await page.getByRole("button", { name: "Continue →" }).click();

    // ── Step 5: Review & launch ─────────────────────────────────────────────
    // Verify summary shows entered name
    await expect(page.getByText(`Welcome, ${PROFILE.name}`)).toBeVisible();
    await page.getByRole("button", { name: "Open My Portal →" }).click();

    // ── Dashboard ────────────────────────────────────────────────────────────
    // Should now be on the dashboard — no longer in onboarding
    await expect(page.getByRole("button", { name: /Open My Portal/i })).not.toBeVisible();

    // The user's name should appear in the dashboard heading
    await expect(page.getByRole("heading", { name: new RegExp(PROFILE.name, "i") })).toBeVisible();

    // Navigation tabs should be visible (roles are "tab")
    await expect(page.getByRole("tab", { name: /Overview/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Financial Runway/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Career Roadmap/i })).toBeVisible();
  });

  test("step 0 shows validation errors when submitted empty", async ({ page }) => {
    const cta = page.getByRole("button", { name: /begin|start|design|get started/i }).first();
    await cta.click();

    // Click Continue without filling anything
    await page.getByRole("button", { name: "Continue →" }).click();

    // Validation errors should appear
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test("step 1 shows error when no stress driver selected", async ({ page }) => {
    const cta = page.getByRole("button", { name: /begin|start|design|get started/i }).first();
    await cta.click();

    // Complete step 0
    await page.getByPlaceholder("What shall we call you?").fill(PROFILE.name);
    await page.getByPlaceholder("e.g. 47").fill(PROFILE.age);
    await page.getByPlaceholder("e.g. 55").fill(PROFILE.transitionAge);
    await page.getByRole("button", { name: "IT / Technology" }).click();
    await page.getByRole("button", { name: "Continue →" }).click();

    // Skip selecting stress drivers and try to continue
    await page.getByRole("button", { name: "Continue →" }).click();
    await expect(page.getByText(/at least one stress driver/i)).toBeVisible();
  });

  test("profile data persists in localStorage after onboarding", async ({ page }) => {
    const cta = page.getByRole("button", { name: /begin|start|design|get started/i }).first();
    await cta.click();

    await page.getByPlaceholder("What shall we call you?").fill(PROFILE.name);
    await page.getByPlaceholder("e.g. 47").fill(PROFILE.age);
    await page.getByPlaceholder("e.g. 55").fill(PROFILE.transitionAge);
    await page.getByRole("button", { name: "IT / Technology" }).click();
    await page.getByRole("button", { name: "Continue →" }).click();

    await page.getByLabel("Heavy workload").check();
    await page.getByRole("button", { name: "Continue →" }).click();

    await page.getByLabel("Freelance / Advisory roles").check();
    await page.getByRole("button", { name: "Continue →" }).click();

    await page.getByRole("button", { name: "Mild / Plateau (15–25°C)" }).click();
    await page.getByRole("button", { name: "₹40k–₹75k/month" }).click();
    await page.getByRole("button", { name: /Mental peace/i }).click();
    await page.getByRole("button", { name: "Continue →" }).click();

    await page.getByRole("button", { name: "None — just me" }).click();
    await page.getByRole("button", { name: "Continue →" }).click();

    await page.getByRole("button", { name: "Open My Portal →" }).click();

    // Check localStorage was populated
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("si_profile");
      return raw ? JSON.parse(raw) : null;
    });

    expect(stored).not.toBeNull();
    expect(stored.name).toBe(PROFILE.name);
    expect(stored.age).toBe(PROFILE.age);
    expect(stored.profession).toBe("IT / Technology");
    expect(stored.climate).toBe("Mild / Plateau (15–25°C)");
    expect(stored.stressDrivers).toContain("Heavy workload");
  });
});
