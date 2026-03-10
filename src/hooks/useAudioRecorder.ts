import { useState, useRef, useCallback, useEffect } from 'react';

// Web Speech API type declarations
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
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

interface UseAudioRecorderOptions {
  autoSendTrigger?: string; // Trigger word, default: "senden"
  onAutoSend?: () => void;  // Called when trigger word is detected
}

interface UseAudioRecorderResult {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  error: string | null;
  autoSendSupported: boolean;
}

export function useAudioRecorder(options?: UseAudioRecorderOptions): UseAudioRecorderResult {
  const triggerWord = (options?.autoSendTrigger || 'senden').toLowerCase();
  const onAutoSendRef = useRef(options?.onAutoSend);

  // Keep the callback ref up to date
  useEffect(() => {
    onAutoSendRef.current = options?.onAutoSend;
  }, [options?.onAutoSend]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoSendTriggeredRef = useRef(false);

  // Check if SpeechRecognition is supported
  const autoSendSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startTimer = useCallback(() => {
    timerRef.current = window.setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore errors during cleanup
      }
      recognitionRef.current = null;
    }
  }, []);

  const startSpeechRecognition = useCallback(() => {
    if (!autoSendSupported || !onAutoSendRef.current) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'de-DE';

    autoSendTriggeredRef.current = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (autoSendTriggeredRef.current) return;

      // Check the latest result
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim().toLowerCase();

        // Check if the transcript ends with the trigger word
        if (transcript.endsWith(triggerWord) && result.isFinal) {
          autoSendTriggeredRef.current = true;
          console.log(`Auto-send triggered by "${triggerWord}"`);
          // Small delay to ensure audio data is captured
          setTimeout(() => {
            onAutoSendRef.current?.();
          }, 300);
          return;
        }
      }
    };

    recognition.onend = () => {
      // Restart if still recording and not triggered
      if (!autoSendTriggeredRef.current && mediaRecorderRef.current?.state === 'recording') {
        try {
          recognition.start();
        } catch {
          // Ignore restart errors
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      // Don't log "aborted" or "no-speech" errors
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('SpeechRecognition error:', event.error);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      console.warn('Could not start SpeechRecognition');
    }
  }, [autoSendSupported, triggerWord]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setDuration(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Use webm for better compatibility, fallback to mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second for chunking support
      setIsRecording(true);
      setIsPaused(false);
      startTimer();

      // Start speech recognition for auto-send detection
      startSpeechRecognition();

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Mikrofonzugriff verweigert. Bitte erlauben Sie den Zugriff.');
    }
  }, [startTimer, startSpeechRecognition]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    // Stop speech recognition
    stopSpeechRecognition();

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm'
        });
        setAudioBlob(blob);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        setIsRecording(false);
        setIsPaused(false);
        stopTimer();
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, [stopTimer, stopSpeechRecognition]);

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
      stopTimer();
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
      startTimer();
    }
  }, [startTimer]);

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
    autoSendSupported,
  };
}
