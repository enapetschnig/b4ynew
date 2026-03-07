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
import Login from "./pages/Login";
import Delegieren from "./pages/Delegieren";
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
          <Route path="/delegieren" element={<Delegieren />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/kontakte" element={<AdminContacts />} />
          <Route path="/admin/benutzer" element={<AdminUsers />} />
          <Route path="/admin/nachrichten" element={<AdminMessages />} />
          <Route path="/admin/nachrichten/:id" element={<AdminMessageDetail />} />
          <Route path="/admin/einstellungen" element={<AdminSettings />} />
          <Route path="/admin/prompts" element={<AdminPrompts />} />
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
