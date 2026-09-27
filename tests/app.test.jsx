import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
vi.mock('../src/ocr.js',()=>({recognizeLabel:vi.fn()}))
afterEach(()=>{cleanup();localStorage.clear()})
it('renders the primary workflow and preserves entered application data',async()=>{
  const { App } = await import('../src/main.jsx')
  render(<App />)
  expect(screen.getByRole('heading',{name:/compare application data/i})).toBeInTheDocument()
  const brand=screen.getByLabelText(/brand name/i); fireEvent.change(brand,{target:{value:'Old Tom'}})
  expect(brand).toHaveValue('Old Tom')
  expect(screen.getByRole('button',{name:/run verification/i})).toBeDisabled()
})
