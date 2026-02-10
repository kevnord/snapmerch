// SnapMerch Theme System
// Supports light/dark toggle via data-theme attribute on <html>

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'snapmerch-theme';

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  // Default to dark (original theme)
  return 'dark';
}

function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);

  // Toggle Tailwind dark class
  if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  // Update meta theme-color for mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#fafafa');
  }
}

/**
 * Call before React render to prevent flash of wrong theme.
 */
export function initTheme(): void {
  applyTheme(getTheme());
}
