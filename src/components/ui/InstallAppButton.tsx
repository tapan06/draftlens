import { useEffect, useState } from 'react';
import { Download, Check } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Кнопка установки веб-приложения (PWA) на рабочий стол ПК или телефон как отдельной программы.
 */
export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setDeferredPrompt(null);
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (installed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-win-high/40 bg-win-high/10 px-3 py-1.5 text-xs font-semibold text-win-high">
        <Check className="h-3.5 w-3.5" /> Установлено как приложение
      </span>
    );
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowHint((v) => !v);
    }
  };

  return (
    <Tooltip
      content={
        showHint
          ? 'В браузере нажми на иконку «Установить приложение» в правой части адресной строки (или Меню → Установить DraftLens), чтобы добавить ярлык на Рабочий стол.'
          : 'Установить DraftLens как отдельное приложение на ПК или телефон (без вкладок браузера)'
      }
    >
      <button onClick={handleInstall} type="button" className="btn-ghost btn-sm border-accent/35 text-accent hover:bg-accent/15">
        <Download className="h-3.5 w-3.5" /> Скачать как приложение
      </button>
    </Tooltip>
  );
}
