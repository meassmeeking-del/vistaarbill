import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

type Plan = 'trial' | 'monthly'

export type PlanRow = {
  id: string
  name: string
  kind: string
  price: number
  days: number
  description: string | null
  badge: string | null
  is_combo: boolean
  active: boolean
  sort_order: number
}

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
  return !!data
}

const ADMIN_EMAILS = new Set(['rajpandey565758@gmail.com'])

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
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
    const admin = await isAdmin(supabase, userId)
    // Hardcoded admin email fallback — always bypass subscription gate
    const email = (context.claims as any)?.email as string | undefined
    const emailIsAdmin = !!email && ADMIN_EMAILS.has(email.toLowerCase())
    return {
      active: !!active || admin || emailIsAdmin,
      isAdmin: admin || emailIsAdmin,
      latest,
      activeRow,
      settings,
      plans: (plans ?? []) as PlanRow[],
    }
  })

export const adminListPlans = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    if (!(await isAdmin(supabase, userId))) throw new Error('Forbidden')
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as PlanRow[]
  })

export const savePlan = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string | null
    name: string
    kind: string
    price: number
    days: number
    description?: string | null
    badge?: string | null
    is_combo?: boolean
    active?: boolean
    sort_order?: number
  }) => {
    const name = String(input?.name || '').trim()
    if (!name) throw new Error('Plan ka naam daalein')
    const kinds = ['trial', 'monthly', 'yearly', 'combo']
    const kind = kinds.includes(input.kind) ? input.kind : 'monthly'
    const price = Number(input.price)
    const days = Number(input.days)
    if (!(price >= 0)) throw new Error('Price sahi nahi hai')
    if (!(days >= 1)) throw new Error('Days kam se kam 1 hone chahiye')
    return {
      id: input.id || null,
      name,
      kind,
      price,
      days,
      description: input.description?.trim() || null,
      badge: input.badge?.trim() || null,
      is_combo: !!input.is_combo || kind === 'combo',
      active: input.active ?? true,
      sort_order: Number(input.sort_order ?? 0),
    }
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    if (!(await isAdmin(supabase, userId))) throw new Error('Forbidden')
    const { id, ...fields } = data
    if (id) {
      const { error } = await supabase.from('subscription_plans').update(fields).eq('id', id)
      if (error) throw new Error(error.message)
      return { ok: true, id }
    }
    const { data: row, error } = await supabase
      .from('subscription_plans')
      .insert(fields)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { ok: true, id: row.id }
  })

export const deletePlan = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error('id required')
    return { id: input.id }
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    if (!(await isAdmin(supabase, userId))) throw new Error('Forbidden')
    const { error } = await supabase.from('subscription_plans').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const submitSubscriptionRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan_id?: string; plan?: Plan; utr: string; note?: string }) => {
    const utr = String(input?.utr || '').trim()
    if (utr.length < 4) throw new Error('UTR/Reference number bahut chhota hai')
    if (!input?.plan_id && input?.plan !== 'trial' && input?.plan !== 'monthly') {
      throw new Error('Plan choose karein')
    }
    return {
      plan_id: input.plan_id || null,
      plan: input.plan ?? null,
      utr,
      note: input.note?.trim() || null,
    }
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    let planRow: PlanRow | null = null
    if (data.plan_id) {
      const { data: p } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', data.plan_id)
        .maybeSingle()
      planRow = (p as PlanRow) ?? null
      if (!planRow) throw new Error('Plan nahi mila')
    }
    const isTrial = planRow ? planRow.kind === 'trial' : data.plan === 'trial'
    let amount: number
    let days: number
    if (planRow) {
      amount = Number(planRow.price)
      days = Number(planRow.days)
    } else {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('trial_price, monthly_price, trial_days, monthly_days')
        .eq('id', true)
        .maybeSingle()
      amount = isTrial ? Number(settings?.trial_price ?? 1) : Number(settings?.monthly_price ?? 99)
      days = isTrial ? Number(settings?.trial_days ?? 7) : Number(settings?.monthly_days ?? 30)
    }

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
    if (isTrial) {
      const { data: trialUsed } = await supabase
        .from('subscription_requests')
        .select('id')
        .eq('user_id', userId)
        .eq('plan', 'trial')
        .in('status', ['approved', 'pending'])
        .limit(1)
      if (trialUsed && trialUsed.length) {
        throw new Error('Trial pehle hi le chuke hain — paid plan chunein')
      }
    }

    const { data: row, error } = await supabase
      .from('subscription_requests')
      .insert({
        user_id: userId,
        plan: isTrial ? 'trial' : 'monthly',
        plan_id: planRow?.id ?? null,
        plan_label: planRow?.name ?? (isTrial ? 'Trial' : 'Monthly'),
        days,
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
    let days = Number((row as any).days ?? 0)
    if (!days) {
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('trial_days, monthly_days')
        .eq('id', true)
        .maybeSingle()
      days =
        row.plan === 'trial'
          ? Number(settings?.trial_days ?? 7)
          : Number(settings?.monthly_days ?? 30)
    }
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
    trial_qr_image_url?: string | null
    subscription_qr_image_url?: string | null
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
        ...(data.trial_qr_image_url !== undefined ? { trial_qr_image_url: data.trial_qr_image_url } : {}),
        ...(data.subscription_qr_image_url !== undefined ? { subscription_qr_image_url: data.subscription_qr_image_url } : {}),
        ...(data.trial_price !== undefined ? { trial_price: data.trial_price } : {}),
        ...(data.monthly_price !== undefined ? { monthly_price: data.monthly_price } : {}),
        ...(data.trial_days !== undefined ? { trial_days: data.trial_days } : {}),
        ...(data.monthly_days !== undefined ? { monthly_days: data.monthly_days } : {}),
      })
      .eq('id', true)
    if (error) throw new Error(error.message)
    return { ok: true }
  })