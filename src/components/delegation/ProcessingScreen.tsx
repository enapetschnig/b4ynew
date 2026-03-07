import { Loader2 } from 'lucide-react';
import { DelegationStatus } from '@/types/delegation';

interface ProcessingScreenProps {
  status: DelegationStatus;
}

export function ProcessingScreen({ status }: ProcessingScreenProps) {
  const getMessage = () => {
    switch (status) {
      case 'transcribing':
        return 'Wird transkribiert…';
      case 'drafting':
        return 'Entwurf wird erstellt…';
      default:
        return 'Wird verarbeitet…';
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-up">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
        </div>
        <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
      </div>
      
      <p className="mt-8 text-xl font-display font-semibold text-foreground">
        {getMessage()}
      </p>
      <p className="mt-2 text-muted-foreground text-center">
        Bitte warten Sie einen Moment
      </p>
    </div>
  );
}
