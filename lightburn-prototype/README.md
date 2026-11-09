# LightBurn CAD/CAM Laser Cutting Prototype

A high-fidelity, interactive web prototype replicating the core architectural workflow, design tools, and machine-control pipelines of **LightBurn** software.

---

## Architecture Overview

```
lightburn-prototype/
├── index.html          # Main application layout, toolbars, docking panels, & preview modal
├── server.py           # Single-command Python local server with auto browser launch
├── css/
│   └── style.css       # LightBurn-authentic dark theme, rulers, controls & telemetry styling
└── js/
    ├── constants.js    # 16 standard LightBurn layers (C00-C15), machine defaults, tool modes
    ├── geometry.js     # Vector shapes (Rect, Circle, Polygon, Path, Text), bounding boxes, raster line generator
    ├── layers.js       # Layer manager (Line/Cut, Fill/Engrave, Fill+Line, Tool), color palette
    ├── canvas.js       # High-DPI 2D canvas, mm grid, dynamic rulers, transform handles, snapping
    ├── gcode.js        # CAM engine generating clean GRBL G-code (M3/M4/M5, feeds, power scaling)
    ├── simulator.js    # Virtual GRBL controller, motion kinematics, Alt+P Preview dialog
    ├── materials.js    # Material library presets (Wood, Acrylic, Leather, Slate) & Test Matrix generator
    └── app.js          # App orchestrator, SVG importer, G-code exporter, keyboard shortcuts
```

---

## Key Replicated Features

1. **LightBurn Multi-Layer System (`C00` – `C15`)**
   - Color-coded layers mapped to specific laser operations:
     - **Line (Vector Cut/Score):** Outline paths with kerf compensation.
     - **Fill (Raster Engrave):** Bi-directional raster scanning generator with custom interval (DPI).
     - **Fill + Line:** Dual-mode engraving followed by perimeter kiss-cut.
     - **Tool Layer:** Non-burning alignment/reference guide.
   - Per-layer parameters: Speed (mm/min), Power (%), Number of Passes, Air Assist toggle, and Output switch.

2. **Interactive CAD Canvas & Rulers**
   - Real-world millimeter grid (400 × 400 mm standard diode bed).
   - Top and Left dynamic rulers tracking pointer coordinates.
   - Interactive 8-point resize handles and rotation handle.
   - Real-time laser diode head marker with glowing focal beam.

3. **LightBurn-Style Alt+P Simulation & Preview**
   - Modal simulation displaying:
     - Rapid traverse moves (`G0`) in red dashed lines.
     - Active laser burns (`G1`) in solid green.
   - Play/Pause animation with scrub slider (0% to 100%) and 1x, 2x, 5x, 10x speeds.
   - Telemetry estimation: Job Time (MM:SS), Cut Distance (mm), Rapid Distance (mm), Total G-code Lines.

4. **Automated Material Test Matrix Generator**
   - Replicates LightBurn's famous calibration tool: generates a 4×4 grid varying Speed (1000–4000 mm/min) vs. Power (20%–80%) to test new materials.

5. **Machine Control & Virtual GRBL Console**
   - Framing (`FRAME`): animates the laser perimeter bounding box.
   - Jog D-pad: X/Y/Z jogging with selectable step distances (0.5mm, 1mm, 10mm, 50mm).
   - Virtual terminal supporting standard GRBL commands (`?`, `$H`, `$$`, `G0 X... Y...`, `M3`, `M5`).
   - Web Serial API bridge ready for real USB laser controller connections.

6. **Import & Export**
   - Import vector artwork from `.svg` files.
   - Export standard `.gcode` / `.nc` files.
   - Save/Load project state (`.lbrn-proto`).

---

## How to Run

### Method 1: Double-Click or Open Directly
Because the prototype uses modular, standard web standards, you can open `index.html` directly in Google Chrome, Microsoft Edge, or Mozilla Firefox:
```text
file:///C:/Users/dhyut/.gemini/antigravity/scratch/lightburn-prototype/index.html
```

### Method 2: Python Local Server
Run the included Python server to launch on `http://localhost:8080`:
```bash
python server.py
```
