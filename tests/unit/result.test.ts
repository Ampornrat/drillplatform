import { describe, it, expect } from 'vitest'
import { ok, fail, unwrap, mapResult } from '@/lib/result'

describe('result helpers', () => {
  it('ok() creates a successful result', () => {
    const r = ok({ id: '123' })
    expect(r.ok).toBe(true)
    expect(r.data).toEqual({ id: '123' })
  })

  it('fail() creates an error result', () => {
    const r = fail('not_found', 'ไม่พบข้อมูล')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('not_found')
    expect(r.message).toBe('ไม่พบข้อมูล')
  })

  it('unwrap() returns data on success', () => {
    const r = ok(42)
    expect(unwrap(r)).toBe(42)
  })

  it('unwrap() throws on failure', () => {
    const r = fail('forbidden', 'ไม่มีสิทธิ์')
    expect(() => unwrap(r)).toThrow('[forbidden] ไม่มีสิทธิ์')
  })

  it('mapResult() transforms data', () => {
    const r = ok(5)
    const doubled = mapResult(r, n => n * 2)
    expect(doubled.ok && doubled.data).toBe(10)
  })

  it('mapResult() passes through failure unchanged', () => {
    const r = fail('validation_error', 'bad input')
    const mapped = mapResult(r, (n: number) => n * 2)
    expect(mapped.ok).toBe(false)
    expect(!mapped.ok && mapped.code).toBe('validation_error')
  })
})
