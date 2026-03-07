import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import logo from '@/assets/logo-bau4you.png';

interface Message {
  id: string;
  channel: string;
  recipient_name: string | null;
  recipient_address: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export default function AdminMessageDetail() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: message, isLoading } = useQuery({
    queryKey: ['message', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Message | null;
    },
    enabled: !!user && !!id,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!message) {
    return (
      <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
        <header className="px-6 py-4 flex items-center gap-3 border-b border-border/50">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin/nachrichten')} 
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logo} alt="BAU4YOU" className="h-8 w-auto" />
          <span className="font-display font-bold text-lg text-foreground">Nachricht</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Nachricht nicht gefunden</p>
        </div>
      </div>
    );
  }

  const sentDate = message.sent_at || message.created_at;

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3 border-b border-border/50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/admin/nachrichten')} 
          className="rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <img src={logo} alt="BAU4YOU" className="h-8 w-auto" />
        <span className="font-display font-bold text-lg text-foreground">Nachricht</span>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto px-6 py-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Channel Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              message.channel === 'email'
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-green-500/10 text-green-500'
            }`}>
              {message.channel === 'email' ? (
                <Mail className="w-4 h-4" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              {message.channel === 'email' ? 'E-Mail' : 'WhatsApp'}
            </div>

            {/* Recipient */}
            <div>
              <p className="text-sm text-muted-foreground">An</p>
              <p className="font-medium text-foreground">
                {message.recipient_name || 'Unbekannt'}
              </p>
              <p className="text-sm text-muted-foreground">
                {message.recipient_address}
              </p>
            </div>

            {/* Subject (only for email) */}
            {message.channel === 'email' && message.subject && (
              <div>
                <p className="text-sm text-muted-foreground">Betreff</p>
                <p className="font-medium text-foreground">{message.subject}</p>
              </div>
            )}

            {/* Sent date */}
            <div>
              <p className="text-sm text-muted-foreground">Gesendet</p>
              <p className="font-medium text-foreground">
                {format(parseISO(sentDate), "d. MMMM yyyy, HH:mm 'Uhr'", { locale: de })}
              </p>
            </div>

            <Separator />

            {/* Body */}
            <div className="whitespace-pre-wrap text-foreground">
              {message.body}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
