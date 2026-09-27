import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('renders the items screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /items/i })).toBeVisible()
  await expect(page.getByText('Sample item')).toBeVisible()
})

test('items screen has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Sample item')).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations).toEqual([])
})
