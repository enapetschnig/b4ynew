import { CheckCircle2, XCircle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResultScreenProps {
  success: boolean;
  message: string;
  errorDetails?: string;
  onRetry: () => void;
  onNewMessage: () => void;
}

export function ResultScreen({
  success,
  message,
  errorDetails,
  onRetry,
  onNewMessage,
}: ResultScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-up">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
        success ? 'bg-success/10' : 'bg-destructive/10'
      }`}>
        {success ? (
          <CheckCircle2 className="w-14 h-14 text-success" />
        ) : (
          <XCircle className="w-14 h-14 text-destructive" />
        )}
      </div>

      <h2 className="mt-6 text-2xl font-display font-bold text-foreground">
        {success ? 'Gesendet!' : 'Fehler'}
      </h2>

      <p className="mt-2 text-muted-foreground text-center max-w-xs">
        {message}
      </p>

      {errorDetails && (
        <p className="mt-4 text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg max-w-xs text-center">
          {errorDetails}
        </p>
      )}

      <div className="mt-8 w-full max-w-xs space-y-3">
        {!success && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="w-full h-14 rounded-xl text-base gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Erneut versuchen
          </Button>
        )}

        <Button
          onClick={onNewMessage}
          className="w-full h-14 rounded-xl text-base gap-2"
        >
          <Home className="w-5 h-5" />
          Neue Nachricht
        </Button>
      </div>
    </div>
  );
}
