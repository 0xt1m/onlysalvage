import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/ui/ResetPasswordForm';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function ResetPasswordPage() {
  return <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex mb-3'>
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  </div>;
}
