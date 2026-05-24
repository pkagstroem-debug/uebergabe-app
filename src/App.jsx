import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2, Home, Zap, Layers, Paintbrush, HardHat,
  LayoutGrid, Trees, ChevronRight, Plus, Settings,
  FileText, Loader2, CheckCircle2, AlertCircle, X,
  Euro, Calendar, Trash2, Eye, EyeOff, Wrench,
  Thermometer, DoorOpen, Hammer, TrendingUp, Users,
  MapPin, ArrowLeft, Upload, Star, ChevronDown, ChevronUp,
  Building, Shovel, Check,
} from 'lucide-react';
import { loadData, saveData, loadApiKey, saveApiKey, genId } from './utils/storage.js';
import { analyzeDocument } from './utils/claudeApi.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d) => {
  if (!d) return '–';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
};

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const ICONS = {
  building: Building2,
  home: Home,
  zap: Zap,
  layers: Layers,
  paintbrush: Paintbrush,
  grid: LayoutGrid,
  trees: Trees,
  thermometer: Thermometer,
  door: DoorOpen,
  shovel: Shovel,
  wrench: Wrench,
  default: HardHat,
};

const GewerkIcon = ({ icon, className = 'w-6 h-6' }) => {
  const Comp = ICONS[icon] ?? ICONS.default;
  return <Comp className={className} />;
};

// ─── Status Config ────────────────────────────────────────────────────────────

const PROJECT_STATUS = {
  planning:    { label: 'Planung',        bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  in_progress: { label: 'In Bearbeitung', bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-500'  },
  completed:   { label: 'Abgeschlossen',  bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500' },
};

const GEWERK_STATUS = {
  geplant:        { label: 'Geplant',        bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  ausgeschrieben: { label: 'Ausgeschrieben', bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400' },
  vergeben:       { label: 'Vergeben',       bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-500'  },
  abgeschlossen:  { label: 'Abgeschlossen',  bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500' },
};

const StatusBadge = ({ status, map }) => {
  const s = map[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar = ({ value }) => (
  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all ${value >= 100 ? 'bg-green-500' : value > 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

// ─── Settings Modal ───────────────────────────────────────────────────────────

const SettingsModal = ({ apiKey, onSave, onClose }) => {
  const [key, setKey] = useState(apiKey);
  const [show, setShow] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Einstellungen</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Anthropic API-Schlüssel
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full pr-10 pl-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Wird nur lokal in Ihrem Browser gespeichert. Benötigt für die KI-Angebotsanalyse.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Abbrechen
          </button>
          <button
            onClick={() => { onSave(key); onClose(); }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Add Project Modal ────────────────────────────────────────────────────────

const AddProjectModal = ({ onSave, onClose }) => {
  const [form, setForm] = useState({
    name: '', address: '', description: '', totalBudget: '', units: '',
    startDate: '', endDate: '', status: 'planning',
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      id: genId(),
      ...form,
      totalBudget: parseFloat(form.totalBudget) || 0,
      units: parseInt(form.units) || 1,
      spentBudget: 0,
      progress: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-semibold text-slate-800">Neues Projekt</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Projektname *', field: 'name', placeholder: 'z.B. Wohnanlage Musterstraße 5' },
            { label: 'Adresse', field: 'address', placeholder: 'Straße, PLZ Ort' },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
              <input value={form[field]} onChange={set(field)} placeholder={placeholder}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Beschreibung</label>
            <textarea value={form.description} onChange={set('description')} rows={2}
              placeholder="Kurze Projektbeschreibung..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Gesamtbudget (€)</label>
              <input type="number" value={form.totalBudget} onChange={set('totalBudget')} placeholder="0"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Einheiten</label>
              <input type="number" value={form.units} onChange={set('units')} placeholder="1"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Baubeginn</label>
              <input type="date" value={form.startDate} onChange={set('startDate')}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fertigstellung</label>
              <input type="date" value={form.endDate} onChange={set('endDate')}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select value={form.status} onChange={set('status')}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="planning">Planung</option>
              <option value="in_progress">In Bearbeitung</option>
              <option value="completed">Abgeschlossen</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Abbrechen</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Add Gewerk Modal ─────────────────────────────────────────────────────────

const GEWERK_TEMPLATES = [
  { name: 'Rohbau', icon: 'building' },
  { name: 'Dacharbeiten', icon: 'home' },
  { name: 'Fenster & Türen', icon: 'door' },
  { name: 'Elektroinstallation', icon: 'zap' },
  { name: 'Sanitär & Heizung', icon: 'thermometer' },
  { name: 'Innenputz & Estrich', icon: 'layers' },
  { name: 'Malerarbeiten', icon: 'paintbrush' },
  { name: 'Bodenbeläge', icon: 'grid' },
  { name: 'Außenanlagen', icon: 'trees' },
  { name: 'Erdarbeiten', icon: 'shovel' },
  { name: 'Zimmererarbeiten', icon: 'wrench' },
  { name: 'Sonstiges', icon: 'default' },
];

const AddGewerkModal = ({ projectId, onSave, onClose }) => {
  const [form, setForm] = useState({ name: '', icon: 'default', budget: '', status: 'geplant' });
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ id: genId(), projectId, ...form, budget: parseFloat(form.budget) || 0 });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Neues Gewerk</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Vorlage wählen</label>
            <div className="grid grid-cols-3 gap-2">
              {GEWERK_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setForm((f) => ({ ...f, name: t.name, icon: t.icon }))}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all
                    ${form.name === t.name ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                >
                  <GewerkIcon icon={t.icon} className="w-5 h-5" />
                  <span className="text-center leading-tight">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bezeichnung *</label>
            <input value={form.name} onChange={set('name')} placeholder="Gewerkbezeichnung"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Budget (€)</label>
              <input type="number" value={form.budget} onChange={set('budget')} placeholder="0"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select value={form.status} onChange={set('status')}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="geplant">Geplant</option>
                <option value="ausgeschrieben">Ausgeschrieben</option>
                <option value="vergeben">Vergeben</option>
                <option value="abgeschlossen">Abgeschlossen</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Abbrechen</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Drop Zone ────────────────────────────────────────────────────────────────

const DropZone = ({ onFiles, loading }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const accept = useCallback((files) => {
    const valid = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    if (valid.length) onFiles(valid);
  }, [onFiles]);

  const onDrop = (e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); };
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !loading && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all
        ${loading ? 'pointer-events-none opacity-75' : 'cursor-pointer'}
        ${dragging ? 'border-blue-400 bg-blue-50 scale-[1.01]' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'}`}
    >
      <input ref={inputRef} type="file" multiple accept=".pdf,image/*" className="hidden"
        onChange={(e) => accept(e.target.files)} />
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-sm font-medium text-slate-600">KI analysiert das Dokument…</p>
          <p className="text-xs text-slate-400">Das kann einige Sekunden dauern</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className={`p-3 rounded-xl transition-colors ${dragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
            <Upload className={`w-8 h-8 ${dragging ? 'text-blue-500' : 'text-slate-400'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {dragging ? 'Datei(en) loslassen' : 'Angebote hier ablegen'}
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF oder Bild (JPG, PNG) · KI liest automatisch alle Daten aus</p>
          </div>
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Klicken oder per Drag & Drop
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Offer Row ────────────────────────────────────────────────────────────────

const OfferRow = ({ offer, isBest, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    ready:     <CheckCircle2 className="w-4 h-4 text-green-500" />,
    analyzing: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    error:     <AlertCircle className="w-4 h-4 text-red-500" title={offer.errorMessage} />,
  }[offer.status];

  const numFmt = (n) => n != null ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '–';

  return (
    <>
      <tr className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${isBest ? 'bg-green-50/50' : ''}`}>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            {isBest && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
            {statusIcon}
          </div>
        </td>
        <td className="px-4 py-3.5">
          <p className={`text-sm font-semibold ${isBest ? 'text-green-800' : 'text-slate-800'}`}>
            {offer.company ?? (offer.status === 'analyzing' ? 'Wird analysiert…' : 'Unbekannt')}
          </p>
          {offer.contactPerson && <p className="text-xs text-slate-400 mt-0.5">{offer.contactPerson}</p>}
        </td>
        <td className="px-4 py-3.5">
          <span className="text-xs text-slate-400 truncate max-w-[140px] block">{offer.fileName}</span>
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{fmtDate(offer.offerDate)}</td>
        <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{fmtDate(offer.validUntil)}</td>
        <td className="px-4 py-3.5">
          <span className={`text-sm font-bold whitespace-nowrap ${isBest ? 'text-green-700' : 'text-slate-800'}`}>
            {fmt(offer.totalNet)}
          </span>
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">{fmt(offer.totalGross)}</td>
        <td className="px-4 py-3.5 text-sm text-slate-500 text-center">{offer.items?.length ?? 0}</td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-1">
            {offer.items?.length > 0 && (
              <button onClick={() => setExpanded(!expanded)}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
                title="Positionen anzeigen">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => onDelete(offer.id)}
              className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors text-slate-300"
              title="Löschen">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/50">
          <td colSpan={9} className="px-6 py-4">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Pos.', 'Beschreibung', 'Menge', 'Einheit', 'EP (€)', 'GP (€)'].map((h, i) => (
                      <th key={h} className={`px-3 py-2 text-xs font-semibold text-slate-500 ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {offer.items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 text-slate-400 font-mono">{item.position}</td>
                      <td className="px-3 py-2.5 text-slate-700 max-w-xs">{item.description}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{item.quantity != null ? new Intl.NumberFormat('de-DE').format(item.quantity) : '–'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{item.unit}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{numFmt(item.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{numFmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-right text-slate-500 font-medium">Netto gesamt</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">{numFmt(offer.totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
              {offer.paymentTerms && (
                <span><span className="font-medium text-slate-600">Zahlung:</span> {offer.paymentTerms}</span>
              )}
              {offer.notes && (
                <span><span className="font-medium text-slate-600">Hinweise:</span> {offer.notes}</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Projects View ────────────────────────────────────────────────────────────

const ProjectsView = ({ projects, gewerke, angebote, onSelect, onAdd, onDelete }) => {
  const getStats = (pid) => {
    const gwIds = gewerke.filter((g) => g.projectId === pid).map((g) => g.id);
    return {
      gwCount: gwIds.length,
      offerCount: angebote.filter((a) => gwIds.includes(a.gewerkId)).length,
    };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bauprojekte</h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} {projects.length === 1 ? 'Projekt' : 'Projekte'} insgesamt</p>
        </div>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Neues Projekt
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="font-medium">Noch keine Projekte</p>
          <p className="text-sm mt-1">Erstellen Sie Ihr erstes Bauprojekt</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((p) => {
            const { gwCount, offerCount } = getStats(p.id);
            return (
              <div key={p.id} onClick={() => onSelect(p)}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-md cursor-pointer transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} map={PROJECT_STATUS} />
                    <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                      className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-200 group-hover:text-slate-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-900 text-base leading-snug">{p.name}</h3>
                {p.address && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />{p.address}
                  </p>
                )}
                {p.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{p.description}</p>}

                <div className="mt-4 mb-1">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Fortschritt</span>
                    <span className="font-medium">{p.progress}%</span>
                  </div>
                  <ProgressBar value={p.progress} />
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <p className="text-slate-400">Gesamtbudget</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{fmt(p.totalBudget)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Einheiten</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{p.units}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Gewerke</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{gwCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Angebote</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{offerCount}</p>
                  </div>
                </div>

                {p.startDate && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" />
                    {fmtDate(p.startDate)} – {fmtDate(p.endDate)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Gewerke View ─────────────────────────────────────────────────────────────

const GewerkeView = ({ project, gewerke, angebote, onBack, onSelect, onAdd, onDelete }) => {
  const bestOffer = (gid) => {
    const offers = angebote.filter((a) => a.gewerkId === gid && a.status === 'ready' && a.totalNet != null);
    return offers.length ? offers.reduce((a, b) => (a.totalNet < b.totalNet ? a : b)) : null;
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Alle Projekte
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
              {project.address && (
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />{project.address}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={project.status} map={PROJECT_STATUS} />
        </div>
        {project.description && <p className="text-sm text-slate-500 mt-3 ml-[60px]">{project.description}</p>}
        <div className="mt-4 ml-[60px] grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Budget', value: fmt(project.totalBudget) },
            { label: 'Fortschritt', value: `${project.progress}%` },
            project.startDate && { label: 'Baubeginn', value: fmtDate(project.startDate) },
            project.endDate && { label: 'Fertigstellung', value: fmtDate(project.endDate) },
          ].filter(Boolean).map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Gewerke <span className="text-slate-400 font-normal text-base">({gewerke.length})</span>
        </h2>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Gewerk hinzufügen
        </button>
      </div>

      {gewerke.length === 0 ? (
        <div className="text-center py-14 bg-white border border-slate-200 rounded-2xl text-slate-400">
          <HardHat className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="font-medium">Noch keine Gewerke</p>
          <p className="text-sm mt-1">Fügen Sie das erste Gewerk hinzu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gewerke.map((g) => {
            const count = angebote.filter((a) => a.gewerkId === g.id).length;
            const best = bestOffer(g.id);

            return (
              <div key={g.id} onClick={() => onSelect(g)}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-md cursor-pointer transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors text-slate-400 group-hover:text-blue-600">
                    <GewerkIcon icon={g.icon} />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={g.status} map={GEWERK_STATUS} />
                    <button onClick={(e) => { e.stopPropagation(); onDelete(g.id); }}
                      className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-200 group-hover:text-slate-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-800">{g.name}</h3>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-400">Budget</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{fmt(g.budget)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Angebote</p>
                    <p className="font-semibold text-slate-700 mt-0.5 flex items-center gap-1">
                      {count}
                      {count > 0 && <FileText className="w-3 h-3 text-slate-300" />}
                    </p>
                  </div>
                  {best && (
                    <div className="col-span-2">
                      <p className="text-slate-400">Günstigstes Angebot</p>
                      <p className="font-semibold text-green-700 mt-0.5 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {fmt(best.totalNet)}
                      </p>
                    </div>
                  )}
                </div>

                {g.budget > 0 && best && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Angebot vs. Budget</span>
                      <span className={best.totalNet > g.budget ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                        {best.totalNet > g.budget ? '+' : ''}{fmt(best.totalNet - g.budget)}
                      </span>
                    </div>
                    <ProgressBar value={(best.totalNet / g.budget) * 100} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Angebote View ────────────────────────────────────────────────────────────

const AngeboteView = ({ project, gewerk, angebote, onBack, onAddOffer, onDeleteOffer, apiKey, onNeedApiKey }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const readyOffers = angebote.filter((a) => a.status === 'ready' && a.totalNet != null);
  const bestId = readyOffers.length
    ? readyOffers.reduce((a, b) => (a.totalNet < b.totalNet ? a : b)).id
    : null;

  const sorted = [...angebote].sort((a, b) => {
    if (a.totalNet != null && b.totalNet != null) return a.totalNet - b.totalNet;
    if (a.totalNet != null) return -1;
    return 1;
  });

  const handleFiles = async (files) => {
    if (!apiKey) { onNeedApiKey(); return; }
    setUploading(true);
    setError('');

    for (const file of files) {
      const placeholderId = genId();
      onAddOffer({
        id: placeholderId, gewerkId: gewerk.id, fileName: file.name, fileSize: file.size,
        uploadedAt: new Date().toISOString(), status: 'analyzing',
        company: null, totalNet: null, totalGross: null, items: [],
      });

      try {
        const result = await analyzeDocument(file, apiKey);
        onAddOffer({
          id: placeholderId, gewerkId: gewerk.id, fileName: file.name, fileSize: file.size,
          uploadedAt: new Date().toISOString(), status: 'ready', ...result,
        }, true);
      } catch (err) {
        onAddOffer({
          id: placeholderId, gewerkId: gewerk.id, fileName: file.name, fileSize: file.size,
          uploadedAt: new Date().toISOString(), status: 'error', errorMessage: err.message,
          company: null, totalNet: null, totalGross: null, items: [],
        }, true);
        setError(`Fehler bei "${file.name}": ${err.message}`);
      }
    }
    setUploading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <button onClick={() => onBack('projects')} className="hover:text-slate-800 transition-colors">Projekte</button>
        <ChevronRight className="w-4 h-4" />
        <button onClick={() => onBack('gewerke')} className="hover:text-slate-800 transition-colors">{project.name}</button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-slate-800">{gewerk.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-50 rounded-xl text-slate-500">
            <GewerkIcon icon={gewerk.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{gewerk.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Budget: <span className="font-medium text-slate-700">{fmt(gewerk.budget)}</span>
              {readyOffers.length > 0 && bestId && (
                <span className="ml-3 text-green-600">
                  Günstigstes: <span className="font-medium">{fmt(readyOffers.find((o) => o.id === bestId)?.totalNet)}</span>
                </span>
              )}
            </p>
          </div>
        </div>
        <StatusBadge status={gewerk.status} map={GEWERK_STATUS} />
      </div>

      <DropZone onFiles={handleFiles} loading={uploading} />

      {error && (
        <div className="mt-3 flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Analysefehler</p>
            <p className="text-xs mt-0.5 break-words">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!apiKey && (
        <div className="mt-3 flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <p>
            Kein API-Schlüssel hinterlegt.{' '}
            <button onClick={onNeedApiKey} className="underline font-medium hover:no-underline">
              Anthropic API-Schlüssel eintragen
            </button>{' '}
            um Angebote automatisch auszulesen.
          </p>
        </div>
      )}

      <div className="mt-7">
        <h2 className="text-base font-semibold text-slate-900 mb-3">
          Angebotsvergleich{' '}
          <span className="text-slate-400 font-normal text-sm">
            ({angebote.length} {angebote.length === 1 ? 'Angebot' : 'Angebote'})
          </span>
        </h2>

        {angebote.length === 0 ? (
          <div className="text-center py-14 bg-white border border-slate-200 rounded-2xl text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="font-medium">Noch keine Angebote</p>
            <p className="text-sm mt-1">Laden Sie Angebote per Drag & Drop hoch – die KI liest alles automatisch aus</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-10"></th>
                    {['Firma', 'Datei', 'Datum', 'Gültig bis', 'Netto', 'Brutto', 'Pos.', ''].map((h, i) => (
                      <th key={i} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${i === 6 ? 'text-center' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((offer) => (
                    <OfferRow key={offer.id} offer={offer} isBest={offer.id === bestId} onDelete={onDeleteOffer} />
                  ))}
                </tbody>
              </table>
            </div>
            {readyOffers.length > 1 && (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                Günstigstes Angebot ist hervorgehoben · Positionen mit{' '}
                <ChevronDown className="w-3 h-3 inline" /> aufklappen
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData] = useState(loadData);
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [view, setView] = useState({ screen: 'projects' });
  const [showSettings, setShowSettings] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddGewerk, setShowAddGewerk] = useState(false);

  useEffect(() => { saveData(data); }, [data]);

  const project = data.projects.find((p) => p.id === view.projectId);
  const gewerk  = data.gewerke.find((g) => g.id === view.gewerkId);

  const projectGewerke  = project ? data.gewerke.filter((g) => g.projectId === project.id) : [];
  const gewerkAngebote  = gewerk  ? data.angebote.filter((a) => a.gewerkId === gewerk.id)  : [];

  const handleSaveApiKey = (key) => { setApiKey(key); saveApiKey(key); };

  const handleAddProject   = (p) => setData((d) => ({ ...d, projects: [...d.projects, p] }));
  const handleDeleteProject = (id) => {
    const gwIds = data.gewerke.filter((g) => g.projectId === id).map((g) => g.id);
    setData((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
      gewerke:  d.gewerke.filter((g) => g.projectId !== id),
      angebote: d.angebote.filter((a) => !gwIds.includes(a.gewerkId)),
    }));
    if (view.projectId === id) setView({ screen: 'projects' });
  };

  const handleAddGewerk    = (g) => setData((d) => ({ ...d, gewerke: [...d.gewerke, g] }));
  const handleDeleteGewerk  = (id) => {
    setData((d) => ({
      ...d,
      gewerke:  d.gewerke.filter((g) => g.id !== id),
      angebote: d.angebote.filter((a) => a.gewerkId !== id),
    }));
    if (view.gewerkId === id) setView({ screen: 'gewerke', projectId: view.projectId });
  };

  const handleAddOffer = (offer, replace = false) =>
    setData((d) => ({
      ...d,
      angebote: replace
        ? d.angebote.map((a) => (a.id === offer.id ? offer : a))
        : [...d.angebote, offer],
    }));

  const handleDeleteOffer = (id) => setData((d) => ({ ...d, angebote: d.angebote.filter((a) => a.id !== id) }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <button onClick={() => setView({ screen: 'projects' })}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-shrink-0">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">BauTrack</span>
          </button>

          {view.screen !== 'projects' && (
            <nav className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 overflow-hidden">
              <button onClick={() => setView({ screen: 'projects' })}
                className="hover:text-slate-800 transition-colors flex-shrink-0">Projekte</button>
              {project && (
                <>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  <button onClick={() => setView({ screen: 'gewerke', projectId: project.id })}
                    className={`hover:text-slate-800 transition-colors truncate max-w-[180px] ${view.screen === 'gewerke' ? 'font-medium text-slate-800' : ''}`}>
                    {project.name}
                  </button>
                </>
              )}
              {gewerk && (
                <>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium text-slate-800 truncate">{gewerk.name}</span>
                </>
              )}
            </nav>
          )}

          <button onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 flex-shrink-0"
            title="Einstellungen (API-Schlüssel)">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view.screen === 'projects' && (
          <ProjectsView
            projects={data.projects} gewerke={data.gewerke} angebote={data.angebote}
            onSelect={(p) => setView({ screen: 'gewerke', projectId: p.id })}
            onAdd={() => setShowAddProject(true)}
            onDelete={handleDeleteProject}
          />
        )}

        {view.screen === 'gewerke' && project && (
          <GewerkeView
            project={project} gewerke={projectGewerke} angebote={data.angebote}
            onBack={() => setView({ screen: 'projects' })}
            onSelect={(g) => setView({ screen: 'angebote', projectId: project.id, gewerkId: g.id })}
            onAdd={() => setShowAddGewerk(true)}
            onDelete={handleDeleteGewerk}
          />
        )}

        {view.screen === 'angebote' && project && gewerk && (
          <AngeboteView
            project={project} gewerk={gewerk} angebote={gewerkAngebote}
            onBack={(target) => {
              if (target === 'projects') setView({ screen: 'projects' });
              else setView({ screen: 'gewerke', projectId: project.id });
            }}
            onAddOffer={handleAddOffer}
            onDeleteOffer={handleDeleteOffer}
            apiKey={apiKey}
            onNeedApiKey={() => setShowSettings(true)}
          />
        )}
      </main>

      {/* Modals */}
      {showSettings && (
        <SettingsModal apiKey={apiKey} onSave={handleSaveApiKey} onClose={() => setShowSettings(false)} />
      )}
      {showAddProject && (
        <AddProjectModal onSave={handleAddProject} onClose={() => setShowAddProject(false)} />
      )}
      {showAddGewerk && project && (
        <AddGewerkModal projectId={project.id} onSave={handleAddGewerk} onClose={() => setShowAddGewerk(false)} />
      )}
    </div>
  );
}
