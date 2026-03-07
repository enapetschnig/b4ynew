import { useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Mail, MessageCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import logo from '@/assets/logo-bau4you.png';

type ChannelFilter = 'all' | 'email' | 'whatsapp';

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

function formatDateGroup(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Heute';
  if (isYesterday(date)) return 'Gestern';
  return format(date, 'EEEE, d. MMMM yyyy', { locale: de });
}

function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), 'HH:mm', { locale: de });
}

function groupMessagesByDate(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>();
  
  messages.forEach((msg) => {
    const dateKey = msg.sent_at || msg.created_at;
    const groupKey = format(parseISO(dateKey), 'yyyy-MM-dd');
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(msg);
  });
  
  return groups;
}

export default function AdminMessages() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!user,
  });

  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    
    return messages.filter((msg) => {
      // Channel filter
      if (filter !== 'all' && msg.channel !== filter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = msg.recipient_name?.toLowerCase().includes(query);
        const matchesAddress = msg.recipient_address.toLowerCase().includes(query);
        const matchesSubject = msg.subject?.toLowerCase().includes(query);
        const matchesBody = msg.body.toLowerCase().includes(query);
        
        if (!matchesName && !matchesAddress && !matchesSubject && !matchesBody) {
          return false;
        }
      }
      
      return true;
    });
  }, [messages, filter, searchQuery]);

  const groupedMessages = useMemo(() => {
    return groupMessagesByDate(filteredMessages);
  }, [filteredMessages]);

  if (authLoading) {
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
          <img src={logo} alt="BAU4YOU" className="h-8 w-auto" />
          <span className="font-display font-bold text-lg text-foreground">Nachrichten</span>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-4 space-y-4 border-b border-border/30">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as ChannelFilter)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Alle</TabsTrigger>
            <TabsTrigger value="email" className="flex-1">
              <Mail className="w-4 h-4 mr-2" />
              E-Mail
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1">
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Messages List */}
      <main className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="px-6 py-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-2">
              Keine Nachrichten
            </h3>
            <p className="text-muted-foreground text-sm">
              {searchQuery 
                ? 'Keine Nachrichten gefunden für deine Suche.'
                : 'Du hast noch keine Nachrichten gesendet.'}
            </p>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-6">
            {Array.from(groupedMessages.entries()).map(([dateKey, msgs]) => (
              <div key={dateKey}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {formatDateGroup(msgs[0].sent_at || msgs[0].created_at)}
                </h3>
                <div className="space-y-3">
                  {msgs.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => navigate(`/admin/nachrichten/${msg.id}`)}
                      className="w-full text-left p-4 rounded-xl border border-border/50 hover:bg-secondary/50 hover:border-border transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            msg.channel === 'email' 
                              ? 'bg-blue-500/10 text-blue-500' 
                              : 'bg-green-500/10 text-green-500'
                          }`}>
                            {msg.channel === 'email' ? (
                              <Mail className="w-5 h-5" />
                            ) : (
                              <MessageCircle className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {msg.channel === 'email' ? 'E-Mail' : 'WhatsApp'} an {msg.recipient_name || msg.recipient_address}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {msg.channel === 'email' && msg.subject 
                                ? `Betreff: ${msg.subject}`
                                : msg.body.slice(0, 50) + (msg.body.length > 50 ? '...' : '')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatTime(msg.sent_at || msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
