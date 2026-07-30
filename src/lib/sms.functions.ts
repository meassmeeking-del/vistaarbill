import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { normalizePhone, sendSms } from './otp.server'

export const sendBillSms = createServerFn({ method: 'POST' })
  .inputValidator((data) =>
    z
      .object({
        phone: z.string().min(6),
        message: z.string().min(1).max(1200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const to = normalizePhone(data.phone)
    if (!/^\+[1-9]\d{7,15}$/.test(to)) throw new Error('Phone number sahi nahi hai')
    await sendSms(to, data.message)
    return { ok: true, phone: to }
  })
