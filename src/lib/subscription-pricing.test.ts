import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateDiscount, FREE_PLAN_DAYS } from './subscription-pricing'

describe('subscription pricing rules', () => {
  it('the free plan lasts seven days', () => {
    assert.equal(FREE_PLAN_DAYS, 7)
  })

  it('a percentage coupon applies the requested percentage', () => {
    assert.equal(calculateDiscount(99, 'percent', 10), 9.9)
  })

  it('a fixed coupon never discounts more than the plan price', () => {
    assert.equal(calculateDiscount(99, 'fixed', 120), 99)
  })
})