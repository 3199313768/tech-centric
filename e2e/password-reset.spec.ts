import { test, expect } from '@playwright/test'

test.describe('密码重置流程', () => {
  test('登录页提供忘记密码入口', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: '忘记密码' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  test('忘记密码页面公开可访问并校验完整邮箱', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: '忘记密码' })).toBeVisible()
    await page.getByRole('button', { name: '发送重置邮件' }).click()
    await expect(page.getByRole('alert')).toContainText('请输入完整邮箱地址')
  })

  test('没有恢复会话时显示可恢复的重置状态', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('重置链接无效或已过期')
    await expect(page.getByRole('link', { name: '重新发送重置邮件' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  test('无效认证回调返回忘记密码页面', async ({ page }) => {
    await page.goto('/auth/callback')
    await expect(page).toHaveURL(/\/forgot-password\?error=invalid-link/)
    await expect(page.getByRole('alert')).toContainText('重置链接无效或已过期')
  })
})
