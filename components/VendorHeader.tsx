import React from 'react';
import { useAuth, UserButton } from '@clerk/clerk-react';

/**
 * Compact header shown in vendor mode with user avatar/sign-out.
 * Only renders the user button if signed in.
 */
export default function VendorHeader() {
  let isSignedIn = false;

  try {
    const auth = useAuth();
    isSignedIn = !!auth.isSignedIn;
  } catch {
    // No ClerkProvider — skip user button
    return (
      <VendorHeaderShell />
    );
  }

  return (
    <VendorHeaderShell>
      {isSignedIn && (
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
            },
          }}
        />
      )}
    </VendorHeaderShell>
  );
}

function VendorHeaderShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface-card/80 backdrop-blur-sm border-b border-surface-border">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-black tracking-tight">
          <span className="text-brand">Snap</span>
          <span className="text-white">Merch</span>
        </h1>
        <span className="text-neutral-500 text-xs font-medium">VENDOR</span>
      </div>
      {children}
    </div>
  );
}
