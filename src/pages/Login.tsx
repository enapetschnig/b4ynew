import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo-bau4you.png';

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/delegieren" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error('Anmeldung fehlgeschlagen', {
            description: error.message,
          });
        } else {
          toast.success('Willkommen zurück!');
        }
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          toast.error('Registrierung fehlgeschlagen', {
            description: error.message,
          });
        } else {
          toast.success('Konto erstellt!', {
            description: 'Sie können sich jetzt anmelden.',
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="px-6 py-8">
        <div className="flex items-center gap-3">
          <img src={logo} alt="BAU4YOU" className="h-12 w-auto" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col justify-center px-6 pb-12">
        <div className="max-w-sm mx-auto w-full">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            {isLogin ? 'Willkommen' : 'Konto erstellen'}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isLogin
              ? 'Melden Sie sich an, um fortzufahren'
              : 'Erstellen Sie Ihr Konto für Delegieren'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-sm font-medium">
                  Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Ihr Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-14 text-base rounded-xl bg-secondary/50 border-border/50 px-4"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                E-Mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ihre@email.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 text-base rounded-xl bg-secondary/50 border-border/50 pl-12 pr-4"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Passwort
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-14 text-base rounded-xl bg-secondary/50 border-border/50 pl-12 pr-4"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Anmelden' : 'Registrieren'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              {isLogin ? (
                <>
                  Noch kein Konto?{' '}
                  <span className="text-primary font-medium">Registrieren</span>
                </>
              ) : (
                <>
                  Bereits ein Konto?{' '}
                  <span className="text-primary font-medium">Anmelden</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
