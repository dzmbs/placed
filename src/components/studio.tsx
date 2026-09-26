'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Backpack,
  Bike,
  Box,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Luggage,
  Maximize2,
  Minimize2,
  Monitor,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Shirt,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ASSETS, COLORS, initialDraft, money, safeDraft, validateDraft } from '@/lib/studio';
import type { AssetKind, Draft, GenerationProvider, SavedModel, Spot, Vec3 } from '@/lib/types';
import {
  rememberCanvas,
  safeCanvasDrafts,
  selectCanvas,
  selectHuman,
  type CanvasDrafts,
} from '@/lib/canvas-drafts';
import { validId } from '@/lib/ids';
import { HUMAN_PRESETS, humanWardrobe, type AvailableHuman } from '@/lib/humans';
import HumanPicker from './human-picker';
import type { CameraCommand } from './viewer';

const Viewer = dynamic(() => import('./viewer'), {
  ssr: false,
  loading: () => (
    <div className="viewer-loading">
      <span className="spinner" />
      Preparing your canvas…
    </div>
  ),
});
const STORAGE_KEY = 'placed-studio-draft-v1';
const LISTINGS_KEY = 'placed-studio-listings-v1';
const CANVASES_KEY = 'placed-studio-canvases-v1';
type Modal = 'import' | 'campaign' | 'publish' | 'gallery' | 'models' | 'help' | null;
const icons = {
  suitcase: Luggage,
  backpack: Backpack,
  dress: Shirt,
  bicycle: Bike,
  digital: Monitor,
  custom: Box,
};

function Mark() {
  return (
    <span className="brand-mark">
      <span />
      <span />
      <span />
    </span>
  );
}
function Thumbnail({ kind }: { kind: AssetKind }) {
  if (kind === 'suitcase')
    return (
      <span className="mini-case">
        <i />
        <b />
      </span>
    );
  if (kind === 'backpack')
    return (
      <span className="mini-pack">
        <i />
      </span>
    );
  const Icon = icons[kind];
  return <Icon size={39} strokeWidth={1.2} />;
}
function downloadJSON(draft: Draft) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'placed-campaign.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ModalShell({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && ref.current) {
        const elements = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, select, textarea, a[href]',
          ),
        ).filter((e) => e.offsetParent !== null);
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', listener);
    return () => {
      document.body.style.overflow = scroll;
      window.removeEventListener('keydown', listener);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ModelsDialog({
  onClose,
  onOpen,
  onImport,
}: {
  onClose: () => void;
  onOpen: (url: string, name: string) => void;
  onImport: () => void;
}) {
  const [models, setModels] = useState<SavedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/models', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setModels(data.models);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Models could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  return (
    <ModalShell onClose={onClose} title="Your saved models." eyebrow="YOUR WORLD, ALWAYS HERE" wide>
      <p className="modal-description">
        Every imported or generated model is saved on this computer. Reopen one to continue its
        canvas, or download a GLB for Blender.
      </p>
      {loading ? (
        <div className="model-library-loading">
          <LoaderCircle size={20} className="spin" />
          Loading your models…
        </div>
      ) : error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : models.length ? (
        <div className="model-library">
          {models.map((model) => (
            <article key={model.id} className="saved-model">
              <span className="saved-model-icon">
                <Box size={25} strokeWidth={1.4} />
              </span>
              <div>
                <h3>{model.name}</h3>
                <p>
                  {model.source === 'upload'
                    ? 'Imported GLB'
                    : `Generated with ${model.source === 'meshy' ? 'Meshy' : 'Tripo'}`}{' '}
                  · {(model.size / 1_000_000).toFixed(1)} MB
                </p>
                <small>{new Date(model.createdAt).toLocaleString()}</small>
              </div>
              <div className="saved-model-actions">
                <a
                  className="button secondary"
                  href={`${model.assetUrl}?download=1`}
                  download={`${model.name}.glb`}
                >
                  <Download size={14} />
                  GLB
                </a>
                <button
                  className="button primary"
                  onClick={() => onOpen(model.assetUrl, model.name)}
                >
                  Open canvas
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="gallery-empty">
          <Box size={35} />
          <h3>Your first model is waiting.</h3>
          <p>
            Import a GLB or generate a model from a photo. If a generation is still running, reopen
            Import to check its progress.
          </p>
        </div>
      )}
      <button className="button secondary full model-library-import" onClick={onImport}>
        <Plus size={15} />
        Import or generate a model
      </button>
    </ModalShell>
  );
}
function ImportDialog({
  onClose,
  onImport,
  onDraftImport,
  notify,
}: {
  onClose: () => void;
  onImport: (url: string, name: string) => void;
  onDraftImport: (draft: Draft) => void;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<'photos' | 'model' | 'draft'>('photos');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [provider, setProvider] = useState<GenerationProvider>('tripo');
  const [config, setConfig] = useState<{
    tripo: boolean;
    meshy: boolean;
    generationEnabled: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [name, setName] = useState('My custom canvas');
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError('Could not check the local provider configuration.'));
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [photos]);
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function poll() {
      try {
        const response = await fetch(`/api/generations/${job}`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || 'Could not check generation.');
        setProgress(data.progress);
        if (data.status === 'succeeded') {
          localStorage.removeItem('placed-active-generation');
          onImport(data.assetUrl, data.name);
          notify('Your 3D model is ready. Click + Add spot to create placements.');
          return;
        }
        if (data.status === 'failed') throw new Error(data.error || 'Generation failed.');
        timeout = setTimeout(poll, 5000);
      } catch (e) {
        if (cancelled) return;
        attempts++;
        if (attempts < 3) {
          timeout = setTimeout(poll, 7000);
          return;
        }
        setError(e instanceof Error ? e.message : 'Generation failed.');
        setBusy(false);
        setJob(null);
        localStorage.removeItem('placed-active-generation');
      }
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [job, onImport, notify]);
  useEffect(() => {
    const pending = localStorage.getItem('placed-active-generation');
    if (pending && validId(pending)) {
      setJob(pending);
      setBusy(true);
    }
  }, []);
  function choose(files: FileList | File[]) {
    const list = Array.from(files);
    if (tab === 'photos') {
      if (
        list.some(
          (f) => !['image/png', 'image/jpeg'].includes(f.type) || f.size > 8 * 1024 * 1024,
        ) ||
        list.length > 4
      ) {
        setError('Choose up to four JPG or PNG photos, at most 8 MB each.');
        return;
      }
      setPhotos(list);
      setError('');
    } else if (list[0]) void importFile(list[0]);
  }
  async function importFile(file: File) {
    setError('');
    setBusy(true);
    try {
      if (tab === 'draft') {
        const draft = safeDraft(JSON.parse(await file.text()));
        if (!draft) throw new Error('This is not a valid Placed campaign file.');
        onDraftImport(draft);
        notify('Campaign restored.');
        return;
      }
      if (!file.name.toLowerCase().endsWith('.glb') || file.size > 50 * 1024 * 1024)
        throw new Error('Choose a GLB model smaller than 50 MB.');
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/assets', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (mounted.current) {
        onImport(data.assetUrl, data.name);
        notify('Model imported. Click + Add spot, then click its surface.');
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function generate() {
    if (!photos.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('provider', provider);
      form.append('name', name);
      photos.forEach((f) => form.append('files', f));
      const response = await fetch('/api/generations', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      localStorage.setItem('placed-active-generation', data.id);
      if (mounted.current) setJob(data.id);
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Generation failed.');
        setBusy(false);
      }
    }
  }
  return (
    <ModalShell onClose={onClose} title="Bring your world into 3D." eyebrow="YOUR CANVAS, YOUR WAY">
      <div className="segmented import-tabs">
        {(['photos', 'model', 'draft'] as const).map((t) => (
          <button
            key={t}
            disabled={busy}
            className={tab === t ? 'active' : ''}
            onClick={() => {
              setTab(t);
              setError('');
            }}
          >
            {t === 'photos' ? 'Photo → 3D' : t === 'model' ? 'Upload a model' : 'Open campaign'}
          </button>
        ))}
      </div>
      {job ? (
        <div className="generation-progress">
          <Sparkles size={35} />
          <h3>Giving your canvas a new dimension.</h3>
          <p>You can close this window. Reopen Import to check progress.</p>
          <div className="progress-track">
            <span style={{ width: `${Math.max(5, progress)}%` }} />
          </div>
          <small>
            {progress}% ·{' '}
            {progress < 30
              ? 'Building geometry'
              : progress < 90
                ? 'Refining shape and materials'
                : 'Preparing your model'}
          </small>
        </div>
      ) : (
        <>
          <div
            className={`upload-zone ${busy ? 'disabled' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) choose(e.dataTransfer.files);
            }}
          >
            <input
              ref={input}
              type="file"
              hidden
              multiple={tab === 'photos'}
              accept={
                tab === 'photos' ? 'image/png,image/jpeg' : tab === 'model' ? '.glb' : '.json'
              }
              onChange={(e) => {
                if (e.target.files) choose(e.target.files);
                e.target.value = '';
              }}
            />
            {previews.length > 0 && tab === 'photos' ? (
              <div className="photo-previews">
                {previews.map((url, i) => (
                  <div key={url}>
                    <img src={url} alt={`${['Front', 'Back', 'Left', 'Right'][i]} view`} />
                    <span>{['FRONT', 'BACK', 'LEFT', 'RIGHT'][i]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="upload-symbol">
                {tab === 'photos' ? <ImagePlus size={30} /> : <Box size={30} />}
              </div>
            )}
            <h3>
              {tab === 'photos'
                ? 'Drop your photos here'
                : tab === 'model'
                  ? 'Drop a GLB model here'
                  : 'Drop a saved campaign here'}
            </h3>
            <p>
              {tab === 'photos'
                ? 'A clear front photo works. Add back and side views for a better result.'
                : tab === 'model'
                  ? 'A self-contained .glb with embedded textures. Up to 50 MB.'
                  : 'Open a .json exported from this local studio.'}
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}Choose{' '}
              {tab === 'photos' ? 'photos' : 'file'}
            </button>
          </div>
          {tab === 'photos' && (
            <>
              <label className="field">
                Canvas name
                <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              </label>
              <div className="provider-options">
                {(['tripo', 'meshy'] as const).map((p) => (
                  <button
                    key={p}
                    disabled={busy || !config?.[p]}
                    onClick={() => setProvider(p)}
                    className={provider === p ? 'chosen' : ''}
                  >
                    <span>
                      {p === 'tripo' ? 'Tripo' : 'Meshy'}
                      <small>{config?.[p] ? 'Connected' : 'Not configured'}</small>
                    </span>
                    <span className="radio-dot">{provider === p && <span />}</span>
                  </button>
                ))}
              </div>
              <p className="import-disclosure">
                Your photos are sent to the selected provider. Generation uses your account’s paid
                API credits. The result is a visual approximation; inspect all sides before creating
                placements.
              </p>
              <button
                className="button primary full"
                disabled={
                  !photos.length || busy || !config?.generationEnabled || !config?.[provider]
                }
                onClick={generate}
              >
                {busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                {busy ? 'Submitting your photos…' : 'Generate my 3D canvas'}
                {!busy && <ArrowRight size={16} />}
              </button>
            </>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </ModalShell>
  );
}

export default function Studio() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [selectedId, setSelectedId] = useState<string | null>('front-hero');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [modal, setModal] = useState<Modal>(null);
  const [placing, setPlacing] = useState<'add' | 'move' | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showSpots, setShowSpots] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [command, setCommand] = useState<CameraCommand>({ view: 'iso', nonce: 0 });
  const [exportNonce, setExportNonce] = useState(0);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState('');
  const [listings, setListings] = useState<Draft[]>([]);
  const [activeTab, setActiveTab] = useState<'spot' | 'all'>('spot');
  const [humans, setHumans] = useState<AvailableHuman[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/humans', { cache: 'no-store', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setHumans(data.humans);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const logoInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvases = useRef<CanvasDrafts>({});
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 6500);
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const selected = draft.spots.find((s) => s.id === selectedId);
  const selectedIndex = draft.spots.findIndex((s) => s.id === selectedId);
  const asset = ASSETS.find((a) => a.id === draft.asset);
  const total = draft.spots.reduce((n, s) => n + s.price, 0);
  const campaignErrors = validateDraft(draft);
  const saveCanvas = useCallback(
    (value: Draft) => {
      canvases.current = rememberCanvas(canvases.current, value);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        localStorage.setItem(CANVASES_KEY, JSON.stringify(canvases.current));
        return true;
      } catch {
        notify('Browser storage is full. Export your campaign to keep a copy.');
        return false;
      }
    },
    [notify],
  );
  useEffect(() => {
    try {
      canvases.current = safeCanvasDrafts(JSON.parse(localStorage.getItem(CANVASES_KEY) ?? '{}'));
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = safeDraft(JSON.parse(raw));
        if (restored) {
          setDraft(restored);
          setSelectedId(restored.spots[0]?.id ?? null);
        }
      }
      const savedListings = JSON.parse(localStorage.getItem(LISTINGS_KEY) ?? '[]');
      if (Array.isArray(savedListings))
        setListings(savedListings.map(safeDraft).filter((d): d is Draft => d !== null));
    } catch {
      notify('Your saved draft could not be opened. A fresh canvas is ready.');
    }
    setReady(true);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [notify]);
  useEffect(() => {
    if (!ready) return;
    setSaved(false);
    const timeout = setTimeout(() => {
      if (saveCanvas(draft)) setSaved(true);
    }, 500);
    return () => clearTimeout(timeout);
  }, [draft, ready, saveCanvas]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      saveCanvas(currentDraft.current);
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [ready, saveCanvas]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
        setPlacing(null);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  function camera(view: CameraCommand['view']) {
    setCommand((c) => ({ view, nonce: c.nonce + 1 }));
  }
  function chooseAsset(kind: AssetKind) {
    if (kind === 'dress' && humans.length) {
      chooseHuman(humans.find((h) => h.id === draft.humanPreset) ?? humans[0]);
      return;
    }
    saveCanvas(draft);
    const next = selectCanvas(canvases.current, draft, kind);
    setDraft(next);
    saveCanvas(next);
    setSelectedId(next.spots[0]?.id ?? null);
    setPlacing(null);
    setMode('edit');
    camera('iso');
  }
  function chooseHuman(human: AvailableHuman) {
    saveCanvas(draft);
    const preset = HUMAN_PRESETS.find((p) => p.id === human.id)!;
    const next = selectHuman(canvases.current, draft, human.id, preset.name, human.spots);
    setDraft(next);
    saveCanvas(next);
    setSelectedId(next.spots[0]?.id ?? null);
    setPlacing(null);
    setMode('edit');
    if (
      !draft.humanPreset ||
      humanWardrobe(draft.humanPreset)?.bodyUrl !== humanWardrobe(human.id)?.bodyUrl ||
      !humanWardrobe(human.id)
    )
      camera('front');
  }
  const importAsset = useCallback(
    (url: string, name: string) => {
      const current = currentDraft.current;
      saveCanvas(current);
      const next = selectCanvas(canvases.current, current, 'custom', url, name);
      setDraft(next);
      saveCanvas(next);
      setSelectedId(next.spots[0]?.id ?? null);
      setModal(null);
      setMode('edit');
      setPlacing(null);
      setCommand((c) => ({ view: 'iso', nonce: c.nonce + 1 }));
    },
    [saveCanvas],
  );
  function select(id: string | null) {
    setSelectedId(id);
    setActiveTab('spot');
    if (id) camera('spot');
  }
  function patchSpot(change: Partial<Spot>) {
    setDraft((d) => ({
      ...d,
      spots: d.spots.map((s) => (s.id === selectedId ? { ...s, ...change } : s)),
    }));
  }
  function place(position: Vec3, rotation: Vec3, meshName: string) {
    if (placing === 'move' && selected)
      patchSpot({ position, rotation, meshName, projection: true });
    else {
      const spot: Spot = {
        id: crypto.randomUUID(),
        name: `Custom / spot ${draft.spots.length + 1}`,
        position,
        rotation,
        width: 0.45,
        height: 0.35,
        price: 150,
        meshName,
        projection: true,
      };
      setDraft((d) => ({ ...d, spots: [...d.spots, spot] }));
      setSelectedId(spot.id);
      setActiveTab('spot');
    }
    setPlacing(null);
    notify(
      placing === 'move'
        ? 'Placement moved to the new surface.'
        : 'Placement added. Give it a name and starting price.',
    );
  }
  function deleteSpot() {
    setDraft((d) => ({ ...d, spots: d.spots.filter((s) => s.id !== selectedId) }));
    setSelectedId(draft.spots.find((s) => s.id !== selectedId)?.id ?? null);
  }
  async function uploadLogo(file: File) {
    if (!selected) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      notify('Use a PNG, JPG, or WebP logo smaller than 2 MB.');
      return;
    }
    const spotId = selected.id;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({
        ...d,
        spots: d.spots.map((s) =>
          s.id === spotId ? { ...s, artwork: reader.result as string } : s,
        ),
      }));
      notify('Logo applied. Rotate your canvas to inspect the placement.');
    };
    reader.readAsDataURL(file);
  }
  function publish() {
    if (campaignErrors.length) return;
    const next = [structuredClone(draft), ...listings].slice(0, 12);
    try {
      localStorage.setItem(LISTINGS_KEY, JSON.stringify(next));
      setListings(next);
      setModal(null);
      setMode('preview');
      camera('iso');
      notify('Listing saved to your local gallery.');
    } catch {
      notify('Browser storage is full. Export your campaign to keep a copy.');
    }
  }
  function loadListing(listing: Draft) {
    saveCanvas(draft);
    const next = structuredClone(listing);
    setDraft(next);
    saveCanvas(next);
    setSelectedId(listing.spots[0]?.id ?? null);
    setMode('preview');
    setModal(null);
    camera('iso');
  }
  function importDraft(next: Draft) {
    saveCanvas(draft);
    setDraft(next);
    saveCanvas(next);
    setSelectedId(next.spots[0]?.id ?? null);
    setMode('edit');
    setPlacing(null);
    setModal(null);
    camera('iso');
  }
  return (
    <main className={`app ${expanded ? 'stage-expanded' : ''}`}>
      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="/" aria-label="Placed home">
          <Mark />
          placed<span>®</span>
        </a>
        <div className="nav-links">
          <button
            className="nav-active"
            onClick={() => {
              setMode('edit');
              setModal(null);
            }}
          >
            Studio
            <span className="nav-dot" />
          </button>
          <button onClick={() => setModal('models')}>My models</button>
          <button onClick={() => setModal('gallery')}>
            My gallery
            {listings.length > 0 && <span className="count-badge">{listings.length}</span>}
          </button>
        </div>
        <div className="nav-right">
          <span className="local-badge">
            <span />
            LOCAL STUDIO
          </span>
          <button
            className="icon-button help-button"
            title="How the studio works"
            aria-label="How the studio works"
            onClick={() => setModal('help')}
          >
            <CircleHelp size={18} />
          </button>
          <span className="avatar">
            Y<span />
          </span>
        </div>
      </nav>
      <header className="page-header">
        <div>
          <div className="eyebrow">
            <span className="tiny-square" />
            THE PLACEMENT STUDIO
          </div>
          <h1>
            Your world. <span>Their next billboard.</span>
          </h1>
          <p>Turn the things you carry, wear, and share into something worth sponsoring.</p>
        </div>
        <div className="header-actions">
          <span className="save-status">
            {saved ? <CheckCheck size={15} /> : <LoaderCircle size={15} className="spin" />}
            {saved ? 'Draft saved locally' : 'Saving…'}
          </span>
          <button
            className="button secondary"
            onClick={() => {
              downloadJSON(draft);
              notify('Campaign exported.');
            }}
          >
            <ArrowDownToLine size={16} />
            Export
          </button>
          <button className="button primary" onClick={() => setModal('publish')}>
            Publish canvas
            <ArrowUpRight size={17} />
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="asset-panel">
          <div className="panel-intro">
            <span className="step-label">01 / THE CANVAS</span>
            <h2>Start with your world.</h2>
            <p>What’s getting sponsored?</p>
          </div>
          <div className="asset-list">
            {ASSETS.map((a) => (
              <button
                key={a.id}
                className={`asset-card ${draft.asset === a.id ? 'selected' : ''}`}
                onClick={() => chooseAsset(a.id)}
              >
                <span className={`asset-thumbnail ${a.id}`}>
                  <Thumbnail kind={a.id} />
                </span>
                <span className="asset-copy">
                  <strong>{a.name}</strong>
                  <small>{a.label}</small>
                </span>
                {draft.asset === a.id ? (
                  <span className="asset-check">
                    <Check size={12} />
                  </span>
                ) : (
                  <ChevronRight className="asset-chevron" size={15} />
                )}
              </button>
            ))}
          </div>
          {draft.asset === 'dress' && humans.length > 0 && (
            <HumanPicker humans={humans} current={draft.humanPreset} onSelect={chooseHuman} />
          )}
          <div className="import-card">
            <div className="import-card-icon">
              <Sparkles size={18} />
            </div>
            <strong>Made for your thing.</strong>
            <p>
              Bring a photo. Make it 3D.
              <br />
              Or import a model you already have.
            </p>
            <button className="button secondary full" onClick={() => setModal('import')}>
              <Plus size={15} />
              Import your own
              <ArrowUpRight size={14} />
            </button>
            <button className="saved-models-link" onClick={() => setModal('models')}>
              Open a saved model
              <ArrowRight size={12} />
            </button>
          </div>
          {!draft.humanPreset && (
            <div className="color-section">
              <span className="section-label">MAKE IT YOURS</span>
              <div className="color-swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label={`Set canvas color ${c}`}
                    aria-pressed={draft.color === c}
                    disabled={draft.asset === 'custom'}
                    style={{ background: c }}
                    className={draft.color === c ? 'chosen' : ''}
                    onClick={() => setDraft((d) => ({ ...d, color: c }))}
                  >
                    {draft.color === c && (
                      <Check
                        size={13}
                        color={c === '#25272e' || c === '#36463e' ? '#fff' : '#293326'}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="sidebar-note">
            <span className="tiny-square" />
            <p>
              A little space.
              <br />
              <strong>A whole lot of possibility.</strong>
            </p>
          </div>
        </aside>
        <section
          className={`stage ${placing ? 'is-placing' : ''}`}
          aria-label="Interactive 3D canvas"
        >
          <div className="stage-top">
            <div>
              <span className="stage-kicker">
                <span />
                INTERACTIVE 3D
              </span>
              <h2>
                {draft.assetName || asset?.name || 'Your canvas'}
                <span>
                  /{' '}
                  {draft.asset === 'custom'
                    ? '06'
                    : String(ASSETS.findIndex((a) => a.id === draft.asset) + 1).padStart(2, '0')}
                </span>
              </h2>
            </div>
            <button
              className="stage-icon"
              aria-label={expanded ? 'Exit expanded view' : 'Expand 3D view'}
              title={expanded ? 'Exit expanded view' : 'Expand view'}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
          <div className="stage-tabs">
            <button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>
              <Layers3 size={13} />
              Editor
            </button>
            <button
              className={mode === 'preview' ? 'active' : ''}
              onClick={() => {
                setMode('preview');
                setPlacing(null);
                camera('iso');
              }}
            >
              <Eye size={13} />
              Sponsor view
            </button>
          </div>
          <Viewer
            draft={draft}
            selectedId={selectedId}
            onSelect={select}
            placing={Boolean(placing)}
            onPlace={place}
            command={command}
            autoRotate={autoRotate}
            showSpots={showSpots}
            preview={mode === 'preview'}
            exportNonce={exportNonce}
            onError={notify}
          />
          <div className="stage-stats">
            <span>
              {String(draft.spots.length).padStart(2, '0')}
              <small>PLACEMENTS</small>
            </span>
            <i />
            <span>
              {money(total)}
              <small>OPENING VALUE</small>
            </span>
          </div>
          {placing && (
            <div className="placement-instruction">
              <Plus size={15} />
              Click the surface to{' '}
              {placing === 'move' ? 'move this placement' : 'place your ad spot'}
              <button onClick={() => setPlacing(null)} aria-label="Cancel placing">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="stage-bottom">
            <div className="camera-toolbar">
              <button
                title="Rotate automatically"
                aria-label="Rotate automatically"
                aria-pressed={autoRotate}
                className={autoRotate ? 'active' : ''}
                onClick={() => setAutoRotate((r) => !r)}
              >
                <RotateCw size={16} />
              </button>
              <span />
              <button onClick={() => camera('front')}>Front</button>
              <button onClick={() => camera('back')}>Back</button>
              <button onClick={() => camera('side')}>Side</button>
              <span />
              <button title="Reset camera" aria-label="Reset camera" onClick={() => camera('iso')}>
                <RotateCcw size={15} />
              </button>
              <button
                title={showSpots ? 'Hide placements' : 'Show placements'}
                aria-label={showSpots ? 'Hide placements' : 'Show placements'}
                onClick={() => setShowSpots((v) => !v)}
              >
                {showSpots ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
            <p>
              <Move size={12} />
              Drag to orbit <span>·</span> Scroll to zoom
            </p>
          </div>
          <span className="stage-coordinate">35° N / YOUR NEXT MOVE</span>
        </section>
        <aside className="placement-panel">
          <div className="placement-heading">
            <span className="step-label">02 / THE SPACE</span>
            <div className="placement-title">
              <h2>{mode === 'preview' ? 'Find your place.' : 'Make room for a brand.'}</h2>
              <span className="small-number">{draft.spots.length}</span>
            </div>
          </div>
          <div className="panel-tabs">
            <button
              className={activeTab === 'spot' ? 'active' : ''}
              onClick={() => setActiveTab('spot')}
            >
              {mode === 'preview' ? 'Selected spot' : 'Edit placement'}
            </button>
            <button
              className={activeTab === 'all' ? 'active' : ''}
              onClick={() => setActiveTab('all')}
            >
              All spots<span>{draft.spots.length}</span>
            </button>
          </div>
          <div className="placement-content">
            {activeTab === 'all' ? (
              <div className="spot-list">
                {draft.spots.length === 0 && (
                  <div className="empty-spots">
                    <Box size={30} />
                    <h3>A blank canvas.</h3>
                    <p>Add your first spot to get started.</p>
                  </div>
                )}
                {draft.spots.map((s, i) => (
                  <button
                    key={s.id}
                    className={selectedId === s.id ? 'selected' : ''}
                    onClick={() => select(s.id)}
                  >
                    <span className="spot-number">{String(i + 1).padStart(2, '0')}</span>
                    <span>
                      <strong>{s.name}</strong>
                      <small>{s.artwork ? 'Logo preview added' : 'Available for a brand'}</small>
                    </span>
                    <b>{money(s.price)}</b>
                  </button>
                ))}
              </div>
            ) : selected ? (
              <>
                <div className="spot-overline">
                  <span className="spot-number">{String(selectedIndex + 1).padStart(2, '0')}</span>
                  <span className="available">
                    <span />
                    AVAILABLE
                  </span>
                  {mode === 'edit' && (
                    <button
                      className="icon-button"
                      aria-label="Delete selected placement"
                      title="Delete placement"
                      onClick={deleteSpot}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {mode === 'edit' ? (
                  <label className="field">
                    Placement name
                    <input
                      value={selected.name}
                      maxLength={60}
                      onChange={(e) => patchSpot({ name: e.target.value })}
                    />
                  </label>
                ) : (
                  <h3 className="preview-spot-title">{selected.name}</h3>
                )}
                <label className="field">
                  {mode === 'edit' ? 'Starting price' : 'Opening bid'}
                  <div className="price-input">
                    <span>$</span>
                    <input
                      aria-label="Starting price in dollars"
                      readOnly={mode === 'preview'}
                      type="number"
                      min="1"
                      max="1000000"
                      value={selected.price}
                      onChange={(e) => patchSpot({ price: Math.max(0, Number(e.target.value)) })}
                    />
                    <small>USD</small>
                  </div>
                </label>
                {mode === 'edit' && (
                  <div className="spot-controls">
                    <div className="range-row">
                      <label htmlFor="spot-width">Width</label>
                      <span>{selected.width.toFixed(2)} ×</span>
                    </div>
                    <input
                      id="spot-width"
                      type="range"
                      min="0.15"
                      max="1.8"
                      step="0.01"
                      value={selected.width}
                      onChange={(e) => patchSpot({ width: Number(e.target.value) })}
                    />
                    <div className="range-row">
                      <label htmlFor="spot-height">Height</label>
                      <span>{selected.height.toFixed(2)} ×</span>
                    </div>
                    <input
                      id="spot-height"
                      type="range"
                      min="0.12"
                      max="1.5"
                      step="0.01"
                      value={selected.height}
                      onChange={(e) => patchSpot({ height: Number(e.target.value) })}
                    />
                    <button
                      className={`move-button ${placing === 'move' ? 'active' : ''}`}
                      onClick={() => {
                        setPlacing(placing === 'move' ? null : 'move');
                      }}
                    >
                      <Move size={13} />
                      Move on surface
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                )}
                <div className="artwork-section">
                  <div className="section-row">
                    <span className="section-label">
                      {mode === 'preview' ? 'TRY YOUR BRAND HERE' : 'LOGO PREVIEW'}
                    </span>
                    {selected.artwork && (
                      <button
                        onClick={() => patchSpot({ artwork: undefined })}
                        aria-label="Remove logo"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <input
                    hidden
                    ref={logoInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void uploadLogo(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                  <button
                    className={`logo-drop ${selected.artwork ? 'has-logo' : ''}`}
                    onClick={() => logoInput.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files[0]) void uploadLogo(e.dataTransfer.files[0]);
                    }}
                  >
                    {selected.artwork ? (
                      <img src={selected.artwork} alt="Your sponsor logo" />
                    ) : (
                      <>
                        <ImagePlus size={22} />
                        <strong>Drop a logo. See it live.</strong>
                        <small>PNG, JPG, WebP · up to 2 MB</small>
                      </>
                    )}
                  </button>
                </div>
                {mode === 'preview' && (
                  <div className="preview-details">
                    <span className="section-label">THE OCCASION</span>
                    <strong>{draft.campaign.event}</strong>
                    <small>
                      {draft.campaign.startDate} → {draft.campaign.endDate}
                    </small>
                    <p>{draft.campaign.deliverables}</p>
                    <button
                      className="button primary full"
                      onClick={() =>
                        notify(
                          'This is a local visual preview. Bidding will arrive with the EVM integration.',
                        )
                      }
                    >
                      <span>Preview sponsorship</span>
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-spots">
                <Box size={30} />
                <h3>Your space starts here.</h3>
                <p>Click + Add spot, then click a surface on your model.</p>
              </div>
            )}
          </div>
          <div className="placement-footer">
            {mode === 'edit' ? (
              <button
                className={`button dark full ${placing === 'add' ? 'placing' : ''}`}
                onClick={() => {
                  setPlacing(placing === 'add' ? null : 'add');
                  setShowSpots(true);
                  camera('iso');
                }}
              >
                <Plus size={16} />
                {placing === 'add' ? 'Click your model…' : 'Add a placement'}
              </button>
            ) : (
              <button
                className="button secondary full"
                onClick={() => {
                  setMode('edit');
                }}
              >
                Back to editor
                <ArrowLeft size={15} />
              </button>
            )}
            <span>YOUR CANVAS. YOUR RULES.</span>
          </div>
        </aside>
      </div>
      <section className="campaign-strip">
        <div className="campaign-strip-label">
          <span className="step-label">03 / THE MOMENT</span>
          <strong>{draft.campaign.event}</strong>
        </div>
        <div>
          <span className="section-label">ON DISPLAY</span>
          <strong>
            {new Date(`${draft.campaign.startDate}T12:00`).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}{' '}
            —{' '}
            {new Date(`${draft.campaign.endDate}T12:00`).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
            <span className="muted">{draft.campaign.startDate.slice(0, 4)}</span>
          </strong>
        </div>
        <div className="strip-deliverables">
          <span className="section-label">WHAT BRANDS GET</span>
          <strong>{draft.campaign.deliverables}</strong>
        </div>
        <button className="button secondary" onClick={() => setModal('campaign')}>
          Edit details
          <ArrowUpRight size={15} />
        </button>
      </section>
      <footer className="footer">
        <span>
          <Mark />
          Good things deserve to be seen.
        </span>
        <button onClick={() => setExportNonce((n) => n + 1)}>
          <Download size={13} />
          Export 3D model
        </button>
        <span>
          BUILT FOR THE REAL WORLD
          <span className="tiny-square" />
        </span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}
      {modal === 'import' && (
        <ImportDialog
          onClose={closeModal}
          onImport={importAsset}
          onDraftImport={importDraft}
          notify={notify}
        />
      )}
      {modal === 'models' && (
        <ModelsDialog
          onClose={closeModal}
          onOpen={importAsset}
          onImport={() => setModal('import')}
        />
      )}
      {modal === 'campaign' && (
        <ModalShell
          onClose={closeModal}
          eyebrow="03 / THE MOMENT"
          title="Give your canvas a story."
        >
          <p className="modal-description">
            Tell brands where their logo is going, and what they’ll get along the way.
          </p>
          <label className="field">
            Campaign title
            <input
              value={draft.campaign.title}
              maxLength={100}
              onChange={(e) =>
                setDraft((d) => ({ ...d, campaign: { ...d.campaign, title: e.target.value } }))
              }
            />
          </label>
          <label className="field">
            Event or display location
            <input
              value={draft.campaign.event}
              maxLength={100}
              onChange={(e) =>
                setDraft((d) => ({ ...d, campaign: { ...d.campaign, event: e.target.value } }))
              }
            />
          </label>
          <div className="two-fields">
            <label className="field">
              Display starts
              <input
                type="date"
                value={draft.campaign.startDate}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    campaign: { ...d.campaign, startDate: e.target.value },
                  }))
                }
              />
            </label>
            <label className="field">
              Display ends
              <input
                type="date"
                min={draft.campaign.startDate}
                value={draft.campaign.endDate}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, campaign: { ...d.campaign, endDate: e.target.value } }))
                }
              />
            </label>
          </div>
          <label className="field">
            Auction closes · your local time
            <input
              type="datetime-local"
              value={draft.campaign.auctionEnd}
              onChange={(e) =>
                setDraft((d) => ({ ...d, campaign: { ...d.campaign, auctionEnd: e.target.value } }))
              }
            />
          </label>
          <label className="field">
            What sponsors receive
            <textarea
              rows={3}
              maxLength={600}
              value={draft.campaign.deliverables}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  campaign: { ...d.campaign, deliverables: e.target.value },
                }))
              }
            />
          </label>
          <button className="button primary full" onClick={closeModal}>
            Save campaign details
            <Check size={16} />
          </button>
        </ModalShell>
      )}
      {modal === 'publish' && (
        <ModalShell
          onClose={closeModal}
          eyebrow="READY TO BE SEEN"
          title="Your next billboard is ready."
        >
          <div className="publish-summary">
            <span className="publish-symbol">
              <Mark />
            </span>
            <h3>{draft.campaign.title}</h3>
            <p>{draft.campaign.event}</p>
            <div>
              <span>
                <strong>{draft.spots.length}</strong>placements
              </span>
              <span>
                <strong>{money(total)}</strong>opening value
              </span>
            </div>
          </div>
          <p className="modal-description">
            Save this listing to your local gallery and explore it as a sponsor. Public sharing,
            real bids, and EVM payments will be added later.
          </p>
          {campaignErrors.length > 0 && (
            <div className="form-error">
              {campaignErrors.map((e) => (
                <p key={e}>{e}</p>
              ))}
              <button className="text-button" onClick={() => setModal('campaign')}>
                Edit campaign details
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          <button
            className="button primary full"
            disabled={campaignErrors.length > 0}
            onClick={publish}
          >
            Save local listing
            <ArrowUpRight size={16} />
          </button>
        </ModalShell>
      )}
      {modal === 'gallery' && (
        <ModalShell
          onClose={closeModal}
          eyebrow="YOUR WORLD, COLLECTED"
          title="Your local gallery."
          wide
        >
          {listings.length ? (
            <div className="gallery-grid">
              {listings.map((listing, i) => (
                <button className="gallery-card" key={i} onClick={() => loadListing(listing)}>
                  <span className={`gallery-art ${listing.asset}`}>
                    <Thumbnail kind={listing.asset} />
                    <span>{listing.spots.length} SPOTS</span>
                  </span>
                  <small>{listing.campaign.event}</small>
                  <h3>{listing.campaign.title}</h3>
                  <div>
                    {money(listing.spots.reduce((n, s) => n + s.price, 0))}
                    <ArrowUpRight size={17} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="gallery-empty">
              <Layers3 size={38} />
              <h3>Your first canvas is waiting.</h3>
              <p>Publish a canvas to save a listing here. Everything stays on this browser.</p>
              <button className="button primary" onClick={closeModal}>
                Back to studio
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </ModalShell>
      )}
      {modal === 'help' && (
        <ModalShell
          onClose={closeModal}
          eyebrow="A PLACE FOR EVERY BRAND"
          title="Small spaces. Big ideas."
        >
          <div className="help-steps">
            <div>
              <span>01</span>
              <section>
                <h3>Pick your canvas.</h3>
                <p>Use a template, import your own GLB, or turn real photos into a 3D model.</p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>Make room.</h3>
                <p>
                  Choose suggested placements or add your own by clicking the model. Set prices and
                  preview logos.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>Give it a moment.</h3>
                <p>
                  Add your event, display dates, auction closing time, and sponsor deliverables.
                </p>
              </section>
            </div>
          </div>
          <p className="import-disclosure">
            This is a local visual prototype. Templates are illustrative, and sizes are preview
            scales. Confirm real print dimensions before selling physical placements. No payments
            are connected.
          </p>
          <button className="button primary full" onClick={closeModal}>
            Let’s make something
            <ArrowRight size={16} />
          </button>
        </ModalShell>
      )}
    </main>
  );
}
