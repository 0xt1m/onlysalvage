import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { getProfile, getListingsBySeller } from '@/lib/api';
import { getMeServer, getApiKeyStatusServer } from '@/lib/api-server';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { ApiKeySection } from '@/components/settings/ApiKeySection';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { DeleteAccountButton } from '@/components/profile/DeleteAccountButton';
import { getTranslations } from 'next-intl/server';
import type { Profile } from '@/lib/types';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  const t = await getTranslations('Settings');

  const me: { username: string; email?: string; verification_status?: Profile['verification_status'] } | null =
    await getMeServer();

  // The middleware already gates /settings behind login, so this is just a
  // safety net for the rare case a request slips through with a cookie that
  // looks present but the API still doesn't recognize it as authenticated.
  if (!me) {
    redirect('/login');
  }

  const profile: Profile | null = await getProfile(me.username);

  if (!profile) {
    redirect('/login');
  }

  const warrantyListings = profile.is_dealer ? await getListingsBySeller(profile.id) : [];
  const apiKeyStatus = await getApiKeyStatusServer();

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 pb-20 gap-3 flex flex-col">
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbSettings') }]} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <Link href={`/profile/${profile.username}`}>
            <Button variant="secondary" size="sm">{t('viewPublicProfile')}</Button>
          </Link>
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row w-full gap-3">
        <Card className="w-full lg:basis-1/5 h-fit lg:sticky lg:top-26 lg:self-start">
          <Link href="#profile"><Button variant="secondary" className="w-full">{t('navProfile')}</Button></Link>
          {profile.is_dealer && (
            <Link href="#warranty"><Button variant="ghost" className="w-full">{t('navWarranty')}</Button></Link>
          )}
          <Link href="#api"><Button variant="ghost" className="w-full">{t('navApi')}</Button></Link>
          <Link href="#security"><Button variant="ghost" className="w-full">{t('navSecurity')}</Button></Link>
        </Card>

        <div className="flex flex-col gap-3 w-full lg:basis-4/5">
          <SettingsForm
            profile={profile}
            email={me.email}
            verificationStatus={me.verification_status ?? 'none'}
            warrantyListings={warrantyListings}
          />

          <ApiKeySection initialStatus={apiKeyStatus} isVerified={profile.is_verified ?? false} />

          <Card id="security" className="scroll-mt-26">
            <h3 className="text-lg font-semibold">{t('securityTitle')}</h3>
            <ChangePasswordForm />
            <p className="text-sm text-muted mt-2">
              {t('usernameChangeQuestion')} <a href="mailto:support@onlysalvage.com" className="text-primary-light hover:underline">{t('contactSupport')}</a> {t('usernameChangeNotSupported')}
            </p>
            <div className="border-t border-border mt-4 pt-4 flex flex-col gap-2 items-start">
              {/* <h4 className="text-sm font-semibold text-error">{t('dangerZone')}</h4> */}
              <DeleteAccountButton />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
