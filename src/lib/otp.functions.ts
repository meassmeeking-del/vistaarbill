import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createAndSendOtp, verifyOtp, isPhoneVerified } from './otp.server'

export const sendPhoneOtp = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ phone: z.string().min(6).max(20) }).parse(data))
  .handler(async ({ data }) => createAndSendOtp(data.phone))

export const confirmPhoneOtp = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().min(6).max(20), code: z.string().min(4).max(8) }).parse(data),
  )
  .handler(async ({ data }) => verifyOtp(data.phone, data.code))

export const checkPhoneVerified = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ phone: z.string().min(6).max(20) }).parse(data))
  .handler(async ({ data }) => ({ verified: await isPhoneVerified(data.phone) }))
