import { useState, useEffect } from 'react';
import { Search, UserPlus, X, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Contact, Channel } from '@/types/delegation';
import { cn } from '@/lib/utils';

interface ContactSearchProps {
  contacts: Contact[];
  selectedContact: Contact | null;
  channel: Channel;
  onSelect: (contact: Contact | null) => void;
  onAddNew: () => void;
}

export function ContactSearch({
  contacts,
  selectedContact,
  channel,
  onSelect,
  onAddNew,
}: ContactSearchProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const filteredContacts = contacts.filter((contact) => {
    const matchesName = contact.name.toLowerCase().includes(query.toLowerCase());
    // For WhatsApp, only show contacts with phone numbers
    if (channel === 'whatsapp') {
      return matchesName && contact.phone;
    }
    // For email, only show contacts with email
    return matchesName && contact.email;
  });

  useEffect(() => {
    if (query.length > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [query]);

  if (selectedContact) {
    return (
      <div className="surface-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{selectedContact.name}</p>
              <p className="text-sm text-muted-foreground">
                {channel === 'email' ? selectedContact.email : selectedContact.phone}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onSelect(null);
              setQuery('');
            }}
            className="h-10 w-10 rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="An: Name eingeben…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length > 0 && setShowResults(true)}
          className="h-14 text-base rounded-xl bg-card border-border/50 pl-12 pr-4"
        />
      </div>

      {showResults && (
        <div className="absolute z-10 w-full mt-2 surface-elevated p-2 max-h-64 overflow-y-auto animate-slide-up">
          {filteredContacts.length > 0 ? (
            filteredContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => {
                  onSelect(contact);
                  setShowResults(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {channel === 'email' ? contact.email : contact.phone}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <p className="mb-3">Kein Kontakt gefunden</p>
              <Button
                variant="outline"
                onClick={() => {
                  onAddNew();
                  setShowResults(false);
                }}
                className="gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Kontakt hinzufügen
              </Button>
            </div>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        onClick={onAddNew}
        className="mt-3 gap-2 text-muted-foreground hover:text-foreground"
      >
        <UserPlus className="w-4 h-4" />
        Kontakt hinzufügen
      </Button>
    </div>
  );
}
