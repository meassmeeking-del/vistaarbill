import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  getMySubscription,
  submitSubscriptionRequest,
} from '@/lib/subscription.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Loader2,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Sparkles,
  Crown,
  Zap,
  CalendarClock,
  Smartphone,
  ArrowRight,
  IndianRupee,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

type Sub = Awaited<ReturnType<typeof getMySubscription>>

const PENDING_GRACE_MS = 24 * 60 * 60 * 1000 // 24 hours

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const fetchSub = useServerFn(getMySubscription)
  const submitFn = useServerFn(submitSubscriptionRequest)
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<Sub | null>(null)
  const [plan, setPlan] = useState<'trial' | 'monthly'>('trial')
  const [utr, setUtr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [payStep, setPayStep] = useState<'idle' | 'opened' | 'confirm'>('idle')

  const refresh = useCallback(async () => {
    try {
      const data = (await fetchSub()) as Sub
      setSub(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [fetchSub])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto sign-out if pending request crosses 24h grace without approval
  useEffect(() => {
    const latest = sub?.latest as any
    if (!latest || latest.status !== 'pending') return
    const created = new Date(latest.created_at).getTime()
    const elapsed = Date.now() - created
    const remaining = PENDING_GRACE_MS - elapsed
    if (remaining <= 0) {
      toast.error('24 ghante me approval nahi mili — logout ho rahe hain')
      supabase.auth.signOut().finally(() => {
        window.location.reload()
      })
      return
    }
    const t = setTimeout(() => {
      toast.error('24 ghante me approval nahi mili — logout ho rahe hain')
      supabase.auth.signOut().finally(() => window.location.reload())
    }, remaining)
    return () => clearTimeout(t)
  }, [sub])

  // Realtime: when admin approves/rejects, refresh instantly
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return
      channel = supabase
        .channel(`sub-req-${data.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscription_requests',
            filter: `user_id=eq.${data.user.id}`,
          },
          () => refresh(),
        )
        .subscribe()
    })()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [refresh])

  const handleSubmit = async (overrideUtr?: string) => {
    const finalUtr = (overrideUtr ?? utr).trim()
    if (!finalUtr) {
      toast.error('UPI Reference / UTR number daalein')
      return
    }
    setSubmitting(true)
    try {
      await submitFn({ data: { plan, utr: finalUtr } })
      toast.success('Request submit ho gayi 🎉 Admin approval ka wait karein')
      setUtr('')
      setPayStep('idle')
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (sub?.active) {
    return (
      <>
        <ActiveStatusBar sub={sub} />
        {children}
      </>
    )
  }

  // Pending within 24h grace → unlock app with a pending status bar
  const latestAny = sub?.latest as any
  void latestAny

  const settings = sub?.settings
  const latest = sub?.latest
  const trialPrice = Number(settings?.trial_price ?? 1)
  const monthlyPrice = Number(settings?.monthly_price ?? 99)
  const trialDays = Number(settings?.trial_days ?? 7)
  const monthlyDays = Number(settings?.monthly_days ?? 30)

  return (
    <LockShell>
      {/* Pending state */}
      {latest?.status === 'pending' && (
        <PendingCard latest={latest} onRefresh={refresh} />
      )}

      {/* Rejected state */}
      {latest?.status === 'rejected' && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-red-900">Request rejected</div>
              <div className="text-sm text-red-700 mt-0.5">
                {latest.reject_reason || 'Admin ne reject kar diya'}
              </div>
              <div className="text-xs text-red-600 mt-1">
                Naya request submit karein 👇
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expired state */}
      {latest?.status === 'approved' && !sub?.active && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 mb-4">
          <div className="flex items-start gap-3">
            <Clock className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
            <div className="flex-1">
              <div className="font-bold text-amber-900">Subscription expired</div>
              <div className="text-sm text-amber-700">
                Renew karein aur app dobara unlock karein
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan selector — hide when there's a pending request */}
      {latest?.status !== 'pending' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <PlanCard
              active={plan === 'trial'}
              onClick={() => setPlan('trial')}
              icon={<Zap className="h-5 w-5" />}
              title="Trial"
              price={trialPrice}
              days={trialDays}
              accent="from-emerald-500 to-teal-600"
              badge="Try it!"
              disabled={false}
            />
            <PlanCard
              active={plan === 'monthly'}
              onClick={() => setPlan('monthly')}
              icon={<Crown className="h-5 w-5" />}
              title="Monthly"
              price={monthlyPrice}
              days={monthlyDays}
              accent="from-violet-600 to-fuchsia-600"
              badge="Best value"
              disabled={false}
            />
          </div>

          <PaymentBlock
            amount={plan === 'trial' ? trialPrice : monthlyPrice}
            upiId={settings?.upi_id ?? ''}
            qr={
              (plan === 'trial'
                ? (settings as any)?.trial_qr_image_url
                : (settings as any)?.subscription_qr_image_url) ??
              settings?.qr_image_url ??
              ''
            }
            payStep={payStep}
            setPayStep={setPayStep}
          />

          {payStep === 'confirm' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-800">
                  <div className="font-bold">Payment kar diya?</div>
                  UPI app me jo <b>12-digit UTR / reference number</b> mila hai woh
                  neeche daalein — request auto-submit ho jayegi.
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="utr" className="text-sm font-semibold">
                  UTR / Reference number
                </Label>
                <Input
                  id="utr"
                  autoFocus
                  placeholder="e.g. 412345678912"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  inputMode="numeric"
                  className="h-12 text-base font-mono tracking-wider"
                />
              </div>
              <Button
                onClick={() => handleSubmit()}
                disabled={submitting || utr.trim().length < 4}
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 shadow-lg shadow-emerald-500/30"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5 mr-2" />
                )}
                Confirm & Submit
              </Button>
              <button
                type="button"
                onClick={() => setPayStep('idle')}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                ← Payment nahi hui? Wapas jaayein
              </button>
            </div>
          )}
        </>
      )}
    </LockShell>
  )
}

function LockShell({ children }: { children: ReactNode }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }
  return (
    <div
      className="min-h-screen p-4 relative overflow-hidden flex items-center justify-center"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <div className="absolute inset-0 bg-background/10 backdrop-blur-3xl" />
      <div className="relative w-full max-w-md bg-card/95 backdrop-blur-xl rounded-3xl border shadow-2xl overflow-hidden my-6">
        <div
          className="px-6 py-6 text-center text-primary-foreground"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <div className="inline-flex h-14 w-14 rounded-2xl bg-white/20 backdrop-blur items-center justify-center mb-2">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Unlock VistaarBill</h1>
          <p className="text-xs text-white/85 mt-1">
            Plan choose karein, payment karein, aur admin approval ka wait karein
          </p>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="px-5 pb-5 pt-1 border-t bg-muted/30">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full text-xs font-semibold text-muted-foreground hover:text-foreground py-2"
          >
            🔄 Doosre account se login karein / Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  active,
  onClick,
  icon,
  title,
  price,
  days,
  accent,
  badge,
  disabled,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  title: string
  price: number
  days: number
  accent: string
  badge: string
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-2xl p-4 text-left transition-all border-2 ${
        active
          ? 'border-violet-500 shadow-lg scale-[1.02] bg-white'
          : 'border-border bg-white/60 hover:border-violet-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Badge
        className={`absolute -top-2 right-3 text-[10px] bg-gradient-to-r ${accent} text-white border-0`}
      >
        {badge}
      </Badge>
      <div
        className={`inline-flex h-9 w-9 rounded-xl items-center justify-center bg-gradient-to-br ${accent} text-white mb-2`}
      >
        {icon}
      </div>
      <div className="text-sm font-semibold text-muted-foreground">{title}</div>
      <div className="text-2xl font-extrabold">
        ₹{price}
        <span className="text-xs font-normal text-muted-foreground"> / {days}d</span>
      </div>
    </button>
  )
}

function PaymentBlock({
  amount,
  upiId,
  qr,
  payStep,
  setPayStep,
}: {
  amount: number
  upiId: string
  qr: string
  payStep: 'idle' | 'opened' | 'confirm'
  setPayStep: (s: 'idle' | 'opened' | 'confirm') => void
}) {
  const copyUpi = async () => {
    if (!upiId) return
    try {
      await navigator.clipboard.writeText(upiId)
      toast.success('UPI ID copy ho gayi')
    } catch {
      /* noop */
    }
  }
  const upiLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=VistaarBill&am=${amount}&cu=INR&tn=${encodeURIComponent(
        'VistaarBill subscription',
      )}`
    : ''
  // Auto-generate a UPI QR for the exact plan amount
  const [autoQr, setAutoQr] = useState('')
  useEffect(() => {
    let cancelled = false
    if (!upiLink) {
      setAutoQr('')
      return
    }
    ;(async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(upiLink, {
          width: 512,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#111827', light: '#ffffff' },
        })
        if (!cancelled) setAutoQr(url)
      } catch {
        if (!cancelled) setAutoQr('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [upiLink])
  const shownQr = autoQr || qr
  const [pickerOpen, setPickerOpen] = useState(false)
  const isMobile =
    typeof navigator !== 'undefined' &&
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
  const upiQuery = upiId
    ? `pa=${encodeURIComponent(upiId)}&pn=VistaarBill&am=${amount}&cu=INR&tn=${encodeURIComponent('VistaarBill subscription')}`
    : ''
  const apps: {
    name: string
    emoji: string
    color: string
    scheme: (q: string) => string
  }[] = [
    { name: 'Google Pay', emoji: '🟢', color: 'from-blue-500 to-green-500', scheme: (q) => `tez://upi/pay?${q}` },
    { name: 'PhonePe', emoji: '🟣', color: 'from-purple-600 to-indigo-600', scheme: (q) => `phonepe://pay?${q}` },
    { name: 'Paytm', emoji: '🔵', color: 'from-sky-500 to-blue-600', scheme: (q) => `paytmmp://pay?${q}` },
    { name: 'BHIM', emoji: '🟠', color: 'from-orange-500 to-amber-500', scheme: (q) => `bhim://pay?${q}` },
    { name: 'Any UPI app', emoji: '📱', color: 'from-slate-600 to-slate-800', scheme: (q) => `upi://pay?${q}` },
  ]
  const openPicker = () => {
    if (!upiLink) {
      toast.error('Admin ne UPI ID set nahi ki — QR se scan karke pay karein')
      return
    }
    if (!isMobile) {
      toast.info('UPI apps sirf phone me kaam karti hain — QR scan karein 📱')
      return
    }
    setPickerOpen(true)
  }
  const launchApp = (schemeUrl: string) => {
    setPickerOpen(false)
    setPayStep('opened')
    window.location.href = schemeUrl
    setTimeout(() => setPayStep('confirm'), 1800)
  }
  // When page becomes visible again after switching to UPI app → confirm step
  useEffect(() => {
    if (payStep !== 'opened') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') setPayStep('confirm')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [payStep, setPayStep])
  return (
    <div className="rounded-2xl border-2 border-dashed border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 text-center space-y-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        Step 1 — Pay ₹{amount}
      </div>
      {shownQr ? (
        <>
        <img
          src={shownQr}
          alt="UPI QR"
          className="mx-auto h-44 w-44 rounded-xl border-4 border-white shadow-md bg-white object-contain"
        />
        {autoQr && (
          <div className="text-[11px] font-semibold text-violet-700">
            ✨ Auto-generated QR — fixed ₹{amount}
          </div>
        )}
        </>
      ) : (
        <div className="mx-auto h-44 w-44 rounded-xl border-4 border-white shadow-md bg-white/80 flex items-center justify-center text-xs text-muted-foreground p-4">
          Admin ne UPI ID set nahi ki — QR generate nahi ho paya
        </div>
      )}
      {upiId && (
        <div className="flex items-center gap-2 justify-center">
          <code className="text-sm font-mono bg-white border rounded-lg px-3 py-1.5">
            {upiId}
          </code>
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={copyUpi}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}
      {/* Animated Pay Button */}
      {payStep !== 'confirm' && (
        <button
          type="button"
          onClick={openPicker}
          disabled={!upiLink && !shownQr}
          className="group relative w-full h-14 rounded-2xl overflow-hidden font-extrabold text-white shadow-xl shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          {/* animated gradient background */}
          <span
            className="absolute inset-0 bg-[linear-gradient(110deg,#7c3aed,45%,#ec4899,55%,#7c3aed)] bg-[length:200%_100%]"
            style={{ animation: 'upi-shine 2.5s linear infinite' }}
          />
          {/* pulsing glow */}
          <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
          {/* content */}
          <span className="relative flex items-center justify-center gap-2 text-base">
            {payStep === 'opened' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                UPI app khul rahi hai…
              </>
            ) : (
              <>
                <Smartphone className="h-5 w-5 animate-pulse" />
                Pay ₹{amount} via UPI
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </span>
          {/* ping indicator */}
          <span className="absolute top-2 right-3 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <style>{`@keyframes upi-shine{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </button>
      )}
      {/* App suggestions row */}
      {payStep !== 'confirm' && upiLink && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <span className="text-[10px] text-muted-foreground">
            {isMobile ? 'Tap → GPay / PhonePe / Paytm / BHIM list khulegi' : 'UPI apps: phone only • QR scan karein'}
          </span>
        </div>
      )}
      {payStep === 'idle' && (
        <button
          type="button"
          onClick={() => setPayStep('confirm')}
          className="text-[11px] font-semibold text-violet-700 underline underline-offset-2"
        >
          Already paid? UTR daalein →
        </button>
      )}
      {/* UPI App Picker Sheet */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-3 animate-in slide-in-from-bottom-8 duration-300 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">Pay ₹{amount}</div>
                <div className="text-xs text-muted-foreground">
                  Amount fix hai • App choose karein
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="h-8 w-8 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground font-bold"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {apps.map((app) => (
                <button
                  key={app.name}
                  type="button"
                  onClick={() => launchApp(app.scheme(upiQuery))}
                  className={`group relative rounded-2xl p-3 text-left bg-gradient-to-br ${app.color} text-white shadow-md active:scale-95 transition-transform overflow-hidden`}
                >
                  <div className="text-2xl">{app.emoji}</div>
                  <div className="mt-1 text-sm font-bold leading-tight">
                    {app.name}
                  </div>
                  <div className="text-[10px] opacity-80">Open →</div>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-center text-muted-foreground pt-2">
              Agar app install nahi hai to woh option kaam nahi karega — doosri
              try karein ya QR scan karein.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PendingCard({
  latest,
  onRefresh,
}: {
  latest: { plan: string; amount: number; utr: string; created_at: string }
  onRefresh: () => void
}) {
  // Live countdown until 24h auto-logout
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const remainingMs = Math.max(
    0,
    PENDING_GRACE_MS - (now - new Date(latest.created_at).getTime()),
  )
  const hours = Math.floor(remainingMs / 3_600_000)
  const mins = Math.floor((remainingMs % 3_600_000) / 60_000)
  const secs = Math.floor((remainingMs % 60_000) / 1000)
  const pct = Math.max(0, Math.min(100, (remainingMs / PENDING_GRACE_MS) * 100))
  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-200 p-5 text-center space-y-3">
      <div className="mx-auto relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border-4 border-amber-200" />
        <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Clock className="h-8 w-8 text-amber-600 animate-pulse" />
        </div>
      </div>
      <div>
        <div className="font-extrabold text-lg text-amber-900">
          Verification chal rahi hai…
        </div>
        <div className="text-sm text-amber-700">
          Admin aapki payment verify kar rahe hain
        </div>
      </div>
      <div className="bg-white/80 rounded-xl p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">
          Auto-logout in
        </div>
        <div className="font-mono font-extrabold text-2xl text-amber-900 tabular-nums">
          {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:
          {String(secs).padStart(2, '0')}
        </div>
        <div className="h-1.5 w-full bg-amber-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[10px] text-amber-700">
          Agar 24 ghante me approval nahi mili to automatic logout ho jayega
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-left bg-white/70 rounded-xl p-3 text-xs">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Plan</div>
          <div className="font-bold capitalize">{latest.plan}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Amount</div>
          <div className="font-bold">₹{latest.amount}</div>
        </div>
        <div className="truncate">
          <div className="text-[10px] text-muted-foreground uppercase">UTR</div>
          <div className="font-bold truncate">{latest.utr}</div>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Submitted {new Date(latest.created_at).toLocaleString('en-IN')}
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} className="w-full">
        <Loader2 className="h-4 w-4 mr-2" /> Refresh status
      </Button>
    </div>
  )
}

function ActiveStatusBar({ sub }: { sub: Sub }) {
  const { daysLeft, label, color } = useMemo(() => {
    if (sub?.isAdmin) {
      return { daysLeft: Infinity, label: 'Admin', color: 'bg-amber-500' }
    }
    const exp = sub?.activeRow?.expires_at
    if (!exp) return { daysLeft: 0, label: 'Active', color: 'bg-emerald-500' }
    const ms = new Date(exp).getTime() - Date.now()
    const days = Math.max(0, Math.ceil(ms / 86_400_000))
    const color =
      days <= 2 ? 'bg-red-500' : days <= 5 ? 'bg-amber-500' : 'bg-emerald-500'
    return { daysLeft: days, label: sub?.activeRow?.plan ?? 'Active', color }
  }, [sub])

  if (sub?.isAdmin) {
    return (
      <div className="bg-amber-500/95 text-white text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2">
        <Crown className="h-3.5 w-3.5" /> Admin · unlimited access
      </div>
    )
  }

  return (
    <div
      className={`${color} text-white text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span className="capitalize">{label}</span>
      <span className="opacity-80">·</span>
      <CalendarClock className="h-3.5 w-3.5" />
      <span>
        {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
      </span>
    </div>
  )
}

function PendingStatusBar({ createdAt, plan }: { createdAt: string; plan: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const remainingMs = Math.max(
    0,
    PENDING_GRACE_MS - (now - new Date(createdAt).getTime()),
  )
  const hours = Math.floor(remainingMs / 3_600_000)
  const mins = Math.floor((remainingMs % 3_600_000) / 60_000)
  return (
    <div className="bg-amber-500/95 text-white text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2">
      <Clock className="h-3.5 w-3.5 animate-pulse" />
      <span className="capitalize">{plan} · approval pending</span>
      <span className="opacity-80">·</span>
      <span>
        {hours}h {mins}m left
      </span>
    </div>
  )
}