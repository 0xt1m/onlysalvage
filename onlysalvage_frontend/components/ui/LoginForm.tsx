'use client'

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Link, useRouter } from '@/i18n/navigation';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth-context';
import { useFormStatus } from 'react-dom';
import { HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export function LoginForm({ className }: { className?: string }) {
  const t = useTranslations('LoginForm');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (searchParams.get('reason') === 'sell') {
      toast.info(t('sellRedirectToast'));
    }
  }, [searchParams, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      router.push('/');
      // Without this, a route already in the client-side Router Cache from
      // before login (e.g. the home page, visited anonymously) can still be
      // served stale -- server components on it re-run with the old (no
      // user) request, so things like each listing card's owner check see
      // no logged-in user at all.
      router.refresh();
    } catch {
      toast.error(t('invalidCredentials'));
    }
  }

  return (
    <form onSubmit={handleLogin} className={cn('flex-1/3 justify-center gap-3', className)}>
      <Card>
          <h3 className="text-primary-light text-lg font-bold mb-1">{t('logIn')}</h3>
          <Input label={t('username')} value={username} onChange={e => setUsername(e.target.value)} />
          <Input label={t('password')} type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <Link href="/forgot-password" className='text-primary-light'>{t('forgotPassword')}</Link>
          <Button variant="primary" type="submit">{t('logIn')}</Button>

          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-border" />
            {t('orDivider')}
            <div className="h-px flex-1 bg-border" />
          </div>

          <GoogleSignInButton />

          <Button type="button" variant="secondary" onClick={() => router.push("/sign-up")}>{t('signUp')}</Button>
      </Card>
    </form>
  )
}
