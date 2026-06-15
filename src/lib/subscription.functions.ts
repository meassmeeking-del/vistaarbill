import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

type Plan = 'trial' | 'monthly'

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
  return !!data
}

export const getMySubscription = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const { data: active } = await supabase.rpc('has_active_subscription', {
      _user_id: userId,
    })
    const { data: latest } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: activeRow } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle()
    const admin = await isAdmin(supabase, userId)
    return {
      active: !!active || admin,
      isAdmin: admin,
      latest,
      activeRow,
      settings,
    }
  })

export const submitSubscriptionRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: Plan; utr: string; note?: string }) => {
    if (!input || (input.plan !== 'trial' && input.plan !== 'monthly')) {
      throw new Error('Invalid plan')
    }
    const utr = String(input.utr || '').trim()
    if (utr.length < 4) throw new Error('UTR/Reference number bahut chhota hai')
    return { plan: input.plan, utr, note: input.note?.trim() || null }
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    const { data: settings } = await supabase
      .from('app_settings')
      .select('trial_price, monthly_price')
      .eq('id', true)
      .maybeSingle()
    const amount =
      data.plan === 'trial'
        ? Number(settings?.trial_price ?? 1)
        : Number(settings?.monthly_price ?? 99)

    // Block duplicate pending
    const { data: existing } = await supabase
      .from('subscription_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(1)
    if (existing && existing.length) {
      throw new Error('Pehle se ek request pending hai — admin approval ka wait karein')
    }

    // Block second trial
    if (data.plan === 'trial') {
      const { data: trialUsed } = await supabase
        .from('subscription_requests')
        .select('id')
        .eq('user_id', userId)
        .eq('plan', 'trial')
        .in('status', ['approved', 'pending'])
        .limit(1)
      if (trialUsed && trialUsed.length) {
        throw new Error('Trial pehle hi le chuke hain — ₹99 monthly plan chunein')
      }
    }

    const { data: row, error } = await supabase
      .from('subscription_requests')
      .insert({
        user_id: userId,
        plan: data.plan,
        amount,
        utr: data.utr,
        note: data.note,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const listSubscriptionRequests = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: 'pending' | 'approved' | 'rejected' | 'all' }) => ({
    status: input?.status ?? 'pending',
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    if (!(await isAdmin(supabase, userId))) throw new Error('Forbidden')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    let q = supabaseAdmin
      .from('subscription_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data.status !== 'all') q = q.eq('status', data.status)
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)))
    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    const emailMap = new Map(
      (usersRes?.users ?? []).map((u) => [u.id, u.email ?? '']),
    )
    return (rows ?? []).map((r) => ({
      ...r,
      user_email: emailMap.get(r.user_id) ?? '',
      _ids: ids,
    }))
  })

export const decideSubscriptionRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string
    decision: 'approve' | 'reject'
    reason?: string
  }) => {
    if (!input?.id) throw new Error('id required')
    if (input.decision !== 'approve' && input.decision !== 'reject') {
      throw new Error('Invalid decision')
    }
    return input
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    if (!(await isAdmin(supabase, userId))) throw new Error('Forbidden')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('subscription_requests')
      .select('*')
      .eq('id', data.id)
      .single()
    if (fetchErr || !row) throw new Error('Request not found')

    if (data.decision === 'reject') {
      const { error } = await supabaseAdmin
        .from('subscription_requests')
        .update({
          status: 'rejected',
          reject_reason: data.reason || 'Rejected by admin',
        })
        .eq('id', data.id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }

    // Approve: compute expiry
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('trial_days, monthly_days')
      .eq('id', true)
      .maybeSingle()
    const days =
      row.plan === 'trial'
        ? Number(settings?.trial_days ?? 7)
        : Number(settings?.monthly_days ?? 30)
    const expires = new Date()
    expires.setDate(expires.getDate() + days)
    const { error } = await supabaseAdmin
      .from('subscription_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
      })
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const updateAppSettings = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    upi_id?: string | null
    qr_image_url?: string | null
    trial_price?: number
    monthly_price?: number
    trial_days?: number
    monthly_days?: number
  }) => input || {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    if (!(await isAdmin(supabase, userId))) throw new Error('Forbidden')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({
        updated_at: new Date().toISOString(),
        ...(data.upi_id !== undefined ? { upi_id: data.upi_id } : {}),
        ...(data.qr_image_url !== undefined ? { qr_image_url: data.qr_image_url } : {}),
        ...(data.trial_price !== undefined ? { trial_price: data.trial_price } : {}),
        ...(data.monthly_price !== undefined ? { monthly_price: data.monthly_price } : {}),
        ...(data.trial_days !== undefined ? { trial_days: data.trial_days } : {}),
        ...(data.monthly_days !== undefined ? { monthly_days: data.monthly_days } : {}),
      })
      .eq('id', true)
    if (error) throw new Error(error.message)
    return { ok: true }
  })