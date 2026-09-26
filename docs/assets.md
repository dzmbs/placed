# Asset workflow

## Included assets

Runtime GLBs, thumbnails and manifests are committed under `public/models/`. Teammates can run the complete studio after `npm ci`; no generation or downloads are required.

Editable scenes are committed under `assets/editable/`:

- `carry-on.blend`: authored suitcase.
- `male-wardrobe.blend`: shared male body and four separate garments.
- `female-wardrobe.blend`: shared female body and three garment sets.
- `female-ivory.blend`: separate static gown model.

These scenes contain packed textures and baked geometry. Open them in Blender to edit meshes/materials; the wardrobe scenes start with their casual outfits visible. Hidden garment and body-region objects are intentional. Parametric MPFB masters can be regenerated with the tools below.

Models are tracked directly in Git. The largest individual file is below 25 MB; avoid committing duplicate exports, render batches, Blender backups or personal uploads. Keep asset licenses with model changes. Vendored Draco decoder licensing is in `public/draco/LICENSE`.

## Editing existing models

Modular wardrobe parts use shared coordinates: Y-up GLBs, feet at 0.06, overall body height 2.8. Keep body and clothing transforms aligned. Preserve mesh names used by placement manifests and the wardrobe catalog in `src/lib/humans.ts`.

1. Edit the Blender scene and export changed parts as self-contained GLBs with embedded textures.
2. Solid surfaces must be opaque. Hair, brows and lashes use alpha cutouts with threshold 0.5.
3. Update `public/models/humans/*.json` if placement positions or mesh names change. Update the wardrobe catalog if garments or skin regions change.
4. Increment the model URL version in `src/lib/humans.ts` after replacing an existing file.
5. Run `npm run verify:models` and inspect the studio from the front, back and sides with a test logo.

Imported static models use the shared normalization helper in `src/lib/model-scene.ts`. Wardrobe parts preserve their authored transforms. Clothing is pre-fitted to the default bodies; arbitrary imported people do not automatically share that wardrobe.

## Regenerating the default wardrobes

Install Blender 5.2 LTS and Python 3.9+. Use `blender` from your PATH, or the full application executable path.

```sh
python3 scripts/setup_mpfb.py
blender --background --factory-startup --python scripts/build_male_wardrobe.py
blender --background --factory-startup --python scripts/build_female_wardrobe.py
node --import tsx scripts/verify_models.ts --prepared male
node --import tsx scripts/verify_models.ts --prepared female
```

The setup downloads pinned MPFB source and CC0 system/dress packs, validates SHA-256 hashes and extracts them into ignored `data/tooling/mpfb/`. It leaves Blender's global add-on preferences unchanged. Allow about 1 GB for source archives and extracted tooling, plus build outputs. Downloads/builds are optional and do not call AI providers.

Prepared masters, outfit scenes, GLBs, manifests and renders are written to ignored `assets/humans/prepared/`. Render projected logos for each changed preset:

```sh
blender --background --factory-startup --python scripts/render_human_placements.py -- male-shirtless
```

Use each affected preset ID from `src/lib/humans.ts`. Inspect previews before publishing:

```sh
node --import tsx scripts/publish_models.ts male
node --import tsx scripts/publish_models.ts female
npm run verify:models
```

Publishing requires current geometry verification and front/back logo renders. It checks asset hashes to reject results from an earlier build. After publishing, copy the reviewed casual scene into `assets/editable/male-wardrobe.blend` or `female-wardrobe.blend` so the committed authoring source matches the runtime model.

Regenerate the carry-on with:

```sh
blender --background --factory-startup --python scripts/build_demo_asset.py
```
