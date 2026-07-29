import { supabaseAdmin } from '@/integrations/supabase/client.server'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'
const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

export function normalizePhone(raw: string) {
  const digits = (raw || '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  const only = digits.replace(/\D/g, '')
  if (only.length === 10) return `+91${only}`
  return `+${only}`
}

export async function hashCode(phone: string, code: string) {
  const data = new TextEncoder().encode(`${phone}:${code}:vistaarbill`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function sendSms(to: string, body: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY
  const FROM = process.env.TWILIO_FROM_NUMBER
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')
  if (!TWILIO_API_KEY) throw new Error('TWILIO_API_KEY is not configured')
  if (!FROM) throw new Error('TWILIO_FROM_NUMBER is not configured')

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TWILIO_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: FROM, Body: body }),
  })
  if (!res.ok) {
    const errorBody = await res.text()
    console.error(`Twilio send failed [${res.status}]: ${errorBody}`)
    throw new Error(`SMS bhejne me problem [${res.status}]: ${errorBody}`)
  }
  return (await res.json()) as { sid?: string }
}

export async function createAndSendOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone)
  if (!/^\+[1-9]\d{7,15}$/.test(phone)) throw new Error('Phone number sahi nahi hai')

  // simple rate limit: max 3 codes per phone per 10 minutes
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('phone_otps')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', since)
  if ((count ?? 0) >= 3) throw new Error('Bahut zyada attempts. 10 minute baad try karein.')

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const code_hash = await hashCode(phone, code)
  const expires_at = new Date(Date.now() + OTP_TTL_MS).toISOString()

  const { error } = await supabaseAdmin
    .from('phone_otps')
    .insert({ phone, code_hash, expires_at })
  if (error) throw new Error(error.message)

  await sendSms(phone, `${code} aapka VistaarBill verification code hai. 5 minute me expire ho jayega.`)
  return { phone }
}

export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone)
  const { data: row } = await supabaseAdmin
    .from('phone_otps')
    .select('*')
    .eq('phone', phone)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) throw new Error('Koi active OTP nahi mila. Dobara bhejein.')
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('OTP expire ho gaya. Dobara bhejein.')
  if (row.attempts >= MAX_ATTEMPTS) throw new Error('Bahut zyada galat attempts. Naya OTP bhejein.')

  const expected = await hashCode(phone, (code || '').trim())
  if (expected !== row.code_hash) {
    await supabaseAdmin
      .from('phone_otps')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
    throw new Error('OTP galat hai')
  }

  await supabaseAdmin.from('phone_otps').update({ verified: true }).eq('id', row.id)
  return { phone, verified: true }
}

export async function isPhoneVerified(rawPhone: string) {
  const phone = normalizePhone(rawPhone)
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data } = await supabaseAdmin
    .from('phone_otps')
    .select('id')
    .eq('phone', phone)
    .eq('verified', true)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()
  return !!data
}
