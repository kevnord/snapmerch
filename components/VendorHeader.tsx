import React, { useState } from 'react';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { getTheme, toggleTheme, type Theme } from '../lib/theme';

/**
 * Compact header shown in vendor mode with user avatar/sign-out and theme toggle.
 */
export default function VendorHeader() {
  let isSignedIn = false;

  try {
    const auth = useAuth();
    isSignedIn = !!auth.isSignedIn;
  } catch {
    // No ClerkProvider — skip user button
    return <VendorHeaderShell />;
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

function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const handleToggle = () => {
    const next = toggleTheme();
    setThemeState(next);
  };

  return (
    <button
      onClick={handleToggle}
      className="w-8 h-8 flex items-center justify-center rounded-full
        bg-surface-elevated border border-surface-border
        text-foreground-muted hover:text-foreground
        active:scale-90 transition-all"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        /* Sun icon for switching to light */
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        /* Moon icon for switching to dark */
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function VendorHeaderShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface-card/80 backdrop-blur-sm border-b border-surface-border">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-black tracking-tight">
          <span className="text-brand">Snap</span>
          <span className="text-foreground">Merch</span>
        </h1>
        <span className="text-foreground-muted text-xs font-medium">VENDOR</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {children}
      </div>
    </div>
  );
}
