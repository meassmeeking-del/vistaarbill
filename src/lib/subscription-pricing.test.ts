import { describe, expect, test } from 'bun:test'
import { calculateDiscount, FREE_PLAN_DAYS } from './subscription-pricing'

describe('subscription pricing rules', () => {
  test('the free plan lasts seven days', () => {
    expect(FREE_PLAN_DAYS).toBe(7)
  })

  test('a percentage coupon applies the requested percentage', () => {
    expect(calculateDiscount(99, 'percent', 10)).toBe(9.9)
  })

  test('a fixed coupon never discounts more than the plan price', () => {
    expect(calculateDiscount(99, 'fixed', 120)).toBe(99)
  })
})