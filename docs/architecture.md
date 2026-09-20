# Architecture

## Why a shared engine

A collage is geometry. Both clients have to answer the same questions — how big is the
canvas, where does each cell sit, which part of the source image fills it — and the two
answers must be identical or the mobile export would not match the web export.

`packages/collage-core` owns that maths and nothing else: no DOM, no React, no platform
API. It is plain TypeScript with 28 unit tests that assert the invariants (templates tile
the unit square without overlaps, canvases keep the requested ratio, crops stay inside the
source image). Both clients import it, so a layout fix ships everywhere at once.

```
                    ┌──────────────────────────┐
                    │   @collage/core          │
                    │   ratios · layouts       │
                    │   geometry · presets     │
                    └───────────┬──────────────┘
                   ┌────────────┴────────────┐
       ┌───────────▼──────────┐   ┌──────────▼───────────┐
       │ apps/web             │   │ apps/mobile          │
       │ Canvas 2D renderer   │   │ RN views + view-shot │
       │ createImageBitmap    │   │ expo-image-picker    │
       └──────────────────────┘   └──────────────────────┘
```

### Key pieces of the engine

| Module             | Responsibility                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `aspect-ratios.ts` | The 9 output ratios and the 4 quality presets (1080–4096 px long edge).                   |
| `layouts.ts`       | Curated templates for 1–9 photos plus generated grids, all normalised to the unit square. |
| `geometry.ts`      | `createPlan`, `resolveFrames`, `computeSourceCrop`, `computeCoverLayout`, `hitTest`.      |
| `presets.ts`       | Style presets, background swatches, file name suggestion.                                 |

Padding and gutter are independent: the drawing area is expanded by half a gutter and
every cell is inset by the same amount, so the outer margin is exactly `padding` and the
space between cells is exactly `gutter`.

`computeSourceCrop` returns the source rectangle for renderers that can crop (Canvas
`drawImage`), while `computeCoverLayout` returns size plus translation for renderers that
cannot (React Native `<Image>`). Same inputs, same framing.

## Web client

- React 19 + Vite 7, state in a single zustand store.
- The plan is always built at **export resolution** and scaled for the preview, which makes
  the preview pixel-accurate rather than approximate.
- `createImageBitmap(file, { imageOrientation: 'from-image' })` honours EXIF rotation and
  downscales oversized sources to 6000 px before decoding.
- Interaction: pointer events for pan, a non-passive native `wheel` listener for zoom
  (React attaches `wheel` passively, which would break `preventDefault`), keyboard nudging
  and drag & drop.
- Export goes through an offscreen canvas at full resolution, then `toBlob`.

### Hosting

The build output is served by `apps/web/server/server.mjs`, a dependency-free Node HTTP
server: SPA fallback, `/healthz`, ETag/304, pre-compressed br/gzip negotiation, immutable
caching for `/assets/**` and a strict security header set (CSP, `X-Content-Type-Options`,
`frame-ancestors 'none'`). Having our own server is what makes the App Service health
check and the pipeline smoke test meaningful.

## Mobile client

- Expo SDK 57, React Native 0.86, the same zustand store shape as the web client.
- Photos are picked with `expo-image-picker` and rendered as absolutely positioned views
  driven by `computeCoverLayout`.
- **Resolution trick.** The collage is laid out at `targetPixels / PixelRatio.get()`
  points and merely _displayed_ scaled down. A view's own transform is ignored when it is
  rasterised, so `captureRef` produces the full target resolution while the user sees a
  screen sized preview. Selection chrome lives in a sibling overlay and therefore never
  appears in the exported image.
- On iOS the capture uses `useRenderInContext`, the only strategy that can rasterise views
  larger than the screen.
- Saving uses the modern `MediaLibrary.Asset.create` API; `saveToLibraryAsync` is
  deprecated in SDK 57 and throws at runtime.
- `react-native-view-shot` is a native module, so the app needs a development build.

## Infrastructure

`infra/main.bicep` composes two modules in a resource group:

- **monitoring** — Log Analytics workspace + Application Insights (workspace based).
- **web-app** — Linux App Service plan and site on `NODE|20-lts`, HTTPS only, TLS 1.2
  minimum, FTPS disabled, basic publishing credentials disabled for both SCM and FTP,
  `WEBSITE_RUN_FROM_PACKAGE=1`, health check on `/healthz`, diagnostic settings streaming
  HTTP, console, application and platform logs to the workspace.

Sizing is environment driven: `dev` runs B1 with one worker and 30 day retention, `prod`
runs P0v3 with two workers and 90 day retention. No storage account is used anywhere,
which also keeps the solution deployable in tenants that block public storage endpoints.

## Pipelines

| Workflow                 | Trigger                | What it does                                                                            |
| ------------------------ | ---------------------- | --------------------------------------------------------------------------------------- |
| `ci.yml`                 | PR, push to `main`     | lint, typecheck, unit tests, web build, Android and iOS JS bundles, Bicep build + lint. |
| `cd.yml`                 | push to `main`, manual | builds one artifact, deploys `dev`, then `prod` behind environment protection.          |
| `deploy-environment.yml` | called by `cd.yml`     | Bicep deployment, zip deploy, retrying smoke test against `/healthz` and `/`.           |
| `infra-what-if.yml`      | PR touching `infra/**` | `az deployment group what-if` for both environments.                                    |
| `mobile-release.yml`     | manual                 | EAS build for the chosen platform and profile, optional store submission.               |

Azure access uses OIDC federated credentials — there are no Azure passwords in GitHub.
The same artifact is promoted from dev to prod, so what is tested is what ships.
