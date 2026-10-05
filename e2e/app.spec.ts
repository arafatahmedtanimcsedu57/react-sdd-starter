import { test, expect } from '@playwright/test'

// F01 — App-wide behaviour (features.md), checked in a real browser with a real URL.

test('an unknown URL shows "Page not found" with a way home', async ({ page }) => {
  await page.goto('/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  await page.getByRole('link', { name: 'Go to the home page' }).click()
  await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()
})
