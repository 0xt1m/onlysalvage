'use client'

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Link, useRouter } from '@/i18n/navigation';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { confirmPasswordReset } from '@/lib/auth';

export function ResetPasswordForm() {
  const t = useTranslations('ResetPasswordForm');
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!uid || !token) {
    return (
      <Card className="flex-1/3 gap-3">
        <h3 className="text-primary-light text-lg font-bold">{t('invalidLinkTitle')}</h3>
        <p className="text-sm text-muted">
          {t('invalidLinkDescription')}
        </p>
        <Link href="/forgot-password" className="text-primary-light text-sm">{t('requestNewLink')}</Link>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="flex-1/3 gap-3">
        <h3 className="text-primary-light text-lg font-bold">{t('passwordUpdatedTitle')}</h3>
        <p className="text-sm text-muted">{t('passwordUpdatedDescription')}</p>
        <Link href="/login" className="text-primary-light text-sm">{t('goToLogin')}</Link>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    const { ok, data } = await confirmPasswordReset(uid, token, password);
    setSubmitting(false);

    if (!ok) {
      setError(data?.detail ?? t('errors.linkInvalidOrExpired'));
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/login'), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className='flex-1/3 justify-center gap-3'>
      <Card>
        <h3 className="text-primary-light text-lg font-bold mb-1">{t('title')}</h3>
        <Input label={t('newPassword')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label={t('confirmPassword')} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        {error && <p className="text-accent text-sm">{error}</p>}
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? t('saving') : t('resetPassword')}
        </Button>
      </Card>
    </form>
  );
}
