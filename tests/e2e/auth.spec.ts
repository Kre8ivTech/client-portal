import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login')
    
    // Check for login page elements
    await expect(page).toHaveTitle(/KT-Portal|Login/)
    await expect(page.getByText(/welcome back/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in|login|send magic link/i })).toBeVisible()
  })

  test('should display signup page', async ({ page }) => {
    await page.goto('/signup')
    
    // Check for signup page elements
    await expect(page.getByText(/request access|sign up|create account/i)).toBeVisible()
  })

  test('should show validation error for empty login form', async ({ page }) => {
    await page.goto('/login')
    
    // Try to submit without filling form
    await page.getByRole('button', { name: /sign in|login|send magic link/i }).click()
    
    // Should show validation errors or remain on page
    await expect(page).toHaveURL(/.*login/)
  })

  test('should navigate between login and signup', async ({ page }) => {
    await page.goto('/login')
    
    // Click signup link
    await page.getByRole('link', { name: /request access|sign up|create account/i }).click()
    await expect(page).toHaveURL(/.*signup/)
    
    // Navigate back to login
    await page.getByRole('link', { name: /back to login|sign in|login/i }).click()
    await expect(page).toHaveURL(/.*login/)
  })
})
