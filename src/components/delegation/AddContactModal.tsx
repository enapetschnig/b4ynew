import { useState, useEffect } from 'react';
import { Loader2, UserPlus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddressForm } from '@/types/delegation';

interface ContactData {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  address_form?: AddressForm | null;
}

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (contact: { name: string; email?: string; phone?: string; notes?: string; address_form?: AddressForm | null }) => Promise<void>;
  initialData?: ContactData;
  isEditing?: boolean;
}

export function AddContactModal({ open, onClose, onAdd, initialData, isEditing = false }: AddContactModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [addressForm, setAddressForm] = useState<AddressForm | 'auto'>('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when opening with initial data
  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || '');
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setNotes(initialData.notes || '');
      setAddressForm(initialData.address_form || 'auto');
    } else if (open && !initialData) {
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
      setAddressForm('auto');
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        address_form: addressForm === 'auto' ? null : addressForm,
      });
      // Reset form
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
      setAddressForm('auto');
      onClose();
    } catch (error) {
      console.error('Contact save error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            {isEditing ? (
              <>
                <Pencil className="w-5 h-5" />
                Kontakt bearbeiten
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Neuen Kontakt hinzufügen
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              type="text"
              placeholder="Max Mustermann"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">E-Mail</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="max@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-phone">Telefon (WhatsApp)</Label>
            <Input
              id="contact-phone"
              type="tel"
              placeholder="+49 123 456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-notes">Notizen</Label>
            <Textarea
              id="contact-notes"
              placeholder="Optionale Notizen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-address-form">Anredeform</Label>
            <Select value={addressForm} onValueChange={(v) => setAddressForm(v as AddressForm | 'auto')}>
              <SelectTrigger id="contact-address-form" className="h-12 rounded-xl">
                <SelectValue placeholder="Anredeform wählen" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-[9999]">
                <SelectItem value="auto">Automatisch (nicht festgelegt)</SelectItem>
                <SelectItem value="du">Du-Form (intern)</SelectItem>
                <SelectItem value="sie">Sie-Form (förmlich)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Definiert, ob dieser Kontakt geduzt oder gesiezt wird
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl"
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 h-12 rounded-xl"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isEditing ? (
                'Speichern'
              ) : (
                'Hinzufügen'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
