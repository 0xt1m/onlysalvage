import { ForgotPasswordForm } from '@/components/ui/ForgotPasswordForm';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex mb-3'>
    <ForgotPasswordForm />
  </div>;
}
