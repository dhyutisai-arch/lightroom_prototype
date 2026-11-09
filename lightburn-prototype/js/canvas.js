// LightBurn Prototype - Interactive 2D Canvas & Viewport Engine

import { BoundingBox, RectangleShape, CircleShape, PolygonShape, PathShape, TextShape } from './geometry.js';
import { TOOL_MODES } from './constants.js';

export class LaserCanvas {
    constructor(canvasEl, rulerTopEl, rulerLeftEl, layerManager, config) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        this.rulerTop = rulerTopEl;
        this.rulerTopCtx = rulerTopEl ? rulerTopEl.getContext('2d') : null;
        this.rulerLeft = rulerLeftEl;
        this.rulerLeftCtx = rulerLeftEl ? rulerLeftEl.getContext('2d') : null;

        this.layerManager = layerManager;
        this.config = config;

        // Viewport Transform (World is in millimeters)
        this.zoom = 1.6; // initial zoom
        this.panX = 80;  // screen px
        this.panY = 80;

        // Shapes list
        this.shapes = [];
        this.activeTool = TOOL_MODES.SELECT;
        this.snapToGrid = true;
        this.snapSize = 1.0; // mm

        // Laser head position (in mm)
        this.laserHead = { x: 0, y: 0 };

        // Interaction state
        this.isMouseDown = false;
        this.dragMode = null; // 'pan', 'move', 'create', 'resize', 'rotate', 'marquee'
        this.startMouseWorld = { x: 0, y: 0 };
        this.startMouseScreen = { x: 0, y: 0 };
        this.currentMouseWorld = { x: 0, y: 0 };
        this.activeHandle = null; // 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w', 'rot'
        this.activeShape = null;
        this.tempPoints = []; // for polyline creation

        // Listeners
        this.onSelectionChange = null;
        this.onCursorMove = null;

        this.initEvents();
        this.resize();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        if (this.rulerTop) {
            this.rulerTop.width = rect.width * dpr;
            this.rulerTop.height = 24 * dpr;
            this.rulerTop.style.width = `${rect.width}px`;
            this.rulerTop.style.height = '24px';
        }
        if (this.rulerLeft) {
            this.rulerLeft.width = 24 * dpr;
            this.rulerLeft.height = rect.height * dpr;
            this.rulerLeft.style.width = '24px';
            this.rulerLeft.style.height = `${rect.height}px`;
        }

        this.render();
    }

    worldToScreen(wx, wy) {
        return {
            x: wx * this.zoom + this.panX,
            y: wy * this.zoom + this.panY
        };
    }

    screenToWorld(sx, sy) {
        let wx = (sx - this.panX) / this.zoom;
        let wy = (sy - this.panY) / this.zoom;

        if (this.snapToGrid) {
            wx = Math.round(wx / this.snapSize) * this.snapSize;
            wy = Math.round(wy / this.snapSize) * this.snapSize;
        }

        return { x: wx, y: wy };
    }

    getSelectedShapes() {
        return this.shapes.filter(s => s.selected);
    }

    getSelectionBounds() {
        const selected = this.getSelectedShapes();
        if (selected.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of selected) {
            const b = s.getBounds();
            if (b.minX < minX) minX = b.minX;
            if (b.minY < minY) minY = b.minY;
            if (b.maxX > maxX) maxX = b.maxX;
            if (b.maxY > maxY) maxY = b.maxY;
        }
        return new BoundingBox(minX, minY, maxX, maxY);
    }

    setLaserHead(x, y) {
        this.laserHead.x = x;
        this.laserHead.y = y;
        this.render();
    }

    initEvents() {
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const mouseX = e.offsetX;
            const mouseY = e.offsetY;

            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
            const newZoom = Math.max(0.2, Math.min(15.0, this.zoom * zoomFactor));

            // Zoom centered on cursor
            this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
            this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
            this.zoom = newZoom;

            this.render();
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = this.screenToWorld(sx, sy);

        this.isMouseDown = true;
        this.startMouseScreen = { x: sx, y: sy };
        this.startMouseWorld = world;
        this.currentMouseWorld = world;

        // Middle button or Space key pans canvas
        if (e.button === 1 || e.spaceKey || this.activeTool === TOOL_MODES.PAN) {
            this.dragMode = 'pan';
            return;
        }

        if (this.activeTool === TOOL_MODES.SELECT) {
            // Check if clicking on bounding box handles of current selection
            const bounds = this.getSelectionBounds();
            if (bounds) {
                const handle = this.hitTestHandle(sx, sy, bounds);
                if (handle) {
                    this.dragMode = handle === 'rot' ? 'rotate' : 'resize';
                    this.activeHandle = handle;
                    return;
                }
            }

            // Check if clicked inside a shape
            let hitShape = null;
            for (let i = this.shapes.length - 1; i >= 0; i--) {
                if (this.shapes[i].containsPoint(world.x, world.y)) {
                    hitShape = this.shapes[i];
                    break;
                }
            }

            if (hitShape) {
                if (!e.shiftKey && !hitShape.selected) {
                    this.shapes.forEach(s => s.selected = false);
                }
                hitShape.selected = true;
                this.dragMode = 'move';
            } else {
                if (!e.shiftKey) {
                    this.shapes.forEach(s => s.selected = false);
                }
                this.dragMode = 'marquee';
            }

            if (this.onSelectionChange) this.onSelectionChange(this.getSelectedShapes());
            this.render();
            return;
        }

        // Shape Creation Tools
        if (this.activeTool === TOOL_MODES.RECTANGLE) {
            const rectShape = new RectangleShape(world.x, world.y, 1, 1, this.layerManager.activeLayerId);
            this.shapes.push(rectShape);
            this.activeShape = rectShape;
            this.dragMode = 'create';
        } else if (this.activeTool === TOOL_MODES.CIRCLE) {
            const circShape = new CircleShape(world.x, world.y, 1, 1, this.layerManager.activeLayerId);
            this.shapes.push(circShape);
            this.activeShape = circShape;
            this.dragMode = 'create';
        } else if (this.activeTool === TOOL_MODES.POLYGON) {
            const polyShape = new PolygonShape(world.x, world.y, 1, 6, this.layerManager.activeLayerId);
            this.shapes.push(polyShape);
            this.activeShape = polyShape;
            this.dragMode = 'create';
        } else if (this.activeTool === TOOL_MODES.LINE) {
            this.tempPoints.push({ x: world.x, y: world.y });
            if (this.tempPoints.length === 1) {
                const pathShape = new PathShape([...this.tempPoints, { x: world.x, y: world.y }], this.layerManager.activeLayerId);
                this.shapes.push(pathShape);
                this.activeShape = pathShape;
            } else {
                this.activeShape.points = [...this.tempPoints];
            }
        }

        this.render();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = this.screenToWorld(sx, sy);
        this.currentMouseWorld = world;

        if (this.onCursorMove) {
            this.onCursorMove(world.x, world.y);
        }

        if (!this.isMouseDown) {
            // Update cursor style
            if (this.activeTool === TOOL_MODES.SELECT) {
                const bounds = this.getSelectionBounds();
                if (bounds) {
                    const handle = this.hitTestHandle(sx, sy, bounds);
                    if (handle) {
                        this.canvas.style.cursor = this.getHandleCursor(handle);
                        return;
                    }
                }
                let hoveringShape = this.shapes.some(s => s.containsPoint(world.x, world.y));
                this.canvas.style.cursor = hoveringShape ? 'move' : 'default';
            } else {
                this.canvas.style.cursor = 'crosshair';
            }
            this.renderRulers();
            return;
        }

        const dxWorld = world.x - this.startMouseWorld.x;
        const dyWorld = world.y - this.startMouseWorld.y;

        if (this.dragMode === 'pan') {
            this.panX += (sx - this.startMouseScreen.x);
            this.panY += (sy - this.startMouseScreen.y);
            this.startMouseScreen = { x: sx, y: sy };
            this.render();
            return;
        }

        if (this.dragMode === 'move') {
            const selected = this.getSelectedShapes();
            selected.forEach(s => s.translate(dxWorld, dyWorld));
            this.startMouseWorld = world;
            this.render();
            return;
        }

        if (this.dragMode === 'create' && this.activeShape) {
            const w = world.x - this.startMouseWorld.x;
            const h = world.y - this.startMouseWorld.y;

            if (this.activeShape.type === 'rect') {
                this.activeShape.x = Math.min(this.startMouseWorld.x, world.x);
                this.activeShape.y = Math.min(this.startMouseWorld.y, world.y);
                this.activeShape.width = Math.abs(w);
                this.activeShape.height = Math.abs(h);
            } else if (this.activeShape.type === 'circle') {
                this.activeShape.rx = Math.abs(w) / 2;
                this.activeShape.ry = Math.abs(h) / 2;
                this.activeShape.cx = this.startMouseWorld.x + w / 2;
                this.activeShape.cy = this.startMouseWorld.y + h / 2;
            } else if (this.activeShape.type === 'polygon') {
                this.activeShape.radius = Math.hypot(w, h);
            }
            this.render();
            return;
        }

        if (this.dragMode === 'resize') {
            // Apply scale based on handle
            const selected = this.getSelectedShapes();
            const b = this.getSelectionBounds();
            if (b && selected.length > 0) {
                // Resize logic
                const ratioX = (world.x - b.minX) / Math.max(1, b.width);
                const ratioY = (world.y - b.minY) / Math.max(1, b.height);
                // Simple proportional stretch
                if (ratioX > 0.05 && ratioY > 0.05) {
                    selected.forEach(s => s.scale(ratioX, ratioY, b.minX, b.minY));
                }
            }
            this.render();
        }
    }

    handleMouseUp(e) {
        if (!this.isMouseDown) return;
        this.isMouseDown = false;

        if (this.dragMode === 'create' && this.activeShape) {
            // Select newly created shape and revert to select tool
            this.shapes.forEach(s => s.selected = false);
            this.activeShape.selected = true;
            this.activeShape = null;
            this.activeTool = TOOL_MODES.SELECT;
            if (this.onSelectionChange) this.onSelectionChange(this.getSelectedShapes());
        }

        this.dragMode = null;
        this.render();
    }

    hitTestHandle(sx, sy, bounds) {
        const handleSize = 8;
        const corners = {
            'nw': this.worldToScreen(bounds.minX, bounds.minY),
            'ne': this.worldToScreen(bounds.maxX, bounds.minY),
            'se': this.worldToScreen(bounds.maxX, bounds.maxY),
            'sw': this.worldToScreen(bounds.minX, bounds.maxY),
            'n':  this.worldToScreen(bounds.centerX, bounds.minY),
            's':  this.worldToScreen(bounds.centerX, bounds.maxY),
            'w':  this.worldToScreen(bounds.minX, bounds.centerY),
            'e':  this.worldToScreen(bounds.maxX, bounds.centerY),
            'rot': this.worldToScreen(bounds.centerX, bounds.minY - 20 / this.zoom)
        };

        for (const [key, pt] of Object.entries(corners)) {
            if (Math.abs(sx - pt.x) <= handleSize && Math.abs(sy - pt.y) <= handleSize) {
                return key;
            }
        }
        return null;
    }

    getHandleCursor(handle) {
        switch (handle) {
            case 'nw': case 'se': return 'nwse-resize';
            case 'ne': case 'sw': return 'nesw-resize';
            case 'n': case 's': return 'ns-resize';
            case 'w': case 'e': return 'ew-resize';
            case 'rot': return 'crosshair';
            default: return 'default';
        }
    }

    render() {
        const dpr = window.devicePixelRatio || 1;
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;

        // Background
        ctx.fillStyle = '#1c1c1e';
        ctx.fillRect(0, 0, w, h);

        // Draw Machine Bed
        this.renderBed(ctx);

        // Draw Shapes
        this.renderShapes(ctx);

        // Draw Laser Head Indicator
        this.renderLaserHead(ctx);

        // Draw Selection Bounding Box & Handles
        this.renderSelection(ctx);

        ctx.restore();
        this.renderRulers();
    }

    renderBed(ctx) {
        const bedW = this.config.bedWidth;
        const bedH = this.config.bedHeight;

        const pTopLeft = this.worldToScreen(0, 0);
        const pBottomRight = this.worldToScreen(bedW, bedH);
        const screenW = bedW * this.zoom;
        const screenH = bedH * this.zoom;

        // Bed Honeycomb / Cutting Area
        ctx.fillStyle = '#242426';
        ctx.fillRect(pTopLeft.x, pTopLeft.y, screenW, screenH);

        // Bed Frame Border
        ctx.strokeStyle = '#44444a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(pTopLeft.x, pTopLeft.y, screenW, screenH);

        // Minor Grid (10mm) and Major Grid (50mm)
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.beginPath();
        for (let x = 0; x <= bedW; x += 10) {
            const pt = this.worldToScreen(x, 0);
            ctx.moveTo(pt.x, pTopLeft.y);
            ctx.lineTo(pt.x, pBottomRight.y);
        }
        for (let y = 0; y <= bedH; y += 10) {
            const pt = this.worldToScreen(0, y);
            ctx.moveTo(pTopLeft.x, pt.y);
            ctx.lineTo(pBottomRight.x, pt.y);
        }
        ctx.stroke();

        // Major Grid (50mm)
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        for (let x = 0; x <= bedW; x += 50) {
            const pt = this.worldToScreen(x, 0);
            ctx.moveTo(pt.x, pTopLeft.y);
            ctx.lineTo(pt.x, pBottomRight.y);
        }
        for (let y = 0; y <= bedH; y += 50) {
            const pt = this.worldToScreen(0, y);
            ctx.moveTo(pTopLeft.x, pt.y);
            ctx.lineTo(pBottomRight.x, pt.y);
        }
        ctx.stroke();

        // Origin Marker (Red Circle with crosshairs)
        let originScreen = pTopLeft;
        if (this.config.originCorner === 'Bottom-Left') {
            originScreen = this.worldToScreen(0, bedH);
        }
        ctx.save();
        ctx.strokeStyle = '#ff3333';
        ctx.fillStyle = 'rgba(255, 50, 50, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(originScreen.x, originScreen.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Crosshair
        ctx.beginPath();
        ctx.moveTo(originScreen.x - 12, originScreen.y);
        ctx.lineTo(originScreen.x + 12, originScreen.y);
        ctx.moveTo(originScreen.x, originScreen.y - 12);
        ctx.lineTo(originScreen.x, originScreen.y + 12);
        ctx.stroke();
        ctx.restore();
    }

    renderShapes(ctx) {
        for (const shape of this.shapes) {
            const layer = this.layerManager.getLayer(shape.layerId);
            const color = layer.color;

            ctx.save();
            ctx.translate(this.panX, this.panY);
            ctx.scale(this.zoom, this.zoom);

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 / this.zoom;

            if (layer.mode === 'Tool') {
                ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
                ctx.strokeStyle = '#ff007f';
            }

            if (layer.mode === 'Fill' || layer.mode === 'Fill+Line') {
                ctx.fillStyle = `${color}40`; // Semi-transparent preview
                if (shape.draw) {
                    shape.draw(ctx);
                    ctx.fill();
                }
            }

            if (layer.mode === 'Line' || layer.mode === 'Fill+Line' || layer.mode === 'Tool') {
                if (shape.draw) {
                    shape.draw(ctx);
                    ctx.stroke();
                }
            }

            ctx.restore();
        }
    }

    renderLaserHead(ctx) {
        const pt = this.worldToScreen(this.laserHead.x, this.laserHead.y);

        ctx.save();
        // Diode glow halo
        const grad = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, 16);
        grad.addColorStop(0, 'rgba(255, 20, 20, 0.8)');
        grad.addColorStop(0.4, 'rgba(255, 50, 50, 0.4)');
        grad.addColorStop(1, 'rgba(255, 50, 50, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
        ctx.fill();

        // Center dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Crosshairs
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pt.x - 10, pt.y);
        ctx.lineTo(pt.x + 10, pt.y);
        ctx.moveTo(pt.x, pt.y - 10);
        ctx.lineTo(pt.x, pt.y + 10);
        ctx.stroke();
        ctx.restore();
    }

    renderSelection(ctx) {
        const bounds = this.getSelectionBounds();
        if (!bounds) return;

        const pMin = this.worldToScreen(bounds.minX, bounds.minY);
        const pMax = this.worldToScreen(bounds.maxX, bounds.maxY);
        const w = pMax.x - pMin.x;
        const h = pMax.y - pMin.y;

        ctx.save();
        ctx.strokeStyle = '#00a8ff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(pMin.x, pMin.y, w, h);
        ctx.setLineDash([]);

        // Draw 8 handles + 1 rotation handle
        const handleSize = 6;
        const corners = [
            { x: pMin.x, y: pMin.y },
            { x: pMax.x, y: pMin.y },
            { x: pMax.x, y: pMax.y },
            { x: pMin.x, y: pMax.y },
            { x: pMin.x + w / 2, y: pMin.y },
            { x: pMin.x + w / 2, y: pMax.y },
            { x: pMin.x, y: pMin.y + h / 2 },
            { x: pMax.x, y: pMin.y + h / 2 }
        ];

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#00a8ff';
        for (const c of corners) {
            ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        }

        // Rotation Handle stalk
        const rotPt = { x: pMin.x + w / 2, y: pMin.y - 18 };
        ctx.beginPath();
        ctx.moveTo(pMin.x + w / 2, pMin.y);
        ctx.lineTo(rotPt.x, rotPt.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rotPt.x, rotPt.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    renderRulers() {
        if (!this.rulerTopCtx || !this.rulerLeftCtx) return;
        const dpr = window.devicePixelRatio || 1;

        // Top Horizontal Ruler
        const tCtx = this.rulerTopCtx;
        const rw = this.rulerTop.width / dpr;
        tCtx.save();
        tCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        tCtx.fillStyle = '#222225';
        tCtx.fillRect(0, 0, rw, 24);
        tCtx.strokeStyle = '#55555c';
        tCtx.fillStyle = '#9999a0';
        tCtx.font = '9px monospace';

        const startWorldX = Math.floor(this.screenToWorld(0, 0).x / 10) * 10;
        const endWorldX = Math.ceil(this.screenToWorld(rw, 0).x / 10) * 10;

        for (let gx = startWorldX; gx <= endWorldX; gx += 10) {
            const sx = this.worldToScreen(gx, 0).x;
            const is50 = gx % 50 === 0;
            const tickH = is50 ? 14 : 7;
            tCtx.beginPath();
            tCtx.moveTo(sx, 24);
            tCtx.lineTo(sx, 24 - tickH);
            tCtx.stroke();
            if (is50) {
                tCtx.fillText(`${gx}`, sx + 2, 10);
            }
        }
        tCtx.restore();

        // Left Vertical Ruler
        const lCtx = this.rulerLeftCtx;
        const rh = this.rulerLeft.height / dpr;
        lCtx.save();
        lCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lCtx.fillStyle = '#222225';
        lCtx.fillRect(0, 0, 24, rh);
        lCtx.strokeStyle = '#55555c';
        lCtx.fillStyle = '#9999a0';
        lCtx.font = '9px monospace';

        const startWorldY = Math.floor(this.screenToWorld(0, 0).y / 10) * 10;
        const endWorldY = Math.ceil(this.screenToWorld(0, rh).y / 10) * 10;

        for (let gy = startWorldY; gy <= endWorldY; gy += 10) {
            const sy = this.worldToScreen(0, gy).y;
            const is50 = gy % 50 === 0;
            const tickW = is50 ? 14 : 7;
            lCtx.beginPath();
            lCtx.moveTo(24, sy);
            lCtx.lineTo(24 - tickW, sy);
            lCtx.stroke();
            if (is50) {
                lCtx.save();
                lCtx.translate(10, sy + 3);
                lCtx.rotate(-Math.PI / 2);
                lCtx.fillText(`${gy}`, 0, 0);
                lCtx.restore();
            }
        }
        lCtx.restore();
    }
}
