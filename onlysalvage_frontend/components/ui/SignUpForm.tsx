'use client'

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { CityAutocomplete } from '@/components/ui/CityAutocomplete';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Link, useRouter } from '@/i18n/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/lib/auth-context';
import { signUp } from '@/lib/auth';
import { US_STATES } from '@/lib/types';
import { formatPhoneDigits, formatPhoneNumber, isPhoneNumberComplete, normalizeUrl, phoneDigitsOnly } from '@/lib/utils';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { useRegistrationPhoneVerification } from '@/components/ui/RegistrationPhoneVerification';

// Mirrors the backend's PHONE_VERIFICATION_ENABLED (see settings.py) --
// both need to be flipped together (this one requires a rebuild, being
// NEXT_PUBLIC_*). Off means: no verify button/code panel shown, and phone
// isn't required to sign up at all, matching what the backend now accepts.
const PHONE_VERIFICATION_ENABLED = process.env.NEXT_PUBLIC_PHONE_VERIFICATION_ENABLED === 'true';

const initialForm = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  street_address: '',
  city: '',
  state: '',
  zip_code: '',
  website: '',
  business_name: '',
  is_dealer: false,
};

export function SignUpForm() {
  const t = useTranslations('SignUpForm');
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const phoneVerification = useRegistrationPhoneVerification({
    phone: form.phone,
    verified: phoneVerified,
    onVerifiedChange: setPhoneVerified,
  });

  const setField = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setErrors(prev => ({ ...prev, [field]: '' }));
    };

  const validate = () => {
    const next: Record<string, string> = {};

    if (!form.username.trim()) next.username = t('errors.usernameRequired');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = t('errors.emailInvalid');
    if (form.password.length < 8) next.password = t('errors.passwordTooShort');
    if (form.confirmPassword !== form.password) next.confirmPassword = t('errors.passwordMismatch');
    if (!form.city.trim()) next.city = t('errors.cityRequired');
    if (!form.state) next.state = t('errors.stateRequired');
    if (!/^\d{5}$/.test(form.zip_code.trim())) next.zip_code = t('errors.zipInvalid');
    if (PHONE_VERIFICATION_ENABLED) {
      if (!isPhoneNumberComplete(form.phone)) next.phone = t('errors.phoneInvalid');
      else if (!phoneVerified) next.phone = t('errors.phoneNotVerified');
    }
    if (form.is_dealer && !form.business_name.trim()) next.business_name = t('errors.businessNameRequired');
    if (form.is_dealer && !form.street_address.trim()) next.street_address = t('errors.streetAddressRequired');

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      city: form.city.trim(),
      state: form.state,
      zip_code: form.zip_code.trim(),
      is_dealer: form.is_dealer,
    };
    payload.phone = form.phone.trim();
    if (form.website.trim()) payload.website = normalizeUrl(form.website);
    if (form.business_name.trim()) payload.business_name = form.business_name.trim();
    if (form.street_address.trim()) payload.street_address = form.street_address.trim();

    const { ok, data } = await signUp(payload);

    if (!ok || !data) {
      if (data && typeof data === 'object') {
        const fieldErrors: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
          fieldErrors[key] = Array.isArray(value) ? String(value[0]) : String(value);
        }
        setErrors(prev => ({ ...prev, ...fieldErrors }));
      }
      setSubmitting(false);
      return;
    }

    try {
      await login(form.username.trim(), form.password);
      router.push('/');
      // See LoginForm's identical call for why this is needed -- otherwise
      // a Router-Cache-stale home page can render as if no one's logged in.
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <form onSubmit={handleSubmit} className='flex-1/3 justify-center gap-3'>
      <Card className="gap-4">
        <h3 className="text-primary-light text-lg font-bold">{t('createAccount')}</h3>

        <GoogleSignInButton />

        <div className="flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          {t('orDivider')}
          <div className="h-px flex-1 bg-border" />
        </div>

        <Input label={t('username')} value={form.username} onChange={setField('username')} error={errors.username} />
        <Input label={t('email')} type="email" value={form.email} onChange={setField('email')} error={errors.email} />
        <Input label={t('password')} type="password" value={form.password} onChange={setField('password')} error={errors.password} />
        <Input label={t('confirmPassword')} type="password" value={form.confirmPassword} onChange={setField('confirmPassword')} error={errors.confirmPassword} />
        <Input
          label={t('phoneNumber')}
          type="tel"
          value={form.phone}
          onChange={(e) => {
            const input = e.target
            const formatted = formatPhoneNumber(input.value)
            setForm(prev => ({ ...prev, phone: formatted }))
            setErrors(prev => ({ ...prev, phone: '' }))
            requestAnimationFrame(() => input.setSelectionRange(formatted.length, formatted.length))
          }}
          onKeyDown={(e) => {
            // Deleting a formatting char (space/paren/dash) the formatter
            // just re-inserts on the next render, since the digit count
            // hasn't changed -- so backspace visibly "does nothing" right
            // before those. Handling it ourselves always drops one real
            // digit instead.
            if (e.key !== 'Backspace') return
            e.preventDefault()
            const input = e.currentTarget
            const digits = phoneDigitsOnly(form.phone)
            const formatted = formatPhoneDigits(digits.slice(0, -1))
            setForm(prev => ({ ...prev, phone: formatted }))
            setErrors(prev => ({ ...prev, phone: '' }))
            requestAnimationFrame(() => input.setSelectionRange(formatted.length, formatted.length))
          }}
          placeholder={t('phonePlaceholder')}
          error={errors.phone}
          endButton={PHONE_VERIFICATION_ENABLED ? phoneVerification.verifyButton : undefined}
        />
        {PHONE_VERIFICATION_ENABLED && phoneVerification.panel}

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[140px]">
            <CityAutocomplete
              label={t('city')}
              value={form.city}
              onChange={(value) => {
                setForm(prev => ({ ...prev, city: value }))
                setErrors(prev => ({ ...prev, city: '' }))
              }}
              onCitySelect={({ city, state }) => {
                setForm(prev => ({ ...prev, city, state: state || prev.state }))
                setErrors(prev => ({ ...prev, city: '', state: '' }))
              }}
              error={errors.city}
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <Select label={t('state')} value={form.state} onChange={setField('state')} options={US_STATES} placeholder={t('select')} error={errors.state} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <Input label={t('zipCode')} value={form.zip_code} onChange={setField('zip_code')} error={errors.zip_code} />
          </div>
        </div>

        <Checkbox
          label={t('dealerCheckbox')}
          defaultChecked={form.is_dealer}
          onChange={(checked) => setForm(prev => ({ ...prev, is_dealer: checked, street_address: checked ? prev.street_address : '' }))}
        />

        {form.is_dealer && (
          <>
            <Input label={t('businessName')} value={form.business_name} onChange={setField('business_name')} error={errors.business_name} />
            <AddressAutocomplete
              label={t('streetAddress')}
              value={form.street_address}
              onChange={(value) => {
                setForm(prev => ({ ...prev, street_address: value }));
                setErrors(prev => ({ ...prev, street_address: '' }));
              }}
              onAddressSelect={(address) => {
                setForm(prev => ({
                  ...prev,
                  street_address: address.street_address,
                  city: address.city || prev.city,
                  state: address.state || prev.state,
                  zip_code: address.zip_code || prev.zip_code,
                }));
                setErrors(prev => ({ ...prev, street_address: '', city: '', state: '', zip_code: '' }));
              }}
              error={errors.street_address}
            />
            <Input label={t('website')} value={form.website} onChange={setField('website')} error={errors.website} placeholder={t('optional')} />
          </>
        )}

        {errors.detail && <p className="text-accent text-sm">{errors.detail}</p>}

        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? t('creatingAccount') : t('signUp')}
        </Button>
        <p className="text-sm">
          {t('alreadyHaveAccount')} <Link href="/login" className="text-primary-light">{t('logIn')}</Link>
        </p>
      </Card>
    </form>
  );
}
