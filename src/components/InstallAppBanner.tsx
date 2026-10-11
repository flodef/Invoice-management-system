import { IconDeviceMobileDown, IconX } from '@tabler/icons-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * Bannière « Installer l'application » — n'apparaît que quand Chrome/Edge
 * propose l'installation (beforeinstallprompt) et que l'utilisateur ne
 * l'a pas fermée. L'entrée Profil reste disponible quelle que soit la
 * bannière.
 */
export function InstallAppBanner() {
  const { canInstall, dismissed, promptInstall, dismiss } = useInstallPrompt();
  if (!canInstall || dismissed) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <IconDeviceMobileDown size={22} className="shrink-0 text-blue-600" />
      <p className="min-w-0 flex-1 text-sm text-blue-900">
        Installez l'application sur cet appareil pour y accéder comme une app — lancement direct, plein écran,
        disponible hors connexion.
      </p>
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Installer
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="shrink-0 rounded-md p-1 text-blue-500 hover:bg-blue-100"
      >
        <IconX size={16} />
      </button>
    </div>
  );
}
