# Stage Manager for Owlbear Rodeo

An enhanced fork of Owlbear Rodeo's [Outliner](https://github.com/owlbear-rodeo/outliner) extension.

## Development

```sh
npm install
npm run dev
```

Run `npm run build` to create the production site in `dist`.

### Local Owlbear Rodeo testing

`npm run dev:obr` regenerates `public/manifest-local.json` from the current
package version each time it starts. This file is intentionally ignored by Git
so it cannot replace the production manifest accidentally. The generated file
has this shape:

```json
{
  "name": "Stage Manager (Local)",
  "version": "1.4.4-local",
  "manifest_version": 1,
  "author": "ex Asperis",
  "icon": "http://localhost:5173/icon-color.svg",
  "background_url": "http://localhost:5173/background.html",
  "description": "Set the stage. Create, link, and control virtual layers for multi-state rooms, multi-floor maps, and other advanced effects.",
  "action": {
    "title": "Stage Manager (Local)",
    "icon": "http://localhost:5173/icon-bw.svg",
    "popover": "http://localhost:5173/extension.html?v=1.4.4-local",
    "height": 129,
    "width": 375
  }
}
```

Start the CORS-enabled development server on the fixed local port:

```sh
npm run dev:obr
```

If `npm` is not installed globally, use Codex's bundled Node runtime—the same
command used by the original successful local test:

```powershell
& 'C:\Users\bryan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173 --strictPort
```

Keep the server running. Open the following URL directly and confirm it displays
JSON whose name is `Stage Manager (Local)`:

```text
http://localhost:5173/manifest-local.json
```

Add that exact `localhost` URL to the Owlbear profile and enable `Stage Manager
(Local)` in a room. Do not substitute `127.0.0.1`, and do not use
`/manifest.json`; the latter deliberately points to the production deployment.

If Owlbear reports `Failed to fetch`:

1. Confirm `npm run dev:obr` is still running and reports port `5173`.
2. Verify the installed URL uses `localhost`, not `127.0.0.1`.
3. Open the manifest URL directly. A connection error means Vite is not
   reachable; valid JSON means the server and manifest are available.
4. After changing the manifest, background page, or Vite configuration, restart
   Vite, remove and re-add the local extension, and reload Owlbear.

Other source changes are hot-reloaded by Vite during development.

## What Stage Manager is for

- Turn a crowded Scene into a readable outline of locations, scenery, clues,
  creatures, and effects without changing their native Owlbear layers.
- Build dependable stacking groups such as Ground, Buildings, Furniture, Roof,
  and Clues, then keep unfinished organization visible in Unassigned.
- Prepare alternate versions of a location—intact and ruined, day and night, or
  mundane and magical—and reveal one state with a single control during play.
- Link one concept across Maps, Props, Drawings, and other native layers so its
  directly controlled state changes as a unit.
- Establish durable policies such as locked, click-through map art while keeping
  individual groups or items available as deliberate exceptions.
- Find and focus a named item quickly, reveal spoilers at the right moment, and
  move or restack selected scenery without searching across the canvas.
- Tailor the panel for prep or play with per-device feature and layer settings;
  a live Total count still calls out objects in layers hidden from the outline.

See the [user guide](https://obr-stage-manager.ex-asperis.com/#overview) for a scene-building workflow, a state-linked layer example, and a concise control reference.

## 1.0 compatibility

Stage Manager 1.0 introduces canonical dependency paths, explicit state selection and
participation, inheritance boundaries, and a local-versus-effective property
model. These semantics are intentionally incompatible with scene metadata from
0.x. Version 1.0 stores its scene model in a new metadata namespace, leaves 0.x
metadata untouched, and displays a warning instead of partially applying or
lossily migrating old rules. Recreate a scene's virtual layers in 1.0 after
installing the new version. See [the 1.0 compatibility notes](docs/1.0-compatibility.md)
for the precise behavior.

## GitHub Pages

The included GitHub Actions workflow tests and builds pushes to `main`, then
publishes `dist` to GitHub Pages. The `public/CNAME` file configures the custom
domain `obr-stage-manager.ex-asperis.com`.

Use the absolute manifest URL when installing the extension in Owlbear Rodeo:

```text
https://obr-stage-manager.ex-asperis.com/manifest.json
```

## Upstream

The Git remotes are configured as:

- `origin`: `https://github.com/exAsperis/OBR-Stage-Manager.git`
- `upstream`: `https://github.com/owlbear-rodeo/outliner.git`

## License

GNU GPLv3

## Contributing

This project is provided as an example of how to use the Owlbear Rodeo SDK. As such it is unlikely that we will accept pull requests for new features.

Copyright (C) 2023 Owlbear Rodeo
