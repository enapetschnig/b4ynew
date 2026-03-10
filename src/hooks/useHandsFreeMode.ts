import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// SpeechRecognition types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string; confidence: number };
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

type HandsFreeStatus = 'idle' | 'recording' | 'transcribing' | 'drafting' | 'ready' | 'sending' | 'sent' | 'error';

interface VoiceCommand {
  patterns: string[];
  action: string;
}

const COMMANDS_BY_STATUS: Record<string, VoiceCommand[]> = {
  idle: [
    { patterns: ['aufnahme starten', 'nachricht aufnehmen', 'aufnehmen', 'starten'], action: 'start_recording' },
    { patterns: ['per e-mail', 'per email', 'e-mail'], action: 'switch_email' },
    { patterns: ['per whatsapp', 'whatsapp'], action: 'switch_whatsapp' },
  ],
  ready: [
    { patterns: ['jetzt senden', 'absenden', 'senden', 'schicken', 'abschicken'], action: 'send' },
    { patterns: ['vorlesen', 'ja', 'ja bitte'], action: 'read_aloud' },
    { patterns: ['nein', 'nein danke', 'nicht vorlesen'], action: 'skip_read' },
    { patterns: ['nochmal', 'neu aufnehmen', 'nochmal aufnehmen'], action: 'retry' },
    { patterns: ['neue nachricht'], action: 'reset' },
  ],
  sent: [
    { patterns: ['neue nachricht', 'nochmal', 'weiter'], action: 'reset' },
  ],
  error: [
    { patterns: ['erneut versuchen', 'nochmal'], action: 'retry' },
    { patterns: ['neue nachricht'], action: 'reset' },
  ],
};

interface UseHandsFreeModeOptions {
  enabled: boolean;
  currentStatus: HandsFreeStatus;
  onCommand: (command: string) => void;
}

interface UseHandsFreeModeResult {
  isListening: boolean;
  lastCommand: string | null;
  speak: (text: string) => Promise<void>;
  isSpeaking: boolean;
  supported: boolean;
}

export function useHandsFreeMode({ enabled, currentStatus, onCommand }: UseHandsFreeModeOptions): UseHandsFreeModeResult {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onCommandRef = useRef(onCommand);
  const currentStatusRef = useRef(currentStatus);
  const enabledRef = useRef(enabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const shouldListenRef = useRef(false);
  // Mute flag: recognition stays alive but ignores results while TTS is playing
  const mutedRef = useRef(false);

  const supported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Keep refs up to date
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { currentStatusRef.current = currentStatus; }, [currentStatus]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Persistent audio element — create once and unlock for iOS autoplay
  if (!audioRef.current && typeof window !== 'undefined') {
    const audio = new Audio();
    // Unlock iOS audio by playing silent data on first user interaction
    const unlockAudio = () => {
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.play().catch(() => {});
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });
    audioRef.current = audio;
  }

  const matchCommand = useCallback((transcript: string): string | null => {
    const text = transcript.toLowerCase().trim();
    const commands = COMMANDS_BY_STATUS[currentStatusRef.current] || [];

    for (const cmd of commands) {
      for (const pattern of cmd.patterns) {
        if (text.endsWith(pattern) || text === pattern) {
          return cmd.action;
        }
      }
    }
    return null;
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!supported || !enabledRef.current) return;

    // Don't listen during recording (the useAudioRecorder handles that)
    if (currentStatusRef.current === 'recording') return;
    // Don't listen during processing states
    if (currentStatusRef.current === 'transcribing' || currentStatusRef.current === 'drafting' || currentStatusRef.current === 'sending') return;

    // If we already have an active recognition, just unmute and keep it
    if (recognitionRef.current && shouldListenRef.current) {
      mutedRef.current = false;
      console.log('[HandsFree] Resuming existing recognition (unmuted)');
      return;
    }

    stopListening();
    shouldListenRef.current = true;
    mutedRef.current = false;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'de-DE';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Ignore results while muted (TTS is playing)
      if (mutedRef.current) {
        console.log('[HandsFree] Ignoring result (muted during TTS)');
        return;
      }

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;

        const transcript = result[0].transcript.trim();
        console.log(`[HandsFree] Heard: "${transcript}" (status: ${currentStatusRef.current})`);

        const action = matchCommand(transcript);
        if (action) {
          console.log(`[HandsFree] Command matched: ${action}`);
          setLastCommand(action);
          setTimeout(() => setLastCommand(null), 2000);
          onCommandRef.current(action);
        }
      }
    };

    recognition.onend = () => {
      console.log('[HandsFree] Recognition ended, shouldListen:', shouldListenRef.current);
      // Auto-restart if we should still be listening
      if (shouldListenRef.current && enabledRef.current) {
        setTimeout(() => {
          if (!shouldListenRef.current || !enabledRef.current) return;
          try {
            recognition.start();
            console.log('[HandsFree] Recognition restarted');
          } catch (e) {
            console.warn('[HandsFree] Could not restart recognition:', e);
            // Retry once more after a longer delay
            setTimeout(() => {
              if (!shouldListenRef.current || !enabledRef.current) return;
              try {
                const fresh = new SpeechRecognitionClass();
                fresh.continuous = true;
                fresh.interimResults = false;
                fresh.lang = 'de-DE';
                fresh.onresult = recognition.onresult;
                fresh.onend = recognition.onend;
                fresh.onerror = recognition.onerror;
                fresh.start();
                recognitionRef.current = fresh;
                console.log('[HandsFree] Fresh recognition started');
              } catch {
                console.warn('[HandsFree] Fresh restart also failed');
                setIsListening(false);
              }
            }, 1000);
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('[HandsFree] SpeechRecognition error:', event.error);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      console.log('[HandsFree] Recognition started');
    } catch {
      console.warn('[HandsFree] Could not start SpeechRecognition');
    }
  }, [supported, matchCommand, stopListening]);

  // TTS speak function — uses ElevenLabs for natural voice, falls back to browser TTS
  // IMPORTANT: Does NOT stop recognition, only mutes it to avoid losing iOS permission
  const speak = useCallback(async (text: string): Promise<void> => {
    // Mute recognition instead of stopping it (iOS Safari can't restart without user gesture)
    mutedRef.current = true;
    setIsSpeaking(true);

    const unmute = () => {
      setIsSpeaking(false);
      mutedRef.current = false;
      // If recognition died during TTS, restart it
      if (enabledRef.current && shouldListenRef.current && !recognitionRef.current) {
        setTimeout(() => startListening(), 300);
      }
    };

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
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

      const blob = await response.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = audioRef.current!;
      audio.src = url;

      await new Promise<void>((resolve) => {
        audio.onended = () => { unmute(); resolve(); };
        audio.onerror = () => { unmute(); resolve(); };
        audio.play().catch(() => { unmute(); resolve(); });
      });
    } catch (err) {
      console.error('[HandsFree] ElevenLabs TTS failed, falling back to browser:', err);
      // Fallback: Browser SpeechSynthesis
      if ('speechSynthesis' in window) {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'de-DE';
          const voices = window.speechSynthesis.getVoices();
          const germanVoice = voices.find(v => v.lang.startsWith('de'));
          if (germanVoice) utterance.voice = germanVoice;
          utterance.onend = () => { unmute(); resolve(); };
          utterance.onerror = () => { unmute(); resolve(); };
          window.speechSynthesis.speak(utterance);
        });
      } else {
        unmute();
      }
    }
  }, [startListening]);

  // Start/stop listening when enabled or status changes
  useEffect(() => {
    if (!enabled || !supported) {
      stopListening();
      return;
    }

    // States where we should listen for commands
    const listeningStates: HandsFreeStatus[] = ['idle', 'ready', 'sent', 'error'];
    if (listeningStates.includes(currentStatus)) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      // Don't stop on cleanup if still enabled (status change will handle it)
    };
  }, [enabled, currentStatus, supported, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [stopListening]);

  return {
    isListening,
    lastCommand,
    speak,
    isSpeaking,
    supported,
  };
}
