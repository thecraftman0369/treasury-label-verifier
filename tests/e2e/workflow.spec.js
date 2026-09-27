import { test, expect } from '@playwright/test'
test('application data survives navigation and language changes',async({page})=>{
  await page.goto('/')
  await page.getByLabel('Brand name').fill('Old Tom Distillery')
  await page.getByRole('button',{name:'Session dashboard'}).click()
  await expect(page.getByRole('heading',{name:'Session dashboard'})).toBeVisible()
  await page.getByRole('button',{name:'Verify labels'}).click()
  await expect(page.getByLabel('Brand name')).toHaveValue('Old Tom Distillery')
  await page.locator('select').selectOption('es')
  await expect(page.getByRole('button',{name:'Verificar etiquetas'})).toBeVisible()
})
