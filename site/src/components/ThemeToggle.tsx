import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Alternância instantânea entre tema claro e escuro. Com o tema em "Automático",
// parte do tema atual do sistema e, ao clicar, fixa a escolha do usuário.
export function ThemeToggle() {
  const { data, dispatch } = useStore();
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const theme = data.settings.theme;
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  const choose = (dark: boolean) => dispatch({ type: 'setSettings', settings: { theme: dark ? 'dark' : 'light' } });

  return (
    <div className="theme-toggle" role="group" aria-label="Tema">
      <button type="button" aria-pressed={!isDark} aria-label="Tema claro" title="Tema claro" onClick={() => choose(false)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <span>Claro</span>
      </button>
      <button type="button" aria-pressed={isDark} aria-label="Tema escuro" title="Tema escuro" onClick={() => choose(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
        <span>Escuro</span>
      </button>
    </div>
  );
}
