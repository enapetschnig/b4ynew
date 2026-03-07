import { Mic, Square, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  disabled?: boolean;
}

export function RecordButton({
  isRecording,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume,
  disabled,
}: RecordButtonProps) {
  if (!isRecording) {
    return (
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        className={cn(
          'btn-record',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Aufnahme starten"
      >
        <Mic className="w-12 h-12" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={onStop}
        className="btn-record recording"
        aria-label="Aufnahme beenden"
      >
        <Square className="w-10 h-10" />
      </button>
      
      <button
        type="button"
        onClick={isPaused ? onResume : onPause}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium transition-all hover:bg-secondary/80"
      >
        {isPaused ? (
          <>
            <Play className="w-5 h-5" />
            <span>Fortsetzen</span>
          </>
        ) : (
          <>
            <Pause className="w-5 h-5" />
            <span>Pause</span>
          </>
        )}
      </button>
    </div>
  );
}
