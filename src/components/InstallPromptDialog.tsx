import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, CheckCircle2, Share2, MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";

interface InstallPromptDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InstallPromptDialog({ open, onClose }: InstallPromptDialogProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'ios' | 'android' | null>(null);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    if (isStandalone) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      toast.success("App installiert!", {
        description: "Die App wurde erfolgreich auf deinem Gerät installiert.",
      });
    };

    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isStandalone]);

  const handlePlatformSelect = (platform: 'ios' | 'android') => {
    setSelectedPlatform(platform);
    if (platform === 'ios') {
      setShowManualGuide(true);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.error("Installation nicht verfügbar", {
        description: "Bitte nutze die manuelle Anleitung für dein Gerät.",
      });
      setShowManualGuide(true);
      return;
    }

    (deferredPrompt as any).prompt();
    const { outcome } = await (deferredPrompt as any).userChoice;

    if (outcome === 'accepted') {
      toast.success("Installation gestartet", {
        description: "Die App wird jetzt installiert...",
      });
      onClose();
    }

    setDeferredPrompt(null);
  };

  const handleShowManual = () => {
    setShowManualGuide(true);
  };

  const handleBack = () => {
    if (showManualGuide) {
      setShowManualGuide(false);
      if (selectedPlatform === 'ios') {
        setSelectedPlatform(null);
      }
    } else if (selectedPlatform) {
      setSelectedPlatform(null);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            {isInstalled
              ? "App bereits installiert!"
              : showManualGuide
                ? "Installationsanleitung"
                : "App installieren"}
          </DialogTitle>
          <DialogDescription>
            {isInstalled
              ? "Die App ist bereits installiert! Du kannst sie jederzeit verwenden."
              : showManualGuide
                ? "Folge diesen Schritten, um die App zu installieren:"
                : "Wähle zuerst deine Plattform aus:"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Platform Selection */}
        {!isInstalled && !selectedPlatform && !showManualGuide && (
          <div className="space-y-3">
            <Card
              className="cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={() => handlePlatformSelect('ios')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-secondary">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-base">iOS / iPhone / iPad</CardTitle>
                    <CardDescription>Für Apple-Geräte (Safari)</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={() => handlePlatformSelect('android')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-secondary">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25 0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25c0 .69-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25 0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25c0 .69-.56 1.25-1.25 1.25z"/>
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-base">Android / Desktop</CardTitle>
                    <CardDescription>Für Android und Desktop-Browser</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Step 2: Android Installation Options */}
        {!isInstalled && selectedPlatform === 'android' && !showManualGuide && (
          <div className="space-y-3">
            <Card
              className="cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={handleInstallClick}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Direkt installieren</CardTitle>
                    <CardDescription>
                      {deferredPrompt
                        ? "Installation mit einem Klick starten"
                        : "Auf diesem Gerät nicht verfügbar"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={handleShowManual}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-secondary">
                    <MoreVertical className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Anleitung ansehen</CardTitle>
                    <CardDescription>Schritt-für-Schritt Anleitung</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Step 3: Manual Guide */}
        {showManualGuide && !isInstalled && (
          <div className="space-y-4">
            {selectedPlatform === 'ios' ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Tippe auf das Teilen-Symbol</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12" />
                        <path d="m8 7 4-4 4 4" />
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                      </svg>
                      (Quadrat mit Pfeil nach oben)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Scrolle und wähle</p>
                    <p className="text-sm text-muted-foreground">"Zum Home-Bildschirm"</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Tippe auf "Hinzufügen"</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Tippe auf das Menü-Symbol</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MoreVertical className="w-4 h-4" /> (drei Punkte oben rechts)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Wähle</p>
                    <p className="text-sm text-muted-foreground">"App installieren" oder "Zum Startbildschirm hinzufügen"</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Bestätige mit "Installieren"</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-secondary/50 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-sm">Du findest die App dann immer am Homebildschirm</p>
            </div>
          </div>
        )}

        {/* App Already Installed */}
        {isInstalled && (
          <div className="bg-secondary/50 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium">App bereits installiert!</p>
              <p className="text-sm text-muted-foreground">Du kannst die App jederzeit verwenden.</p>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between gap-2 pt-2">
          {((selectedPlatform && !showManualGuide && selectedPlatform === 'android') || showManualGuide) && !isInstalled && (
            <Button variant="outline" onClick={handleBack}>
              Zurück
            </Button>
          )}
          <Button
            className="ml-auto"
            onClick={onClose}
          >
            {isInstalled ? "Fertig" : showManualGuide ? "Verstanden" : "Später"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
