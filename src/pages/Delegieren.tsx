import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LogOut, Loader2, Cloud, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChannelToggle } from '@/components/delegation/ChannelToggle';
import { RecordButton } from '@/components/delegation/RecordButton';
import { RecordingTimer } from '@/components/delegation/RecordingTimer';
import { ProcessingScreen } from '@/components/delegation/ProcessingScreen';
import { PreviewScreen } from '@/components/delegation/PreviewScreen';
import { ResultScreen } from '@/components/delegation/ResultScreen';
import { Channel, Contact, Draft, DelegationStatus, MediaFile } from '@/types/delegation';
import logo from '@/assets/logo-bau4you.png';
import { Badge } from '@/components/ui/badge';

export default function Delegieren() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const audioRecorder = useAudioRecorder();
  const { queue, queueLength, addToQueue, processQueue, isProcessing } = useOfflineQueue();
  const [channel, setChannel] = useState<Channel>('email');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [status, setStatus] = useState<DelegationStatus>('idle');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [hasWhapiToken, setHasWhapiToken] = useState(false);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string | null>(null);
  const [smtpFromEmail, setSmtpFromEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadContacts();
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('reply_to_email, signature, whapi_token, n8n_webhook_url, smtp_from_email, display_name')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (data) {
        if (data.reply_to_email) setReplyToEmail(data.reply_to_email);
        if (data.signature) setSignature(data.signature);
        setHasWhapiToken(!!data.whapi_token);
        if (data.n8n_webhook_url) setN8nWebhookUrl(data.n8n_webhook_url);
        if (data.smtp_from_email) setSmtpFromEmail(data.smtp_from_email);
        if (data.display_name) setDisplayName(data.display_name);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  // Online event listener for offline queue
  useEffect(() => {
    const handleOnline = () => {
      if (queueLength > 0) {
        toast.info('Verbindung wiederhergestellt – sende wartende Nachrichten...');
        processQueue();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queueLength, processQueue]);

  useEffect(() => {
    if (audioRecorder.error) {
      toast.error(audioRecorder.error);
    }
  }, [audioRecorder.error]);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase.from('contacts').select('*').order('name');
      if (!error && data) setContacts(data as Contact[]);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const handleStartRecording = async () => {
    await audioRecorder.startRecording();
    setStatus('recording');
  };

  const handleStopRecording = async () => {
    const audioBlob = await audioRecorder.stopRecording();
    
    if (!audioBlob) {
      toast.error('Keine Aufnahme vorhanden');
      setStatus('idle');
      return;
    }

    setStatus('transcribing');

    try {
      // Step 1: Transcribe audio
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const transcribeResponse = await supabase.functions.invoke('transcribe-audio', {
        body: formData,
      });

      if (transcribeResponse.error) {
        throw new Error(transcribeResponse.error.message);
      }

      const transcript = transcribeResponse.data?.text;
      
      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Keine Sprache erkannt');
      }

      setStatus('drafting');

      // Step 2: Process with LLM - pass contacts for matching
      const processResponse = await supabase.functions.invoke('process-delegation', {
        body: {
          transcript,
          channel,
          contacts: contacts.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            address_form: c.address_form,
          })),
        },
      });

      if (processResponse.error) {
        throw new Error(processResponse.error.message);
      }

      const draftData = processResponse.data;

      if (draftData.error) {
        throw new Error(draftData.error);
      }

      if (draftData.modelUsed?.includes('fallback')) {
        toast.info('OpenAI nicht verfügbar — Gemini wurde als Fallback verwendet');
      }

      // Find matched contact from our contacts list
      const matchedContact = draftData.matchedContact 
        ? contacts.find(c => c.id === draftData.matchedContact.id) || null
        : null;

      setDraft({
        channel,
        recipient: matchedContact,
        recipientName: draftData.recipientName || draftData.detectedRecipient || '',
        recipientAddress: draftData.recipientAddress || '',
        subject: draftData.subject || '',
        body: draftData.body,
        summary: draftData.summary,
        originalTranscript: transcript,
        detectedRecipient: draftData.detectedRecipient,
        addressForm: draftData.addressForm || 'sie',
      });

      setStatus('ready');

    } catch (error) {
      console.error('Processing error:', error);
      setStatus('error');
      setErrorDetails(error instanceof Error ? error.message : 'Verarbeitung fehlgeschlagen');
      setResultMessage('Fehler bei der Verarbeitung');
    }
  };

  const handleSelectContact = (contact: Contact) => {
    if (!draft) return;
    
    const address = channel === 'email' ? contact.email : contact.phone;
    setDraft({
      ...draft,
      recipient: contact,
      recipientName: contact.name,
      recipientAddress: address || '',
      addressForm: contact.address_form || draft.addressForm,
    });
  };

  const handleSend = async () => {
    if (!draft) return;

    // Validate recipient address
    if (!draft.recipientAddress) {
      toast.error(channel === 'email' 
        ? 'Bitte wählen Sie einen Kontakt mit E-Mail-Adresse' 
        : 'Bitte wählen Sie einen Kontakt mit Telefonnummer');
      return;
    }
    
    setIsSending(true);
    
    try {
      // Check if online before attempting to send
      if (!navigator.onLine) {
        // Queue the message for later
        const bodyWithSignature = (draft.channel === 'email' && signature)
          ? `${draft.body}\n\n${signature}`
          : draft.body;

        addToQueue(draft.channel, {
          to: draft.recipientAddress,
          subject: draft.subject,
          body: bodyWithSignature,
          signature: signature || undefined,
          recipientName: draft.recipientName,
          replyTo: replyToEmail || undefined,
          fromEmail: smtpFromEmail || undefined,
          n8nWebhookUrl: n8nWebhookUrl || undefined,
          contactId: draft.recipient?.id,
          userId: user!.id,
        });

        toast.info('Keine Verbindung – Nachricht wird gesendet, sobald du wieder online bist');
        setStatus('sent');
        setResultMessage('Nachricht wartet auf Verbindung...');
        return;
      }

      if (draft.channel === 'email') {
        if (!n8nWebhookUrl) {
          toast.error('Bitte n8n Webhook-URL in den Einstellungen konfigurieren');
          setIsSending(false);
          return;
        }

        const emailResponse = await supabase.functions.invoke('send-email', {
          body: {
            to: draft.recipientAddress,
            from: smtpFromEmail || undefined,
            subject: draft.subject,
            body: draft.body,
            signature: signature || undefined,
            recipientName: draft.recipientName,
            senderName: displayName || undefined,
            replyTo: replyToEmail || undefined,
            webhookUrl: n8nWebhookUrl,
          },
        });

        if (emailResponse.error) {
          throw new Error(emailResponse.error.message);
        }

        if (emailResponse.data?.error) {
          throw new Error(emailResponse.data.error);
        }

        const bodyWithSignature = signature
          ? `${draft.body}\n\n${signature}`
          : draft.body;

        await supabase.from('messages').insert({
          user_id: user!.id,
          contact_id: draft.recipient?.id,
          channel: 'email',
          recipient_name: draft.recipientName,
          recipient_address: draft.recipientAddress,
          subject: draft.subject,
          body: bodyWithSignature,
          status: 'sent',
        });

        setStatus('sent');
        setResultMessage(`E-Mail erfolgreich an ${draft.recipientName} gesendet`);

      } else {
        // Upload media files to storage if any
        const mediaUrls: { url: string; type: 'image' | 'video' }[] = [];
        
        if (draft.mediaFiles && draft.mediaFiles.length > 0) {
          toast.info(`Lade ${draft.mediaFiles.length} Medien hoch...`);
          
          for (const media of draft.mediaFiles) {
            const fileName = `${user!.id}/${Date.now()}-${media.file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('whatsapp-media')
              .upload(fileName, media.file);
            
            if (uploadError) {
              console.error('Media upload error:', uploadError);
              throw new Error(`Fehler beim Hochladen: ${media.file.name}`);
            }
            
            // Get signed URL (valid for 1 hour)
            const { data: urlData } = await supabase.storage
              .from('whatsapp-media')
              .createSignedUrl(uploadData.path, 3600);
            
            if (urlData?.signedUrl) {
              mediaUrls.push({
                url: urlData.signedUrl,
                type: media.type,
              });
            }
          }
        }
        
        // Send via WHAPI
        const whatsappResponse = await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: draft.recipientAddress,
            body: draft.subject ? `Betreff: ${draft.subject}\n\n${draft.body}` : draft.body,
            recipientName: draft.recipientName,
            contactId: draft.recipient?.id,
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          },
        });

        if (whatsappResponse.error) {
          throw new Error(whatsappResponse.error.message);
        }

        if (whatsappResponse.data?.error) {
          throw new Error(whatsappResponse.data.error);
        }

        const mediaCount = whatsappResponse.data?.mediaCount || 0;
        setStatus('sent');
        setResultMessage(
          mediaCount > 0 
            ? `WhatsApp mit ${mediaCount} Medien an ${draft.recipientName} gesendet`
            : `WhatsApp erfolgreich an ${draft.recipientName} gesendet`
        );
      }

    } catch (error) {
      console.error('Send error:', error);
      
      // If network error, add to offline queue
      if (!navigator.onLine || (error instanceof Error && error.message.toLowerCase().includes('network'))) {
        const bodyWithSignature = (draft.channel === 'email' && signature)
          ? `${draft.body}\n\n${signature}`
          : draft.body;

        addToQueue(draft.channel, {
          to: draft.recipientAddress,
          subject: draft.subject,
          body: bodyWithSignature,
          signature: signature || undefined,
          recipientName: draft.recipientName,
          replyTo: replyToEmail || undefined,
          fromEmail: smtpFromEmail || undefined,
          n8nWebhookUrl: n8nWebhookUrl || undefined,
          contactId: draft.recipient?.id,
          userId: user!.id,
        });
        
        toast.info('Verbindungsfehler – Nachricht wird gesendet, sobald du wieder online bist');
        setStatus('sent');
        setResultMessage('Nachricht wartet auf Verbindung...');
      } else {
        setStatus('error');
        setErrorDetails(error instanceof Error ? error.message : 'Senden fehlgeschlagen');
        setResultMessage('Fehler beim Senden');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setDraft(null);
    setResultMessage('');
    setErrorDetails('');
    setIsSending(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (status === 'sent' || status === 'error') return <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom"><ResultScreen success={status === 'sent'} message={resultMessage} errorDetails={errorDetails} onRetry={() => setStatus('ready')} onNewMessage={handleReset} /></div>;
  if (status === 'ready' && draft) return <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom"><PreviewScreen draft={draft} contacts={contacts} onEdit={setDraft} onSelectContact={handleSelectContact} onSend={handleSend} onBack={() => setStatus('idle')} isSending={isSending} signature={signature} /></div>;
  if (status === 'transcribing' || status === 'drafting') return <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom"><ProcessingScreen status={status} /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <img src={logo} alt="BAU4YOU" className="h-10 w-auto cursor-pointer" onClick={() => window.location.reload()} />
          <span className="font-display font-bold text-xl text-foreground">Delegieren</span>
          {queueLength > 0 && (
            <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30 flex items-center gap-1">
              <Cloud className="w-3 h-3" />
              {queueLength} wartend
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full">
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
        <section className="mb-8">
          <ChannelToggle channel={channel} onChange={setChannel} />
        </section>

        {channel === 'whatsapp' && !hasWhapiToken && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  WhatsApp nicht verfügbar
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bitte hinterlege zuerst deinen WHAPI-Token in den Einstellungen.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate('/admin/einstellungen')}
                >
                  Zu den Einstellungen
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <section className="flex-1 flex flex-col items-center justify-center">
          <RecordingTimer isRecording={audioRecorder.isRecording} isPaused={audioRecorder.isPaused} />
          <div className="mt-6">
            <RecordButton 
              isRecording={audioRecorder.isRecording} 
              isPaused={audioRecorder.isPaused} 
              onStart={handleStartRecording} 
              onStop={handleStopRecording} 
              onPause={audioRecorder.pauseRecording} 
              onResume={audioRecorder.resumeRecording} 
              disabled={channel === 'whatsapp' && !hasWhapiToken}
            />
          </div>
          {!audioRecorder.isRecording && (
            <p className="mt-6 text-muted-foreground text-center text-sm max-w-xs">
              Sag z.B.: „An Christoph: Bitte den Bericht bis Freitag fertigstellen…"
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
