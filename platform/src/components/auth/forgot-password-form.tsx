'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { requestPasswordReset, setNewPassword, verifyResetCode } from '@/app/actions/auth';
import { Alert, ErrorText } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

type Step = 'email' | 'code' | 'password';
const RESEND_SECONDS = 60;

// Three steps: email -> 6-digit code from the email -> new password.
export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = (to: string, again = false) => start(async () => {
    const res = await requestPasswordReset({ email: to });
    if (!res.ok) return setError(res.error);
    setError(null);
    setEmail(to.trim().toLowerCase());
    setCode('');
    setStep('code');
    setCooldown(RESEND_SECONDS);
    setNotice(again ? 'We sent a new code. Use the code from the latest email.' : null);
  });

  if (step === 'email') {
    return (
      <>
        <p className="mb-4 text-center text-sm text-muted">Enter the email address you registered with. We&apos;ll send you a 6-digit verification code.</p>
        <ErrorText error={error} />
        <form noValidate onSubmit={(e) => { e.preventDefault(); sendCode(String(new FormData(e.currentTarget).get('email') ?? '')); }}>
          <Field label="Email" htmlFor="reset-email">
            <Input id="reset-email" name="email" type="email" autoComplete="email" defaultValue={email} required autoFocus />
          </Field>
          <Button block type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send code'}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted"><Link href="/login">Back to log in</Link></p>
      </>
    );
  }

  if (step === 'code') {
    return (
      <>
        <p className="mb-4 text-center text-sm text-muted">
          If an account uses <b className="text-ink">{email}</b>, we sent it a 6-digit code. It expires in 1 hour.
          Can&apos;t find it? Check your spam folder.
        </p>
        {notice && !error && <Alert tone="info" className="mb-3">{notice}</Alert>}
        <ErrorText error={error} />
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await verifyResetCode({ email, code });
              if (!res.ok) return setError(res.error);
              setError(null);
              setNotice(null);
              setStep('password');
            });
          }}
        >
          <Field label="Verification code" htmlFor="reset-code">
            <Input
              id="reset-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus
              placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center font-mono text-2xl tracking-[0.5em]"
            />
          </Field>
          <Button block type="submit" disabled={pending || code.length !== 6}>{pending ? 'Checking…' : 'Verify code'}</Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted">
          <button type="button" className="text-primary disabled:text-muted" disabled={pending || cooldown > 0} onClick={() => sendCode(email, true)}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          <button type="button" className="text-primary" onClick={() => { setStep('email'); setError(null); setNotice(null); }}>Use a different email</button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="mb-4 text-center text-sm text-muted">Code verified. Choose a new password for <b className="text-ink">{email}</b>.</p>
      <ErrorText error={error} />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          start(async () => {
            const res = await setNewPassword({ password: form.get('password'), confirm: form.get('confirm') });
            if (!res.ok) {
              if (res.status === 401) setStep('email');
              return setError(res.error);
            }
            toast.success('Your password has been reset. You are logged in.');
            router.replace(res.data.next);
            router.refresh();
          });
        }}
      >
        <Field label="New password" htmlFor="new-password" hint="At least 8 characters, with a letter and a number.">
          <Input id="new-password" name="password" type="password" autoComplete="new-password" required autoFocus />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-password">
          <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <Button block type="submit" disabled={pending}>{pending ? 'Saving…' : 'Reset password'}</Button>
      </form>
    </>
  );
}
