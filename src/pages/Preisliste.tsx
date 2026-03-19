import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, Search, Sparkles, Download, ChevronDown, ChevronRight,
  X, FileSpreadsheet, FileJson, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import logo from '@/assets/logo-bau4you.png';

interface Wage {
  id: string;
  name: string;
  wage_cost_price: number;
  wage_per_hour: number;
  net_price_per_unit: number;
  time_minutes: number;
  quantity: number;
  activity: string;
}

interface Service {
  id: string;
  nr: string;
  name: string;
  description: string;
  manufacturer: string;
  unit_type: string;
  net_price_per_unit: number;
  vat_percent: number;
  time_minutes: number;
  materials: Material[];
  materialCount: number;
  wages: Wage[];
}

interface Material {
  nr: string;
  name: string;
  quantity: number;
  unit_type: string;
  net_price_per_unit: number;
  base_price: number;
  list_price: number;
}

interface Product {
  nr: string;
  internal_identifier: string;
  base_price: number;
  list_price: number;
  vat_percent: number;
  is_deleted: boolean;
  price_quantity: number;
  quantity_min: number;
  quantity_interval: number;
  delivery_time: string;
  attributes: Record<string, unknown>[];
  base_data: {
    name: string;
    description: string;
    category: string;
    unit_type: string;
    manufacturer: string;
    manufacturer_nr: string;
  };
}

type TabType = 'services' | 'products';

export default function Preisliste() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabType>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState({ services: false, products: false });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedGewerke, setSelectedGewerke] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [onlyWithMaterial, setOnlyWithMaterial] = useState(false);
  const [showGewerkeDropdown, setShowGewerkeDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // KI filter
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilteredIds, setAiFilteredIds] = useState<Set<number> | null>(null);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Download dropdown
  const [showDownload, setShowDownload] = useState(false);

  const fetchData = useCallback(async (type: TabType) => {
    if (loaded[type]) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('hero-export', {
        body: { type },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (type === 'services') {
        setServices(data.items || []);
      } else {
        setProducts(data.items || []);
      }
      setLoaded(prev => ({ ...prev, [type]: true }));
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error(`Fehler beim Laden: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  useEffect(() => {
    if (user) fetchData(tab);
  }, [user, tab, fetchData]);

  // Reset AI filter on tab change
  useEffect(() => {
    setAiFilteredIds(null);
    setAiQuery('');
    setExpandedRows(new Set());
  }, [tab]);

  // Dynamic filter options
  const gewerke = useMemo(() => {
    const set = new Set<string>();
    services.forEach(s => { if (s.manufacturer) set.add(s.manufacturer); });
    return Array.from(set).sort();
  }, [services]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.base_data?.category) set.add(p.base_data.category); });
    return Array.from(set).sort();
  }, [products]);

  const units = useMemo(() => {
    const set = new Set<string>();
    if (tab === 'services') {
      services.forEach(s => { if (s.unit_type) set.add(s.unit_type); });
    } else {
      products.forEach(p => { if (p.base_data?.unit_type) set.add(p.base_data.unit_type); });
    }
    return Array.from(set).sort();
  }, [tab, services, products]);

  // Filtered items
  const filteredServices = useMemo(() => {
    let items = services;
    if (aiFilteredIds) {
      items = items.filter((_, i) => aiFilteredIds.has(i));
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(s =>
        s.nr?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      );
    }
    if (selectedGewerke.length > 0) {
      items = items.filter(s => selectedGewerke.includes(s.manufacturer));
    }
    if (selectedUnits.length > 0) {
      items = items.filter(s => selectedUnits.includes(s.unit_type));
    }
    if (priceMin) items = items.filter(s => s.net_price_per_unit >= parseFloat(priceMin));
    if (priceMax) items = items.filter(s => s.net_price_per_unit <= parseFloat(priceMax));
    if (onlyWithMaterial) items = items.filter(s => s.materialCount > 0);
    return items;
  }, [services, search, selectedGewerke, selectedUnits, priceMin, priceMax, onlyWithMaterial, aiFilteredIds]);

  const filteredProducts = useMemo(() => {
    let items = products;
    if (aiFilteredIds) {
      items = items.filter((_, i) => aiFilteredIds.has(i));
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        p.nr?.toLowerCase().includes(q) ||
        p.base_data?.name?.toLowerCase().includes(q) ||
        p.base_data?.description?.toLowerCase().includes(q) ||
        p.base_data?.category?.toLowerCase().includes(q)
      );
    }
    if (selectedGewerke.length > 0) {
      items = items.filter(p => selectedGewerke.includes(p.base_data?.category));
    }
    if (selectedUnits.length > 0) {
      items = items.filter(p => selectedUnits.includes(p.base_data?.unit_type));
    }
    if (priceMin) items = items.filter(p => p.list_price >= parseFloat(priceMin));
    if (priceMax) items = items.filter(p => p.list_price <= parseFloat(priceMax));
    return items;
  }, [products, search, selectedGewerke, selectedUnits, priceMin, priceMax, aiFilteredIds]);

  const totalCount = tab === 'services' ? services.length : products.length;
  const filteredCount = tab === 'services' ? filteredServices.length : filteredProducts.length;

  // KI filter
  const handleAiFilter = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const items = tab === 'services' ? services : products;
      const { data, error } = await supabase.functions.invoke('hero-filter', {
        body: { query: aiQuery, items, type: tab },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const resultItems = data.items || [];
      const ids = new Set<number>();
      const sourceItems = tab === 'services' ? services : products;
      resultItems.forEach((item: Service | Product) => {
        const idx = sourceItems.indexOf(item);
        if (idx >= 0) ids.add(idx);
      });

      // Match by nr instead if indexOf fails
      if (ids.size === 0 && resultItems.length > 0) {
        resultItems.forEach((item: Service | Product) => {
          const itemNr = 'nr' in item ? item.nr : '';
          const idx = sourceItems.findIndex((s: Service | Product) => ('nr' in s ? s.nr : '') === itemNr);
          if (idx >= 0) ids.add(idx);
        });
      }

      setAiFilteredIds(ids.size > 0 ? ids : new Set());
      toast.success(`KI-Filter: ${data.count} Treffer`);
    } catch (err) {
      console.error('AI filter error:', err);
      toast.error('KI-Filter fehlgeschlagen');
    } finally {
      setAiLoading(false);
    }
  };

  const clearAiFilter = () => {
    setAiFilteredIds(null);
    setAiQuery('');
  };

  // Toggle row expand
  const toggleRow = (index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Shared calculation helper — uses Hero's own net_price_per_unit × quantity
  const calcServiceRow = (s: Service) => {
    const wages = s.wages || [];
    const materials = s.materials || [];
    const laborVkNetto = wages.reduce((sum, w) => sum + ((w.net_price_per_unit || 0) * (w.quantity || 0)), 0);
    const materialVkNetto = materials.reduce((sum, m) => sum + ((m.net_price_per_unit || 0) * (m.quantity || 1)), 0);
    const laborMinutes = wages.reduce((sum, w) => sum + (w.time_minutes || 0), 0);
    const laborHours = laborMinutes / 60;
    // Stundensatz = Gesamt-Lohn / Stunden (gewichteter Durchschnitt bei mehreren Lohngruppen)
    const laborVkPerHour = laborHours > 0 ? laborVkNetto / laborHours : 0;
    return {
      laborVkNetto: Math.round(laborVkNetto * 100) / 100,
      materialVkNetto: Math.round(materialVkNetto * 100) / 100,
      laborMinutes,
      laborVkPerHour: Math.round(laborVkPerHour * 100) / 100,
    };
  };

  // Downloads
  const downloadJSON = () => {
    let blob: Blob;
    if (tab === 'services') {
      const enriched = filteredServices.map(s => {
        const { laborVkNetto, materialVkNetto, laborMinutes, laborVkPerHour } = calcServiceRow(s);
        return {
          ...s,
          kalkulation: {
            vk_netto_einheit: s.net_price_per_unit,
            lohn_vk_netto: laborVkNetto,
            material_vk_netto: materialVkNetto,
            lohn_minuten: laborMinutes,
            lohn_vk_per_hour: laborVkPerHour,
          },
        };
      });
      blob = new Blob([JSON.stringify(enriched, null, 2)], { type: 'application/json' });
    } else {
      blob = new Blob([JSON.stringify(filteredProducts, null, 2)], { type: 'application/json' });
    }
    downloadBlob(blob, `preisliste-${tab}.json`);
  };

  const downloadXLSX = async () => {
    const XLSX = await import('xlsx');

    if (tab === 'services') {
      // Bau4You Excel Template format — uses Hero's own values
      const rows = filteredServices.map(s => {
        const { laborVkNetto, materialVkNetto, laborMinutes, laborVkPerHour } = calcServiceRow(s);
        return {
          'Leistungsnummer': s.nr || '',
          'Einheit': s.unit_type || '',
          'Leistungsname (Kurztext)': s.name || '',
          'Beschreibung (Langtext)': s.description || '',
          'VK Neu Netto / Einheit': Math.round((s.net_price_per_unit || 0) * 100) / 100,
          'Lohnkosten VK Netto neu / Einheit': laborVkNetto,
          'Materialkosten VK Netto neu / Einheit': materialVkNetto,
          'Lohnkosten Minuten / Einheit': laborMinutes,
          'Lohnkosten VK Netto/ Einheit': laborVkPerHour,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      // Set column widths
      ws['!cols'] = [
        { wch: 18 }, { wch: 10 }, { wch: 40 }, { wch: 60 },
        { wch: 20 }, { wch: 28 }, { wch: 32 }, { wch: 24 }, { wch: 24 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Preisliste');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Bau4You_Preisliste.xlsx');
    } else {
      const rows = filteredProducts.map(p => ({
        Nr: p.nr,
        Name: p.base_data?.name,
        Kategorie: p.base_data?.category,
        Einheit: p.base_data?.unit_type,
        'EK (€)': p.base_price,
        'VK (€)': p.list_price,
        Beschreibung: p.base_data?.description,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Artikel');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `preisliste-artikel.xlsx`);
    }
  };

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(16);
    doc.text(`Preisliste - ${tab === 'services' ? 'Leistungen' : 'Artikel'}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`${filteredCount} von ${totalCount} Einträgen`, 14, 28);

    if (tab === 'services') {
      autoTable(doc, {
        startY: 35,
        head: [['Nr', 'Einheit', 'Leistungsname', 'VK Netto/Einh.', 'Lohn VK Netto', 'Material VK Netto', 'Lohn Min.', 'Lohn VK/h']],
        body: filteredServices.map(s => {
          const { laborVkNetto, materialVkNetto, laborMinutes, laborVkPerHour } = calcServiceRow(s);
          return [
            s.nr, s.unit_type, s.name,
            s.net_price_per_unit?.toFixed(2),
            laborVkNetto.toFixed(2),
            materialVkNetto.toFixed(2),
            laborMinutes,
            laborVkPerHour.toFixed(2),
          ];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    } else {
      autoTable(doc, {
        startY: 35,
        head: [['Nr', 'Name', 'Kategorie', 'Einheit', 'EK (€)', 'VK (€)']],
        body: filteredProducts.map(p => [
          p.nr, p.base_data?.name, p.base_data?.category, p.base_data?.unit_type,
          p.base_price?.toFixed(2), p.list_price?.toFixed(2),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    doc.save(`preisliste-${tab}.pdf`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllFilters = () => {
    setSearch('');
    setSelectedGewerke([]);
    setSelectedUnits([]);
    setPriceMin('');
    setPriceMax('');
    setOnlyWithMaterial(false);
    clearAiFilter();
  };

  const hasActiveFilters = search || selectedGewerke.length > 0 || selectedUnits.length > 0 || priceMin || priceMax || onlyWithMaterial || aiFilteredIds;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const filterOptions = tab === 'services' ? gewerke : categories;
  const filterLabel = tab === 'services' ? 'Gewerk' : 'Kategorie';

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <img src={logo} alt="BAU4YOU" className="h-8 w-auto" />
          <span className="font-display font-bold text-lg text-foreground">Preisliste</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {filteredCount} von {totalCount}
        </Badge>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => setTab('services')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
            tab === 'services' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Leistungen
        </button>
        <button
          onClick={() => setTab('products')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
            tab === 'products' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Artikel
        </button>
      </div>

      {/* Search + KI */}
      <div className="px-4 py-3 space-y-2 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Nr, Name, Beschreibung..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* KI Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
            <Input
              placeholder="KI-Suche: z.B. &quot;alle Malerarbeiten unter 50€&quot;"
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiFilter()}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button size="sm" onClick={handleAiFilter} disabled={aiLoading || !aiQuery.trim()} className="h-9 px-3">
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </Button>
          {aiFilteredIds && (
            <Button size="sm" variant="ghost" onClick={clearAiFilter} className="h-9 px-2">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Filter toggle + active badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-7 text-xs gap-1">
            Filter {showFilters ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </Button>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearAllFilters} className="h-7 text-xs text-destructive">
              Alle Filter löschen
            </Button>
          )}
          {aiFilteredIds && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
              KI-Filter aktiv
            </Badge>
          )}
          {selectedGewerke.map(g => (
            <Badge key={g} variant="secondary" className="text-xs gap-1">
              {g}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedGewerke(prev => prev.filter(x => x !== g))} />
            </Badge>
          ))}
          {selectedUnits.map(u => (
            <Badge key={u} variant="secondary" className="text-xs gap-1">
              {u}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedUnits(prev => prev.filter(x => x !== u))} />
            </Badge>
          ))}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="space-y-3 pt-2">
            {/* Gewerk / Category multi-select */}
            {filterOptions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setShowGewerkeDropdown(!showGewerkeDropdown); setShowUnitDropdown(false); }}
                  className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <span className="text-muted-foreground">
                    {selectedGewerke.length > 0 ? `${selectedGewerke.length} ${filterLabel}(e)` : `${filterLabel} wählen...`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {showGewerkeDropdown && (
                  <div className="absolute z-20 top-10 left-0 right-0 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                    {filterOptions.map(g => (
                      <label key={g} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedGewerke.includes(g)}
                          onChange={e => {
                            if (e.target.checked) setSelectedGewerke(prev => [...prev, g]);
                            else setSelectedGewerke(prev => prev.filter(x => x !== g));
                          }}
                          className="rounded"
                        />
                        {g}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Unit multi-select */}
            {units.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setShowUnitDropdown(!showUnitDropdown); setShowGewerkeDropdown(false); }}
                  className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <span className="text-muted-foreground">
                    {selectedUnits.length > 0 ? `${selectedUnits.length} Einheit(en)` : 'Einheit wählen...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {showUnitDropdown && (
                  <div className="absolute z-20 top-10 left-0 right-0 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                    {units.map(u => (
                      <label key={u} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedUnits.includes(u)}
                          onChange={e => {
                            if (e.target.checked) setSelectedUnits(prev => [...prev, u]);
                            else setSelectedUnits(prev => prev.filter(x => x !== u));
                          }}
                          className="rounded"
                        />
                        {u}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Price range */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Preis min"
                value={priceMin}
                onChange={e => setPriceMin(e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                type="number"
                placeholder="Preis max"
                value={priceMax}
                onChange={e => setPriceMax(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Only with materials (services only) */}
            {tab === 'services' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyWithMaterial}
                  onChange={e => setOnlyWithMaterial(e.target.checked)}
                  className="rounded"
                />
                Nur mit Material
              </label>
            )}
          </div>
        )}
      </div>

      {/* Download bar */}
      <div className="px-4 py-2 flex justify-end border-b border-border/20 relative">
        <Button size="sm" variant="outline" onClick={() => setShowDownload(!showDownload)} className="h-7 text-xs gap-1">
          <Download className="w-3 h-3" /> Export
        </Button>
        {showDownload && (
          <div className="absolute z-20 top-9 right-4 bg-popover border border-border rounded-md shadow-lg py-1">
            <button onClick={() => { downloadJSON(); setShowDownload(false); }} className="flex items-center gap-2 px-4 py-2 hover:bg-secondary/50 text-sm w-full text-left">
              <FileJson className="w-4 h-4" /> JSON
            </button>
            <button onClick={() => { downloadXLSX(); setShowDownload(false); }} className="flex items-center gap-2 px-4 py-2 hover:bg-secondary/50 text-sm w-full text-left">
              <FileSpreadsheet className="w-4 h-4" /> Excel (XLSX)
            </button>
            <button onClick={() => { downloadPDF(); setShowDownload(false); }} className="flex items-center gap-2 px-4 py-2 hover:bg-secondary/50 text-sm w-full text-left">
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <main className="flex-1 overflow-y-auto" onClick={() => { setShowDownload(false); setShowGewerkeDropdown(false); setShowUnitDropdown(false); }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Lade Daten aus HERO...</span>
          </div>
        ) : tab === 'services' ? (
          <div className="divide-y divide-border/30">
            {filteredServices.map((s, i) => {
              const isHeader = s.nr?.endsWith('-000');
              return (
              <div key={`${s.id}-${i}`}>
                <button
                  onClick={() => toggleRow(i)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${isHeader ? 'bg-red-50 dark:bg-red-950/30' : 'hover:bg-secondary/30'}`}
                >
                  <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 transition-transform ${isHeader ? 'text-red-500' : 'text-muted-foreground'} ${expandedRows.has(i) ? 'rotate-90' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-mono ${isHeader ? 'text-red-600 dark:text-red-400 font-bold' : 'text-muted-foreground'}`}>{s.nr}</span>
                      <span className={`text-sm font-medium truncate ${isHeader ? 'text-red-600 dark:text-red-400 font-bold' : 'text-foreground'}`}>{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {s.manufacturer && <span>{s.manufacturer}</span>}
                      {s.unit_type && <span>{s.unit_type}</span>}
                      {s.time_minutes > 0 && <span>{s.time_minutes} min</span>}
                      {s.materialCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          {s.materialCount} Mat.
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                    {s.net_price_per_unit?.toFixed(2)} €
                  </span>
                </button>
                {expandedRows.has(i) && (
                  <div className="px-4 pb-3 pl-11 space-y-2">
                    {s.description && (
                      <p className="text-xs text-muted-foreground whitespace-pre-line">{s.description}</p>
                    )}
                    {s.wages && s.wages.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Lohn / Maschinenkosten:</p>
                        <div className="space-y-1">
                          {s.wages.map((w, wi) => (
                            <div key={wi} className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{w.name}</span>
                                <span className="shrink-0 ml-2">{w.time_minutes} min ({(w.time_minutes / 60).toFixed(1)} h)</span>
                              </div>
                              <div className="flex justify-end gap-3 mt-0.5 font-mono">
                                <span>EK {w.wage_cost_price?.toFixed(2)}€/h</span>
                                <span>VK {w.wage_per_hour?.toFixed(2)}€/h</span>
                                <span className="font-semibold">= {(w.wage_per_hour * w.time_minutes / 60).toFixed(2)}€</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {s.materials && s.materials.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Materialien:</p>
                        <div className="space-y-1">
                          {s.materials.map((m, mi) => (
                            <div key={mi} className="text-xs text-muted-foreground bg-secondary/30 rounded px-2 py-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  {m.nr && <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">Art. {m.nr}</span>}
                                  <span className="truncate">{m.name}</span>
                                </div>
                                <span className="shrink-0 ml-2">{m.quantity} {m.unit_type}</span>
                              </div>
                              <div className="flex justify-end gap-2 mt-0.5 font-mono">
                                {m.base_price != null && <span>EK {m.base_price.toFixed(2)}€</span>}
                                {m.list_price != null && <span>VK {m.list_price.toFixed(2)}€</span>}
                                {m.base_price == null && m.list_price == null && m.net_price_per_unit != null && (
                                  <span>{m.net_price_per_unit.toFixed(2)} €</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ); })}
            {filteredServices.length === 0 && !loading && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Keine Leistungen gefunden
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredProducts.map((p, i) => (
              <div key={`${p.nr}-${i}`}>
                <button
                  onClick={() => toggleRow(i)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
                >
                  <ChevronRight className={`w-4 h-4 mt-0.5 text-muted-foreground shrink-0 transition-transform ${expandedRows.has(i) ? 'rotate-90' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{p.nr}</span>
                      <span className="text-sm font-medium text-foreground truncate">{p.base_data?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {p.base_data?.category && <span>{p.base_data.category}</span>}
                      {p.base_data?.unit_type && <span>{p.base_data.unit_type}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-foreground">{p.list_price?.toFixed(2)} €</div>
                    <div className="text-xs text-muted-foreground">EK {p.base_price?.toFixed(2)} €</div>
                  </div>
                </button>
                {expandedRows.has(i) && (
                  <div className="px-4 pb-3 pl-11">
                    {p.base_data?.description && (
                      <p className="text-xs text-muted-foreground whitespace-pre-line">{p.base_data.description}</p>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      {p.base_data?.manufacturer && <p>Hersteller: {p.base_data.manufacturer}</p>}
                      {p.internal_identifier && <p>Interne ID: {p.internal_identifier}</p>}
                      <p>MwSt: {p.vat_percent}%</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredProducts.length === 0 && !loading && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Keine Artikel gefunden
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
