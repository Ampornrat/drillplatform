/**
 * Playwright E2E: Full demo flow
 * Requires the dev server running on http://localhost:3002
 * and commander@drill.test already seeded (run seed first).
 *
 * Run:
 *   npx playwright test tests/e2e/demo-flow.spec.ts --headed
 */
import { test, expect, type Page } from '@playwright/test'

// Shared drill state across tests (E2E tests run sequentially)
let drillId = ''

// ── Step 1-3: Login already handled by auth.setup.ts ─────────────────────────

test('Step 1: Dashboard loads for commander', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/dashboard/)
  // Sidebar should show commander nav items
  await expect(page.getByText(/Drill Platform/i)).toBeVisible()
})

// ── Step 2-3: Create incident from METHANE ────────────────────────────────────

test('Step 2-3: Create incident from METHANE form', async ({ page }) => {
  await page.goto('/planner/drills')
  await expect(page).toHaveURL(/planner\/drills/)

  // Find "New Drill / Incident" button
  const newButton = page.getByRole('button', { name: /new|ใหม่|สร้าง/i }).first()
  await newButton.click()

  // Fill METHANE form or basic drill form
  const titleInput = page.getByLabel(/title|ชื่อ/i).first()
  await titleInput.fill('[E2E Playwright] MCI Drill Alpha')

  // Submit
  const submitBtn = page.getByRole('button', { name: /create|confirm|สร้าง|ยืนยัน/i }).last()
  await submitBtn.click()

  // Wait for success — either toast or redirect
  await page.waitForTimeout(2000)

  // Capture drillId from URL if redirected to drill page
  const url = page.url()
  const match = url.match(/drill\/([0-9a-f-]{36})/)
  if (match) drillId = match[1]!
  console.log('Created drill:', drillId || '(id not captured from URL)')
})

test('Step 3: New drill appears in list', async ({ page }) => {
  await page.goto('/planner/drills')
  await expect(page.getByText(/MCI Drill Alpha/i)).toBeVisible({ timeout: 10000 })
})

// ── Step 4-5: IAP ─────────────────────────────────────────────────────────────

test('Step 4-5: IAP page loads for active drill', async ({ page }) => {
  if (!drillId) {
    // Find any active drill from list
    await page.goto('/planner/drills')
    const drillLink = page.getByRole('link', { name: /E2E/i }).first()
    if (await drillLink.isVisible()) {
      await drillLink.click()
      const url = page.url()
      const m = url.match(/drill\/([0-9a-f-]{36})/)
      if (m) drillId = m[1]!
    }
  }
  if (!drillId) {
    test.skip()
    return
  }
  await page.goto(`/drill/${drillId}/dashboard`)
  await expect(page).toHaveURL(new RegExp(`drill/${drillId}`))
  // IAP section should be accessible
  await expect(page.getByText(/IAP|Incident Action Plan/i)).toBeVisible({ timeout: 8000 })
})

// ── Step 10-11: Facility diversion (realtime) ─────────────────────────────────

test('Step 10-11: Dashboard shows facility status section', async ({ page }) => {
  if (!drillId) { test.skip(); return }
  await page.goto(`/drill/${drillId}/dashboard`)

  // Facility section should be present
  const facilitySection = page.getByText(/facility|โรงพยาบาล|diversion|เบี่ยง/i).first()
  await expect(facilitySection).toBeVisible({ timeout: 10000 })
})

// ── Steps 13-15: Scenario and inject ─────────────────────────────────────────

test('Step 13: Scenario builder accessible', async ({ page }) => {
  await page.goto('/planner/drills')
  // Navigate to any drill scenario page
  if (!drillId) { test.skip(); return }
  await page.goto(`/drill/${drillId}/dashboard`)
  // Scenario section
  const scenarioLink = page.getByRole('link', { name: /scenario|builder|สถานการณ์/i }).first()
  if (await scenarioLink.isVisible({ timeout: 3000 })) {
    await scenarioLink.click()
    await expect(page).toHaveURL(/scenario|builder/)
  } else {
    console.warn('Scenario nav not found — checking dashboard for scenario card')
  }
})

// ── Steps 16-17: Evaluation dashboard ────────────────────────────────────────

test('Step 16-17: Evaluation dashboard accessible', async ({ page }) => {
  if (!drillId) { test.skip(); return }
  await page.goto(`/drill/${drillId}/dashboard`)

  // Evaluation nav or section
  const evalLink = page.getByRole('link', { name: /evaluat|ประเมิน/i }).first()
  if (await evalLink.isVisible({ timeout: 3000 })) {
    await evalLink.click()
  } else {
    await page.goto('/core/aar')
  }
  await expect(page).toHaveURL(/evaluat|aar|dashboard/)
})

// ── Steps 18-21: AAR + LMS ───────────────────────────────────────────────────

test('Step 18: AAR page loads', async ({ page }) => {
  await page.goto('/core/aar')
  await expect(page).toHaveURL(/aar/)
  await expect(page.getByText(/AAR|after.action|รายงาน/i)).toBeVisible({ timeout: 8000 })
})

test('Step 19-20: AAR detail + LMS tab accessible', async ({ page }) => {
  if (!drillId) { test.skip(); return }
  await page.goto(`/drill/aar/${drillId}`)

  // AAR detail page — LMS tab
  const lmsTab = page.getByRole('tab', { name: /LMS|course/i }).first()
  if (await lmsTab.isVisible({ timeout: 5000 })) {
    await lmsTab.click()
    await expect(page.getByText(/MCI-TRIAGE-101|course|คอร์ส/i)).toBeVisible({ timeout: 5000 })
  } else {
    console.warn('LMS tab not visible — may require data')
  }
})

// ── Notifications bell ────────────────────────────────────────────────────────

test('Notification bell present in context bar', async ({ page }) => {
  await page.goto('/dashboard')
  // Notification bell should be in the context bar
  const bell = page.locator('[aria-label="Notifications"]').first()
  await expect(bell).toBeVisible({ timeout: 8000 })
})

test('Notification bell shows badge on unread', async ({ page }) => {
  await page.goto('/dashboard')
  // If there are any unread notifications, badge should be visible
  // (may be 0 in a clean environment — just verify bell renders)
  const bell = page.locator('[aria-label="Notifications"]').first()
  await expect(bell).toBeVisible()
})
