import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Search, MoreVertical, UserCheck, UserX, Shield, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import logo from '@/assets/logo-bau4you.png';

interface UserWithRole {
  user_id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  role: 'admin' | 'user';
}

export default function AdminUsers() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminAndLoadUsers();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.email.toLowerCase().includes(query) ||
            (u.display_name && u.display_name.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, users]);

  const checkAdminAndLoadUsers = async () => {
    // Check if current user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    setIsAdmin(true);
    await loadUsers();
  };

  const loadUsers = async () => {
    setIsLoading(true);

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, display_name, is_active, created_at');

    if (profilesError) {
      toast.error('Fehler beim Laden der Benutzer');
      console.error(profilesError);
      setIsLoading(false);
      return;
    }

    // Get all user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error(rolesError);
    }

    // Create a map of user_id -> role
    const roleMap = new Map<string, 'admin' | 'user'>();
    roles?.forEach((r) => {
      // Cast the role to the correct type
      roleMap.set(r.user_id, r.role as 'admin' | 'user');
    });

    // Get user emails from auth.users via edge function or use email from metadata
    // Since we can't directly query auth.users, we'll use the user's email from their session
    // For now, we'll show user_id and display_name

    const usersWithRoles: UserWithRole[] = (profiles || []).map((p) => ({
      user_id: p.user_id,
      email: '', // Will be filled if we can get it
      display_name: p.display_name,
      is_active: p.is_active ?? true,
      created_at: p.created_at,
      role: roleMap.get(p.user_id) || 'user',
    }));

    // Try to get emails - for the current user we know the email
    usersWithRoles.forEach((u) => {
      if (u.user_id === user?.id) {
        u.email = user.email || '';
      }
    });

    setUsers(usersWithRoles);
    setFilteredUsers(usersWithRoles);
    setIsLoading(false);
  };

  const handleToggleActive = async (targetUser: UserWithRole) => {
    if (targetUser.user_id === user?.id) {
      toast.error('Du kannst dich nicht selbst deaktivieren');
      return;
    }

    const newStatus = !targetUser.is_active;

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('user_id', targetUser.user_id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
      console.error(error);
      return;
    }

    toast.success(newStatus ? 'Benutzer aktiviert' : 'Benutzer deaktiviert');
    await loadUsers();
  };

  const openRoleDialog = (targetUser: UserWithRole) => {
    setSelectedUser(targetUser);
    setSelectedRole(targetUser.role);
    setShowRoleDialog(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;

    if (selectedUser.user_id === user?.id && selectedRole !== 'admin') {
      toast.error('Du kannst dir nicht selbst die Admin-Rolle entziehen');
      return;
    }

    setIsSaving(true);

    // Delete existing role
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', selectedUser.user_id);

    // Insert new role
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: selectedUser.user_id, role: selectedRole });

    if (error) {
      toast.error('Fehler beim Speichern der Rolle');
      console.error(error);
      setIsSaving(false);
      return;
    }

    toast.success('Rolle gespeichert');
    setShowRoleDialog(false);
    setIsSaving(false);
    await loadUsers();
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Zugriff verweigert</h1>
        <p className="text-muted-foreground text-center mb-6">
          Du benötigst Admin-Rechte, um auf diese Seite zuzugreifen.
        </p>
        <Button onClick={() => navigate('/admin')}>Zurück zur Übersicht</Button>
      </div>
    );
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
          <img src={logo} alt="BAU4YOU" className="h-8 w-auto" />
          <span className="font-display font-bold text-lg text-foreground">Benutzer</span>
        </div>
      </header>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Benutzer suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Users List */}
      <main className="flex-1 px-6 pb-6 space-y-3 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Keine Benutzer gefunden
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div
              key={u.user_id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                u.is_active
                  ? 'border-border/50 bg-card'
                  : 'border-destructive/30 bg-destructive/5'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground truncate">
                    {u.display_name || 'Unbekannt'}
                  </span>
                  {u.user_id === user?.id && (
                    <Badge variant="outline" className="text-xs">Du</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {u.email || u.user_id.slice(0, 8) + '...'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                    {u.role === 'admin' ? 'Admin' : 'User'}
                  </Badge>
                  {u.is_active ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Aktiv
                    </span>
                  ) : (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <UserX className="w-3 h-3" /> Deaktiviert
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
                  <DropdownMenuItem onClick={() => openRoleDialog(u)}>
                    <Shield className="w-4 h-4 mr-2" />
                    Rolle ändern
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToggleActive(u)}
                    disabled={u.user_id === user?.id}
                  >
                    {u.is_active ? (
                      <>
                        <UserX className="w-4 h-4 mr-2" />
                        Deaktivieren
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Aktivieren
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </main>

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rolle ändern</DialogTitle>
            <DialogDescription>
              Wähle eine Rolle für {selectedUser?.display_name || 'diesen Benutzer'}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'admin' | 'user')}>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer">
              <RadioGroupItem value="user" id="role-user" className="mt-1" />
              <Label htmlFor="role-user" className="flex-1 cursor-pointer">
                <div className="font-medium">User</div>
                <div className="text-sm text-muted-foreground">
                  Kann delegieren und eigene Kontakte verwalten
                </div>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer">
              <RadioGroupItem value="admin" id="role-admin" className="mt-1" />
              <Label htmlFor="role-admin" className="flex-1 cursor-pointer">
                <div className="font-medium">Admin</div>
                <div className="text-sm text-muted-foreground">
                  Zusätzlich: Benutzer verwalten, Einstellungen, Prompts
                </div>
              </Label>
            </div>
          </RadioGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveRole} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
