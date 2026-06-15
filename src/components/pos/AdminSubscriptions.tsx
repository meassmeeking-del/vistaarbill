import { useCallback, useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  listSubscriptionRequests,
  decideSubscriptionRequest,
  updateAppSettings,
  getMySubscription,
} from '@/lib/subscription.functions'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  QrCode,
  Save,
} from 'lucide-react'

type Req = {
  id: string
  user_id: string
  user_email: string
  plan: string
  amount: number
  utr: string
  status: string
  reject_reason: string | null
  created_at: string
  expires_at: string | null
}

export function AdminSubscriptions() {
  const listFn = useServerFn(listSubscriptionRequests)
  const decideFn = useServerFn(decideSubscriptionRequest)
  const settingsFn = useServerFn(updateAppSettings)
  const subFn = useServerFn(getMySubscription)
  const [filter, setFilter] =
    useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [rows, setRows] = useState<Req[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [upiId, setUpiId] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [trialPrice, setTrialPrice] = useState(1)
  const [monthlyPrice, setMonthlyPrice] = useState(99)
  const [trialDays, setTrialDays] = useState(7)
  const [monthlyDays, setMonthlyDays] = useState(30)
  const [uploading, setUploading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = (await listFn({ data: { status: filter } })) as Req[]
      setRows(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [filter, listFn])

  const loadSettings = useCallback(async () => {
    try {
      const s = await subFn()
      const st = s?.settings
      if (st) {
        setUpiId(st.upi_id ?? '')
        setQrUrl(st.qr_image_url ?? '')
        setTrialPrice(Number(st.trial_price ?? 1))
        setMonthlyPrice(Number(st.monthly_price ?? 99))
        setTrialDays(Number(st.trial_days ?? 7))
        setMonthlyDays(Number(st.monthly_days ?? 30))
      }
    } catch (e) {
      console.error(e)
    }
  }, [subFn])

  useEffect(() => {
    refresh()
  }, [refresh])
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    let reason: string | undefined
    if (decision === 'reject') {
      const r = prompt('Reject reason?')
      if (r === null) return
      reason = r
    }
    setBusy(id)
    try {
      await decideFn({ data: { id, decision, reason } })
      toast.success(decision === 'approve' ? 'Approved 🎉' : 'Rejected')
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  const uploadQr = async (file: File) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `qr-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('qr-codes')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: signed, error: signErr } = await supabase.storage
        .from('qr-codes')
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5)
      if (signErr || !signed?.signedUrl) throw signErr || new Error('Sign failed')
      setQrUrl(signed.signedUrl)
      await settingsFn({ data: { qr_image_url: signed.signedUrl } })
      toast.success('QR upload ho gaya')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      await settingsFn({
        data: {
          upi_id: upiId.trim() || null,
          trial_price: trialPrice,
          monthly_price: monthlyPrice,
          trial_days: trialDays,
          monthly_days: monthlyDays,
        },
      })
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Settings card */}
      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-violet-600" />
          <h2 className="font-bold">Payment QR & Pricing</h2>
        </div>
        <div className="grid sm:grid-cols-[180px_1fr] gap-4">
          <div className="space-y-2">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="QR"
                className="h-44 w-44 object-contain rounded-xl border bg-white"
              />
            ) : (
              <div className="h-44 w-44 rounded-xl border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground p-3 text-center">
                No QR uploaded
              </div>
            )}
            <label className="block">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadQr(f)
                  e.target.value = ''
                }}
              />
              <span
                className={`flex items-center justify-center gap-2 h-9 w-44 rounded-md bg-violet-600 text-white text-sm font-semibold cursor-pointer hover:bg-violet-700 ${
                  uploading ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload QR
              </span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">UPI ID</Label>
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@upi"
              />
            </div>
            <div>
              <Label className="text-xs">Trial ₹</Label>
              <Input
                type="number"
                value={trialPrice}
                onChange={(e) => setTrialPrice(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Trial days</Label>
              <Input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Monthly ₹</Label>
              <Input
                type="number"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Monthly days</Label>
              <Input
                type="number"
                value={monthlyDays}
                onChange={(e) => setMonthlyDays(Number(e.target.value))}
              />
            </div>
            <Button
              onClick={saveSettings}
              disabled={savingSettings}
              className="col-span-2 mt-1"
            >
              {savingSettings ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save settings
            </Button>
          </div>
        </div>
      </div>

      {/* Requests list */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold">Subscription requests</h2>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1 rounded-md capitalize font-semibold ${
                  filter === s
                    ? 'bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {loading && (
          <div className="py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No {filter} requests
          </div>
        )}
        <div className="grid gap-2">
          {rows.map((r) => {
            const isPending = r.status === 'pending'
            return (
              <div
                key={r.id}
                className="rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold truncate">{r.user_email}</span>
                    <Badge
                      className={
                        r.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800 border-0'
                          : r.status === 'rejected'
                            ? 'bg-red-100 text-red-800 border-0'
                            : 'bg-amber-100 text-amber-800 border-0'
                      }
                    >
                      {r.status}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {r.plan} · ₹{r.amount}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    UTR: <span className="font-mono">{r.utr}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('en-IN')}
                    {r.expires_at &&
                      ` · expires ${new Date(r.expires_at).toLocaleDateString('en-IN')}`}
                  </div>
                  {r.reject_reason && (
                    <div className="text-xs text-red-600 mt-1">
                      Reason: {r.reject_reason}
                    </div>
                  )}
                </div>
                {isPending && (
                  <div className="flex gap-2 sm:justify-end">
                    <Button
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() => decide(r.id, 'approve')}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy === r.id}
                      onClick={() => decide(r.id, 'reject')}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}