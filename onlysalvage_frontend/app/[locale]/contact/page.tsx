import { redirect } from '@/i18n/navigation';

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/support', locale });
}
