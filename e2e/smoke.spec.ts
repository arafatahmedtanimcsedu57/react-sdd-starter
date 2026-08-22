import { test, expect } from '@playwright/test'

test('renders the items screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /items/i })).toBeVisible()
  await expect(page.getByText('Sample item')).toBeVisible()
})
