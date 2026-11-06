# match
## 3D Stadium (`stadium/`)

Real-time, game-ready stadium built with three.js (bundled locally in `stadium/vendor/`, no build step).

```bash
cd stadium && python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need an HTTP server; opening `index.html` via `file://` will not work.

- **Controls:** drag to orbit, right-drag to pan, wheel to zoom; *Walk mode* uses WASD, Shift to run, Space/C up/down, Esc to exit.
- **Panel:** day/sunset/night lighting, camera presets, quality levels, roof/seat layer toggles, exploded build view.
- **Export GLB:** downloads the full stadium as a `.glb` for Unity, Unreal, Godot or Blender.
