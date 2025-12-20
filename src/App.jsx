import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Trash2, 
  Plus, 
  ChevronRight, 
  Check, 
  FileText, 
  Key, 
  Zap, 
  PenTool,
  Eye,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Camera,
  Wand2,
  X,
  UploadCloud,
  Loader2,
  Download,
  MapPin,
  Home,
  User,
  LayoutGrid,
  Save,
  RotateCcw,
  AlertTriangle,
  Archive,
  FileClock,
  CheckCircle2,
  ExternalLink,
  History
} from 'lucide-react';

// --- KONFIGURATION ---
const getN8nWebhookUrl = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_N8N_WEBHOOK_URL;
    }
  } catch (e) {
    console.warn('Environment variables not accessible via import.meta');
  }
  return '';
};

const N8N_WEBHOOK_URL = getN8nWebhookUrl();
const DRAFT_STORAGE_KEY = "uebergabeApp.currentDraft"; // [PERSISTENCE] Aktueller Entwurf (Full Data)
const HISTORY_STORAGE_KEY = "uebergabeApp.protocolHistory"; // [PERSISTENCE] Historie (Metadaten)

// --- HELPER: UUID (ROBUST) ---
const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; 
  bytes[8] = (bytes[8] & 0x3f) | 0x80; 
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};

// --- KOMPONENTE: ADRESS AUTOCOMPLETE ---
const AddressAutocomplete = ({ value, onChange, placeholder, className }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDropdown || !value || value.length < 3) {
      setSuggestions([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(false);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&addressdetails=1&limit=5&countrycodes=de`;
        const res = await fetch(url, { headers: { "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" } });
        
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setHasSearched(true);
        } else {
          setSuggestions([]);
          setHasSearched(true);
        }
      } catch (error) {
        console.error("Adress-Suche Fehler:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [value, showDropdown]);

  const handleSelect = (item) => {
    const a = item.address;
    const street = a.road || a.pedestrian || a.street || '';
    const houseNr = a.house_number || '';
    const zip = a.postcode || '';
    const city = a.city || a.town || a.village || a.municipality || '';

    let formattedAddress = item.display_name;
    if ((street || city) && zip) {
      const streetPart = `${street} ${houseNr}`.trim();
      const cityPart = `${zip} ${city}`.trim();
      formattedAddress = `${streetPart}, ${cityPart}`.replace(/^, /, '').trim();
    }
    onChange(formattedAddress);
    setShowDropdown(false);
  };

  const handleInput = (e) => {
    onChange(e.target.value);
    setShowDropdown(true);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInput}
          onFocus={() => value && value.length >= 3 && setShowDropdown(true)}
          className={className}
          placeholder={placeholder}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="animate-spin text-slate-400" size={16} />
          </div>
        )}
      </div>
      {showDropdown && (
        <ul className="absolute z-[100] w-full bg-white border border-slate-300 rounded-b-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
          {isLoading && !suggestions.length && <li className="px-3 py-2 text-sm text-slate-400 italic">Suche Adresse...</li>}
          {!isLoading && hasSearched && suggestions.length === 0 && <li className="px-3 py-2 text-sm text-slate-400 italic">Keine Adresse gefunden.</li>}
          {suggestions.map((s) => (
            <li key={s.place_id} onClick={() => handleSelect(s)} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 text-slate-700 flex items-start gap-2">
              <MapPin size={14} className="mt-1 text-slate-400 flex-shrink-0" />
              <span>{s.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- CSS STYLES FÜR PRINT/PDF ---
const PrintStyles = () => (
  <style>{`
    @page { size: A4; margin: 0; }
    #pdf-print-container {
      width: 210mm; 
      background-color: white;
      padding: 10mm;
      box-sizing: border-box;
      position: absolute;
      top: 0;
      left: -9999px;
      z-index: -10;
      font-family: 'Times New Roman', serif;
      color: black;
      font-size: 11pt;
      line-height: 1.4;
    }
    .pdf-block, .pdf-signatures-block, .pdf-photo-block {
      position: relative;
      box-sizing: border-box;
    }
    #pdf-print-container img {
      max-width: 100%;
      height: auto;
      display: block;
    }
  `}</style>
);

// --- INITIAL STATE ---
const INITIAL_DATA = {
  meta: {
    id: uuid(),
    date: new Date().toISOString().split('T')[0],
    address: '',
    // Eine zentrale Liste für alle Parteien
    parties: [
      { id: 'p1', name: '', email: '', role: 'Verkäufer' },
      { id: 'p2', name: '', email: '', role: 'Käufer' }
    ]
  },
  keys: [
    { id: 'k1', type: 'Haus-/Wohnungsschlüssel', count: '', number: '' },
    { id: 'k2', type: 'Briefkastenschlüssel', count: '', number: '' }
  ],
  meters: {
    main: [
      { id: 'm1', type: 'Strom', number: '', reading: '', location: '', image: null, imageName: '' },
      { id: 'm2', type: 'Wasser (Kalt)', number: '', reading: '', location: '', image: null, imageName: '' }
    ],
    hasHeating: true,
    heating: [
      { id: 'h1', room: 'Wohnzimmer', number: '', reading: '', image: null, imageName: '' },
      { id: 'h2', room: 'Schlafzimmer', number: '', reading: '', image: null, imageName: '' }
    ]
  },
  // Bestandsaufnahme
  inventory: {
    rooms: [] // { id, name, note, image, imageName }
  },
  defects: {
    hasDefects: false,
    list: [
      { id: 'd1', location: '', description: '', image: null, imageName: '' }
    ]
  },
  docs: '',
  remarks: '',
  signatures: [] 
};

// Rollen Definitionen
const PARTY_ROLES_OPTIONS = ['Verkäufer', 'Käufer', 'Eigentümer', 'Mieter', 'Hausverwaltung', 'Makler'];
// Für Unterschriften (kann erweitert werden oder gleich bleiben)
const SIGNER_ROLES = PARTY_ROLES_OPTIONS.concat(['Zeuge']);

const STEPS = [
  { id: 'meta', title: 'Daten', icon: FileText },
  { id: 'keys', title: 'Schlüssel', icon: Key },
  { id: 'meters', title: 'Zähler & Mängel', icon: Zap },
  { id: 'inventory', title: 'Bestand', icon: LayoutGrid },
  { id: 'preview', title: 'Abschluss', icon: PenTool }
];

// --- HELPER COMPONENTS ---
const SectionTitle = ({ children, icon: Icon }) => (
  <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-200 pb-2">
    {Icon && <Icon className="w-6 h-6 text-blue-600" />}
    {children}
  </h2>
);

const IconButton = ({ onClick, icon: Icon, colorClass = "text-slate-400 hover:text-red-500", label }) => (
  <button onClick={onClick} className={`p-2 rounded-full hover:bg-slate-100 transition-colors ${colorClass}`} title={label}>
    <Icon size={18} />
  </button>
);

const ImageUploadButton = ({ image, onUpload, onRemove, labelSuffix = "Foto" }) => {
  const fileInputRef = useRef(null);
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const cleanName = `${labelSuffix}.jpg`;
        onUpload(reader.result, cleanName);
      };
      reader.readAsDataURL(file);
    }
  };

  if (image) {
    return (
      <div className="relative inline-block mt-2">
        <div className="h-20 w-20 rounded-lg overflow-hidden border border-slate-300 relative group">
          <img src={image} alt="Preview" className="h-full w-full object-cover" />
          <button onClick={onRemove} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity" title="Bild entfernen"><X size={12} /></button>
        </div>
        <div className="text-[10px] text-slate-500 truncate max-w-[80px] mt-1 flex items-center gap-1"><Check size={10} className="text-green-500" /> Gespeichert</div>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
      <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 text-xs font-semibold hover:bg-slate-50 hover:text-blue-600 transition-colors"><Camera size={14} /> Foto hinzufügen</button>
    </div>
  );
};

// --- CORE PROTOCOL CONTENT (SHARED) ---
const ProtocolContent = ({ data, signatures, isPreview }) => {
  const activeKeys = data.keys.filter(k => k.count && k.count > 0);
  const showHeating = data.meters.hasHeating && data.meters.heating.some(h => h.number || h.reading);
  const showDefects = data.defects.hasDefects && data.defects.list.length > 0;
  const showInventory = data.inventory && data.inventory.rooms && data.inventory.rooms.length > 0;

  // Filter Parties
  const sellers = data.meta.parties.filter(p => p.role === 'Verkäufer');
  const buyers = data.meta.parties.filter(p => p.role === 'Käufer');
  const otherParties = data.meta.parties.filter(p => p.role !== 'Verkäufer' && p.role !== 'Käufer');

  // Bilder sammeln
  const allImages = [];
  data.meters.main.forEach(m => { if(m.image) allImages.push({ title: m.imageName, src: m.image }); });
  if(data.meters.hasHeating) {
    data.meters.heating.forEach(h => { if(h.image) allImages.push({ title: h.imageName || `HKV ${h.room}.jpg`, src: h.image }); });
  }
  if(showInventory) {
    data.inventory.rooms.forEach(r => { if(r.image) allImages.push({ title: r.imageName || `Zimmer: ${r.name}`, src: r.image }); });
  }
  if(data.defects.hasDefects) {
    data.defects.list.forEach(d => { if(d.image) allImages.push({ title: d.imageName || `Mangel ${d.location}.jpg`, src: d.image }); });
  }

  const gridClass = isPreview 
    ? "grid grid-cols-1 md:grid-cols-2 gap-4" 
    : "grid grid-cols-2 gap-4";

  return (
    <div className="text-slate-900 font-serif text-sm leading-relaxed">
       {/* HEADER BLOCK */}
       <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 border-b-2 border-slate-800 pb-4 pdf-block">
        <div className="order-2 sm:order-1 text-center sm:text-left w-full sm:w-auto">
          <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-900">Übergabeprotokoll</h1>
          <p className="text-slate-500">Haus- / Wohnungsübergabe</p>
        </div>
        <div className="order-1 sm:order-2 text-center sm:text-right font-bold text-slate-700 sm:border-l-4 sm:border-blue-600 sm:pl-3 mb-4 sm:mb-0 w-full sm:w-auto">
          LUDWIGS<br/>IMMOBILIEN
        </div>
      </div>

      {/* META DATA BLOCK */}
      <div className={`${gridClass} mb-8 pdf-block`}>
        <div className="mb-4">
          <p className="text-xs uppercase text-slate-500 font-bold">Objektanschrift</p>
          <p className="font-medium text-lg border-b border-slate-300 pb-1 min-h-[1.5em]">{data.meta.address || '—'}</p>
        </div>
        <div className="mb-4">
          <p className="text-xs uppercase text-slate-500 font-bold">Datum</p>
          <p className="font-medium text-lg border-b border-slate-300 pb-1 min-h-[1.5em]">{data.meta.date}</p>
        </div>
        
        {/* Verkäufer Block */}
        <div className="mb-4">
          <p className="text-xs uppercase text-slate-500 font-bold">Verkäufer</p>
          <div className="border-b border-slate-300 pb-1 min-h-[1.5em]">
             {sellers.length > 0 ? (
               <ul className="list-none m-0 p-0">
                 {sellers.map(s => s.name && (<li key={s.id}>{s.name} {s.email && <span className="text-slate-500 text-xs italic">({s.email})</span>}</li>))}
               </ul>
             ) : '—'}
          </div>
        </div>

        {/* Käufer Block */}
        <div className="mb-4">
           <p className="text-xs uppercase text-slate-500 font-bold">Käufer</p>
           <div className="border-b border-slate-300 pb-1 min-h-[1.5em]">
             {buyers.length > 0 ? (
               <ul className="list-none m-0 p-0">
                 {buyers.map(b => b.name && (<li key={b.id}>{b.name} {b.email && <span className="text-slate-500 text-xs italic">({b.email})</span>}</li>))}
               </ul>
             ) : '—'}
          </div>
        </div>
      </div>

      {/* Weitere Parteien Block (Falls vorhanden) */}
      {otherParties.length > 0 && (
        <div className="mb-8 pdf-block">
          <p className="text-xs uppercase text-slate-500 font-bold mb-1">Weitere Parteien</p>
          <div className="border border-slate-200 bg-slate-50 p-3 rounded text-sm">
             <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
               {otherParties.map(p => (
                 <li key={p.id} className="flex flex-col">
                   <span className="font-bold text-slate-700">{p.role}:</span> 
                   <span>{p.name || 'Unbenannt'} <span className="text-slate-400 italic text-xs">{p.email ? `(${p.email})` : ''}</span></span>
                 </li>
               ))}
             </ul>
          </div>
        </div>
      )}

      {/* KEYS BLOCK */}
      <div className="mb-8 pdf-block">
        <h3 className="font-bold bg-slate-100 p-2 mb-2 border-l-4 border-slate-400">1. Schlüsselübergabe</h3>
        {activeKeys.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-300">
                <th className="py-1 font-semibold w-1/2">Schlüssel-Art</th>
                <th className="py-1 font-semibold w-1/4">Anzahl</th>
                <th className="py-1 font-semibold w-1/4">Nummer (Opt.)</th>
              </tr>
            </thead>
            <tbody>
              {activeKeys.map((k, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 break-words pr-2">{k.type}</td>
                  <td className="py-2 font-mono font-bold">{k.count}</td>
                  <td className="py-2 font-mono text-slate-600 break-all">{k.number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-400 italic py-2">Keine Schlüssel erfasst.</p>
        )}
      </div>

      {/* METERS HEADER BLOCK */}
      <div className="pdf-block">
        <h3 className="font-bold bg-slate-100 p-2 mb-2 border-l-4 border-slate-400">2. Zählerstände</h3>
      </div>
      
      <div className={`${gridClass} mb-6`}>
        {data.meters.main.length > 0 ? data.meters.main.map((m) => (
          <div key={m.id} className="border border-slate-300 p-3 rounded bg-white pdf-block">
            <div className="flex justify-between items-start">
                <p className="text-xs font-bold uppercase mb-2 text-slate-700">{m.type || 'Unbenannt'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-slate-500">Zähler-Nr:</div>
              <div className="font-mono text-right break-all">{m.number || '—'}</div>
              <div className="text-slate-500 font-bold">Stand:</div>
              <div className="font-mono font-bold text-right">{m.reading || '—'}</div>
              <div className="text-slate-500 text-xs mt-1 border-t border-slate-100 pt-1 col-span-2 flex justify-between">
                <span>Ort:</span> <span>{m.location || '—'}</span>
              </div>
              {m.image && <div className="col-span-2 mt-1 text-[10px] text-slate-500 italic">[Siehe Anhang: {m.imageName}]</div>}
            </div>
          </div>
        )) : <p className="text-slate-400 italic mb-4 pdf-block">Keine Hauptzähler erfasst.</p>}
      </div>

      {showHeating && (
        <div className="mt-4 mb-8 pdf-block overflow-x-auto">
          <p className="text-xs font-bold uppercase mb-2">Heizkostenverteiler</p>
          <table className="w-full text-sm border border-slate-300">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 border border-slate-300 text-left">Raum</th>
                <th className="p-2 border border-slate-300 text-left">Geräte-Nr.</th>
                <th className="p-2 border border-slate-300 text-right">Ablesewert</th>
                <th className="p-2 border border-slate-300 w-16 text-center">Foto</th>
              </tr>
            </thead>
            <tbody>
              {data.meters.heating.filter(h => h.number || h.reading).map((h, i) => (
                <tr key={i}>
                  <td className="p-2 border border-slate-300">{h.room}</td>
                  <td className="p-2 border border-slate-300 font-mono break-all">{h.number}</td>
                  <td className="p-2 border border-slate-300 font-mono text-right font-bold">{h.reading}</td>
                  <td className="p-2 border border-slate-300 text-center text-[10px] italic text-slate-500">{h.image ? "Ja" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* INVENTORY BLOCK (NEU) */}
      <div className="pdf-block">
         <h3 className="font-bold bg-slate-100 p-2 mb-2 border-l-4 border-blue-400">3. Bestandsaufnahme</h3>
      </div>
      <div className="mb-8 space-y-3">
        {!showInventory ? (
          <p className="text-slate-500 italic px-2 pdf-block">Keine Zimmer erfasst.</p>
        ) : (
          data.inventory.rooms.map((room, i) => (
            <div key={i} className="border border-slate-200 p-3 rounded pdf-block bg-slate-50/50">
               <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-800">{room.name}</span>
                  {room.image && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">Foto im Anhang</span>}
               </div>
               {room.note && (
                 <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{room.note}</p>
               )}
            </div>
          ))
        )}
      </div>

      {/* DEFECTS HEADER */}
      <div className="pdf-block">
        <h3 className="font-bold bg-slate-100 p-2 mb-2 border-l-4 border-red-400 text-red-900">4. Festgestellte Mängel</h3>
      </div>

      <div className="space-y-4 mb-8">
        {!showDefects ? (
           <p className="text-slate-500 italic px-2 pdf-block">Keine Mängel festgestellt.</p>
        ) : (
          data.defects.list.map((defect, i) => (
            <div key={i} className="border border-red-100 bg-red-50/30 p-3 rounded pdf-block">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold uppercase text-red-800">{defect.location || 'Ohne Ortsangabe'}</p>
                  <p className="text-sm text-slate-800 break-words">{defect.description || 'Keine Beschreibung'}</p>
                  {defect.image && <p className="text-[10px] text-slate-500 italic mt-1">[Foto im Anhang: {defect.imageName}]</p>}
                </div>
            </div>
          ))
        )}
      </div>

      {/* DOCS BLOCK */}
      <div className="mb-8 pdf-block">
        <h3 className="font-bold bg-slate-100 p-2 mb-2 border-l-4 border-slate-400">5. Sonstiges</h3>
        <div className="mb-4">
          <p className="text-xs uppercase text-slate-500 font-bold">Übergebene Unterlagen</p>
          <p className="whitespace-pre-wrap break-words">{data.docs || '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 font-bold">Sonstige Bemerkungen</p>
          <p className="whitespace-pre-wrap break-words">{data.remarks || 'Keine weiteren Bemerkungen.'}</p>
        </div>
      </div>

      {/* SIGNATURES BLOCK */}
      <div className="mt-12 pdf-signatures-block">
        <div className="pt-4 border-t-2 border-slate-900">
          <h3 className="font-bold uppercase tracking-widest mb-6 text-center">Unterschriften</h3>
          {signatures.length === 0 ? (
             <p className="text-center text-slate-400 italic py-8 border-2 border-dashed border-slate-200 bg-slate-50 rounded">Noch keine Unterschriften erfasst.</p>
          ) : (
            <div className={gridClass}>
              {signatures.map((sig, idx) => (
                <div key={idx} className="">
                   <div className="h-20 mb-2 flex items-end justify-center">
                     <img src={sig.data} alt="Unterschrift" className="max-h-full max-w-full" />
                   </div>
                   <div className="border-t border-slate-800 pt-2 text-center">
                     <p className="font-bold text-sm">{sig.name || sig.role}</p>
                     <p className="text-xs uppercase text-slate-500">{sig.role}</p>
                     <p className="text-[10px] text-slate-400">{new Date(sig.timestamp).toLocaleString()}</p>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-12 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
          Dokument ID: {data.meta.id}
        </div>
      </div>

      {/* ANHANG BLOCKS */}
      {allImages.length > 0 && (
        <>
          <div className="mt-8 pt-8 border-t-4 border-slate-100 pdf-block">
             <h2 className="text-xl font-bold uppercase tracking-widest text-slate-900 mb-6">Anhang: Fotodokumentation</h2>
          </div>
          <div className={gridClass}>
             {allImages.map((img, idx) => (
               <div key={idx} className="border border-slate-200 p-2 rounded pdf-photo-block">
                 <div className="aspect-[4/3] bg-slate-100 overflow-hidden mb-2 flex items-center justify-center">
                   <img src={img.src} alt={img.title} className="max-w-full max-h-full object-contain" />
                 </div>
                 <p className="text-center text-sm font-bold text-slate-700 break-words">{img.title}</p>
               </div>
             ))}
          </div>
        </>
      )}
    </div>
  );
};

// [PERF] Memoized Version des ProtocolContent für die Vorschau
const MemoProtocolContent = React.memo(ProtocolContent);

// --- MAIN APP COMPONENT ---

export default function App() {
  const [step, setStep] = useState(0);
  const [view, setView] = useState("form"); // [VIEW] 'form' oder 'archive'
  const [data, setData] = useState(INITIAL_DATA);
  const [historyList, setHistoryList] = useState([]); // [PERSISTENCE] History Liste (nur Metadata)
  
  const [currentSignerRole, setCurrentSignerRole] = useState(SIGNER_ROLES[0]);
  const [currentSignerName, setCurrentSignerName] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // [PERF] Bedingtes Rendering des Print-Containers
  const [showPrintContainer, setShowPrintContainer] = useState(false);
  
  // [PERSISTENCE] State für Drafts
  const [foundDraft, setFoundDraft] = useState(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // --- PERSISTENCE: LOAD HISTORY ON MOUNT ---
  useEffect(() => {
    try {
      const storedHist = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHist) {
        setHistoryList(JSON.parse(storedHist));
      }
    } catch (e) {
      console.error("Fehler beim Laden der History:", e);
    }
  }, []);

  // --- PERSISTENCE: RESTORE CURRENT DRAFT ON MOUNT ---
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.data && parsed.data.meta) {
          setFoundDraft(parsed);
          setShowDraftDialog(true);
        }
      }
    } catch (e) {
      console.error("Fehler beim Laden des Drafts:", e);
    }
  }, []);

  // --- PERSISTENCE: AUTO-SAVE DRAFT & UPDATE HISTORY ---
  useEffect(() => {
    if (showDraftDialog) return;

    const timer = setTimeout(() => {
      try {
        // 1. Save Full Draft
        const draft = {
          data,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

        // 2. Update History (Metadata only)
        updateHistoryEntry(data, "draft");
        
      } catch (e) {
        console.warn("Auto-Save fehlgeschlagen (evtl. Quota exceeded):", e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [data, showDraftDialog]);

  // Helper zum Updaten der History
  const updateHistoryEntry = (currentData, status, pdfUrl = null) => {
    try {
      const existingHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
      const idx = existingHistory.findIndex(h => h.id === currentData.meta.id);
      
      const newEntry = {
        id: currentData.meta.id,
        date: currentData.meta.date,
        address: currentData.meta.address,
        parties: currentData.meta.parties.map(p => ({ name: p.name, role: p.role })), // Kompakte Party Info
        status: status,
        savedAt: new Date().toISOString(),
        completedAt: status === 'completed' ? new Date().toISOString() : (idx >= 0 ? existingHistory[idx].completedAt : undefined),
        pdfUrl: pdfUrl || (idx >= 0 ? existingHistory[idx].pdfUrl : undefined),
        data: currentData // Speichere vollständige Protokolldaten für alle Einträge (Draft und Completed)
      };

      let newHistory;
      if (idx >= 0) {
        newHistory = [...existingHistory];
        newHistory[idx] = newEntry;
      } else {
        newHistory = [newEntry, ...existingHistory];
      }
      
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
      setHistoryList(newHistory);
    } catch (e) {
      console.error("History Update Error:", e);
    }
  };

  // Funktion: Draft wiederherstellen
  const restoreDraft = () => {
    if (foundDraft) {
      setData(foundDraft.data);
      setDraftRestored(true);
      setShowDraftDialog(false);
    }
  };

  // Funktion: Draft verwerfen
  const discardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setShowDraftDialog(false);
  };

  // Funktion: Reset (Neues Protokoll)
  const resetProtocol = () => {
    if (confirm("Wirklich neu starten? Alle nicht gespeicherten Eingaben gehen verloren.")) {
      setData(INITIAL_DATA);
      setDraftRestored(false);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setStep(0);
      setView("form");
      window.scrollTo(0, 0);
    }
  };

  // [LOGIC] Resume Draft aus Archiv (neue Implementierung)
  const handleResumeDraft = (historyId) => {
    // 1. Suche passenden Eintrag in historyList
    const entry = historyList.find(h => h.id === historyId);
    if (!entry) {
      alert("Für diesen Entwurf wurden keine Daten gefunden.");
      return;
    }
    // 2. Prüfe, ob entry.data existiert
    if (!entry.data) {
      alert("Dieser Entwurf hat keine gespeicherten Formulardaten. Bitte öffne ihn einmal im Protokoll, damit er gespeichert werden kann.");
      return;
    }
    // 3. Daten setzen und Draft-Speicher aktualisieren
    setData(entry.data);
    setStep(0);
    setView("form");
    setDraftRestored(true);
    window.scrollTo(0, 0);
    // Draft wieder im Draft-Speicher ablegen
    try {
      const draft = { data: entry.data, savedAt: entry.savedAt || new Date().toISOString() };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn("Konnte Draft nicht im localStorage aktualisieren", e);
    }
  };

  // [LOGIC] Delete History Entry (Draft or Completed)
  const handleDeleteHistoryEntry = (id) => {
    if (!confirm("Diesen Eintrag wirklich aus dem Archiv löschen? Das erzeugte PDF (z.B. in deinem E-Mail-Postfach oder Drive) bleibt davon unberührt.")) {
      return;
    }
    try {
      const existingHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
      const newHistory = existingHistory.filter(h => h.id !== id);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
      setHistoryList(newHistory);

      // Falls der gelöschte Eintrag der aktuell aktive Draft im Speicher ist, diesen auch entfernen
      const storedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (storedDraft) {
        const parsedDraft = JSON.parse(storedDraft);
        if (parsedDraft?.data?.meta?.id === id) {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
          // Wenn der aktuell geladene Datensatz diesem Draft entspricht, Formular zurücksetzen
          if (data.meta.id === id) {
            setData(INITIAL_DATA);
            setDraftRestored(false);
            setStep(0);
            setView("form");
          }
        }
      }
    } catch (e) {
      console.error("Fehler beim Löschen des History-Eintrags:", e);
    }
  };

  useEffect(() => {
    const scripts = [
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    ];
    scripts.forEach(src => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
      }
    });
  }, []);

  const updateField = (path, value) => {
    setData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]]; }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const addItem = (collectionPath, newItem) => {
    setData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const keys = collectionPath.split('.');
      let current = newData;
      for (let i = 0; i < keys.length; i++) { current = current[keys[i]]; }
      current.push({ ...newItem, id: uuid() });
      return newData;
    });
  };

  const removeItem = (collectionPath, id) => {
    setData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const keys = collectionPath.split('.');
      let parent = newData;
      for (let i = 0; i < keys.length - 1; i++) { parent = parent[keys[i]]; }
      const collectionName = keys[keys.length - 1];
      parent[collectionName] = parent[collectionName].filter(item => item.id !== id);
      return newData;
    });
  };

  const updateItem = (collectionPath, id, field, value) => {
    setData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const keys = collectionPath.split('.');
      let current = newData;
      for (let i = 0; i < keys.length; i++) { current = current[keys[i]]; }
      const idx = current.findIndex(item => item.id === id);
      if (idx !== -1) current[idx][field] = value;
      return newData;
    });
  };

  const improveTextWithAI = () => {
    if (!data.remarks) return;
    setIsAiLoading(true);
    setTimeout(() => {
      const original = data.remarks;
      const improved = `Rechtlicher Hinweis: Die Parteien bestätigen, dass der Zustand wie besichtigt akzeptiert wird. Zu den Anmerkungen ("${original}") besteht Einigkeit über die Aufnahme in dieses Protokoll.`;
      updateField('remarks', improved);
      setIsAiLoading(false);
    }, 1000);
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => { e.preventDefault(); setIsDrawing(true); const ctx = canvasRef.current.getContext('2d'); const { x, y } = getCanvasCoordinates(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const draw = (e) => { if (!isDrawing) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const { x, y } = getCanvasCoordinates(e); ctx.lineTo(x, y); ctx.stroke(); };
  const endDraw = () => setIsDrawing(false);
  const clearSignature = () => { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); };
  
  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas.toDataURL() === document.createElement('canvas').toDataURL()) { alert("Bitte unterschreiben."); return; }
    const newSig = { role: currentSignerRole, name: currentSignerName || currentSignerRole, data: canvas.toDataURL(), timestamp: new Date().toISOString() };
    setData(prev => ({ ...prev, signatures: [...prev.signatures, newSig] }));
    clearSignature();
    setCurrentSignerName('');
  };

  useEffect(() => {
    if (step === 4 && canvasRef.current) { 
      const canvas = canvasRef.current;
      const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if(parent) {
          canvas.width = parent.offsetWidth;
          canvas.height = parent.offsetHeight;
          const ctx = canvas.getContext('2d');
          ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000000';
        }
      };
      resizeCanvas();
      const timer = setTimeout(resizeCanvas, 300);
      window.addEventListener('resize', resizeCanvas);
      return () => { clearTimeout(timer); window.removeEventListener('resize', resizeCanvas); };
    }
  }, [step, view]); // Added view dependency

  // --- PDF GENERATION ---
  const generatePdfBlob = async () => {
    const input = document.getElementById('pdf-print-container');
    if(!input) throw new Error("Print Container nicht gefunden (DOM Fehler).");
    if (!window.html2canvas || !window.jspdf) throw new Error("PDF-Bibliotheken sind noch nicht geladen.");

    try {
      const canvas = await window.html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 794, 
        
        onclone: (clonedDoc) => {
          const container = clonedDoc.getElementById('pdf-print-container');
          container.style.display = 'block'; 
          
          const containerWidthPx = container.offsetWidth; 
          const mmToPx = containerWidthPx / 210;
          const pageHeightPx = 297 * mmToPx;
          const paddingPx = 10 * mmToPx;
          
          const blocks = container.querySelectorAll('.pdf-block, .pdf-signatures-block, .pdf-photo-block');
          
          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const top = block.offsetTop;
            const height = block.offsetHeight;
            const bottom = top + height;
            const startPage = Math.floor(top / pageHeightPx);
            const pageBottomLimit = (startPage + 1) * pageHeightPx - paddingPx;
            
            if (bottom > pageBottomLimit) {
              const nextPageStart = (startPage + 1) * pageHeightPx;
              const targetTop = nextPageStart + paddingPx;
              const shiftNeeded = targetTop - top;
              if (shiftNeeded > 0) {
                const existingMargin = parseFloat(block.style.marginTop || '0');
                block.style.marginTop = `${existingMargin + shiftNeeded}px`;
              }
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.7); 
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; 
      const pageHeight = 297; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) { 
        position = position - 297;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight); 
        heightLeft -= pageHeight;
      }

      return pdf.output('blob');

    } catch (err) {
      console.error("PDF Generation failed", err);
      throw new Error("Fehler beim Generieren des PDFs: " + err.message);
    }
  };

  const handleGeneratePDFDownload = async () => {
    setIsGeneratingPdf(true);
    setShowPrintContainer(true);
    await new Promise(r => setTimeout(r, 100));

    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeAddr = data.meta.address.replace(/[^a-z0-9]/gi, '_') || 'Objekt';
      link.href = url;
      link.download = `Uebergabeprotokoll_${data.meta.date}_${safeAddr}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setShowPrintContainer(false); 
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateAndSubmit = async () => {
    if (data.signatures.length === 0) {
      alert("Bitte mindestens eine Unterschrift erfassen.");
      return;
    }
    if (!confirm("Sind Sie sicher? Das Protokoll wird final abgeschlossen und versendet.")) return;

    setIsSubmitting(true);
    setShowPrintContainer(true);
    await new Promise(r => setTimeout(r, 100));

    try {
      const pdfBlob = await generatePdfBlob();
      const safeAddr = data.meta.address.replace(/[^a-z0-9]/gi, '_') || 'Objekt';
      const filename = `Uebergabeprotokoll_${data.meta.date}_${safeAddr}.pdf`;

      const formData = new FormData();
      formData.append('file', pdfBlob, filename);
      const recipients = data.meta.parties.map(p => p.email).filter(Boolean);
      
      const metaData = {
        id: data.meta.id,
        address: data.meta.address,
        date: data.meta.date,
        recipients: recipients
      };
      formData.append('data', JSON.stringify(data));
      formData.append('meta', JSON.stringify(metaData));

      const response = await fetch(N8N_WEBHOOK_URL, { method: 'POST', body: formData });

      if (!response.ok) throw new Error(`Server Status: ${response.status}`);
      const result = await response.json();
      
      // [PERSISTENCE] 1. Update History to Completed
      updateHistoryEntry(data, "completed", result.pdfDriveUrl);

      // [PERSISTENCE] 2. Draft löschen
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      
      alert("Erfolg! PDF und Daten wurden übertragen.");
      if (result.pdfDriveUrl) window.open(result.pdfDriveUrl, '_blank');
      
      // Wechsel ins Archiv oder Reset? Hier: Reset
      setData(INITIAL_DATA);
      setStep(0);
      setView("archive"); // Wechseln wir ins Archiv um das fertige Ergebnis zu sehen

    } catch (error) {
      console.error("Submit Error:", error);
      alert("Fehler bei der Übertragung: " + error.message);
    } finally {
      setShowPrintContainer(false);
      setIsSubmitting(false);
    }
  };

  // --- ARCHIVE VIEW COMPONENT ---
  const renderArchive = () => {
    const drafts = historyList.filter(h => h.status === 'draft').sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    const completed = historyList.filter(h => h.status === 'completed').sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    return (
      <div className="space-y-8 animate-in fade-in">
        {/* Entwürfe */}
        <div>
          <div className="flex items-center gap-2 mb-4">
             <div className="bg-amber-100 p-2 rounded-full text-amber-600"><FileClock size={20} /></div>
             <h3 className="text-xl font-bold text-slate-800">Laufende Entwürfe</h3>
          </div>
          {drafts.length === 0 ? (
            <p className="text-slate-500 italic ml-2">Keine offenen Entwürfe.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {drafts.map(draft => (
                 <div key={draft.id} className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-amber-300 hover:shadow-md transition-shadow relative">
                    <div className="mb-2">
                       <p className="font-bold text-slate-900 truncate">{draft.address || "Ohne Adresse"}</p>
                       <p className="text-sm text-slate-500">{draft.date}</p>
                    </div>
                    <div className="text-xs text-slate-500 mb-4 line-clamp-1">
                      {draft.parties && draft.parties.map(p => `${p.name} (${p.role})`).join(', ')}
                    </div>
                    <div className="flex justify-between items-center mt-2 border-t pt-2">
                       <div className="flex flex-col">
                         <span className="text-[10px] text-slate-400">Gespeichert: {new Date(draft.savedAt).toLocaleString()}</span>
                         <button
                           onClick={() => handleDeleteHistoryEntry(draft.id)}
                           className="text-[10px] text-red-500 hover:text-red-600 mt-1 self-start"
                         >
                           Entwurf löschen
                         </button>
                       </div>
                       <button
                         onClick={() => handleResumeDraft(draft.id)}
                         className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1 rounded flex items-center gap-1"
                       >
                          Weiter <ChevronRight size={14} />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* Abgeschlossen */}
        <div>
          <div className="flex items-center gap-2 mb-4">
             <div className="bg-green-100 p-2 rounded-full text-green-600"><CheckCircle2 size={20} /></div>
             <h3 className="text-xl font-bold text-slate-800">Archiv (Abgeschlossen)</h3>
          </div>
          {completed.length === 0 ? (
             <p className="text-slate-500 italic ml-2">Noch keine Protokolle abgeschlossen.</p>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {completed.map(comp => (
                 <div key={comp.id} className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-green-500 hover:shadow-md transition-shadow relative opacity-90 hover:opacity-100">
                    <div className="mb-2">
                       <p className="font-bold text-slate-900 truncate">{comp.address || "Ohne Adresse"}</p>
                       <p className="text-sm text-slate-500">{comp.date}</p>
                    </div>
                    <div className="text-xs text-slate-500 mb-4 line-clamp-1">
                      {comp.parties && comp.parties.map(p => `${p.name} (${p.role})`).join(', ')}
                    </div>
                    <div className="flex justify-between items-center mt-2 border-t pt-2">
                       <div className="flex flex-col">
                         <span className="text-[10px] text-slate-400">Abschluss: {new Date(comp.completedAt).toLocaleDateString()}</span>
                         <button
                           onClick={() => handleDeleteHistoryEntry(comp.id)}
                           className="text-[10px] text-red-500 hover:text-red-600 mt-1 self-start"
                         >
                           Aus Archiv löschen
                         </button>
                       </div>
                       {comp.pdfUrl ? (
                         <button
                           onClick={() => window.open(comp.pdfUrl, '_blank')}
                           className="text-sm font-bold text-green-700 hover:bg-green-50 px-3 py-1 rounded flex items-center gap-1"
                         >
                            <ExternalLink size={14} /> PDF Öffnen
                         </button>
                       ) : (
                         <span className="text-xs italic text-slate-400">Kein PDF Link</span>
                       )}
                    </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>
    );
  };

  // --- RENDER ---
  const renderContent = () => {
    // Wenn Archiv aktiv, zeige Archiv
    if (view === 'archive') return renderArchive();

    // Sonst Formular-Steps
    switch(step) {
      case 0: return (
        <div className="space-y-6 animate-in fade-in">
          <SectionTitle icon={FileText}>Objekt & Parteien</SectionTitle>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Datum</label><input type="date" value={data.meta.date} onChange={e => updateField('meta.date', e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none" /></div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Anschrift</label>
                 <AddressAutocomplete 
                   placeholder="Musterstraße 12, Stadt..." 
                   value={data.meta.address} 
                   onChange={val => updateField('meta.address', val)} 
                   className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                 />
               </div>
             </div>
             
             <hr className="border-slate-100 my-4" />
             
             {/* Unified Parties Section */}
             <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Anwesende Parteien</label>
                  <button onClick={() => addItem('meta.parties', { name: '', email: '', role: 'Käufer' })} className="text-blue-600 text-xs font-bold flex gap-1 hover:bg-blue-50 px-2 py-1 rounded"><Plus size={14}/> Person hinzufügen</button>
                </div>
                <div className="space-y-3">
                  {data.meta.parties.map((p, idx) => (
                    <div key={p.id} className="flex gap-2 items-start bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 flex-1 items-center">
                         <div className="md:col-span-4">
                           <input placeholder="Name" value={p.name} onChange={(e) => updateItem('meta.parties', p.id, 'name', e.target.value)} className="w-full p-2 border border-slate-300 rounded outline-none text-sm font-semibold" />
                         </div>
                         <div className="md:col-span-4">
                           <input type="email" placeholder="E-Mail" value={p.email} onChange={(e) => updateItem('meta.parties', p.id, 'email', e.target.value)} className="w-full p-2 border border-slate-300 rounded outline-none text-sm" />
                         </div>
                         <div className="md:col-span-4">
                           <select value={p.role} onChange={(e) => updateItem('meta.parties', p.id, 'role', e.target.value)} className="w-full p-2 border border-slate-300 rounded outline-none text-sm bg-white cursor-pointer">
                             {PARTY_ROLES_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
                           </select>
                         </div>
                      </div>
                      <IconButton onClick={() => removeItem('meta.parties', p.id)} icon={Trash2} />
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      );
      case 1: return (
        <div className="space-y-6 animate-in fade-in">
           <SectionTitle icon={Key}>Schlüssel</SectionTitle>
           <div className="space-y-3">{data.keys.map((k) => (<div key={k.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group"><div className="absolute top-2 right-2"><IconButton onClick={() => removeItem('keys', k.id)} icon={Trash2} /></div><div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"><div className="md:col-span-6"><label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Art</label><input className="w-full p-2 border-b border-slate-300 outline-none font-medium bg-transparent" placeholder="z.B. Haustür" value={k.type} onChange={(e) => updateItem('keys', k.id, 'type', e.target.value)} /></div><div className="md:col-span-2"><label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Anzahl</label><input type="number" placeholder="0" className="w-full p-2 border border-slate-300 rounded font-mono text-center font-bold bg-slate-50" value={k.count} onChange={(e) => updateItem('keys', k.id, 'count', e.target.value)} /></div><div className="md:col-span-4"><label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Nummer</label><input type="text" placeholder="Nr." className="w-full p-2 border border-slate-300 rounded text-sm bg-slate-50" value={k.number} onChange={(e) => updateItem('keys', k.id, 'number', e.target.value)} /></div></div></div>))}</div>
           <button onClick={() => addItem('keys', { type: '', count: '', number: '' })} className="w-full py-4 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 font-bold hover:bg-blue-50 flex items-center justify-center gap-2"><Plus size={20} /> Schlüssel hinzufügen</button>
        </div>
      );
      case 2: return (
        <div className="space-y-8 animate-in fade-in">
          <SectionTitle icon={Zap}>Zähler & Mängel</SectionTitle>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><h3 className="font-bold text-slate-800 mb-4">Hauptzähler</h3><div className="space-y-6">{data.meters.main.map((meter) => (<div key={meter.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative"><div className="absolute top-2 right-2"><IconButton onClick={() => removeItem('meters.main', meter.id)} icon={Trash2} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2 pr-10"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zählerart</label><input placeholder="z.B. Strom" className="w-full p-2 border border-slate-300 rounded font-bold text-lg" value={meter.type} onChange={e => updateItem('meters.main', meter.id, 'type', e.target.value)} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nummer</label><input placeholder="Nr." className="w-full p-2 border border-slate-300 rounded font-mono" value={meter.number} onChange={e => updateItem('meters.main', meter.id, 'number', e.target.value)} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stand</label><input placeholder="123.45" type="number" className="w-full p-2 border border-slate-300 rounded font-mono font-bold" value={meter.reading} onChange={e => updateItem('meters.main', meter.id, 'reading', e.target.value)} /></div><div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ort</label><input placeholder="z.B. Keller" className={`w-full p-2 border rounded text-sm ${!meter.location ? 'border-amber-300 bg-amber-50' : 'border-slate-300'}`} value={meter.location} onChange={e => updateItem('meters.main', meter.id, 'location', e.target.value)} /><ImageUploadButton image={meter.image} onUpload={(imgData, name) => { updateItem('meters.main', meter.id, 'image', imgData); updateItem('meters.main', meter.id, 'imageName', name); }} onRemove={() => updateItem('meters.main', meter.id, 'image', null)} labelSuffix={meter.type || 'Zähler'} /></div></div></div>))} <button onClick={() => addItem('meters.main', { type: '', number: '', reading: '', location: '', image: null })} className="w-full py-3 bg-white border border-slate-300 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 flex justify-center gap-2"><Plus size={16} /> Neuen Zähler hinzufügen</button></div></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex justify-between items-center mb-4"><div className="flex items-center gap-3"><h3 className="font-bold text-slate-800">Heizkostenverteiler</h3><button onClick={() => updateField('meters.hasHeating', !data.meters.hasHeating)} className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${data.meters.hasHeating ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{data.meters.hasHeating ? <ToggleRight size={20} /> : <ToggleLeft size={20} />} {data.meters.hasHeating ? 'Vorhanden' : 'Nicht vorhanden'}</button></div></div>{data.meters.hasHeating && (<div className="space-y-4">{data.meters.heating.map((h, idx) => (<div key={h.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-slate-50 p-2 rounded border border-slate-200"><input placeholder="Raum" className="flex-1 bg-transparent border-b border-slate-300 p-1 font-medium text-sm outline-none" value={h.room} onChange={e => updateItem('meters.heating', h.id, 'room', e.target.value)} /><input placeholder="Geräte-Nr." className="flex-1 bg-transparent border-b border-slate-300 p-1 font-mono text-sm outline-none" value={h.number} onChange={e => updateItem('meters.heating', h.id, 'number', e.target.value)} /><input placeholder="Wert" className="w-24 bg-transparent border-b border-slate-300 p-1 font-mono text-sm text-right outline-none" value={h.reading} onChange={e => updateItem('meters.heating', h.id, 'reading', e.target.value)} /><div className="flex items-center gap-2"><ImageUploadButton image={h.image} onUpload={(img, name) => { updateItem('meters.heating', h.id, 'image', img); updateItem('meters.heating', h.id, 'imageName', name); }} onRemove={() => updateItem('meters.heating', h.id, 'image', null)} labelSuffix={`HKV ${h.room}`} /><IconButton onClick={() => removeItem('meters.heating', h.id)} icon={XCircle} /></div></div>))}<button onClick={() => addItem('meters.heating', { room: '', number: '', reading: '', image: null })} className="text-blue-600 text-sm font-semibold flex items-center gap-2 hover:underline p-2"><Plus size={16} /> Zeile hinzufügen</button></div>)}</div>
          <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100"><div className="flex justify-between items-center mb-4"><div className="flex items-center gap-3"><h3 className="font-bold text-red-900">Mängel / Schäden</h3><button onClick={() => updateField('defects.hasDefects', !data.defects.hasDefects)} className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${data.defects.hasDefects ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-500'}`}>{data.defects.hasDefects ? <ToggleRight size={20} /> : <ToggleLeft size={20} />} {data.defects.hasDefects ? 'Mängel vorhanden' : 'Keine Mängel'}</button></div></div>{data.defects.hasDefects && (<div className="space-y-4 animate-in fade-in">{data.defects.list.map((defect) => (<div key={defect.id} className="bg-white p-4 rounded-lg border border-red-200 shadow-sm relative"><div className="absolute top-2 right-2"><IconButton onClick={() => removeItem('defects.list', defect.id)} icon={Trash2} /></div><div className="grid grid-cols-1 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ort</label><input placeholder="z.B. Küche" className="w-full p-2 border border-slate-300 rounded font-medium" value={defect.location} onChange={e => updateItem('defects.list', defect.id, 'location', e.target.value)} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Beschreibung</label><textarea placeholder="Kratzer..." className="w-full p-2 border border-slate-300 rounded text-sm h-20" value={defect.description} onChange={e => updateItem('defects.list', defect.id, 'description', e.target.value)} /></div><div><ImageUploadButton image={defect.image} onUpload={(img, name) => { updateItem('defects.list', defect.id, 'image', img); updateItem('defects.list', defect.id, 'imageName', name); }} onRemove={() => updateItem('defects.list', defect.id, 'image', null)} labelSuffix={`Mangel ${defect.location}`} /></div></div></div>))}<button onClick={() => addItem('defects.list', { location: '', description: '', image: null })} className="w-full py-3 bg-red-100 border border-red-200 rounded-lg text-red-700 font-semibold hover:bg-red-200 flex justify-center gap-2"><Plus size={16} /> Weiteren Mangel erfassen</button></div>)}</div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><h3 className="font-bold text-slate-800 mb-2">Unterlagen & Bemerkungen</h3><div className="space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unterlagen</label><textarea className="w-full p-3 border border-slate-300 rounded-lg h-20 text-sm" placeholder="Energieausweis..." value={data.docs} onChange={e => updateField('docs', e.target.value)} /></div><div><div className="flex justify-between items-end mb-1"><label className="block text-xs font-bold text-slate-500 uppercase">Bemerkungen</label><button onClick={improveTextWithAI} disabled={!data.remarks || isAiLoading} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 flex gap-1 disabled:opacity-50"><Wand2 size={12} /> {isAiLoading ? '...' : 'KI: Verbessern'}</button></div><textarea className="w-full p-3 border border-slate-300 rounded-lg h-24 text-sm" placeholder="Sonstiges..." value={data.remarks} onChange={e => updateField('remarks', e.target.value)} /></div></div></div>
        </div>
      );
      case 3: return (
        // NEUE SECTION: BESTANDSAUFNAHME
        <div className="space-y-6 animate-in fade-in">
           <SectionTitle icon={LayoutGrid}>Bestandsaufnahme</SectionTitle>
           <div className="space-y-4">
             {data.inventory.rooms.length === 0 && (
               <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">
                 Noch keine Zimmer erfasst.
               </div>
             )}
             {data.inventory.rooms.map((room) => (
               <div key={room.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group">
                 <div className="absolute top-2 right-2"><IconButton onClick={() => removeItem('inventory.rooms', room.id)} icon={Trash2} /></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zimmer / Bereich <span className="text-red-500">*</span></label>
                       <input 
                         placeholder="z.B. Wohnzimmer, Flur, Keller" 
                         className="w-full p-2 border border-slate-300 rounded font-medium text-lg" 
                         value={room.name} 
                         onChange={e => updateItem('inventory.rooms', room.id, 'name', e.target.value)} 
                       />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zustand / Bemerkung</label>
                      <textarea 
                        placeholder="Zustand Wände, Boden, Besonderheiten..." 
                        className="w-full p-2 border border-slate-300 rounded text-sm h-20" 
                        value={room.note} 
                        onChange={e => updateItem('inventory.rooms', room.id, 'note', e.target.value)} 
                      />
                    </div>
                    <div className="md:col-span-2">
                       <ImageUploadButton 
                         image={room.image} 
                         onUpload={(imgData, name) => { 
                           updateItem('inventory.rooms', room.id, 'image', imgData); 
                           updateItem('inventory.rooms', room.id, 'imageName', name); 
                         }} 
                         onRemove={() => updateItem('inventory.rooms', room.id, 'image', null)} 
                         labelSuffix={`Zimmer ${room.name}`} 
                       />
                    </div>
                 </div>
               </div>
             ))}
           </div>
           <button onClick={() => addItem('inventory.rooms', { name: '', note: '', image: null })} className="w-full py-4 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 font-bold hover:bg-blue-50 flex items-center justify-center gap-2"><Plus size={20} /> Zimmer hinzufügen</button>
        </div>
      );
      case 4: return (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in">
          <div className="lg:w-1/3 space-y-6 order-2 lg:order-1">
            <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg"><h3 className="font-bold mb-4 flex items-center gap-2"><PenTool size={20} /> Unterschrift</h3><div className="space-y-4 mb-4"><select className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white" value={currentSignerRole} onChange={e => setCurrentSignerRole(e.target.value)}>{SIGNER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select><input className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white" placeholder="Name (Optional)" value={currentSignerName} onChange={e => setCurrentSignerName(e.target.value)} /></div><div className="bg-white rounded-lg h-40 relative touch-none overflow-hidden cursor-crosshair mb-4"><canvas ref={canvasRef} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} className="w-full h-full" /><button onClick={clearSignature} className="absolute top-2 right-2 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded hover:bg-red-100 hover:text-red-500">Reset</button></div><button onClick={saveSignature} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold flex items-center justify-center gap-2"><Check size={18} /> Unterschreiben</button></div>
            <div className="space-y-3"><button onClick={handleGenerateAndSubmit} disabled={isSubmitting} className="w-full py-4 bg-green-600 text-white hover:bg-green-700 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed">{isSubmitting ? <Loader2 className="animate-spin" /> : <UploadCloud size={20} />} {isSubmitting ? 'Sende Daten & PDF...' : 'Übergabe abschließen'}</button><button onClick={handleGeneratePDFDownload} disabled={isGeneratingPdf} className="w-full py-3 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm">{isGeneratingPdf ? <Loader2 className="animate-spin text-slate-400" /> : <Download size={20} />} {isGeneratingPdf ? 'Erzeuge PDF...' : 'Nur PDF laden (A4)'}</button></div>
          </div>
          <div className="lg:w-2/3 order-1 lg:order-2">
            <div className="bg-slate-200 p-4 rounded-xl overflow-auto">
              <div className="mb-4 flex items-center gap-2 text-slate-600 font-bold"><Eye size={20} /> Protokoll-Vorschau</div>
              <div className="bg-white shadow-lg border border-slate-200 mx-auto w-full max-w-[210mm] p-4 md:p-[10mm] overflow-hidden">
                {/* [PERF] Memoized Content verwenden */}
                <MemoProtocolContent data={data} signatures={data.signatures} isPreview={true} />
              </div>
            </div>
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 relative">
      <PrintStyles />
      {/* [PERF] Print Container nur rendern wenn PDF erzeugt wird */}
      {showPrintContainer && (
        <div id="pdf-print-container">
          <ProtocolContent data={data} signatures={data.signatures} isPreview={false} />
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 text-white p-1.5 rounded-lg font-serif font-bold">L</div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none">Ludwigs<span className="text-slate-400 font-normal">App</span></span>
              {draftRestored && view === 'form' && <span className="text-[10px] text-green-600 font-medium">Entwurf aktiv</span>}
            </div>
          </div>
          
          {/* TAB NAV (VIEW SWITCHER) */}
          <div className="flex bg-slate-100 p-1 rounded-lg ml-4">
             <button 
               onClick={() => setView('form')} 
               className={`px-3 py-1 text-sm font-semibold rounded-md transition-all ${view === 'form' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Protokoll
             </button>
             <button 
               onClick={() => setView('archive')} 
               className={`px-3 py-1 text-sm font-semibold rounded-md transition-all flex items-center gap-1 ${view === 'archive' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <History size={14} /> Archiv
             </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {view === 'form' && (
            <button onClick={resetProtocol} className="text-slate-400 hover:text-red-500 p-2 rounded hover:bg-slate-50" title="Neues Protokoll (Reset)">
              <RotateCcw size={18} />
            </button>
          )}
          <div className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded hidden sm:block">{data.meta.id.slice(0,8)}...</div>
        </div>
      </header>

      {/* STEP NAV - Nur anzeigen im Form-View */}
      {view === 'form' && (
        <div className="bg-white border-b border-slate-200 px-4 py-3 overflow-x-auto"><div className="flex items-center gap-6 min-w-max mx-auto max-w-4xl">{STEPS.map((s, idx) => (<button key={s.id} onClick={() => setStep(idx)} className={`flex items-center gap-2 group ${idx === step ? 'text-blue-600' : 'text-slate-400'}`}><div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${idx === step ? 'border-blue-600 bg-blue-50' : (idx < step ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-200 bg-white')}`}>{idx < step ? <Check size={14} /> : <s.icon size={14} />}</div><span className={`text-sm font-medium ${idx === step ? 'text-slate-900' : 'group-hover:text-slate-600'}`}>{s.title}</span>{idx < STEPS.length - 1 && <ChevronRight size={14} className="text-slate-300 ml-2" />}</button>))}</div></div>
      )}
      
      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto p-4 md:p-8">{renderContent()}</main>
      
      {/* FOOTER NAV - Nur anzeigen im Form-View */}
      {view === 'form' && step < 4 && (<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-10"><div className="max-w-2xl mx-auto flex justify-between gap-4"><button onClick={() => {window.scrollTo(0,0); setStep(Math.max(0, step - 1))}} disabled={step === 0} className="flex-1 py-3 px-4 rounded-xl font-semibold border border-slate-300 text-slate-600 disabled:opacity-50 hover:bg-slate-50">Zurück</button><button onClick={() => {window.scrollTo(0,0); setStep(Math.min(STEPS.length - 1, step + 1))}} className="flex-[2] py-3 px-4 rounded-xl font-bold bg-blue-600 text-white shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2">Weiter <ChevronRight size={20} /></button></div></div>)}

      {/* [PERSISTENCE] RESTORE MODAL */}
      {showDraftDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4 text-amber-600">
              <AlertTriangle size={28} />
              <h3 className="font-bold text-lg text-slate-900">Entwurf gefunden</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Es wurde ein ungespeicherter Entwurf vom 
              <span className="font-semibold block text-slate-800">
                {new Date(foundDraft?.savedAt).toLocaleString()}
              </span> 
              gefunden. Möchtest du ihn wiederherstellen?
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={restoreDraft}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2"
              >
                <Save size={18} /> Entwurf laden
              </button>
              <button 
                onClick={discardDraft}
                className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 font-medium rounded-lg"
              >
                Verwerfen (Neu starten)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}