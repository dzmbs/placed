# Placed

Turn bags, clothing, bikes and digital surfaces into ad space. Pick a 3D model or import your own, choose sponsorship spots and preview how a brand's logo looks on them.

Placed includes a 3D placement editor and marketplace screens for listings, auctions, campaign proof, creator tokens and portfolios. The marketplace expects a wallet/backend adapter; see [backend integration](docs/backend-integration.md). No accounts, balances or transactions are simulated in the product.

Built with Next.js, React Three Fiber and Three.js.

## Run locally

You need Node.js 22.19 or newer.

```sh
git clone https://github.com/dzmbs/placed.git
cd placed
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Default models are included, so you can start without Blender or API keys.

For photo-to-3D generation, copy `.env.example` to `.env.local`, add a Tripo or Meshy API key and set `GENERATION_ENABLED=true`. Generation uses that provider's credits.

Drafts and the gallery are saved in your browser. Imported and generated models are saved in `data/`. Both stay local.

## Development

Run `npm run check` for formatting, type checks, tests, model verification and a production build. Use `npm run format` to format the code.

See [the asset workflow](docs/assets.md) for editing the included models and Blender sources, and [asset licenses](public/models/humans/LICENSES.md) for attribution.
