// LightBurn Prototype - Machine Controller, Motion Simulator & Preview Engine

export class LaserSimulator {
    constructor(canvas, gcodeGen, onHeadMove, onLog) {
        this.previewCanvas = canvas;
        this.previewCtx = canvas ? canvas.getContext('2d') : null;
        this.gcodeGen = gcodeGen;
        this.onHeadMove = onHeadMove;
        this.onLog = onLog || console.log;

        // Virtual Head State (in mm)
        this.headPos = { x: 0, y: 0, z: 0 };
        this.laserActive = false;
        this.currentPower = 0;
        this.isFraming = false;
        this.serialPort = null;
        this.serialWriter = null;
        this.isConnected = false;

        // Preview playback state
        this.motionSegments = [];
        this.currentSegmentIndex = 0;
        this.progress = 0; // 0 to 1
        this.isPlaying = false;
        this.playbackSpeed = 2; // 2x default
        this.animFrameId = null;
    }

    log(msg, type = 'info') {
        if (this.onLog) this.onLog(msg, type);
    }

    /**
     * Parse G-Code text into graphical motion segments for simulation playback.
     */
    parseGCode(gcodeText) {
        const lines = gcodeText.split('\n');
        const segments = [];
        let curX = 0;
        let curY = 0;
        let laserOn = false;
        let currentPower = 0;
        let currentSpeed = 3000;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith(';')) continue;

            // Check laser on/off
            if (line.includes('M3') || line.includes('M4')) {
                laserOn = true;
                const matchS = line.match(/S(\d+)/);
                if (matchS) currentPower = parseInt(matchS[1], 10);
            }
            if (line.includes('M5')) {
                laserOn = false;
                currentPower = 0;
            }

            // Check feedrate
            const matchF = line.match(/F(\d+)/);
            if (matchF) currentSpeed = parseInt(matchF[1], 10);

            // Check G0 / G1 coordinates
            if (line.startsWith('G0') || line.startsWith('G1')) {
                const matchX = line.match(/X([0-9.-]+)/);
                const matchY = line.match(/Y([0-9.-]+)/);

                const nextX = matchX ? parseFloat(matchX[1]) : curX;
                const nextY = matchY ? parseFloat(matchY[1]) : curY;

                const isRapid = line.startsWith('G0') || !laserOn;
                const dist = Math.hypot(nextX - curX, nextY - curY);

                if (dist > 0.001) {
                    segments.push({
                        type: isRapid ? 'rapid' : 'cut',
                        x1: curX,
                        y1: curY,
                        x2: nextX,
                        y2: nextY,
                        dist: dist,
                        speed: isRapid ? 4000 : currentSpeed,
                        power: currentPower
                    });
                    curX = nextX;
                    curY = nextY;
                }
            }
        }

        this.motionSegments = segments;
        this.progress = 0;
        this.currentSegmentIndex = 0;
        return segments;
    }

    /**
     * Render the LightBurn Simulation Preview dialog canvas.
     */
    renderPreview() {
        if (!this.previewCanvas || !this.previewCtx) return;
        const ctx = this.previewCtx;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;

        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, w, h);

        const bedW = this.gcodeGen.config.bedWidth;
        const bedH = this.gcodeGen.config.bedHeight;

        // Calculate scaling to fit preview canvas with padding
        const padding = 30;
        const scale = Math.min((w - padding * 2) / bedW, (h - padding * 2) / bedH);
        const offsetX = (w - bedW * scale) / 2;
        const offsetY = (h - bedH * scale) / 2;

        const toScreenX = (x) => offsetX + x * scale;
        const toScreenY = (y) => offsetY + (bedH - y) * scale; // Machine coordinate (0 at bottom)

        // Draw machine bed boundary
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(offsetX, offsetY, bedW * scale, bedH * scale);

        // Draw grid lines
        ctx.strokeStyle = '#282828';
        ctx.beginPath();
        for (let gx = 0; gx <= bedW; gx += 50) {
            ctx.moveTo(toScreenX(gx), toScreenY(0));
            ctx.lineTo(toScreenX(gx), toScreenY(bedH));
        }
        for (let gy = 0; gy <= bedH; gy += 50) {
            ctx.moveTo(toScreenX(0), toScreenY(gy));
            ctx.lineTo(toScreenX(bedW), toScreenY(gy));
        }
        ctx.stroke();

        if (this.motionSegments.length === 0) {
            ctx.fillStyle = '#888888';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No laser moves generated. Add shapes to canvas.', w / 2, h / 2);
            return;
        }

        // Draw all rapid moves in faint red dashed lines
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 60, 60, 0.35)';
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const seg of this.motionSegments) {
            if (seg.type === 'rapid') {
                ctx.moveTo(toScreenX(seg.x1), toScreenY(seg.y1));
                ctx.lineTo(toScreenX(seg.x2), toScreenY(seg.y2));
            }
        }
        ctx.stroke();
        ctx.restore();

        // Draw cut paths up to current progress
        const targetCount = Math.floor(this.progress * this.motionSegments.length);
        let headSimPos = { x: 0, y: 0 };

        // 1. Cut paths already burned (solid green/cyan/white)
        ctx.lineWidth = 1.5;
        for (let i = 0; i < targetCount; i++) {
            const seg = this.motionSegments[i];
            if (seg.type === 'cut') {
                ctx.strokeStyle = '#00ff88';
                ctx.beginPath();
                ctx.moveTo(toScreenX(seg.x1), toScreenY(seg.y1));
                ctx.lineTo(toScreenX(seg.x2), toScreenY(seg.y2));
                ctx.stroke();
            }
            headSimPos = { x: seg.x2, y: seg.y2 };
        }

        // 2. Remaining future cut paths (faint gray)
        ctx.strokeStyle = 'rgba(120, 120, 120, 0.4)';
        ctx.beginPath();
        for (let i = targetCount; i < this.motionSegments.length; i++) {
            const seg = this.motionSegments[i];
            if (seg.type === 'cut') {
                ctx.moveTo(toScreenX(seg.x1), toScreenY(seg.y1));
                ctx.lineTo(toScreenX(seg.x2), toScreenY(seg.y2));
            }
        }
        ctx.stroke();

        // 3. Draw Laser Head cursor in simulation
        if (targetCount > 0) {
            const headSx = toScreenX(headSimPos.x);
            const headSy = toScreenY(headSimPos.y);

            // Glow ring
            ctx.beginPath();
            ctx.arc(headSx, headSy, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
            ctx.fill();

            // Center laser dot
            ctx.beginPath();
            ctx.arc(headSx, headSy, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ff2222';
            ctx.fill();
        }
    }

    /**
     * Start playback animation loop.
     */
    startPlayback(onUpdate) {
        if (this.isPlaying) return;
        this.isPlaying = true;

        let lastTime = performance.now();

        const step = (now) => {
            if (!this.isPlaying) return;
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            // Increment progress based on speed
            const rate = 0.05 * this.playbackSpeed; // Complete full job in ~20s at 1x
            this.progress += dt * rate;

            if (this.progress >= 1.0) {
                this.progress = 1.0;
                this.isPlaying = false;
                if (onUpdate) onUpdate(1.0);
                this.renderPreview();
                return;
            }

            if (onUpdate) onUpdate(this.progress);
            this.renderPreview();
            this.animFrameId = requestAnimationFrame(step);
        };

        this.animFrameId = requestAnimationFrame(step);
    }

    pausePlayback() {
        this.isPlaying = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    seekPlayback(progressVal) {
        this.progress = Math.max(0, Math.min(1, progressVal));
        this.renderPreview();
    }

    /**
     * Frame Bounding Box: animates the laser head around the perimeter on the main workspace.
     */
    frameBoundingBox(shapes, onFinish) {
        if (this.isFraming) return;
        this.isFraming = true;

        if (shapes.length === 0) {
            this.log('[FRAME] No shapes to frame.', 'warn');
            this.isFraming = false;
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of shapes) {
            const b = s.getBounds();
            if (b.minX < minX) minX = b.minX;
            if (b.minY < minY) minY = b.minY;
            if (b.maxX > maxX) maxX = b.maxX;
            if (b.maxY > maxY) maxY = b.maxY;
        }

        const pts = [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY },
            { x: minX, y: minY },
            { x: 0, y: 0 } // Back to origin
        ];

        this.log(`[FRAME] Framing bounding box: (${minX.toFixed(1)}, ${minY.toFixed(1)}) to (${maxX.toFixed(1)}, ${maxY.toFixed(1)}) mm`, 'info');

        let ptIndex = 0;
        const stepInterval = setInterval(() => {
            if (ptIndex >= pts.length) {
                clearInterval(stepInterval);
                this.isFraming = false;
                this.log('[FRAME] Completed.', 'success');
                if (onFinish) onFinish();
                return;
            }

            const target = pts[ptIndex++];
            this.headPos.x = target.x;
            this.headPos.y = target.y;
            if (this.onHeadMove) this.onHeadMove(this.headPos);
        }, 300);
    }

    /**
     * Virtual jog controls.
     */
    jog(axis, distance) {
        if (axis === 'X') {
            this.headPos.x = Math.max(0, Math.min(this.gcodeGen.config.bedWidth, this.headPos.x + distance));
        } else if (axis === 'Y') {
            this.headPos.y = Math.max(0, Math.min(this.gcodeGen.config.bedHeight, this.headPos.y + distance));
        } else if (axis === 'Z') {
            this.headPos.z = Math.max(-50, Math.min(50, this.headPos.z + distance));
        }

        this.log(`Jog ${axis} by ${distance}mm -> Current: X:${this.headPos.x.toFixed(1)} Y:${this.headPos.y.toFixed(1)}`, 'info');
        if (this.onHeadMove) this.onHeadMove(this.headPos);
    }

    home() {
        this.headPos.x = 0;
        this.headPos.y = 0;
        this.headPos.z = 0;
        this.log('[HOME] Axes homed: (0, 0, 0)', 'success');
        if (this.onHeadMove) this.onHeadMove(this.headPos);
    }

    /**
     * Process virtual terminal G-Code commands.
     */
    executeCommand(cmd) {
        const clean = cmd.trim();
        this.log(`> ${clean}`, 'cmd');

        if (clean === '?') {
            const status = `<Idle|MPos:${this.headPos.x.toFixed(3)},${this.headPos.y.toFixed(3)},${this.headPos.z.toFixed(3)}|FS:0,0|Pn:P>`;
            this.log(status, 'resp');
            this.log('ok', 'resp');
            return status;
        }

        if (clean === '$H') {
            this.home();
            this.log('[MSG:Homing cycle complete]', 'resp');
            this.log('ok', 'resp');
            return 'ok';
        }

        if (clean === '$$') {
            this.log('$30=1000 (Max spindle speed/laser PWM)', 'resp');
            this.log('$32=1 (Laser-mode enable)', 'resp');
            this.log('$100=80.000 (X-axis travel resolution)', 'resp');
            this.log('$101=80.000 (Y-axis travel resolution)', 'resp');
            this.log('$110=6000.000 (X-axis maximum rate, mm/min)', 'resp');
            this.log('$111=6000.000 (Y-axis maximum rate, mm/min)', 'resp');
            this.log('$120=1000.000 (X-axis acceleration, mm/sec^2)', 'resp');
            this.log('$121=1000.000 (Y-axis acceleration, mm/sec^2)', 'resp');
            this.log('ok', 'resp');
            return 'ok';
        }

        if (clean.startsWith('G0') || clean.startsWith('G1')) {
            const mx = clean.match(/X([0-9.-]+)/);
            const my = clean.match(/Y([0-9.-]+)/);
            if (mx) this.headPos.x = parseFloat(mx[1]);
            if (my) this.headPos.y = parseFloat(my[1]);
            if (this.onHeadMove) this.onHeadMove(this.headPos);
            this.log('ok', 'resp');
            return 'ok';
        }

        if (clean === 'M3' || clean.startsWith('M3')) {
            this.laserActive = true;
            this.log('ok', 'resp');
            return 'ok';
        }

        if (clean === 'M5') {
            this.laserActive = false;
            this.log('ok', 'resp');
            return 'ok';
        }

        this.log('ok', 'resp');
        return 'ok';
    }

    /**
     * Optional Web Serial API integration for connecting to real USB laser hardware.
     */
    async connectSerial() {
        if (!('serial' in navigator)) {
            this.log('Web Serial API not supported in this browser. Running in Virtual Simulator mode.', 'warn');
            return false;
        }

        try {
            this.serialPort = await navigator.serial.requestPort();
            await this.serialPort.open({ baudRate: 115200 });
            this.isConnected = true;
            this.log('[SERIAL] Connected to physical GRBL Controller at 115200 baud!', 'success');
            return true;
        } catch (err) {
            this.log(`[SERIAL] Connection cancelled or failed: ${err.message}`, 'error');
            return false;
        }
    }
}
