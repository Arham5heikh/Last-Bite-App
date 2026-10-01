import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
