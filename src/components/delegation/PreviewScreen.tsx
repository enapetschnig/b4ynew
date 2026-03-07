import { Mail, MessageCircle, Edit2, User, Send, ArrowLeft, AlertTriangle, ChevronDown, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Draft, Channel, Contact, MediaFile } from '@/types/delegation';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useState, useCallback, useRef } from 'react';
import { MediaPicker } from './MediaPicker';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PreviewScreenProps {
  draft: Draft;
  contacts: Contact[];
  onEdit: (draft: Draft) => void;
  onSelectContact: (contact: Contact) => void;
  onSend: () => void;
  onBack: () => void;
  isSending: boolean;
  signature?: string | null;
}

export function PreviewScreen({ draft, contacts, onEdit, onSelectContact, onSend, onBack, isSending, signature }: PreviewScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(draft.subject);
  const [editedBody, setEditedBody] = useState(draft.body);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSpeakingRef = useRef(false);

  const speakText = useCallback(async () => {
    if (isSpeakingRef.current) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = draft.subject
      ? `Betreff: ${draft.subject}. ${draft.body}`
      : draft.body;

    console.log(`TTS request: channel=${draft.channel}, textLength=${textToSpeak.length}, text="${textToSpeak.substring(0, 100)}..."`);
    setIsLoadingAudio(true);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ text: textToSpeak }),
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('TTS response error:', response.status, errText);
        throw new Error(`TTS fehlgeschlagen (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        toast.error('Audio-Wiedergabe fehlgeschlagen');
      };

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      await audio.play();
    } catch (e) {
      console.error('TTS error:', e);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      toast.error('Vorlesen fehlgeschlagen');
    } finally {
      setIsLoadingAudio(false);
    }
  }, [draft.subject, draft.body, draft.channel]);

  const handleSaveEdit = () => {
    onEdit({
      ...draft,
      subject: editedSubject,
      body: editedBody,
    });
    setIsEditing(false);
  };

  const handleAddMedia = (newFiles: MediaFile[]) => {
    const currentMedia = draft.mediaFiles || [];
    onEdit({
      ...draft,
      mediaFiles: [...currentMedia, ...newFiles],
    });
  };

  const handleRemoveMedia = (id: string) => {
    const currentMedia = draft.mediaFiles || [];
    // Revoke URL to free memory
    const file = currentMedia.find(m => m.id === id);
    if (file) {
      URL.revokeObjectURL(file.previewUrl);
    }
    onEdit({
      ...draft,
      mediaFiles: currentMedia.filter(m => m.id !== id),
    });
  };

  // Filter contacts based on channel
  const availableContacts = contacts.filter(c => 
    draft.channel === 'email' ? c.email : c.phone
  );

  const hasValidRecipient = draft.recipientAddress && draft.recipientAddress.length > 0;
  const needsContactSelection = !hasValidRecipient;
  const isWhatsApp = draft.channel === 'whatsapp';
  const mediaFiles = draft.mediaFiles || [];

  return (
    <div className="flex-1 flex flex-col animate-fade-up">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Zurück</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary */}
        <div className="surface-card p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-1">Zusammenfassung</p>
          <p className="text-foreground font-medium">{draft.summary}</p>
        </div>

        {/* Detected vs Matched Recipient Info */}
        {draft.detectedRecipient && needsContactSelection && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Erkannt: „{draft.detectedRecipient}"
              </p>
              <p className="text-sm text-muted-foreground">
                Bitte wählen Sie den passenden Kontakt aus Ihrer Liste
              </p>
            </div>
          </div>
        )}

        {/* Recipient & Channel */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              hasValidRecipient ? 'bg-primary/10' : 'bg-warning/10'
            }`}>
              <User className={`w-6 h-6 ${hasValidRecipient ? 'text-primary' : 'text-warning'}`} />
            </div>
            
            {/* Contact Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex-1 text-left hover:bg-secondary/50 rounded-lg p-2 -m-2 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-semibold ${hasValidRecipient ? 'text-foreground' : 'text-warning'}`}>
                        {draft.recipientName || 'Empfänger wählen'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {draft.recipientAddress || 'Kein Kontakt zugeordnet'}
                      </p>
                    </div>
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {availableContacts.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Keine Kontakte mit {draft.channel === 'email' ? 'E-Mail' : 'Telefonnummer'} vorhanden
                  </div>
                ) : (
                  availableContacts.map(contact => (
                    <DropdownMenuItem 
                      key={contact.id} 
                      onClick={() => onSelectContact(contact)}
                      className="flex flex-col items-start"
                    >
                      <span className="font-medium">{contact.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {draft.channel === 'email' ? contact.email : contact.phone}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className={`status-badge ${draft.channel === 'email' ? 'bg-channel-email/10 text-channel-email' : 'bg-channel-whatsapp/10 text-channel-whatsapp'}`}>
            {draft.channel === 'email' ? (
              <Mail className="w-4 h-4" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            <span>{draft.channel === 'email' ? 'E-Mail' : 'WhatsApp'}</span>
          </div>
        </div>

        {/* Message Content */}
        <div className="space-y-4">
          {(draft.channel === 'email' || draft.channel === 'whatsapp') && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Betreff</p>
              {isEditing ? (
                <Input
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="h-12 rounded-xl"
                />
              ) : (
                <p className="font-semibold text-foreground bg-secondary/50 px-4 py-3 rounded-xl">
                  {draft.subject}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {draft.channel === 'email' ? 'Nachricht' : 'WhatsApp-Nachricht'}
            </p>
            {isEditing ? (
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                className="rounded-xl min-h-[200px] resize-none"
              />
            ) : (
              <div className="message-preview whitespace-pre-wrap">
                {draft.body}
              </div>
            )}
            
            {/* Email Signature Display */}
            {draft.channel === 'email' && signature && !isEditing && (
              <div className="mt-4 pt-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Signatur</p>
                <p className="text-muted-foreground whitespace-pre-wrap text-sm">{signature}</p>
              </div>
            )}
          </div>

          {/* Media Picker for WhatsApp */}
          {isWhatsApp && !isEditing && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Fotos & Videos</p>
              <MediaPicker
                mediaFiles={mediaFiles}
                onAdd={handleAddMedia}
                onRemove={handleRemoveMedia}
                maxFiles={10}
                disabled={isSending}
              />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-6 border-t border-border/50 safe-area-bottom bg-background">
        <div className="flex gap-3 mb-4">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditedSubject(draft.subject);
                  setEditedBody(draft.body);
                  setIsEditing(false);
                }}
                className="flex-1 h-14 rounded-xl text-base"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="flex-1 h-14 rounded-xl text-base"
              >
                Speichern
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="flex-1 h-14 rounded-xl text-base gap-2"
              >
                <Edit2 className="w-5 h-5" />
                Bearbeiten
              </Button>
              <Button
                variant="outline"
                onClick={speakText}
                disabled={isLoadingAudio}
                className={`h-14 rounded-xl text-base gap-2 px-4 ${isSpeaking ? 'bg-primary/10 border-primary' : ''}`}
              >
                {isLoadingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                {isLoadingAudio ? 'Laden...' : isSpeaking ? 'Stopp' : 'Vorlesen'}
              </Button>
            </>
          )}
        </div>

        {!isEditing && (
          <Button
            onClick={onSend}
            disabled={isSending || !hasValidRecipient}
            className="w-full h-16 rounded-xl text-lg font-bold gap-3 bg-success hover:bg-success/90 disabled:opacity-50"
          >
            <Send className="w-6 h-6" />
            {hasValidRecipient 
              ? (mediaFiles.length > 0 ? `Senden (${mediaFiles.length} Medien)` : 'Jetzt senden') 
              : 'Empfänger wählen'}
          </Button>
        )}
      </div>
    </div>
  );
}
