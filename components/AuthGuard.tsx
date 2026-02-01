import React from 'react';
import { useAuth, useClerk, SignIn } from '@clerk/clerk-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Wraps vendor-only content. Shows sign-in if not authenticated.
 * Falls through transparently if Clerk isn't configured (dev mode).
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  let isLoaded = true;
  let isSignedIn = false;

  try {
    const auth = useAuth();
    isLoaded = auth.isLoaded;
    isSignedIn = !!auth.isSignedIn;
  } catch {
    // ClerkProvider not mounted (no key configured) — allow through
    return <>{children}</>;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <svg className="w-10 h-10 text-brand animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-neutral-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
        <div className="space-y-6 max-w-sm w-full text-center">
          {/* Logo */}
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              <span className="text-brand">Snap</span>
              <span className="text-white">Merch</span>
            </h1>
            <p className="text-neutral-400 mt-1 text-sm">Vendor sign-in required</p>
          </div>

          {/* Clerk SignIn component */}
          <div className="flex justify-center">
            <SignIn
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-surface-card border border-surface-border shadow-xl',
                  headerTitle: 'text-white',
                  headerSubtitle: 'text-neutral-400',
                  socialButtonsBlockButton: 'bg-surface-elevated border-surface-border text-white hover:bg-surface-card',
                  formFieldLabel: 'text-neutral-300',
                  formFieldInput: 'bg-surface-elevated border-surface-border text-white',
                  footerActionLink: 'text-brand hover:text-brand-light',
                  identityPreviewEditButton: 'text-brand',
                },
              }}
              routing="hash"
              signUpUrl="#/sign-up"
            />
          </div>

          {/* Branding */}
          <p className="text-neutral-600 text-xs">
            Powered by MyRestoMod
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
