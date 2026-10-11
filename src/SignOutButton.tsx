'use client';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from 'convex/react';
import { IconLogout } from '@tabler/icons-react';

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="inline-flex items-center gap-1.5 px-2 py-2 sm:px-4 sm:py-2 rounded bg-white text-secondary border border-gray-200 font-semibold hover:bg-gray-50 hover:text-secondary-hover transition-colors shadow-sm hover:shadow"
      onClick={() => void signOut()}
      title="Se déconnecter"
      aria-label="Se déconnecter"
    >
      <IconLogout size={18} className="sm:hidden" />
      <span className="hidden sm:inline">Se déconnecter</span>
    </button>
  );
}
