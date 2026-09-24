import { test, expect } from '@playwright/test'

test('管理工作台保留固定侧栏导航', async ({ page }) => {
  await page.goto('/admin')

  const admin = page.locator('.sg-admin__sidebar')
  if ((await admin.count()) === 0) {
    await expect(page).toHaveURL(/\/login/)
    return
  }

  await expect(admin).toBeVisible()
  for (const label of ['仪表盘', '知识库', '资源管理', '技能管理', '系统设置']) {
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: '返回前台', exact: true })).toBeVisible()
})
