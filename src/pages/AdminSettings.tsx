import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Save, Mail, FileText, ChevronRight, Cpu, Smartphone, MessageCircle, Eye, EyeOff, Webhook, CheckCircle2, XCircle } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import logo from '@/assets/logo-bau4you.png';

interface Profile {
  display_name: string | null;
  signature: string | null;
  reply_to_email: string | null;
  default_channel: string | null;
  preferred_model: string | null;
  whapi_token: string | null;
  n8n_webhook_url: string | null;
  smtp_from_email: string | null;
}

export default function AdminSettings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { handleRestartInstallGuide } = useOnboarding();
  const [profile, setProfile] = useState<Profile>({
    display_name: '',
    signature: '',
    reply_to_email: '',
    default_channel: 'email',
    preferred_model: 'gemini',
    whapi_token: '',
    n8n_webhook_url: '',
    smtp_from_email: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showWhapiToken, setShowWhapiToken] = useState(false);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, signature, reply_to_email, default_channel, preferred_model, whapi_token, n8n_webhook_url, smtp_from_email')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!error && data) {
        setProfile({
          display_name: data.display_name || '',
          signature: data.signature || '',
          reply_to_email: data.reply_to_email || '',
          default_channel: data.default_channel || 'email',
          preferred_model: data.preferred_model || 'gemini',
          whapi_token: data.whapi_token || '',
          n8n_webhook_url: data.n8n_webhook_url || '',
          smtp_from_email: data.smtp_from_email || '',
        });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name || null,
          signature: profile.signature || null,
          reply_to_email: profile.reply_to_email || null,
          default_channel: profile.default_channel,
          preferred_model: profile.preferred_model,
          whapi_token: profile.whapi_token || null,
          n8n_webhook_url: profile.n8n_webhook_url || null,
          smtp_from_email: profile.smtp_from_email || null,
        })
        .eq('user_id', user.id);

      if (error) {
        toast.error('Fehler beim Speichern');
        console.error(error);
      } else {
        toast.success('Einstellungen gespeichert');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      toast.error('Fehler beim Speichern');
    }
    
    setIsSaving(false);
  };

  if (loading || isLoading) {
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
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin')} 
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logo} alt="BAU4YOU" className="h-8 w-auto cursor-pointer" onClick={() => navigate('/admin')} />
          <span className="font-display font-bold text-lg text-foreground">Einstellungen</span>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Speichern
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6 space-y-6 overflow-y-auto">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Dein Name und Signatur für E-Mails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Anzeigename</Label>
              <Input
                id="display_name"
                placeholder="z.B. Max Mustermann"
                value={profile.display_name || ''}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Wird als Absendername in E-Mails verwendet
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signature">Signatur</Label>
              <Textarea
                id="signature"
                placeholder="Mit freundlichen Grüßen,&#10;Max Mustermann"
                value={profile.signature || ''}
                onChange={(e) => setProfile({ ...profile, signature: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Reply-To Card */}
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <CardTitle>Antwort-Adresse (Reply-To)</CardTitle>
            </div>
            <CardDescription>
              Wenn jemand auf deine E-Mail antwortet, geht die Antwort an diese Adresse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reply_to_email">E-Mail für Antworten</Label>
              <Input
                id="reply_to_email"
                type="email"
                placeholder="z.B. deine@firma.at"
                value={profile.reply_to_email || ''}
                onChange={(e) => setProfile({ ...profile, reply_to_email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Die E-Mails werden weiterhin über unseren Server versendet, aber Antworten landen in deinem Postfach
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Email Gateway (n8n) Card */}
        <Card className="border-blue-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-blue-500" />
                <CardTitle>Email Gateway (n8n)</CardTitle>
              </div>
              {profile.n8n_webhook_url && profile.smtp_from_email ? (
                <div className="flex items-center gap-1 text-green-500">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Konfiguriert</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <XCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Nicht konfiguriert</span>
                </div>
              )}
            </div>
            <CardDescription>
              Verbinde deinen n8n-Workflow fuer den E-Mail-Versand
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="n8n_webhook_url">n8n Webhook-URL</Label>
              <Input
                id="n8n_webhook_url"
                type="url"
                placeholder="https://dein-n8n.app/webhook/..."
                value={profile.n8n_webhook_url || ''}
                onChange={(e) => setProfile({ ...profile, n8n_webhook_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Die Webhook-URL deines n8n E-Mail-Workflows
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_from_email">Absender-Email (From)</Label>
              <Input
                id="smtp_from_email"
                type="email"
                placeholder="z.B. office@deinefirma.at"
                value={profile.smtp_from_email || ''}
                onChange={(e) => setProfile({ ...profile, smtp_from_email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Diese Adresse wird als Absender in E-Mails angezeigt
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Model Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              <CardTitle>KI-Modell</CardTitle>
            </div>
            <CardDescription>
              Wähle das KI-Modell für die Textverarbeitung
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferred_model">Bevorzugtes Modell</Label>
              <Select
                value={profile.preferred_model || 'gemini'}
                onValueChange={(value) => setProfile({ ...profile, preferred_model: value })}
              >
                <SelectTrigger id="preferred_model">
                  <SelectValue placeholder="Modell auswählen" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="z-[9999]">
                  <SelectItem value="gemini">Gemini (Google)</SelectItem>
                  <SelectItem value="openai">GPT-5 (OpenAI)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Beide Modelle liefern hochwertige Ergebnisse. Bei Problemen kann ein Wechsel helfen.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp API Card */}
        <Card className="border-green-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <CardTitle>WhatsApp API-Schlüssel</CardTitle>
            </div>
            <CardDescription>
              Dein persönlicher WHAPI-Token für den WhatsApp-Versand
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whapi_token">WHAPI Token</Label>
              <div className="relative">
                <Input
                  id="whapi_token"
                  type={showWhapiToken ? 'text' : 'password'}
                  placeholder="Dein WHAPI API-Schlüssel"
                  value={profile.whapi_token || ''}
                  onChange={(e) => setProfile({ ...profile, whapi_token: e.target.value })}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowWhapiToken(!showWhapiToken)}
                >
                  {showWhapiToken ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Wenn leer, wird der globale WHAPI-Token verwendet (falls vorhanden)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Prompt Management Link */}
        <Card 
          className="cursor-pointer hover:bg-secondary/30 transition-colors"
          onClick={() => navigate('/admin/prompts')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle>Prompt-Verwaltung</CardTitle>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <CardDescription>
              Bearbeite den KI-Prompt für E-Mails mit Versionierung und Rollback
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Install App Guide Link */}
        <Card 
          className="cursor-pointer hover:bg-secondary/30 transition-colors"
          onClick={handleRestartInstallGuide}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <CardTitle>App installieren</CardTitle>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <CardDescription>
              Anleitung zum Hinzufügen auf den Startbildschirm
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
