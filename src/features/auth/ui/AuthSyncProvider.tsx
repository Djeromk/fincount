'use client';

import { useAuthSync } from '../model/useAuthSync';

export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  useAuthSync();
  return <>{children}</>;
}
