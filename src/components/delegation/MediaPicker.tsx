import { useState, useRef } from 'react';
import { Camera, Image, X, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface MediaFile {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

interface MediaPickerProps {
  mediaFiles: MediaFile[];
  onAdd: (files: MediaFile[]) => void;
  onRemove: (id: string) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function MediaPicker({ 
  mediaFiles, 
  onAdd, 
  onRemove, 
  maxFiles = 10,
  disabled = false 
}: MediaPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);

    const newMediaFiles: MediaFile[] = [];
    const remainingSlots = maxFiles - mediaFiles.length;

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        continue;
      }

      // Validate file size (16MB max for WhatsApp)
      if (file.size > 16 * 1024 * 1024) {
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newMediaFiles.push({
        id: `${Date.now()}-${i}`,
        file,
        previewUrl,
        type: file.type.startsWith('image/') ? 'image' : 'video',
      });
    }

    if (newMediaFiles.length > 0) {
      onAdd(newMediaFiles);
    }

    setIsLoading(false);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canAddMore = mediaFiles.length < maxFiles && !disabled;

  return (
    <div className="space-y-3">
      {/* Media Preview Grid */}
      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {mediaFiles.map((media) => (
            <div key={media.id} className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
              {media.type === 'image' ? (
                <img 
                  src={media.previewUrl} 
                  alt="Vorschau" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <video 
                  src={media.previewUrl} 
                  className="w-full h-full object-cover"
                />
              )}
              <button
                onClick={() => onRemove(media.id)}
                disabled={disabled}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          
          {/* Add More Button */}
          {canAddMore && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="aspect-square rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center hover:bg-secondary/50 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="w-6 h-6 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Initial Add Buttons */}
      {mediaFiles.length === 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading}
            className="flex-1 gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Image className="w-4 h-4" />
            )}
            Fotos hinzufügen
          </Button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Media Count */}
      {mediaFiles.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {mediaFiles.length} von {maxFiles} Medien ausgewählt
        </p>
      )}
    </div>
  );
}
