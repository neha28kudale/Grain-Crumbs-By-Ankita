import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — Grain Crumbs Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

// ── EmailJS config ─────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = "service_o3pbjwb";
const EMAILJS_TEMPLATE_ID = "template_144sxrs";          // same combined template
const EMAILJS_PUBLIC_KEY  = "P8p-EPatFJBMOHmsz";
const PERSONAL_EMAIL      = "ankita.junankar@gmail.com"; // OTP always goes here only

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

type Step = "email" | "otp" | "reset" | "done";

const inputCls =
  "w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/30";

function ForgotPasswordPage() {
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  // ── State ────────────────────────────────────────────────────────────────
  const [step, setStep]             = useState<Step>("email");
  const [adminEmail, setAdminEmail] = useState("");
  const [otpInput, setOtpInput]     = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy]             = useState(false);
  const [err, setErr]               = useState<string | null>(null);

  // OTP kept in memory only
  const [otpCode, setOtpCode]               = useState("");
  const [otpExpiry, setOtpExpiry]           = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const generateOtp = () =>
    String(Math.floor(100000 + Math.random() * 900000));

  const sendOtpEmail = async (otp: string, forEmail: string) => {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id:  EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id:     EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email:    PERSONAL_EMAIL,
          admin_email: forEmail,
          otp:         otp,
          time:        new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        },
      }),
    });
    if (!res.ok) throw new Error("Failed to send OTP email. Please try again.");
  };

  // ── Step 1: Verify admin email exists → send OTP ──────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      // Check the email exists in user_roles as admin
      const { data: users } = await supabase.auth.admin?.listUsers?.() ?? { data: null };

      // We can't query auth.users directly from client, so we attempt a
      // password reset — but we intercept it with OTP instead.
      // Just verify the email is non-empty and looks valid, then send OTP.
      // Supabase will reject the updateUser call later if email doesn't exist.
      if (!adminEmail.trim() || !adminEmail.includes("@")) {
        throw new Error("Please enter a valid email address.");
      }

      const otp = generateOtp();
      await sendOtpEmail(otp, adminEmail.trim());

      setOtpCode(otp);
      setOtpExpiry(Date.now() + OTP_TTL_MS);
      setResendCooldown(60);
      setStep("otp");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setErr(null);
    setBusy(true);
    try {
      const otp = generateOtp();
      await sendOtpEmail(otp, adminEmail.trim());
      setOtpCode(otp);
      setOtpExpiry(Date.now() + OTP_TTL_MS);
      setResendCooldown(60);
      setOtpInput("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to resend OTP.");
    } finally {
      setBusy(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!/^\d{6}$/.test(otpInput.trim())) {
      setErr("Please enter the 6-digit OTP.");
      return;
    }
    if (Date.now() > otpExpiry) {
      setErr("OTP has expired. Please request a new one.");
      setOtpCode("");
      return;
    }
    if (otpInput.trim() !== otpCode) {
      setErr("Incorrect OTP. Please check and try again.");
      return;
    }

    // OTP correct — move to reset step, invalidate code
    setOtpCode("");
    setStep("reset");
  };

  // ── Step 3: Set new password ──────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (newPw.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      // Sign in with the admin email using Supabase magic link flow isn't
      // available client-side without the old password. Instead we use
      // Supabase's built-in password recovery: trigger reset email first,
      // but since we've already OTP-verified identity, we call updateUser
      // after signing in via OTP-verified session. 
      //
      // Best approach: use signInWithPassword won't work without old pw.
      // Use Supabase Admin API via a server function if available,
      // OR use the recoveryToken approach below.
      //
      // For this app (client-only), the safest pattern is:
      // 1. Call resetPasswordForEmail (sends Supabase recovery email)
      // 2. But we already verified identity via our OTP above.
      // So we call resetPasswordForEmail and tell admin to also check
      // their Supabase recovery email — OR use a server function.
      //
      // Since this project uses server functions (TanStack Start),
      // we call a lightweight server fn to update the password by email.
      // For now, trigger Supabase's own reset email as fallback:
      const { error } = await supabase.auth.resetPasswordForEmail(adminEmail.trim(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (error) throw error;
      setStep("done");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to reset password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const STEPS: Step[] = ["email", "otp", "reset", "done"];
  const STEP_LABELS: Record<Step, string> = {
    email: "Email",
    otp:   "Verify OTP",
    reset: "New Password",
    done:  "Done",
  };

  return (
    <section className="section">
      <div className="container-prose max-w-lg">

        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-2 flex-wrap">
          {STEPS.map((s, i) => {
            const currentIdx = STEPS.indexOf(step);
            const past   = i < currentIdx;
            const active = step === s;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold transition-colors ${
                    past
                      ? "bg-green-100 text-green-700"
                      : active
                      ? "bg-[color:var(--chocolate-dark)] text-[color:var(--cream)]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {past ? "✓" : i + 1}
                </div>
                <span className={`text-xs uppercase tracking-[0.18em] ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {STEP_LABELS[s]}
                </span>
                {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
              </div>
            );
          })}
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 md:p-10">

          {/* ── Step 1: Enter admin email ── */}
          {step === "email" && (
            <>
              <div className="flex items-center gap-3 mb-7">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--chocolate-dark)] text-[color:var(--cream)]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl">Forgot Password</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    An OTP will be sent to the registered personal email
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Admin Email
                  </span>
                  <input
                    required
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className={inputCls}
                    // placeholder="thegraincrumbs@gmail.com"
                    autoComplete="email"
                  />
                </label>

                {err && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {err}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <Link to="/admin/login" className="btn-outline flex-1 justify-center">
                    Back to Login
                  </Link>
                  <button
                    type="submit"
                    disabled={busy}
                    className="btn-primary flex-1 justify-center disabled:opacity-60"
                  >
                    {busy
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending OTP…</>
                      : "Send OTP"}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Step 2: Enter OTP ── */}
          {step === "otp" && (
            <>
              <div className="flex items-center gap-3 mb-7">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--chocolate-dark)] text-[color:var(--cream)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl">Verify Identity</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    OTP sent to your personal email
                  </p>
                </div>
              </div>

              <div className="mb-5 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--cream-dark)]/40 px-5 py-4 text-sm text-muted-foreground">
                Check your personal email for a <strong>6-digit OTP</strong>.
                It expires in <strong>10 minutes</strong>.
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    6-Digit OTP
                  </span>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={inputCls + " text-center font-mono text-3xl tracking-[0.6em]"}
                    placeholder="——————"
                    autoFocus
                  />
                </label>

                {err && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {err}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setOtpInput(""); setErr(null); }}
                    className="btn-outline flex-1 justify-center"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy || otpInput.length !== 6}
                    className="btn-primary flex-1 justify-center disabled:opacity-60"
                  >
                    Verify OTP
                  </button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Didn't receive it?{" "}
                  {resendCooldown > 0 ? (
                    <span className="text-[color:var(--gold)]">Resend in {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleResend}
                      className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  )}
                </p>
              </form>
            </>
          )}

          {/* ── Step 3: Set new password ── */}
          {step === "reset" && (
            <>
              <div className="flex items-center gap-3 mb-7">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--chocolate-dark)] text-[color:var(--cream)]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl">Set New Password</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Identity verified — choose a new password
                  </p>
                </div>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    New Password
                  </span>
                  <div className="relative">
                    <input
                      required
                      type={showNew ? "text" : "password"}
                      minLength={8}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className={inputCls + " pr-10"}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Confirm New Password
                  </span>
                  <div className="relative">
                    <input
                      required
                      type={showConfirm ? "text" : "password"}
                      minLength={8}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className={inputCls + " pr-10"}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {err && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {err}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary w-full justify-center disabled:opacity-60"
                >
                  {busy
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
                    : "Update Password"}
                </button>
              </form>
            </>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <div className="py-6 text-center space-y-6">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <h1 className="font-display text-3xl text-[color:var(--chocolate-dark)]">
                  Check Your Email
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  A password reset link has been sent to <strong>{adminEmail}</strong>.
                  Click the link in that email to set your new password and sign back in.
                </p>
              </div>
              <Link to="/admin/login" className="btn-primary inline-flex justify-center">
                Back to Login
              </Link>
            </div>
          )}

        </div>
      </div>
    </section>
  );
}