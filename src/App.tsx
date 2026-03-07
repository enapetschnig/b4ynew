import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { OnboardingProvider, useOnboarding } from "@/contexts/OnboardingContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InstallPromptDialog } from "@/components/InstallPromptDialog";
import { AppLayout } from "./components/AppLayout";
import Login from "./pages/Login";
import Delegieren from "./pages/Delegieren";
import Preisliste from "./pages/Preisliste";
import Angebote from "./pages/Angebote";
import Admin from "./pages/Admin";
import AdminContacts from "./pages/AdminContacts";
import AdminSettings from "./pages/AdminSettings";
import AdminPrompts from "./pages/AdminPrompts";
import AdminUsers from "./pages/AdminUsers";
import AdminMessages from "./pages/AdminMessages";
import AdminMessageDetail from "./pages/AdminMessageDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const { showInstallDialog, handleInstallDialogClose } = useOnboarding();

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/delegieren" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/delegieren" element={<AppLayout><Delegieren /></AppLayout>} />
          <Route path="/preisliste" element={<AppLayout><Preisliste /></AppLayout>} />
          <Route path="/angebote" element={<AppLayout><Angebote /></AppLayout>} />
          <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
          <Route path="/admin/kontakte" element={<AppLayout><AdminContacts /></AppLayout>} />
          <Route path="/admin/benutzer" element={<AppLayout><AdminUsers /></AppLayout>} />
          <Route path="/admin/nachrichten" element={<AppLayout><AdminMessages /></AppLayout>} />
          <Route path="/admin/nachrichten/:id" element={<AppLayout><AdminMessageDetail /></AppLayout>} />
          <Route path="/admin/einstellungen" element={<AppLayout><AdminSettings /></AppLayout>} />
          <Route path="/admin/prompts" element={<AppLayout><AdminPrompts /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <InstallPromptDialog open={showInstallDialog} onClose={handleInstallDialogClose} />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <OnboardingProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </OnboardingProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
