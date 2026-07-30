import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createAndSendOtp,
  verifyOtp,
  isPhoneVerified,
  accountExists,
  otpLogin,
  otpResetPassword,
} from './otp.server'

export const sendPhoneOtp = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ phone: z.string().min(6).max(20) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const r = await createAndSendOtp(data.phone)
      return { ok: true as const, phone: r.phone }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'OTP bhejne me problem' }
    }
  })

export const confirmPhoneOtp = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().min(6).max(20), code: z.string().min(4).max(8) }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      await verifyOtp(data.phone, data.code)
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'OTP galat hai' }
    }
  })

export const checkPhoneVerified = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ phone: z.string().min(6).max(20) }).parse(data))
  .handler(async ({ data }) => ({ verified: await isPhoneVerified(data.phone) }))

export const checkAccountExists = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().max(255).optional(),
        phone: z.string().trim().max(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => accountExists(data.email, data.phone))

export const phoneOtpLogin = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().min(6).max(20), code: z.string().min(4).max(8) }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const r = await otpLogin(data.phone, data.code)
      return { ok: true as const, ...r }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Login nahi ho paya' }
    }
  })

export const phoneOtpResetPassword = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        phone: z.string().min(6).max(20),
        code: z.string().min(4).max(8),
        password: z.string().min(6).max(72),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      await otpResetPassword(data.phone, data.code, data.password)
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Password reset nahi hua' }
    }
  })
