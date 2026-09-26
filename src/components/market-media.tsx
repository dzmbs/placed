'use client';
import { useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, X } from 'lucide-react';
import type { Artwork, MarketAsset } from '@/lib/market';

async function digest(data: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
export function MediaInput({
  value,
  onChange,
  proof = false,
  preview = false,
  onRemove,
}: {
  value?: Artwork;
  onChange: (art: Artwork) => void;
  proof?: boolean;
  preview?: boolean;
  onRemove?: () => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false),
    uploading = useRef(false);
  async function upload(file?: File) {
    if (!file || uploading.current) return;
    setError('');
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError('Use a PNG, JPG or WebP smaller than 2 MB.');
      return;
    }
    uploading.current = true;
    setBusy(true);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      onChange({ name: file.name, url, hash: await digest(await file.arrayBuffer()) });
    } catch {
      setError('The image could not be read. Try another file.');
    } finally {
      uploading.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mp-media-input" aria-busy={busy}>
      {value && (
        <div className={`mp-upload-preview ${proof ? 'proof' : ''}`}>
          <img src={value.url} alt={value.name} />
          <span>{value.name}</span>
        </div>
      )}
      <label
        className={`mp-upload ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = busy ? 'none' : 'copy';
          setDragging(!busy);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files[0]);
        }}
      >
        {busy ? <LoaderCircle className="spin" size={21} /> : <ImagePlus size={21} />}
        <strong aria-live="polite">
          {busy
            ? 'Reading image…'
            : value
              ? 'Replace image'
              : proof
                ? 'Upload proof photo'
                : preview
                  ? 'Drop your logo here or choose an image'
                  : 'Upload artwork'}
        </strong>
        <small>PNG, JPG, WebP · up to 2 MB</small>
        <input
          aria-label={proof ? 'Proof photo' : 'Sponsor artwork'}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {value && onRemove && (
        <button
          type="button"
          className="mp-text-button mp-preview-remove"
          disabled={busy}
          onClick={onRemove}
        >
          <X size={15} /> Remove preview
        </button>
      )}
      {error && (
        <p className="mp-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AssetArt({ asset }: { asset: MarketAsset }) {
  const kind = asset.draft.asset;
  return (
    <div className={`mp-art mp-art-${kind}`}>
      <svg viewBox="0 0 480 300" aria-hidden="true">
        <defs>
          <linearGradient id={`g-${asset.id}`} x2="1" y2="1">
            <stop stopColor="#c4cfb0" />
            <stop offset="1" stopColor="#6d8563" />
          </linearGradient>
        </defs>
        <ellipse cx="240" cy="269" rx="149" ry="17" fill="#08150d" opacity=".4" />
        {kind === 'billboard' ? (
          <>
            <path d="M151 264V180M327 264V180" stroke="#7d9277" strokeWidth="12" />
            <path d="M139 266h25m151 0h25" stroke="#455840" strokeWidth="9" />
            <path d="M76 44l327 13v156L76 204z" fill="#6e8264" />
            <path d="M83 52l313 12v137L83 195z" fill={`url(#g-${asset.id})`} />
            <path d="M242 60v139" stroke="#e2edc8" strokeWidth="3" />
            {[110, 200, 290, 377].map((x) => (
              <path key={x} d={`M${x} 46v-17h-15`} fill="none" stroke="#8ba07c" strokeWidth="6" />
            ))}
          </>
        ) : kind === 'twitch' ? (
          <>
            <rect x="54" y="37" width="372" height="220" rx="5" fill="#27243b" />
            <path d="M63 242V46h354v197" stroke="#a292d4" strokeWidth="3" fill="none" />
            {[85, 294].map((x) => (
              <g key={x}>
                <rect x={x} y="81" width="100" height="62" rx="3" fill="#bfcfa3" />
                <path d={`M${x - 5} 164h110m-100 65h100`} stroke="#716e59" strokeWidth="6" />
              </g>
            ))}
            <rect x="205" y="126" width="70" height="105" rx="13" fill="#60516e" />
            <rect x="155" y="212" width="170" height="10" rx="3" fill="#c0cbae" />
            <path d="M170 220v40m140-40v40" stroke="#141f19" strokeWidth="8" />
          </>
        ) : kind === 'x-banner' ? (
          <>
            <rect x="66" y="35" width="350" height="228" rx="10" fill="#0c1611" stroke="#849976" />
            <path d="M77 46h328v105H77z" fill={`url(#g-${asset.id})`} />
            <circle cx="121" cy="155" r="29" fill="#b5c6a0" stroke="#0c1611" strokeWidth="6" />
            <path d="M88 206h145m-145 18h250" stroke="#78936b" strokeWidth="7" />
            <rect x="326" y="167" width="67" height="20" rx="10" fill="#d6dfcb" />
          </>
        ) : kind === 'dress' ? (
          <>
            <path
              d="M200 39l-60 41-28 63 47 21 21-38-22 133h166l-22-133 21 38 46-21-28-63-61-41q-40 35-80 0z"
              fill={`url(#g-${asset.id})`}
              stroke="#91a67e"
              strokeWidth="2"
            />
            <path d="M201 41q38 59 79 0" fill="none" stroke="#52664a" strokeWidth="6" />
            <rect x="191" y="120" width="99" height="57" rx="3" fill="#d7f76a" />
          </>
        ) : kind === 'bicycle' ? (
          <g
            fill="none"
            stroke="#bdccaa"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="128" cy="206" r="54" />
            <circle cx="353" cy="206" r="54" />
            <path d="M128 206l57-111 57 111H128l151-79h42l32 79M242 206l-35-78m-40-33h47m88 31-13-49h31" />
            <path d="M203 133l57-29 35 68-61 24z" fill="#d7f76a" stroke="#c8d8b2" strokeWidth="3" />
          </g>
        ) : kind === 'custom' ? (
          <g stroke="#a7bc99" strokeWidth="3" strokeLinejoin="round">
            <path d="M240 48l113 62v124l-113 61-113-61V110z" fill="#40543b" />
            <path d="M127 110l113 61 113-61M240 171v124" fill="none" />
            <path d="M167 134l53 29v66l-53-29z" fill="#d7f76a" />
          </g>
        ) : kind === 'digital' ? (
          <>
            <rect x="71" y="42" width="338" height="204" rx="12" fill="#a6b896" />
            <rect x="84" y="55" width="312" height="178" rx="4" fill="#30452d" />
            <rect x="157" y="105" width="166" height="73" rx="3" fill="#d7f76a" />
            <path d="M240 247v25m-52 0h104" stroke="#a6b896" strokeWidth="10" />
          </>
        ) : (
          <>
            <rect x="158" y="57" width="163" height="207" rx="23" fill={`url(#g-${asset.id})`} />
            <path d="M208 58V32h64v26" fill="none" stroke="#758a68" strokeWidth="10" />
            <rect x="180" y="105" width="120" height="72" fill="#d7f76a" />
          </>
        )}
      </svg>
    </div>
  );
}
