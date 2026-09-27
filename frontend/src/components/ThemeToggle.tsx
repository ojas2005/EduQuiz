import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type Theme = 'light' | 'dark';
const preferenceKey = 'eduquiz:theme';
function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(preferenceKey);
    return value === 'light' || value === 'dark' ? value : null;
  } catch { return null; }
}
function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() || systemTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191c19' : '#f6f4ed');
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = () => { if (!savedTheme()) setTheme(systemTheme()); };
    const syncTabs = (event: StorageEvent) => {
      if (event.key === preferenceKey || event.key === null) setTheme(savedTheme() || systemTheme());
    };
    media.addEventListener('change', followSystem);
    window.addEventListener('storage', syncTabs);
    return () => {
      media.removeEventListener('change', followSystem);
      window.removeEventListener('storage', syncTabs);
    };
  }, []);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(preferenceKey, next); } catch { /* Still works for this visit. */ }
    setTheme(next);
  }
  return { theme, toggleTheme };
}
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === 'dark';
  return <button type="button" className="theme-toggle" role="switch" aria-checked={dark}
    aria-label="Dark mode" title={`Switch to ${dark ? 'light' : 'dark'} mode`} onClick={onToggle}>
    {dark ? <Moon size={18} aria-hidden="true"/> : <Sun size={18} aria-hidden="true"/>}
    <span>{dark ? 'Dark' : 'Light'}</span>
  </button>;
}
