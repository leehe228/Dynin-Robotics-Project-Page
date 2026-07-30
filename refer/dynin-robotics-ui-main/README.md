# Dynin-Robotics Interactive Explorer

An interactive visualization of the shared Dynin-Robotics backbone across four
objectives: Policy, World Modeling, Goal State Prediction, and Task
Understanding.

**Live site:** https://leehe228.github.io/Dynin-Robotics-Project-Page/

## Run locally

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
```

The GitHub Pages deployment uses a separate static export:

```bash
npm run build:pages
```

To preview that export locally with the same base path used by GitHub Pages:

```bash
npm test
npm run preview:pages
```

The preview is available at http://localhost:3000. It maps both the root URL and
`/Dynin-Robotics-Project-Page/` to the exported site so CSS, JavaScript, fonts,
and media resolve exactly as they do after deployment.

Every push to `main` is deployed automatically by GitHub Actions.
