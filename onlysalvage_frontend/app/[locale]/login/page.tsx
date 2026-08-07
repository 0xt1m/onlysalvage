import { Suspense } from 'react';
import { LoginForm } from '@/components/ui/LoginForm'
import { AuthInfoPanel } from '@/components/auth/AuthInfoPanel';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In",
};

export default async function LoginPage() {
  return <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex flex-col md:flex-row mb-3'>
    <Suspense>
      <LoginForm className='md:order-2' />
    </Suspense>
    <AuthInfoPanel className='md:flex-2/3 h-auto md:order-1' />
  </div>;
}
