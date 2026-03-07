

# Fix: Chrome-Kompatibilitaet und Stabilitaet verbessern

## Problem

In Chrome funktionieren viele Sachen nicht - z.B. kann die Prompt-Verwaltung nicht geoeffnet werden, und verschiedene Aktionen fuehren zum "Etwas ist schiefgelaufen"-Bildschirm. Das Logo ist ausserdem nicht klickbar, um zurueckzukommen.

## Ursache

Mehrere Seiten haben noch keine `try/catch`-Bloecke um ihre Daten-Ladefunktionen. Wenn ein Fehler auftritt (z.B. Token abgelaufen, Netzwerkproblem), stuerzt die ganze Seite ab. Betroffen sind:

- **AdminPrompts.tsx**: Alle 4 async Funktionen ohne try/catch
- **AdminContacts.tsx**: loadContacts und handleDeleteContact ohne try/catch
- **AdminSettings.tsx**: Select-Dropdown fehlt Portal-Fix fuer Chrome

## Loesung

### Aenderung 1: AdminPrompts.tsx - try/catch ueberall

Alle async Funktionen absichern: `loadPrompts`, `createDefaultPrompt`, `handleSave`, `handleRollback`. Ausserdem Logo klickbar machen (zurueck zu /admin/einstellungen).

### Aenderung 2: AdminContacts.tsx - try/catch ergaenzen

`loadContacts` und `handleDeleteContact` mit try/catch absichern. Logo klickbar machen (zurueck zu /admin).

### Aenderung 3: AdminSettings.tsx - Select-Dropdown Fix

`SelectContent` bekommt `position="popper"` und `z-[9999]` wie beim AddContactModal. Logo klickbar machen.

### Aenderung 4: Admin.tsx - Logo klickbar

Logo im Admin-Menue klickbar machen (zurueck zu /delegieren).

### Aenderung 5: Delegieren.tsx - Logo klickbar

Logo auf der Hauptseite soll die Seite neu laden / zum Anfang zurueckfuehren.

---

## Technische Details

### Datei 1: `src/pages/AdminPrompts.tsx`

```typescript
// loadPrompts mit try/catch
const loadPrompts = async (...) => {
  try {
    const { data, error } = await supabase.from('prompts')...;
    // existing logic
  } catch (err) {
    console.error('Failed to load prompts:', err);
  }
};

// createDefaultPrompt mit try/catch
const createDefaultPrompt = async (...) => {
  try {
    const { data, error } = await supabase.from('prompts').insert(...)...;
    // existing logic
  } catch (err) {
    console.error('Failed to create default prompt:', err);
  }
};

// handleSave mit try/catch
const handleSave = async () => {
  try {
    // existing logic
  } catch (err) {
    console.error('Failed to save prompt:', err);
    toast.error('Fehler beim Speichern');
  }
  setIsSaving(false);
};

// handleRollback mit try/catch
const handleRollback = async (prompt: Prompt) => {
  try {
    // existing logic
  } catch (err) {
    console.error('Failed to rollback:', err);
    toast.error('Fehler beim Zuruecksetzen');
  }
  setIsSaving(false);
};
```

Logo klickbar machen: `<img onClick={() => navigate('/admin/einstellungen')} className="... cursor-pointer" />`

### Datei 2: `src/pages/AdminContacts.tsx`

```typescript
const loadContacts = async () => {
  setIsLoading(true);
  try {
    const { data, error } = await supabase.from('contacts')...;
    // existing logic
  } catch (err) {
    console.error('Failed to load contacts:', err);
    toast.error('Fehler beim Laden der Kontakte');
  }
  setIsLoading(false);
};

const handleDeleteContact = async () => {
  if (!deletingContact) return;
  try {
    // existing logic
  } catch (err) {
    console.error('Failed to delete contact:', err);
    toast.error('Fehler beim Loeschen');
  }
  setDeletingContact(null);
};
```

Logo klickbar: `<img onClick={() => navigate('/admin')} className="... cursor-pointer" />`

### Datei 3: `src/pages/AdminSettings.tsx`

Select-Dropdown Fix:
```tsx
<SelectContent position="popper" sideOffset={4} className="z-[9999]">
```

Logo klickbar: `<img onClick={() => navigate('/admin')} className="... cursor-pointer" />`

### Datei 4: `src/pages/Admin.tsx`

Logo klickbar: `<img onClick={() => navigate('/delegieren')} className="... cursor-pointer" />`

### Datei 5: `src/pages/Delegieren.tsx`

Logo klickbar: `<img onClick={() => window.location.reload()} className="... cursor-pointer" />`

---

## Zusammenfassung

| Datei | Aenderung |
|-------|-----------|
| `src/pages/AdminPrompts.tsx` | try/catch in allen 4 async Funktionen + Logo klickbar |
| `src/pages/AdminContacts.tsx` | try/catch in loadContacts + handleDelete + Logo klickbar |
| `src/pages/AdminSettings.tsx` | Select position="popper" Fix + Logo klickbar |
| `src/pages/Admin.tsx` | Logo klickbar |
| `src/pages/Delegieren.tsx` | Logo klickbar |

