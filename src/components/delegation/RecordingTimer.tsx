import { useEffect, useState } from 'react';

interface RecordingTimerProps {
  isRecording: boolean;
  isPaused: boolean;
}

export function RecordingTimer({ isRecording, isPaused }: RecordingTimerProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      setSeconds(0);
      return;
    }

    if (isPaused) return;

    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) return null;

  return (
    <div className="status-badge status-recording animate-fade-up">
      <span className="w-2 h-2 rounded-full bg-recording animate-pulse" />
      <span className="font-mono text-lg font-semibold">{formatTime(seconds)}</span>
      {isPaused && <span className="text-xs ml-2">(Pausiert)</span>}
    </div>
  );
}
