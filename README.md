# Placed

A local 3D studio for creating advertising placements on physical objects and digital surfaces. Built with Next.js, React Three Fiber and Three.js. Auctions and EVM payments are planned separately.

## Start developing

Use Node.js 22.19 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The default models are included in Git; Blender and API keys are optional.

To enable photo-to-3D generation, copy `.env.example` to `.env.local`, set a Tripo or Meshy API key, and set `GENERATION_ENABLED=true`. Photos go to the selected provider and generation uses its API credits. Keep credentials in `.env.local`.

```sh
npm run check
npm run format
```

`check` runs formatting, TypeScript, tests, model verification and a production build. Python tools use Ruff formatting: `uvx ruff==0.16.9 format scripts`.

## Studio features

- Carry-on, backpack, people/outfits, bicycle and digital banner canvases.
- Six male combinations: cotton T-shirt, technical T-shirt or shirtless; jeans or running shorts.
- Three female outfits on one shared body: long gown, athletic top/leggings and T-shirt/jeans. A separate ivory gown model is also included.
- Orbit/zoom, camera presets, surface decals, logo previews and placement pricing.
- Campaign metadata, sponsor preview, local gallery and JSON/GLB export.
- Local GLB uploads and photo-to-3D generation through Tripo or Meshy.

Each canvas/outfit has a separate browser draft. Switching restores its logos, placements and campaign. Browser storage is specific to the browser and origin. Imported/generated GLBs and job records live in ignored `data/`; campaign JSON references those local assets. Back up both when moving personal projects.

“Publish canvas” saves to the local gallery. Bidding, authentication, payments and public listings are not implemented. The server accepts local requests only.

## Repository map

| Path                              | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `src/components/studio.tsx`       | Editor state, campaign controls and dialogs             |
| `src/components/human-picker.tsx` | Gender and outfit selection                             |
| `src/components/viewer.tsx`       | Cameras, decals, lighting and GLB export                |
| `src/components/models.tsx`       | Curated, procedural and uploaded models                 |
| `src/lib/`                        | Draft validation, canvas persistence and model assembly |
| `src/lib/server/`                 | Local asset storage and generation providers            |
| `public/models/`                  | Committed GLBs, thumbnails and preset manifests         |
| `assets/editable/`                | Committed Blender sources                               |
| `scripts/`                        | Asset authoring, verification and publishing tools      |

See [the asset workflow](docs/assets.md) for editing models. Asset attribution is preserved in [LICENSES.md](public/models/humans/LICENSES.md).
