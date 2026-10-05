import { test, expect } from '@playwright/test'

// F02 — Items (features.md). The whole flow through the real app: router, RTK Query, the
// form and the MSW mock, which unit tests only cover one piece at a time.

test('adding an item shows it in the list and keeps the form open', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Sample item')).toBeVisible()

  await page.getByRole('button', { name: 'Add item' }).click()
  const name = page.getByLabel('Name')
  await name.fill('Milk')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: 'Milk' })).toBeVisible()
  await expect(name).toHaveValue('')
  await expect(name).toBeVisible()
})

test('a blank name shows a validation error and adds nothing', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Sample item')).toBeVisible()

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(1)
})
