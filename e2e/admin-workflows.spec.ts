import { test, expect } from '@playwright/test'

test('admin workflow workbench creates and edits a graph', async ({ page }) => {
  await page.goto('/admin/workflows')
  await expect(page.getByRole('heading', { name: '流程工作台' })).toBeVisible()
  await page.getByRole('button', { name: '问题' }).click()
  await expect(page.locator('.sg-workflow-node')).toHaveCount(1)
  await expect(page.getByRole('status')).toContainText('已保存')
  await page.getByRole('button', { name: '预览' }).click()
  await expect(page.locator('.sg-workflow-canvas--readonly')).toBeVisible()
})

test('admin workflow player pauses at a human input and can cancel', async ({ page }) => {
  await page.goto('/admin/workflows')
  await expect(page.getByRole('heading', { name: '流程工作台' })).toBeVisible()
  await page.getByRole('button', { name: '新建空白流程' }).first().click()
  await page.getByRole('button', { name: '人工输入' }).click()
  await page.getByRole('button', { name: '运行' }).click()
  await page.getByRole('button', { name: '开始运行' }).click()
  await expect(page.getByRole('textbox', { name: '人工输入' })).toBeVisible()
  await page.getByRole('textbox', { name: '人工输入' }).fill('需要确认')
  await page.getByRole('button', { name: '提交输入' }).click()
  await expect(page.getByRole('button', { name: '取消运行' })).toBeVisible()
  await page.getByRole('button', { name: '取消运行' }).click()
  await expect(page.getByText('已取消')).toBeVisible()
})
