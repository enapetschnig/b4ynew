import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, FileText } from 'lucide-react';
import logo from '@/assets/logo-bau4you.png';

export default function Angebote() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top">
      <header className="px-6 py-4 flex items-center gap-3 border-b border-border/50">
        <img src={logo} alt="BAU4YOU" className="h-8 w-auto" />
        <span className="font-display font-bold text-lg text-foreground">Angebote</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Bald verfügbar</h2>
        <p className="text-muted-foreground text-center text-sm max-w-xs">
          Hier kannst du bald Angebote per Sprachnachricht erstellen und verwalten.
        </p>
      </main>
    </div>
  );
}
