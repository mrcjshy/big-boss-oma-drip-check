import { describe, it, expect } from 'vitest'
import { GeminiQuotaError, isQuotaError } from '../src/geminiService'

describe('isQuotaError', () => {
  it('matches a tagged GeminiQuotaError', () => {
    expect(isQuotaError(new GeminiQuotaError())).toBe(true)
  })

  it('matches a generic Error mentioning HTTP 429', () => {
    expect(
      isQuotaError(new Error('Gemini API error: 429. quota exceeded')),
    ).toBe(true)
  })

  it('matches a generic Error mentioning "quota"', () => {
    expect(
      isQuotaError(new Error('You exceeded your current quota, check billing')),
    ).toBe(true)
  })

  it('matches a generic Error mentioning "rate limit"', () => {
    expect(isQuotaError(new Error('rate limit reached, try again'))).toBe(true)
  })

  it('matches a generic Error mentioning RESOURCE_EXHAUSTED', () => {
    expect(isQuotaError(new Error('upstream said RESOURCE_EXHAUSTED'))).toBe(true)
  })

  it('does not match unrelated errors', () => {
    expect(isQuotaError(new Error('Server error: 500'))).toBe(false)
    expect(isQuotaError(new Error('bad gateway 502'))).toBe(false)
    expect(isQuotaError(new Error('Walang JSON na binalik si Gemini'))).toBe(false)
  })

  it('does not match non-Error values', () => {
    expect(isQuotaError(null)).toBe(false)
    expect(isQuotaError(undefined)).toBe(false)
    expect(isQuotaError('429')).toBe(false)
    expect(isQuotaError({ message: 'quota' })).toBe(false)
  })

  it('GeminiQuotaError carries a default Taglish-friendly message', () => {
    const err = new GeminiQuotaError()
    expect(err.message).toMatch(/quota/i)
    expect(err.kind).toBe('quota')
    expect(err.name).toBe('GeminiQuotaError')
  })

  it('GeminiQuotaError preserves a custom message', () => {
    const err = new GeminiQuotaError('Custom quota note')
    expect(err.message).toBe('Custom quota note')
  })
})
