import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, ArrowLeft, Plus, Search, Mail, Phone, 
  MoreVertical, Pencil, Trash2, User 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Contact } from '@/types/delegation';
import { AddContactModal } from '@/components/delegation/AddContactModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import logo from '@/assets/logo-bau4you.png';

export default function AdminContacts() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (user) loadContacts();
  }, [user]);

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name');
      
      if (error) {
        toast.error('Fehler beim Laden der Kontakte');
      } else {
        setContacts(data as Contact[]);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
      toast.error('Fehler beim Laden der Kontakte');
    }
    setIsLoading(false);
  };

  const handleAddContact = async (contact: { 
    name: string; 
    email?: string; 
    phone?: string; 
    notes?: string;
    address_form?: 'du' | 'sie' | null;
  }) => {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: user!.id,
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        notes: contact.notes || null,
        address_form: contact.address_form || null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Fehler beim Hinzufügen');
      return;
    }

    setContacts([...contacts, data as Contact]);
    toast.success('Kontakt hinzugefügt');
  };

  const handleUpdateContact = async (contact: { 
    name: string; 
    email?: string; 
    phone?: string; 
    notes?: string;
    address_form?: 'du' | 'sie' | null;
  }) => {
    if (!editingContact) return;

    const { error } = await supabase
      .from('contacts')
      .update({
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        notes: contact.notes || null,
        address_form: contact.address_form || null,
      })
      .eq('id', editingContact.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
      return;
    }

    setContacts(contacts.map(c => 
      c.id === editingContact.id 
        ? { ...c, ...contact } 
        : c
    ));
    setEditingContact(null);
    toast.success('Kontakt aktualisiert');
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', deletingContact.id);

      if (error) {
        toast.error('Fehler beim Löschen');
      } else {
        setContacts(contacts.filter(c => c.id !== deletingContact.id));
        toast.success('Kontakt gelöscht');
      }
    } catch (err) {
      console.error('Failed to delete contact:', err);
      toast.error('Fehler beim Löschen');
    }
    setDeletingContact(null);
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin')} 
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={logo} alt="BAU4YOU" className="h-8 w-auto cursor-pointer" onClick={() => navigate('/admin')} />
          <span className="font-display font-bold text-lg text-foreground">Kontakte</span>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)}
          size="icon"
          className="rounded-full"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </header>

      {/* Search */}
      <div className="px-6 py-4 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Kontakt suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      </div>

      {/* Contacts List */}
      <main className="flex-1 px-6 py-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'Keine Kontakte gefunden' : 'Noch keine Kontakte'}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                onClick={() => setShowAddModal(true)}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ersten Kontakt anlegen
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-secondary/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate">{contact.name}</p>
                    {contact.address_form && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        contact.address_form === 'du' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {contact.address_form === 'du' ? 'Du' : 'Sie'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {contact.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setDeletingContact(contact)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      <AddContactModal
        open={showAddModal || !!editingContact}
        onClose={() => {
          setShowAddModal(false);
          setEditingContact(null);
        }}
        onAdd={editingContact ? handleUpdateContact : handleAddContact}
        initialData={editingContact || undefined}
        isEditing={!!editingContact}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{deletingContact?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteContact}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
