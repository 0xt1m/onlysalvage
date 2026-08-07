import { SignUpForm } from '@/components/ui/SignUpForm';
import { AuthInfoPanel } from '@/components/auth/AuthInfoPanel';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default async function SignUpPage() {
  const t = await getTranslations('Auth');

  return <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex flex-col md:flex-row mb-3'>
    <AuthInfoPanel eyebrow={t('signUpTitle')} className='md:flex-2/3 h-auto' />
    <SignUpForm />
  </div>;
}
