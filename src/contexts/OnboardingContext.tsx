import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface OnboardingContextType {
  showInstallDialog: boolean;
  setShowInstallDialog: (show: boolean) => void;
  handleRestartInstallGuide: () => void;
  handleInstallDialogClose: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const SESSION_KEY = 'onboarding_dialog_shown_this_session';

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    let isMounted = true;
    let hasCheckedLocal = false;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('OnboardingContext: session recovery failed:', error.message);
        return;
      }
      setUserId(session?.user?.id ?? null);
      if (session?.user && !hasCheckedLocal) {
        hasCheckedLocal = true;
        checkIfShouldShowInstallGuide(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        setUserId(session?.user?.id ?? null);
        
        if (event === 'SIGNED_IN' && session?.user && !hasCheckedLocal) {
          hasCheckedLocal = true;
          setTimeout(() => {
            if (isMounted) {
              checkIfShouldShowInstallGuide(session.user.id);
            }
          }, 500);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkIfShouldShowInstallGuide = async (currentUserId: string, retryCount = 0) => {
    // Only show on mobile/tablet devices
    if (!isMobile) {
      return;
    }

    // Skip if already shown in this session
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      return;
    }

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("anleitung_completed")
      .eq("user_id", currentUserId)
      .maybeSingle();

    // Retry if profile doesn't exist yet (trigger may not have run)
    if (!profileData && retryCount < 3) {
      setTimeout(() => {
        checkIfShouldShowInstallGuide(currentUserId, retryCount + 1);
      }, 1000);
      return;
    }

    // Don't show if already completed
    if (profileData?.anleitung_completed === true) {
      return;
    }

    // Show dialog for new users or those who haven't completed it
    if (!profileData || profileData.anleitung_completed === false) {
      setShowInstallDialog(true);
      sessionStorage.setItem(SESSION_KEY, 'true');
    }
  };

  const handleRestartInstallGuide = () => {
    setShowInstallDialog(true);
  };

  const handleInstallDialogClose = async () => {
    if (userId) {
      await supabase
        .from('profiles')
        .update({ anleitung_completed: true })
        .eq('user_id', userId);
    }
    setShowInstallDialog(false);
  };

  return (
    <OnboardingContext.Provider
      value={{
        showInstallDialog,
        setShowInstallDialog,
        handleRestartInstallGuide,
        handleInstallDialogClose,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
