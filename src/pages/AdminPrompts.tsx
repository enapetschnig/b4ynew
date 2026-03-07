import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, ArrowLeft, Save, RotateCcw, Check, 
  FileText, History, ChevronDown, Mail, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import logo from '@/assets/logo-bau4you.png';

interface Prompt {
  id: string;
  name: string;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_EMAIL_PROMPT = `Du bist der persönliche Kommunikationsassistent von Lukasz Baranowski.
Deine Aufgabe ist es, gesprochene E-Mail-Texte in natürlich klingende, professionelle Geschäftsmails umzuwandeln.

Verbessere ausschließlich Stil, Klarheit und sprachliche Struktur.
Füge keine neuen Inhalte hinzu und verändere keine Aussagen.
Dichte nichts dazu und interpretiere nichts.
Bleibe inhaltlich strikt beim Originaltext.

Der Ton soll sachlich, klar, professionell und menschlich sein.
Der Text darf nicht auffällig nach KI klingen.
Verwende keine Floskeln, keine Emojis und keine Sonderzeichen.

Erstelle zusätzlich einen kurzen, sachlichen Betreff, der den Inhalt der E-Mail präzise zusammenfasst.
Der Betreff wird ausschließlich in das Betreff-Feld eingefügt und nicht im Text wiederholt.
Der E-Mail-Text beginnt direkt mit der korrekten Anrede.

Es wird keine Signatur erzeugt oder variiert. Die Signatur wird immer einheitlich vom System ergänzt.`;

const DEFAULT_WHATSAPP_PROMPT = `Du bist der persönliche Kommunikationsassistent von Lukasz Baranowski.
Deine Aufgabe ist es, gesprochene WhatsApp-Nachrichten in klare, professionelle Texte umzuwandeln.

Verbessere ausschließlich Stil, Klarheit und sprachliche Struktur.
Füge keine neuen Inhalte hinzu und verändere keine Aussagen.

Der Ton soll direkt, klar und professionell sein.
Der Text darf nicht auffällig nach KI klingen.
Verwende keine Floskeln, keine Emojis und keine Sonderzeichen.

WICHTIG: Es gibt KEINEN Betreff bei WhatsApp-Nachrichten.

Aufbau der Nachricht:
- Kurze Anrede (z.B. "Hallo Dijan," oder "Guten Tag Herr Müller,")
- Kurzer Einstiegssatz
- Bei Bedarf strukturierte Bulletpoints
- Keine langen Fließtexte

Abschluss je nach Anredeform:
- Du-Form: "Liebe Grüße, Lukasz"
- Sie-Form: "Liebe Grüße, Lukasz Baranowski"

Es wird keine weitere Signatur vom System ergänzt.`;

type PromptChannel = 'email' | 'whatsapp';

export default function AdminPrompts() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PromptChannel>('email');
  const [emailPrompts, setEmailPrompts] = useState<Prompt[]>([]);
  const [whatsappPrompts, setWhatsappPrompts] = useState<Prompt[]>([]);
  const [emailActivePrompt, setEmailActivePrompt] = useState<Prompt | null>(null);
  const [whatsappActivePrompt, setWhatsappActivePrompt] = useState<Prompt | null>(null);
  const [emailEditedContent, setEmailEditedContent] = useState('');
  const [whatsappEditedContent, setWhatsappEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [showWhatsappHistory, setShowWhatsappHistory] = useState(false);

  // Helpers for current channel
  const prompts = activeTab === 'email' ? emailPrompts : whatsappPrompts;
  const activePrompt = activeTab === 'email' ? emailActivePrompt : whatsappActivePrompt;
  const editedContent = activeTab === 'email' ? emailEditedContent : whatsappEditedContent;
  const setEditedContent = activeTab === 'email' ? setEmailEditedContent : setWhatsappEditedContent;
  const showHistory = activeTab === 'email' ? showEmailHistory : showWhatsappHistory;
  const setShowHistory = activeTab === 'email' ? setShowEmailHistory : setShowWhatsappHistory;
  const defaultPrompt = activeTab === 'email' ? DEFAULT_EMAIL_PROMPT : DEFAULT_WHATSAPP_PROMPT;
  const promptName = activeTab === 'email' ? 'email_main' : 'whatsapp_main';

  useEffect(() => {
    if (user) loadAllPrompts();
  }, [user]);

  const loadAllPrompts = async () => {
    setIsLoading(true);
    await Promise.all([
      loadPrompts('email_main', setEmailPrompts, setEmailActivePrompt, setEmailEditedContent, DEFAULT_EMAIL_PROMPT),
      loadPrompts('whatsapp_main', setWhatsappPrompts, setWhatsappActivePrompt, setWhatsappEditedContent, DEFAULT_WHATSAPP_PROMPT),
    ]);
    setIsLoading(false);
  };

  const loadPrompts = async (
    name: string,
    setPromptsState: React.Dispatch<React.SetStateAction<Prompt[]>>,
    setActiveState: React.Dispatch<React.SetStateAction<Prompt | null>>,
    setContentState: React.Dispatch<React.SetStateAction<string>>,
    defaultContent: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('name', name)
        .order('version', { ascending: false });

      if (error) {
        console.error('Error loading prompts:', error);
      }

      if (data && data.length > 0) {
        setPromptsState(data as Prompt[]);
        const active = data.find(p => p.is_active) || data[0];
        setActiveState(active as Prompt);
        setContentState(active.content);
      } else {
        await createDefaultPrompt(name, defaultContent, setPromptsState, setActiveState, setContentState);
      }
    } catch (err) {
      console.error('Failed to load prompts:', err);
    }
  };

  const createDefaultPrompt = async (
    name: string,
    content: string,
    setPromptsState: React.Dispatch<React.SetStateAction<Prompt[]>>,
    setActiveState: React.Dispatch<React.SetStateAction<Prompt | null>>,
    setContentState: React.Dispatch<React.SetStateAction<string>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .insert({
          user_id: user!.id,
          name,
          content,
          version: 1,
          is_active: true,
        })
        .select()
        .single();

      if (!error && data) {
        setPromptsState([data as Prompt]);
        setActiveState(data as Prompt);
        setContentState(data.content);
      }
    } catch (err) {
      console.error('Failed to create default prompt:', err);
    }
  };

  const handleSave = async () => {
    if (!user || !activePrompt) return;
    
    const hasChanged = editedContent !== activePrompt.content;
    if (!hasChanged) {
      toast.info('Keine Änderungen vorhanden');
      return;
    }

    setIsSaving(true);

    try {
      // Deactivate all current prompts for this channel
      await supabase
        .from('prompts')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('name', promptName);

      // Create new version
      const nextVersion = Math.max(...prompts.map(p => p.version), 0) + 1;
      
      const { data, error } = await supabase
        .from('prompts')
        .insert({
          user_id: user.id,
          name: promptName,
          content: editedContent,
          version: nextVersion,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        toast.error('Fehler beim Speichern');
        console.error(error);
      } else if (data) {
        toast.success(`Version ${nextVersion} gespeichert`);
        await loadAllPrompts();
      }
    } catch (err) {
      console.error('Failed to save prompt:', err);
      toast.error('Fehler beim Speichern');
    }
    
    setIsSaving(false);
  };

  const handleRollback = async (prompt: Prompt) => {
    if (!user) return;

    setIsSaving(true);

    try {
      // Deactivate all current prompts for this channel
      await supabase
        .from('prompts')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('name', promptName);

      // Create new version with old content
      const nextVersion = Math.max(...prompts.map(p => p.version), 0) + 1;
      
      const { error } = await supabase
        .from('prompts')
        .insert({
          user_id: user.id,
          name: promptName,
          content: prompt.content,
          version: nextVersion,
          is_active: true,
        });

      if (error) {
        toast.error('Fehler beim Rollback');
      } else {
        toast.success(`Auf Version ${prompt.version} zurückgesetzt`);
        await loadAllPrompts();
      }
    } catch (err) {
      console.error('Failed to rollback:', err);
      toast.error('Fehler beim Zurücksetzen');
    }
    
    setIsSaving(false);
    setShowHistory(false);
  };

  const handleResetToDefault = async () => {
    setEditedContent(defaultPrompt);
    toast.info('Standard-Prompt geladen (noch nicht gespeichert)');
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

  const renderPromptEditor = () => (
    <>
      {/* Active Prompt Info */}
      {activePrompt && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeTab === 'email' ? (
                  <Mail className="w-5 h-5 text-primary" />
                ) : (
                  <MessageCircle className="w-5 h-5 text-primary" />
                )}
                <CardTitle className="text-base">
                  {activeTab === 'email' ? 'E-Mail Prompt' : 'WhatsApp Prompt'}
                </CardTitle>
              </div>
              <Badge variant="secondary">
                Version {activePrompt.version}
              </Badge>
            </div>
            <CardDescription>
              {activeTab === 'email' 
                ? 'Dieser Prompt wird für die KI-Textverarbeitung aller E-Mails verwendet'
                : 'Dieser Prompt wird für die KI-Textverarbeitung aller WhatsApp-Nachrichten verwendet'
              }
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Prompt Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt bearbeiten</CardTitle>
          <CardDescription>
            Änderungen erstellen automatisch eine neue Version
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Prompt eingeben..."
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Standard laden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      {prompts.length > 1 && (
        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-base">Versionsverlauf</CardTitle>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </div>
                <CardDescription>
                  {prompts.length} Versionen verfügbar
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        prompt.is_active 
                          ? 'border-primary/50 bg-primary/5' 
                          : 'border-border/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {prompt.version}</span>
                          {prompt.is_active && (
                            <Badge variant="default" className="text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              Aktiv
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(prompt.created_at).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {!prompt.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRollback(prompt)}
                          disabled={isSaving}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Wiederherstellen
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin/einstellungen')} 
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logo} alt="BAU4YOU" className="h-8 w-auto cursor-pointer" onClick={() => navigate('/admin/einstellungen')} />
          <span className="font-display font-bold text-lg text-foreground">Prompt-Verwaltung</span>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Speichern
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PromptChannel)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="email" className="gap-2">
              <Mail className="w-4 h-4" />
              E-Mail
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-6">
            {renderPromptEditor()}
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-6">
            {renderPromptEditor()}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
