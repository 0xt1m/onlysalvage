'use client'

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { requestPasswordReset } from '@/lib/auth';

export function ForgotPasswordForm() {
  const t = useTranslations('ForgotPasswordForm');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setSubmitting(true);
    await requestPasswordReset(username.trim());
    setSubmitting(false);
    setSent(true);
  };

  if (sent) {
    return (
      <Card className="flex-1/3 gap-3">
        <h3 className="text-primary-light text-lg font-bold">{t('checkYourEmail')}</h3>
        <p className="text-sm">
          {t('checkYourEmailDescription')}
        </p>
        <Link href="/login" className="text-primary-light text-sm">{t('backToLogin')}</Link>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='flex-1/3 justify-center gap-3'>
      <Card>
        <h3 className="text-primary-light text-lg font-bold mb-1">{t('title')}</h3>
        <p className="text-sm text-muted">{t('description')}</p>
        <Input label={t('usernameOrEmail')} value={username} onChange={(e) => setUsername(e.target.value)} />
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? t('sending') : t('sendResetLink')}
        </Button>
        <Link href="/login" className="text-primary-light text-sm">{t('backToLogin')}</Link>
      </Card>
    </form>
  );
}
