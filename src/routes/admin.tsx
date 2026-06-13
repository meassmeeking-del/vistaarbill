import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listAllUsers,
  setUserBan,
  setUserActive,
  deleteUserAccount,
  setUserRole,
  checkIsAdmin,
} from '@/lib/admin.functions'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  ShieldCheck,
  Ban,
  CheckCircle2,
  Trash2,
  ArrowLeft,
  Search,
  Crown,
  Power,
  Loader2,
} from 'lucide-react'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

function AdminPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [search, setSearch] = useState('')

  const list = useServerFn(listAllUsers)
  const checkAdmin = useServerFn(checkIsAdmin)
  const banFn = useServerFn(setUserBan)
  const activeFn = useServerFn(setUserActive)
  const deleteFn = useServerFn(deleteUserAccount)
  const roleFn = useServerFn(setUserRole)

  const qc = useQueryClient()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        navigate({ to: '/' })
        return
      }
      try {
        const res = await checkAdmin()
        if (cancelled) return
        if (!res.isAdmin) {
          toast.error('Admins only')
          navigate({ to: '/' })
          return
        }
        setAuthorized(true)
      } catch {
        navigate({ to: '/' })
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [checkAdmin, navigate])

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => list(),
    enabled: authorized,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-users'] })

  const mBan = useMutation({
    mutationFn: (v: { userId: string; ban: boolean }) => banFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.ban ? 'User banned' : 'User unbanned')
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const mActive = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.active ? 'User activated' : 'User deactivated')
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const mDelete = useMutation({
    mutationFn: (v: { userId: string }) => deleteFn({ data: v }),
    onSuccess: () => {
      toast.success('User deleted')
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const mRole = useMutation({
    mutationFn: (v: { userId: string; role: 'admin' | 'cashier'; grant: boolean }) =>
      roleFn({ data: v }),
    onSuccess: () => {
      toast.success('Role updated')
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!authorized) return null

  const filtered = (users.data ?? []).filter((u) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      u.email.toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q) ||
      (u.shop_name ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-background">
      <header
        className="text-primary-foreground shadow-lg"
        style={{ background: 'var(--gradient-primary)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm opacity-90 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Admin Panel
            </h1>
            <p className="text-xs opacity-80">Manage users — ban, activate, delete</p>
          </div>
          <Badge className="bg-white/20 text-white border-0">
            {users.data?.length ?? 0} users
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 bg-card border rounded-xl p-2 shadow-sm">
          <Search className="h-4 w-4 ml-2 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or shop…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0"
          />
          <Button variant="outline" size="sm" onClick={refresh} disabled={users.isFetching}>
            {users.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        {users.isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        )}
        {users.isError && (
          <div className="text-center py-12 text-destructive text-sm">
            {(users.error as Error)?.message ?? 'Failed to load users'}
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map((u) => {
            const isAdmin = u.roles.includes('admin')
            const busy =
              (mBan.isPending && mBan.variables?.userId === u.id) ||
              (mActive.isPending && mActive.variables?.userId === u.id) ||
              (mDelete.isPending && mDelete.variables?.userId === u.id) ||
              (mRole.isPending && mRole.variables?.userId === u.id)
            return (
              <div
                key={u.id}
                className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">
                      {u.display_name || u.email.split('@')[0]}
                    </span>
                    {u.is_self && (
                      <Badge variant="outline" className="text-[10px]">
                        You
                      </Badge>
                    )}
                    {isAdmin && (
                      <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px]">
                        <Crown className="h-3 w-3 mr-1" /> Admin
                      </Badge>
                    )}
                    {u.banned ? (
                      <Badge className="bg-red-100 text-red-800 border-0 text-[10px]">
                        Banned
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  {u.shop_name && (
                    <div className="text-xs text-muted-foreground truncate">
                      🏪 {u.shop_name}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Joined {new Date(u.created_at).toLocaleDateString()} ·{' '}
                    {u.last_sign_in_at
                      ? `Last login ${new Date(u.last_sign_in_at).toLocaleDateString()}`
                      : 'Never signed in'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {u.banned ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || u.is_self}
                      onClick={() => mBan.mutate({ userId: u.id, ban: false })}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Unban
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || u.is_self}
                      onClick={() => {
                        if (confirm(`Ban ${u.email}?`)) mBan.mutate({ userId: u.id, ban: true })
                      }}
                    >
                      <Ban className="h-4 w-4 mr-1" /> Ban
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || u.is_self}
                    onClick={() =>
                      mActive.mutate({ userId: u.id, active: u.banned })
                    }
                    title={u.banned ? 'Activate' : 'Deactivate'}
                  >
                    <Power className="h-4 w-4 mr-1" />
                    {u.banned ? 'Activate' : 'Deactivate'}
                  </Button>
                  <Button
                    size="sm"
                    variant={isAdmin ? 'secondary' : 'default'}
                    disabled={busy || (u.is_self && isAdmin)}
                    onClick={() =>
                      mRole.mutate({ userId: u.id, role: 'admin', grant: !isAdmin })
                    }
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    {isAdmin ? 'Revoke admin' : 'Make admin'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy || u.is_self}
                    onClick={() => {
                      if (confirm(`Permanently delete ${u.email}? This cannot be undone.`))
                        mDelete.mutate({ userId: u.id })
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
          {!users.isLoading && filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              No users found.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}