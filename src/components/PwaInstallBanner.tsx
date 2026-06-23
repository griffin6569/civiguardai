import { useEffect, useState } from "react";
import { Download, Shield, X } from "lucide-react";

const isStandalone = () => {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
};

const PwaInstallBanner = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandalone());

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallPrompt(event);
      if (!isStandalone()) {
        setIsVisible(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setInstallPrompt(null);
      setIsInstalling(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt || isInstalling) return;

    setIsInstalling(true);

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      setInstallPrompt(null);
      setIsInstalling(false);
      setIsVisible(false);
    }
  };

  if (!installPrompt || !isVisible || isInstalled) return null;

  return (
    <div className="fixed left-4 right-4 bottom-24 z-50 md:left-6 md:right-auto md:bottom-6 md:w-[380px]">
      <div className="rounded-2xl border border-glow bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="absolute inset-0 gradient-radial pointer-events-none" />
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/12">
              <Shield className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-sm font-semibold text-foreground">Install CiviGuard AI</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Add the app to your device for faster access, full-screen monitoring, and a cleaner mobile experience.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVisible(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Dismiss install prompt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Download className="h-4 w-4" />
                  {isInstalling ? "Opening installer..." : "Install app"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsVisible(false)}
                  className="rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm text-secondary-foreground transition-colors hover:bg-secondary"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
