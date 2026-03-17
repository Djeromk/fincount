'use client';

import { LoginForm } from '@/features/auth/ui/LoginForm';
import { OAuthButtons } from '@/features/auth/ui/OAuthButtons';
import { useRedirectIfAuthenticated } from '@/shared/hooks/useRedirectIfAuthenticated';

export default function LoginPage() {
  useRedirectIfAuthenticated();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Finsight</h1>

        <OAuthButtons />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Или через email</span>
          </div>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
