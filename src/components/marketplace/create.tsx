'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Draft, Spot, Vec3, GenerationJob } from '@/lib/types';
import { initialDraft, safeDraft } from '@/lib/studio';
import { restoreMarketplaceDraft } from '@/lib/marketplace/drafts';
import {
  api,
  storeMetadata,
  uploadMedia,
  publishAsset,
  createSlot,
  type WalletSession,
} from '@/lib/marketplace/client';
import { useMarketplace } from './context';
import { Viewer, ErrorMessage } from './shared';
import styles from './marketplace.module.css';

export default function CreateAsset() {
  const router = useRouter();
  const market = useMarketplace();
  const [title, setTitle] = useState('My everyday shirt');
  const [description, setDescription] = useState(
    'A reusable front-of-shirt placement for my next sponsorships.',
  );
  const [draft, setDraft] = useState<Draft>({
    ...initialDraft(),
    asset: 'dress',
    humanPreset: 'male-casual',
    spots: [],
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [command, setCommand] = useState({
    view: 'front' as 'front' | 'back' | 'side' | 'iso' | 'spot',
    nonce: 0,
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [job, setJob] = useState<Partial<GenerationJob>>();
  const [generationSession, setGenerationSession] = useState<WalletSession>();
  const [error, setError] = useState('');
  const [source, setSource] = useState('Prepared 3D example');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('placed-marketplace-create-v1') || 'null');
      const restored = restoreMarketplaceDraft(saved?.draft, window.location.origin);
      if (restored) {
        setDraft(restored);
        setSelected(restored.spots[0]?.id || null);
        if (typeof saved.title === 'string') setTitle(saved.title.slice(0, 100));
        if (typeof saved.description === 'string') setDescription(saved.description.slice(0, 2000));
        if (typeof saved.source === 'string') setSource(saved.source);
        if (saved.job && /^[a-f0-9-]{36}$/.test(saved.job.id)) setJob(saved.job);
        setLoaded(true);
        return;
      }
    } catch {
      /* An invalid local draft falls back to the prepared example. */
    }
    fetch('/models/humans/male-casual.json')
      .then((r) => r.json())
      .then((meta) => {
        const first: Spot = { ...meta.spots[0], price: 0, name: 'Front of shirt' };
        setDraft((value) => ({ ...value, spots: [first] }));
        setSelected(first.id);
      })
      .catch(() => setError('Prepared placement could not load.'))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        'placed-marketplace-create-v1',
        JSON.stringify({ draft, title, description, source, job }),
      );
    } catch {
      setError(
        'Browser storage is full. Export your model from the studio or publish before closing.',
      );
    }
  }, [loaded, draft, title, description, source, job]);
  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [photos]);
  useEffect(() => {
    if (!job?.id || !generationSession || ['succeeded', 'failed'].includes(job.status || ''))
      return;
    let stopped = false,
      polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const next = await api<GenerationJob>(
          `/generations/${job.id}`,
          undefined,
          generationSession,
        );
        if (!stopped) {
          setJob(next);
          if (next.status === 'succeeded' && next.assetUrl) {
            setDraft((value) => ({
              ...value,
              asset: 'custom',
              assetUrl: next.assetUrl,
              humanPreset: undefined,
              spots: [],
            }));
            setSelected(null);
            setPlacing(true);
            setSource('AI-generated model');
          }
        }
      } catch (error) {
        if (!stopped)
          setError(error instanceof Error ? error.message : 'Generation status unavailable.');
      } finally {
        polling = false;
      }
    };
    const timer = setInterval(() => void poll(), 5000);
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [job?.id, job?.status, generationSession]);
  function updateSpot(patch: Partial<Spot>) {
    setDraft((value) => ({
      ...value,
      spots: value.spots.map((spot) => (spot.id === selected ? { ...spot, ...patch } : spot)),
    }));
  }
  function place(position: Vec3, rotation: Vec3, meshName: string) {
    const id =
      selected && draft.spots.some((spot) => spot.id === selected) ? selected : crypto.randomUUID();
    setDraft((value) => {
      const previous = value.spots.find((spot) => spot.id === id);
      const next: Spot = {
        id,
        name: previous?.name || `Placement ${value.spots.length + 1}`,
        position,
        rotation,
        meshName,
        projection: true,
        width: previous?.width || 0.4,
        height: previous?.height || 0.3,
        price: 0,
      };
      return {
        ...value,
        spots: previous
          ? value.spots.map((spot) => (spot.id === id ? next : spot))
          : [...value.spots, next],
      };
    });
    setSelected(id);
    setPlacing(false);
  }
  const spot = draft.spots.find((spot) => spot.id === selected);
  return (
    <>
      <p className={styles.eyebrow}>01 / Create an asset</p>
      <h1>Make a place for a brand.</h1>
      <p className={styles.muted}>
        Upload a clear full-body outfit photo, generate a model, then click its surface to place a
        rectangular ad slot.
      </p>
      <div className={styles.split}>
        <div>
          <div className={styles.viewer}>
            <Viewer
              draft={draft}
              selectedId={selected}
              onSelect={setSelected}
              placing={placing}
              onPlace={place}
              command={command}
              autoRotate={false}
              showSpots
              preview
              exportNonce={0}
              onError={setError}
            />
          </div>
          <div className={styles.controls}>
            {(['front', 'back', 'side', 'iso'] as const).map((view) => (
              <button key={view} onClick={() => setCommand({ view, nonce: Date.now() })}>
                {view}
              </button>
            ))}
            <span className={styles.muted}>{source}</span>
          </div>
          <ErrorMessage error={error || job?.error || ''} />
          {placing && (
            <p className={styles.warning}>
              Click the model where this placement should attach. Rotate it first if needed.
            </p>
          )}
        </div>
        <div className={styles.stack}>
          <section className={styles.panel}>
            <h2>Start with your photo</h2>
            <div
              className={styles.drop}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setPhotos(
                  Array.from(event.dataTransfer.files)
                    .filter((file) => ['image/png', 'image/jpeg'].includes(file.type))
                    .slice(0, 4),
                );
              }}
            >
              <label>
                Drop a JPG or PNG here
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 4))}
                />
              </label>
              <p className={styles.muted}>
                Good lighting, plain background, visible feet and hands, arms slightly away from
                your body. One photo generates the model; others appear on the listing.
              </p>
            </div>
            <div className={styles.photos}>
              {previews.map((url) => (
                <img src={url} key={url} alt="Uploaded outfit preview" />
              ))}
            </div>
            <div className={styles.controls}>
              <button
                disabled={
                  market.busy ||
                  !photos.length ||
                  (!!job && !['succeeded', 'failed'].includes(job.status || ''))
                }
                onClick={() =>
                  void market.run('Start photo-to-3D generation', async () => {
                    const session = await market.authenticate();
                    const form = new FormData();
                    form.set('photo', photos[0]);
                    const next = await api<GenerationJob>(
                      '/generations',
                      { method: 'POST', body: form },
                      session,
                    );
                    setGenerationSession(session);
                    setJob(next);
                  })
                }
              >
                Generate from first photo
              </button>
              <button
                disabled={market.busy}
                onClick={() => {
                  setJob(undefined);
                  setSource('Prepared 3D example');
                  fetch('/models/humans/male-casual.json')
                    .then((r) => r.json())
                    .then((meta) => {
                      setDraft({
                        ...initialDraft(),
                        asset: 'dress',
                        humanPreset: 'male-casual',
                        spots: [{ ...meta.spots[0], price: 0, name: 'Front of shirt' }],
                      });
                      setSelected(meta.spots[0].id);
                    });
                }}
              >
                Use prepared shirt example
              </button>
            </div>
            {job && (
              <>
                <p>
                  {job.status} · {job.progress || 0}%
                </p>
                <progress className={styles.progress} max={100} value={job.progress || 0} />
              </>
            )}
            {job?.id &&
              !['succeeded', 'failed'].includes(job.status || '') &&
              !generationSession && (
                <button
                  disabled={market.busy}
                  onClick={() =>
                    void market.run('Resume saved generation', async () => {
                      setGenerationSession(await market.authenticate());
                    })
                  }
                >
                  Resume saved generation
                </button>
              )}
            <label>
              Or import a self-contained GLB
              <input
                type="file"
                accept=".glb"
                disabled={market.busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file)
                    void market.run('Import model', async () => {
                      const stored = await uploadMedia(
                        await market.authenticate(),
                        file,
                        'model/gltf-binary',
                      );
                      setJob(undefined);
                      setDraft({
                        ...initialDraft(),
                        asset: 'custom',
                        assetUrl: stored.uri,
                        humanPreset: undefined,
                        spots: [],
                      });
                      setSelected(null);
                      setPlacing(true);
                      setSource('Imported model');
                    });
                }}
              />
            </label>
            <button
              onClick={() => {
                try {
                  const saved = safeDraft(
                    JSON.parse(localStorage.getItem('placed-studio-draft-v1') || 'null'),
                  );
                  if (!saved) throw new Error('Open the studio and save a model first.');
                  setDraft(saved);
                  setSelected(saved.spots[0]?.id || null);
                  setSource('Saved studio draft');
                } catch (error) {
                  setError(error instanceof Error ? error.message : 'Draft unavailable.');
                }
              }}
            >
              Use my saved studio draft
            </button>
          </section>
          <section className={styles.panel}>
            <h2>Your advertising slots</h2>
            <div className={styles.controls}>
              {draft.spots.map((spot) => (
                <button
                  key={spot.id}
                  className={selected === spot.id ? styles.active : undefined}
                  onClick={() => setSelected(spot.id)}
                >
                  {spot.name}
                </button>
              ))}
            </div>
            <div className={styles.controls}>
              <button
                onClick={() => {
                  setSelected(null);
                  setPlacing(true);
                }}
              >
                Add a slot
              </button>
              {spot && (
                <>
                  <button onClick={() => setPlacing(true)}>Move selected slot</button>
                  <button
                    onClick={() => {
                      setDraft((value) => ({
                        ...value,
                        spots: value.spots.filter((s) => s.id !== selected),
                      }));
                      setSelected(null);
                    }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
            {spot && (
              <>
                <label>
                  Slot name
                  <input
                    value={spot.name}
                    maxLength={100}
                    onChange={(event) => updateSpot({ name: event.target.value })}
                  />
                </label>
                <label>
                  Width
                  <input
                    type="range"
                    min={0.05}
                    max={1.5}
                    step={0.01}
                    value={spot.width}
                    onChange={(event) => updateSpot({ width: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Height
                  <input
                    type="range"
                    min={0.05}
                    max={1.5}
                    step={0.01}
                    value={spot.height}
                    onChange={(event) => updateSpot({ height: Number(event.target.value) })}
                  />
                </label>
              </>
            )}
          </section>
          <section className={styles.panel}>
            <h2>Publish your asset</h2>
            <label>
              Title
              <input
                value={title}
                maxLength={100}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                maxLength={2000}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <p className={styles.muted}>
              Publishing requires Proof of Human. No token is created. You can run advertising
              auctions immediately and choose financing later.
            </p>
            <button
              disabled={
                market.busy || !market.balances?.authorized || !draft.spots.length || !title.trim()
              }
              onClick={() =>
                void market.run('Publish asset and its slots', async () => {
                  if (!market.wallet) throw Error('Connect wallet first.');
                  const session = await market.authenticate();
                  let modelUrl = draft.assetUrl;
                  if (modelUrl?.startsWith('/api/assets/')) {
                    const response = await fetch(modelUrl);
                    if (!response.ok) throw Error('Saved model unavailable.');
                    modelUrl = (
                      await uploadMedia(session, await response.blob(), 'model/gltf-binary')
                    ).uri;
                  }
                  const photosURI = [];
                  for (const file of photos) photosURI.push((await uploadMedia(session, file)).uri);
                  const metadata = await storeMetadata(session, 'asset', {
                    version: 1,
                    title,
                    description,
                    kind: draft.asset,
                    modelUrl,
                    humanPreset: draft.humanPreset,
                    color: draft.color,
                    photos: photosURI,
                  });
                  const id = await publishAsset(market.wallet, metadata.uri);
                  router.push(`/marketplace/assets/${id}`);
                  for (const placement of draft.spots) {
                    const record = await storeMetadata(session, 'slot', {
                      version: 1,
                      name: placement.name,
                      placement,
                    });
                    await createSlot(market.wallet, id, record.uri);
                  }
                  return id;
                })
              }
            >
              Publish on Sepolia
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
