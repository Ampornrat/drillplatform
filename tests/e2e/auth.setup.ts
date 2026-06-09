/**
 * Playwright auth setup: signs in as commander and saves session storage.
 * Run automatically before main E2E tests via playwright.config.ts dependency.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.resolve('./tests/e2e/.auth/commander.json')

setup('authenticate as commander', async ({ page }) => {
  await page.goto('/login')

  // Fill login form
  await page.getByLabel(/email|อีเมล/i).fill(
    process.env.E2E_COMMANDER_EMAIL ?? 'commander@drill.test'
  )
  await page.getByLabel(/password|รหัสผ่าน/i).fill(
    process.env.E2E_PASSWORD ?? 'DrillTest2026!'
  )
  await page.getByRole('button', { name: /login|เข้าสู่ระบบ/i }).click()

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 })

  // Save auth state for reuse across tests
  await page.context().storageState({ path: AUTH_FILE })
})
