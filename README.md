# Collage Studio

Professional multi-photo collage editor that runs as a **web app** and as a **native
iOS/Android app**, sharing one layout engine. Pick your photos, choose an aspect ratio
(1:1, 4:5, 9:16, 16:9 and more), fine tune the framing and export a print quality image.

**Photos never leave the device.** Every collage is composed and rasterised on the client,
so the Azure footprint is only a static host — no image upload, no storage, no backend.

| Surface | Stack                           | Where it runs                      |
| ------- | ------------------------------- | ---------------------------------- |
| Web     | React 19 + Vite 7 + Canvas 2D   | Azure App Service (Linux, Node 20) |
| Mobile  | Expo SDK 57 + React Native 0.86 | iOS and Android, built with EAS    |
| Engine  | TypeScript, zero dependencies   | Shared by both clients             |

## Live environments

| Environment | URL                                                        | Plan            |
| ----------- | ---------------------------------------------------------- | --------------- |
| dev         | <https://app-collage-dev-v6nfmaroooon2.azurewebsites.net>  | B1, 1 worker    |
| prod        | <https://app-collage-prod-jdmrvajfcyj2c.azurewebsites.net> | P0v3, 2 workers |

Both expose `/healthz`, which reports the commit currently being served.

## Features

- 9 aspect ratios grouped by use case (square, portrait, landscape) and 4 export
  resolutions from 1080 px to 4096 px on the long edge.
- Curated layout templates for 1–9 photos plus generated grids up to 12 photos.
- Per cell framing: zoom (1×–4×) and pan, with the crop maths shared by both clients.
- Six style presets plus manual control of gutter, outer margin, corner radius, cell
  border, drop shadow and background colour.
- PNG / JPEG / WebP export on web, PNG / JPEG save-to-gallery and share on mobile.
- Exact output resolution: the preview is always a scaled copy of the real export plan,
  so what you see is what you get.

## Repository layout

```
packages/collage-core   Layout templates, geometry, aspect ratios, presets (28 unit tests)
apps/web                React client + zero dependency Node static server for App Service
apps/mobile             Expo application (iOS + Android)
infra                   Bicep: App Service plan, web app, Log Analytics, App Insights
.github/workflows       CI, CD (dev -> prod), infrastructure what-if, EAS mobile release
scripts                 One-off bootstrap for Azure identity and GitHub environments
docs                    Architecture and operations runbook
```

## Getting started

```bash
npm install          # Node 20.19+ required
npm run dev          # web client on http://localhost:5173
npm run dev:mobile   # Expo dev server for the mobile app
```

Quality gates, exactly what CI runs:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Mobile notes

The mobile app captures the collage with `react-native-view-shot`, a native module, so it
needs a **development build** and cannot run inside Expo Go:

```bash
npx eas build --profile development --platform android
npm run dev:mobile
```

## Deployment

`main` is the only deployable branch. Every push runs CI, then CD builds one artifact and
promotes it through the environments:

```
build -> dev (auto) -> prod (protected environment)
```

Infrastructure is deployed from the same workflow, so the App Service configuration and
the application version always move together. Pull requests that touch `infra/` get an
`az deployment group what-if` summary for both environments.

| Environment | Resource group           | Plan | Workers |
| ----------- | ------------------------ | ---- | ------- |
| dev         | `rg-collage-studio-dev`  | B1   | 1       |
| prod        | `rg-collage-studio-prod` | P0v3 | 2       |

First time setup (creates the resource groups, the Entra application with federated
credentials, the role assignments and the GitHub environments and secrets):

```powershell
pwsh ./scripts/bootstrap-azure.ps1 -Repository chapi-dev/collage-studio
```

See [docs/architecture.md](docs/architecture.md) for the design and
[docs/runbook.md](docs/runbook.md) for day-two operations.
