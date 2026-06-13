import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc('has_role', {
    _user_id: userId,
    _role: 'admin',
  })
  if (error) throw new Response(error.message, { status: 500 })
  if (!data) throw new Response('Forbidden: admin only', { status: 403 })
}

export const listAllUsers = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    if (error) throw new Response(error.message, { status: 500 })

    const ids = data.users.map((u) => u.id)
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, shop_name')
      .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

    return data.users.map((u) => {
      const p = profiles?.find((x) => x.id === u.id)
      const userRoles = (roles ?? [])
        .filter((r) => r.user_id === u.id)
        .map((r) => r.role as string)
      const bannedUntilRaw = (u as unknown as { banned_until?: string | null })
        .banned_until
      const banned = !!bannedUntilRaw && new Date(bannedUntilRaw) > new Date()
      return {
        id: u.id,
        email: u.email ?? '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        display_name: p?.display_name ?? null,
        shop_name: p?.shop_name ?? null,
        roles: userRoles,
        banned,
        banned_until: bannedUntilRaw ?? null,
        is_self: u.id === context.userId,
      }
    })
  })

export const setUserBan = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; ban: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    if (data.userId === context.userId)
      throw new Response('Cannot ban yourself', { status: 400 })
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.ban ? '876000h' : 'none',
    } as never)
    if (error) throw new Response(error.message, { status: 500 })
    return { ok: true }
  })

export const setUserActive = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    if (data.userId === context.userId)
      throw new Response('Cannot deactivate yourself', { status: 400 })
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    // Deactivate = 100-year ban; Activate = remove ban
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? 'none' : '876000h',
    } as never)
    if (error) throw new Response(error.message, { status: 500 })
    return { ok: true }
  })

export const deleteUserAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    if (data.userId === context.userId)
      throw new Response('Cannot delete yourself', { status: 400 })
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId)
    if (error) throw new Response(error.message, { status: 500 })
    return { ok: true }
  })

export const setUserRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: 'admin' | 'cashier'; grant: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: 'user_id,role' })
      if (error) throw new Response(error.message, { status: 500 })
    } else {
      if (data.userId === context.userId && data.role === 'admin')
        throw new Response('Cannot revoke your own admin role', { status: 400 })
      const { error } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', data.userId)
        .eq('role', data.role)
      if (error) throw new Response(error.message, { status: 500 })
    }
    return { ok: true }
  })

export const checkIsAdmin = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    })
    return { isAdmin: !!data }
  })