# backgrounds/

One folder per game *view*, each self-contained: its own art plus a standalone
`*-preview.html` that opens directly in a browser, no server or build step.

| Folder | View | Open |
|---|---|---|
| `stroll/` | Side-scroll walk | `stroll/stroll-preview.html` |
| `garden-state/` | Overview of all players' plots | `garden-state/garden-state-preview.html` |

The loose `.svg` files at this top level (`plot-*.svg`, `world-backdrop.svg`)
belong to the real app and are wired through `../manifest.json` — leave them
where they are. This folder-per-view convention is only for new
design/prototyping work that isn't wired into the app yet.

Adding a new view: make a folder, drop its art in, write one HTML file that
references only files inside that same folder (plus a relative link out to
another view's preview if there's a nav button between them).
