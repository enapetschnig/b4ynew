import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mic } from 'lucide-react';
import { RecordButton } from '@/components/delegation/RecordButton';
import { RecordingTimer } from '@/components/delegation/RecordingTimer';
import { PositionPreview, Position } from '@/components/angebote/PositionPreview';
import logo from '@/assets/logo-bau4you.png';

type Status = 'idle' | 'recording' | 'paused' | 'transcribing' | 'processing' | 'ready' | 'error';

export default function Angebote() {
  const { user, loading } = useAuth();
  const audioRecorder = useAudioRecorder();
  const [status, setStatus] = useState<Status>('idle');
  const [positions, setPositions] = useState<Position[]>([]);
  const [transcript, setTranscript] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleStartRecording = useCallback(async () => {
    try {
      await audioRecorder.startRecording();
      setStatus('recording');
    } catch {
      toast.error('Mikrofon konnte nicht gestartet werden');
    }
  }, [audioRecorder]);

  const handleStopRecording = useCallback(async () => {
    const blob = await audioRecorder.stopRecording();
    if (!blob) {
      toast.error('Keine Aufnahme vorhanden');
      setStatus('idle');
      return;
    }

    // Step 1: Transcribe
    setStatus('transcribing');
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const transcribeResponse = await supabase.functions.invoke('transcribe-audio', {
        body: formData,
      });

      if (transcribeResponse.error) {
        throw new Error(transcribeResponse.error.message || 'Transkription fehlgeschlagen');
      }

      const transcriptText = transcribeResponse.data?.text;
      if (!transcriptText) {
        throw new Error('Kein Text erkannt');
      }

      setTranscript(transcriptText);

      // Step 2: Process positions
      setStatus('processing');

      const processResponse = await supabase.functions.invoke('process-position', {
        body: { transcript: transcriptText },
      });

      if (processResponse.error) {
        throw new Error(processResponse.error.message || 'Kalkulation fehlgeschlagen');
      }

      const data = processResponse.data;
      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.positions?.length) {
        throw new Error('Keine Positionen erkannt');
      }

      if (data.modelUsed?.includes('fallback') && data.fallbackReason) {
        toast.info(`OpenAI-Fehler: ${data.fallbackReason} — Gemini wurde verwendet`);
      }

      setPositions(data.positions);
      setModelUsed(data.modelUsed || 'gemini');
      setStatus('ready');

    } catch (e) {
      console.error('Processing error:', e);
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setErrorMessage(msg);
      setStatus('error');
      toast.error(msg);
    }
  }, [audioRecorder]);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setPositions([]);
    setTranscript('');
    setModelUsed('');
    setErrorMessage('');
  }, []);

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
        <span className="font-display font-bold text-lg text-foreground">Angebotspositionen</span>
      </header>

      {/* Processing states */}
      {(status === 'transcribing' || status === 'processing') && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-up">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-accent animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
          </div>
          <p className="mt-8 text-xl font-display font-semibold text-foreground">
            {status === 'transcribing' ? 'Wird transkribiert…' : 'Kalkulation wird erstellt…'}
          </p>
          <p className="mt-2 text-muted-foreground text-center">
            Bitte warten Sie einen Moment
          </p>
        </div>
      )}

      {/* Ready — show positions */}
      {status === 'ready' && (
        <PositionPreview
          positions={positions}
          transcript={transcript}
          modelUsed={modelUsed}
          onNewRecording={handleReset}
        />
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Fehler</h2>
          <p className="text-muted-foreground text-center text-sm max-w-xs mb-6">{errorMessage}</p>
          <button
            onClick={handleReset}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Idle / Recording */}
      {(status === 'idle' || status === 'recording' || status === 'paused') && (
        <main className="flex-1 flex flex-col items-center justify-center px-6">
          {status === 'idle' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Position diktieren</h2>
              <p className="text-muted-foreground text-center text-sm max-w-xs mb-8">
                Beschreiben Sie die Leistung per Sprache — die KI erstellt eine kalkulierte Angebotsposition.
              </p>
            </>
          )}

          {(status === 'recording' || status === 'paused') && (
            <div className="mb-6">
              <RecordingTimer isRecording={audioRecorder.isRecording} isPaused={audioRecorder.isPaused} />
            </div>
          )}

          <RecordButton
            isRecording={audioRecorder.isRecording}
            isPaused={audioRecorder.isPaused}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            onPause={audioRecorder.pauseRecording}
            onResume={audioRecorder.resumeRecording}
          />

          {status === 'idle' && (
            <p className="mt-6 text-xs text-muted-foreground text-center max-w-xs">
              Beispiel: "25 Quadratmeter Wandfliesen, mittlere Qualität, Fugen grau"
            </p>
          )}
        </main>
      )}
    </div>
  );
}
