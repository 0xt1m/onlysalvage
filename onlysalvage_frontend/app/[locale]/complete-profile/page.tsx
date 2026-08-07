import { redirect } from '@/i18n/navigation';
import { getMeServer } from '@/lib/api-server';
import { CompleteProfileForm } from '@/components/auth/CompleteProfileForm';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Complete Your Profile",
};

export default async function CompleteProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const me = await getMeServer();

  if (!me) {
    redirect({ href: '/login', locale });
  }
  if (me.profile_complete) {
    redirect({ href: '/', locale });
  }

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-8 mb-6 flex flex-col">
      <CompleteProfileForm />
    </div>
  );
}
