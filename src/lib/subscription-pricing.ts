export const FREE_PLAN_DAYS = 7

export function calculateDiscount(
  price: number,
  type: 'percent' | 'fixed',
  value: number,
) {
  const safePrice = Math.max(0, Number(price) || 0)
  const safeValue = Math.max(0, Number(value) || 0)
  const discount = type === 'percent' ? (safePrice * safeValue) / 100 : safeValue
  return Math.min(safePrice, Math.round(discount * 100) / 100)
}

export function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}