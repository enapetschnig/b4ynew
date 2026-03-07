import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Users, MessageSquare, Settings, ChevronRight, UserCog } from 'lucide-react';
import logo from '@/assets/logo-bau4you.png';

interface AdminMenuItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  path: string;
  badge?: string;
}

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const menuItems: AdminMenuItem[] = [
    {
      icon: <Users className="w-6 h-6" />,
      label: 'Kontakte',
      description: 'Kontakte verwalten, hinzufügen und bearbeiten',
      path: '/admin/kontakte',
    },
    {
      icon: <UserCog className="w-6 h-6" />,
      label: 'Benutzer',
      description: 'Benutzer und Rollen verwalten',
      path: '/admin/benutzer',
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      label: 'Nachrichten',
      description: 'Gesendete E-Mails und WhatsApp-Nachrichten',
      path: '/admin/nachrichten',
    },
    {
      icon: <Settings className="w-6 h-6" />,
      label: 'Einstellungen',
      description: 'Profil, Signatur und Antwort-Adresse',
      path: '/admin/einstellungen',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3 border-b border-border/50">
        <img src={logo} alt="BAU4YOU" className="h-8 w-auto" />
        <span className="font-display font-bold text-lg text-foreground">Admin</span>
      </header>

      {/* Menu */}
      <main className="flex-1 px-6 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Verwaltung</h1>
        
        <div className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => !item.badge && navigate(item.path)}
              disabled={!!item.badge}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${
                item.badge 
                  ? 'border-border/30 opacity-60 cursor-not-allowed' 
                  : 'border-border/50 hover:bg-secondary/50 hover:border-border'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
