import { IconDeviceDesktop, IconDeviceMobile, IconDeviceTablet, IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from '../utils/theme';

/**
 * Three-way theme toggle — system / light / dark — same look as the Job
 * Conciergerie landing's. `data-theme-opt` + :root[data-theme] CSS keeps the
 * active state correct before hydration (no flash).
 */
export function ThemeToggle() {
  const { mode, set, ready } = useTheme();
  const activeMode = ready ? mode : null;
  const btnClass =
    'theme-opt rounded-full w-7 h-7 flex items-center justify-center transition-all hover:text-slate-700 dark:hover:text-slate-200 overflow-hidden cursor-pointer';
  return (
    <div
      role="radiogroup"
      aria-label="Thème"
      className="inline-grid grid-cols-3 gap-0.5 rounded-full p-1 shrink-0 bg-slate-200/70 dark:bg-slate-700/60 border border-slate-300/70 dark:border-slate-600/60 text-slate-500 dark:text-slate-400"
    >
      <button
        type="button"
        onClick={() => set('system')}
        title="Système"
        aria-label="Système"
        aria-checked={activeMode === 'system'}
        disabled={!ready}
        role="radio"
        data-theme-opt="system"
        className={btnClass}
      >
        <IconDeviceDesktop size={16} className="hidden md:block" />
        <IconDeviceTablet size={16} className="hidden sm:block md:hidden" />
        <IconDeviceMobile size={16} className="sm:hidden" />
      </button>
      {(
        [
          { value: 'light', icon: IconSun, label: 'Clair' },
          { value: 'dark', icon: IconMoon, label: 'Sombre' },
        ] as const
      ).map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => set(opt.value)}
          title={opt.label}
          aria-label={opt.label}
          aria-checked={activeMode === opt.value}
          disabled={!ready}
          role="radio"
          data-theme-opt={opt.value}
          className={btnClass}
        >
          <opt.icon size={16} />
        </button>
      ))}
    </div>
  );
}
