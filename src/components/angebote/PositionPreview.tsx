import { useState } from 'react';
import { ChevronDown, ChevronRight, Calculator, Clock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';


export interface Position {
  menge: number;
  einheit: string;
  kurztext: string;
  langtext: string;
  gewerk: string;
  angebotenes_produkt: string;
  arbeitszeit_h: number;
  arbeitszeit_min_pro_einheit: number;
  arbeitskosten: number;
  materialkosten: number;
  arbeitsanteil_prozent: number;
  materialanteil_prozent: number;
  arbeitsanteil_euro: number;
  materialanteil_euro: number;
  gesamt_pro_einheit_netto: number;
}

interface PositionPreviewProps {
  positions: Position[];
  transcript: string;
  modelUsed: string;
  onNewRecording: () => void;
}

function formatEuro(value: number): string {
  return value.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function PositionCard({ position, index, total }: { position: Position; index: number; total: number }) {
  const [expanded, setExpanded] = useState(true);

  const gesamtNetto = position.gesamt_pro_einheit_netto * position.menge;

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {total > 1 && (
              <span className="text-xs font-medium text-muted-foreground">Pos. {index + 1}</span>
            )}
            <Badge variant="secondary" className="text-xs">{position.gewerk}</Badge>
          </div>
          <h3 className="font-semibold text-foreground truncate">{position.kurztext}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>{position.menge} {position.einheit}</span>
            <span className="font-semibold text-foreground">{formatEuro(position.gesamt_pro_einheit_netto)}/{position.einheit}</span>
          </div>
        </div>
        <div className="flex flex-col items-end ml-3">
          <span className="text-lg font-bold text-primary">{formatEuro(gesamtNetto)}</span>
          <span className="text-xs text-muted-foreground">gesamt netto</span>
          {expanded ? <ChevronDown className="w-4 h-4 mt-1 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/50 p-4 space-y-4">
          {/* Langtext */}
          <div>
            <p className="text-sm text-foreground leading-relaxed">{position.langtext}</p>
          </div>

          {/* Angebotenes Produkt */}
          {position.angebotenes_produkt && (
            <div className="flex items-start gap-2">
              <Package className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">Angebotenes Produkt</span>
                <p className="text-sm font-medium">{position.angebotenes_produkt}</p>
              </div>
            </div>
          )}

          {/* Kalkulation */}
          <div className="rounded-lg bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kalkulation</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material</span>
                <span>{position.materialanteil_prozent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"></span>
                <span className="font-medium">{formatEuro(position.materialanteil_euro)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Arbeit</span>
                <span>{position.arbeitsanteil_prozent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"></span>
                <span className="font-medium">{formatEuro(position.arbeitsanteil_euro)}</span>
              </div>
            </div>

            <div className="border-t border-border/50 pt-2 mt-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Zeit gesamt:</span>
                <span className="font-medium">{formatTime(position.arbeitszeit_h)}</span>
                <span className="text-muted-foreground ml-2">({position.arbeitszeit_min_pro_einheit} min/{position.einheit})</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export function PositionPreview({ positions, transcript, modelUsed, onNewRecording }: PositionPreviewProps) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="flex-1 flex flex-col px-4 pb-24 animate-fade-up">
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {positions.length === 1 ? '1 Position' : `${positions.length} Positionen`} erstellt
          </h2>
          <p className="text-xs text-muted-foreground">Modell: {modelUsed}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowTranscript(!showTranscript)}>
          {showTranscript ? 'Verbergen' : 'Transkript'}
        </Button>
      </div>

      {showTranscript && (
        <div className="mb-4 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground italic">
          "{transcript}"
        </div>
      )}

      {/* Position cards */}
      <div className="space-y-3 mb-6">
        {positions.map((pos, i) => (
          <PositionCard key={i} position={pos} index={i} total={positions.length} />
        ))}
      </div>

      {/* New recording button */}
      <Button onClick={onNewRecording} className="w-full" size="lg">
        Neue Aufnahme
      </Button>
    </div>
  );
}
