import { useLocation, useNavigate } from 'react-router-dom';
import { Send, FileSpreadsheet, FileText, Settings } from 'lucide-react';

const tabs = [
  { label: 'Delegieren', icon: Send, path: '/delegieren' },
  { label: 'Preisliste', icon: FileSpreadsheet, path: '/preisliste' },
  { label: 'Angebote', icon: FileText, path: '/angebote', disabled: true },
  { label: 'Admin', icon: Settings, path: '/admin' },
] as const;

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname.startsWith('/admin');
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="bg-background/80 backdrop-blur-xl border-t border-border/50">
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                onClick={() => !tab.disabled && navigate(tab.path)}
                disabled={tab.disabled}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg min-w-[64px] transition-colors ${
                  tab.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                {tab.disabled && (
                  <span className="text-[8px] text-muted-foreground leading-none">Bald</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
