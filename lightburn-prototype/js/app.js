// LightBurn Prototype - Main Application Controller

import { MACHINE_DEFAULTS, TOOL_MODES } from './constants.js';
import { LayerManager } from './layers.js';
import { LaserCanvas } from './canvas.js';
import { GCodeGenerator } from './gcode.js';
import { LaserSimulator } from './simulator.js';
import { MaterialManager } from './materials.js';
import { RectangleShape, CircleShape, PolygonShape, PathShape, TextShape } from './geometry.js';

class LightBurnApp {
    constructor() {
        this.config = { ...MACHINE_DEFAULTS };
        this.layerManager = new LayerManager();
        this.gcodeGen = new GCodeGenerator(this.config);

        // DOM elements
        this.canvasEl = document.getElementById('workCanvas');
        this.rulerTopEl = document.getElementById('rulerTop');
        this.rulerLeftEl = document.getElementById('rulerLeft');
        this.previewModalEl = document.getElementById('previewModal');
        this.previewCanvasEl = document.getElementById('previewCanvas');
        this.consoleLogEl = document.getElementById('consoleLog');

        // Initialize Core Systems
        this.canvas = new LaserCanvas(this.canvasEl, this.rulerTopEl, this.rulerLeftEl, this.layerManager, this.config);
        this.simulator = new LaserSimulator(
            this.previewCanvasEl,
            this.gcodeGen,
            (pos) => this.canvas.setLaserHead(pos.x, pos.y),
            (msg, type) => this.appendConsole(msg, type)
        );
        this.materialManager = new MaterialManager(this.layerManager);

        // Undo history
        this.undoStack = [];
        this.redoStack = [];

        this.init();
    }

    init() {
        this.initUI();
        this.initEvents();
        this.loadSampleCoasterProject();
        this.updateLayersUI();
        this.appendConsole('LightBurn Prototype v1.0.0 Ready. Controller: Virtual GRBL 1.1f', 'success');
        this.appendConsole('Type "?" or "$$" in the console below to test GRBL commands.', 'info');
    }

    initUI() {
        // Render Palette
        const paletteContainer = document.getElementById('colorPalette');
        this.layerManager.renderPalette(paletteContainer, (layerId) => {
            const selected = this.canvas.getSelectedShapes();
            if (selected.length > 0) {
                selected.forEach(s => s.layerId = layerId);
                this.canvas.render();
                this.updateLayersUI();
            }
        });

        // Render Materials
        const materialsContainer = document.getElementById('materialsList');
        if (materialsContainer) {
            this.materialManager.renderList(materialsContainer, (mat, op) => {
                this.appendConsole(`Applied preset "${mat.name} - ${op.name}" to Active Layer C0${this.layerManager.activeLayerId}`, 'success');
                this.updateLayersUI();
            });
        }

        // Bind Canvas callbacks
        this.canvas.onSelectionChange = (selected) => {
            this.updateSelectionPropertiesUI(selected);
        };

        this.canvas.onCursorMove = (x, y) => {
            const coordEl = document.getElementById('statusCoords');
            if (coordEl) {
                coordEl.textContent = `X: ${x.toFixed(1)} mm | Y: ${y.toFixed(1)} mm`;
            }
        };

        this.layerManager.onChange(() => {
            this.updateLayersUI();
            this.canvas.render();
        });
    }

    updateLayersUI() {
        const tbody = document.getElementById('layersTableBody');
        const usedLayerIds = new Set(this.canvas.shapes.map(s => s.layerId));
        this.layerManager.renderTable(tbody, usedLayerIds, (id) => {
            this.canvas.render();
        });
    }

    updateSelectionPropertiesUI(selected) {
        const infoEl = document.getElementById('selectionInfo');
        const posWEl = document.getElementById('propWidth');
        const posHEl = document.getElementById('propHeight');
        const posXEl = document.getElementById('propX');
        const posYEl = document.getElementById('propY');

        if (!infoEl) return;

        if (selected.length === 0) {
            infoEl.textContent = 'No selection';
            if (posWEl) posWEl.value = '0';
            if (posHEl) posHEl.value = '0';
            if (posXEl) posXEl.value = '0';
            if (posYEl) posYEl.value = '0';
        } else {
            const bounds = this.canvas.getSelectionBounds();
            infoEl.textContent = `${selected.length} object${selected.length > 1 ? 's' : ''} selected`;
            if (posWEl && bounds) posWEl.value = bounds.width.toFixed(1);
            if (posHEl && bounds) posHEl.value = bounds.height.toFixed(1);
            if (posXEl && bounds) posXEl.value = bounds.minX.toFixed(1);
            if (posYEl && bounds) posYEl.value = bounds.minY.toFixed(1);
        }
    }

    appendConsole(msg, type = 'info') {
        if (!this.consoleLogEl) return;
        const line = document.createElement('div');
        line.className = `log-line log-${type}`;
        line.textContent = msg;
        this.consoleLogEl.appendChild(line);
        this.consoleLogEl.scrollTop = this.consoleLogEl.scrollHeight;
    }

    initEvents() {
        // Tab switching (Cuts, Laser, Materials, GCode, Console)
        document.querySelectorAll('.panel-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                e.currentTarget.classList.add('active');
                const targetId = e.currentTarget.getAttribute('data-tab');
                const contentEl = document.getElementById(targetId);
                if (contentEl) contentEl.classList.add('active');

                // If GCode tab clicked, regenerate GCode preview
                if (targetId === 'tabGCode') {
                    this.updateGCodePreview();
                }
            });
        });

        // Left Toolbox
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.getAttribute('data-tool');
                if (tool === 'test_grid') {
                    this.generateMaterialTestGrid();
                    return;
                }
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.canvas.activeTool = tool;
            });
        });

        // Laser Control Buttons
        document.getElementById('btnStartJob')?.addEventListener('click', () => this.startLaserJob());
        document.getElementById('btnFrame')?.addEventListener('click', () => this.frameJob());
        document.getElementById('btnHome')?.addEventListener('click', () => this.simulator.home());
        document.getElementById('btnStop')?.addEventListener('click', () => this.stopLaserJob());

        // Jog Buttons
        document.querySelectorAll('.btn-jog').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const axis = e.currentTarget.getAttribute('data-axis');
                const dir = parseFloat(e.currentTarget.getAttribute('data-dir'));
                const stepInput = document.getElementById('jogStep');
                const step = (parseFloat(stepInput?.value) || 10) * dir;
                this.simulator.jog(axis, step);
            });
        });

        // Preview Modal Buttons
        document.getElementById('btnPreview')?.addEventListener('click', () => this.openPreviewModal());
        document.getElementById('btnClosePreview')?.addEventListener('click', () => this.closePreviewModal());
        document.getElementById('btnPlaySimulation')?.addEventListener('click', () => this.toggleSimulationPlay());
        document.getElementById('previewScrubber')?.addEventListener('input', (e) => {
            this.simulator.seekPlayback(parseFloat(e.target.value));
        });

        // Speed multipliers
        document.querySelectorAll('.sim-spd-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sim-spd-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.simulator.playbackSpeed = parseFloat(e.currentTarget.getAttribute('data-speed')) || 1;
            });
        });

        // Console input
        const consoleInput = document.getElementById('terminalInput');
        consoleInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && consoleInput.value.trim()) {
                this.simulator.executeCommand(consoleInput.value.trim());
                consoleInput.value = '';
            }
        });

        // Top Toolbar: Import / Export / Samples
        document.getElementById('btnImportSvg')?.addEventListener('click', () => {
            document.getElementById('svgFileInput').click();
        });
        document.getElementById('svgFileInput')?.addEventListener('change', (e) => this.handleSvgImport(e));

        document.getElementById('btnExportGcode')?.addEventListener('click', () => this.exportGCodeFile());
        document.getElementById('btnSaveProject')?.addEventListener('click', () => this.saveProject());
        document.getElementById('btnLoadSample')?.addEventListener('click', () => this.loadSampleCoasterProject());

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const selected = this.canvas.getSelectedShapes();
                if (selected.length > 0) {
                    this.canvas.shapes = this.canvas.shapes.filter(s => !s.selected);
                    this.canvas.render();
                    this.updateLayersUI();
                    this.updateSelectionPropertiesUI([]);
                }
            } else if (e.key === 'p' && e.altKey) {
                e.preventDefault();
                this.openPreviewModal();
            } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.canvas.shapes.forEach(s => s.selected = true);
                this.canvas.render();
                this.updateSelectionPropertiesUI(this.canvas.shapes);
            }
        });
    }

    startLaserJob() {
        this.appendConsole('[JOB] Starting G-code execution...', 'info');
        const result = this.gcodeGen.generate(this.canvas.shapes, this.layerManager);
        this.appendConsole(`[JOB] Generated ${result.totalLines} lines. Estimated time: ${result.formattedTime}`, 'success');
        this.openPreviewModal();
        this.simulator.startPlayback();
    }

    stopLaserJob() {
        this.simulator.pausePlayback();
        this.simulator.executeCommand('M5');
        this.appendConsole('[JOB] Job stopped / Laser OFF.', 'warn');
    }

    frameJob() {
        this.simulator.frameBoundingBox(this.canvas.shapes);
    }

    openPreviewModal() {
        if (!this.previewModalEl) return;
        this.previewModalEl.style.display = 'flex';

        // Generate toolpath & simulate
        const result = this.gcodeGen.generate(this.canvas.shapes, this.layerManager);
        this.simulator.parseGCode(result.gcode);
        this.simulator.renderPreview();

        // Update telemetry
        document.getElementById('simEstTime').textContent = result.formattedTime;
        document.getElementById('simCutDist').textContent = `${result.totalCutDist} mm`;
        document.getElementById('simRapidDist').textContent = `${result.totalRapidDist} mm`;
        document.getElementById('simLineCount').textContent = `${result.totalLines}`;
    }

    closePreviewModal() {
        if (!this.previewModalEl) return;
        this.simulator.pausePlayback();
        this.previewModalEl.style.display = 'none';
    }

    toggleSimulationPlay() {
        const playBtn = document.getElementById('btnPlaySimulation');
        if (this.simulator.isPlaying) {
            this.simulator.pausePlayback();
            if (playBtn) playBtn.textContent = '▶ Play';
        } else {
            this.simulator.startPlayback((progress) => {
                const scrubber = document.getElementById('previewScrubber');
                if (scrubber) scrubber.value = progress;
            });
            if (playBtn) playBtn.textContent = '❚❚ Pause';
        }
    }

    updateGCodePreview() {
        const textEl = document.getElementById('gcodeOutput');
        if (!textEl) return;
        const result = this.gcodeGen.generate(this.canvas.shapes, this.layerManager);
        textEl.textContent = result.gcode;
    }

    exportGCodeFile() {
        const result = this.gcodeGen.generate(this.canvas.shapes, this.layerManager);
        const blob = new Blob([result.gcode], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laser_job_${Date.now()}.gcode`;
        a.click();
        URL.revokeObjectURL(url);
        this.appendConsole('Exported G-Code file successfully.', 'success');
    }

    generateMaterialTestGrid() {
        const testShapes = this.materialManager.generateTestGrid(40, 40);
        this.canvas.shapes.push(...testShapes);
        this.canvas.render();
        this.updateLayersUI();
        this.appendConsole('Material Test Matrix generated on workspace.', 'success');
    }

    loadSampleCoasterProject() {
        this.canvas.shapes = [];

        // 1. Outer Cut Boundary (C00 - Line/Cut, 300 mm/min, 90% power)
        const outerHex = new PolygonShape(120, 120, 50, 6, 0);
        outerHex.name = 'Outer Hex Cut';
        this.canvas.shapes.push(outerHex);

        // 2. Score Geometric Pattern (C02 - Score, 1500 mm/min, 20% power)
        const innerCircle = new CircleShape(120, 120, 38, 38, 2);
        innerCircle.name = 'Inner Score Ring';
        this.canvas.shapes.push(innerCircle);

        // 3. Center Engraved Emblem (C01 - Fill/Engrave, 3500 mm/min, 30% power)
        const star = new PolygonShape(120, 120, 22, 5, 1);
        star.name = 'Center Star Emblem';
        this.canvas.shapes.push(star);

        // 4. Text Branding (C01 - Fill)
        const text1 = new TextShape(88, 148, 'LIGHTBURN', 8, 1);
        this.canvas.shapes.push(text1);

        this.canvas.render();
        this.updateLayersUI();
        this.appendConsole('Sample Project loaded: Geometric Laser Coaster (Cut, Score & Engrave layers).', 'info');
    }

    handleSvgImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const svgContent = evt.target.result;
            this.parseSvg(svgContent);
        };
        reader.readAsText(file);
    }

    parseSvg(svgText) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            let addedCount = 0;

            // Parse rects
            doc.querySelectorAll('rect').forEach(r => {
                const x = parseFloat(r.getAttribute('x')) || 20;
                const y = parseFloat(r.getAttribute('y')) || 20;
                const w = parseFloat(r.getAttribute('width')) || 30;
                const h = parseFloat(r.getAttribute('height')) || 30;
                this.canvas.shapes.push(new RectangleShape(x, y, w, h, 0));
                addedCount++;
            });

            // Parse circles
            doc.querySelectorAll('circle').forEach(c => {
                const cx = parseFloat(c.getAttribute('cx')) || 50;
                const cy = parseFloat(c.getAttribute('cy')) || 50;
                const r = parseFloat(c.getAttribute('r')) || 20;
                this.canvas.shapes.push(new CircleShape(cx, cy, r, r, 1));
                addedCount++;
            });

            this.canvas.render();
            this.updateLayersUI();
            this.appendConsole(`Imported ${addedCount} shapes from SVG file.`, 'success');
        } catch (err) {
            this.appendConsole(`SVG import failed: ${err.message}`, 'error');
        }
    }

    saveProject() {
        const data = {
            version: '1.0',
            config: this.config,
            layers: this.layerManager.layers,
            shapes: this.canvas.shapes.map(s => ({
                type: s.type,
                name: s.name,
                layerId: s.layerId,
                data: s
            }))
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project_${Date.now()}.lbrn-proto`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Bootstrap Application on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
    window.app = new LightBurnApp();
});
