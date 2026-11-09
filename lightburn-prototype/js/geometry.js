// LightBurn Prototype - Geometry, Math & Shape Models

let shapeIdCounter = 1;

export class BoundingBox {
    constructor(minX = 0, minY = 0, maxX = 0, maxY = 0) {
        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
    }

    get width() { return Math.max(0, this.maxX - this.minX); }
    get height() { return Math.max(0, this.maxY - this.minY); }
    get centerX() { return (this.minX + this.maxX) / 2; }
    get centerY() { return (this.minY + this.maxY) / 2; }

    contains(x, y) {
        return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
    }

    expand(padding) {
        return new BoundingBox(
            this.minX - padding,
            this.minY - padding,
            this.maxX + padding,
            this.maxY + padding
        );
    }

    static fromPoints(pts) {
        if (!pts || pts.length === 0) return new BoundingBox(0, 0, 0, 0);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return new BoundingBox(minX, minY, maxX, maxY);
    }
}

export class BaseShape {
    constructor(layerId = 0, name = 'Shape') {
        this.id = 'shp_' + (shapeIdCounter++);
        this.layerId = layerId;
        this.name = name;
        this.selected = false;
        this.rotation = 0; // degrees
    }

    getBounds() {
        return new BoundingBox();
    }

    containsPoint(px, py) {
        return this.getBounds().contains(px, py);
    }

    translate(dx, dy) {
        // implemented by subclass
    }

    scale(sx, sy, originX, originY) {
        // implemented by subclass
    }

    rotate(angleDeg, originX, originY) {
        this.rotation = (this.rotation + angleDeg) % 360;
    }

    // Convert geometry to contiguous paths of points [{x, y}, ...]
    toPolylines() {
        return [];
    }

    // Generate raster horizontal scan segments for FILL mode
    generateRasterLines(interval = 0.1) {
        const bounds = this.getBounds();
        if (bounds.width <= 0 || bounds.height <= 0) return [];

        const polylines = this.toPolylines();
        const rasterSegments = [];

        // Scan Y from bounds.minY to bounds.maxY by interval
        let direction = true; // true: L-to-R, false: R-to-L
        const startY = bounds.minY + interval / 2;
        const endY = bounds.maxY;

        for (let y = startY; y <= endY; y += interval) {
            const intersections = [];

            // Intersect y with all line segments of polylines
            for (const poly of polylines) {
                for (let i = 0; i < poly.length - 1; i++) {
                    const p1 = poly[i];
                    const p2 = poly[i + 1];

                    // Check if y is between p1.y and p2.y
                    if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
                        const t = (y - p1.y) / (p2.y - p1.y);
                        const x = p1.x + t * (p2.x - p1.x);
                        intersections.push(x);
                    }
                }
            }

            if (intersections.length >= 2) {
                intersections.sort((a, b) => a - b);
                // Pair them into solid fill segments
                for (let k = 0; k < intersections.length - 1; k += 2) {
                    let xStart = intersections[k];
                    let xEnd = intersections[k + 1];
                    if (direction) {
                        rasterSegments.push({ x1: xStart, y1: y, x2: xEnd, y2: y });
                    } else {
                        rasterSegments.push({ x1: xEnd, y1: y, x2: xStart, y2: y });
                    }
                }
                direction = !direction; // Bi-directional scanning
            }
        }

        return rasterSegments;
    }
}

export class RectangleShape extends BaseShape {
    constructor(x, y, width, height, layerId = 0, rx = 0) {
        super(layerId, 'Rectangle');
        this.type = 'rect';
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.rx = rx;
    }

    getBounds() {
        return new BoundingBox(this.x, this.y, this.x + this.width, this.y + this.height);
    }

    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }

    translate(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    scale(sx, sy, originX, originY) {
        this.x = originX + (this.x - originX) * sx;
        this.y = originY + (this.y - originY) * sy;
        this.width *= Math.abs(sx);
        this.height *= Math.abs(sy);
        if (sx < 0) this.x -= this.width;
        if (sy < 0) this.y -= this.height;
    }

    toPolylines() {
        const x1 = this.x;
        const y1 = this.y;
        const x2 = this.x + this.width;
        const y2 = this.y + this.height;

        return [[
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x2, y: y2 },
            { x: x1, y: y2 },
            { x: x1, y: y1 } // Closed
        ]];
    }

    draw(ctx) {
        ctx.beginPath();
        if (this.rx > 0 && ctx.roundRect) {
            ctx.roundRect(this.x, this.y, this.width, this.height, this.rx);
        } else {
            ctx.rect(this.x, this.y, this.width, this.height);
        }
    }
}

export class CircleShape extends BaseShape {
    constructor(cx, cy, rx, ry = null, layerId = 0) {
        super(layerId, rx === ry || ry === null ? 'Circle' : 'Ellipse');
        this.type = 'circle';
        this.cx = cx;
        this.cy = cy;
        this.rx = rx;
        this.ry = ry === null ? rx : ry;
    }

    getBounds() {
        return new BoundingBox(this.cx - this.rx, this.cy - this.ry, this.cx + this.rx, this.cy + this.ry);
    }

    containsPoint(px, py) {
        const dx = (px - this.cx) / this.rx;
        const dy = (py - this.cy) / this.ry;
        return (dx * dx + dy * dy) <= 1.0;
    }

    translate(dx, dy) {
        this.cx += dx;
        this.cy += dy;
    }

    scale(sx, sy, originX, originY) {
        this.cx = originX + (this.cx - originX) * sx;
        this.cy = originY + (this.cy - originY) * sy;
        this.rx *= Math.abs(sx);
        this.ry *= Math.abs(sy);
    }

    toPolylines(segments = 48) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            pts.push({
                x: this.cx + Math.cos(theta) * this.rx,
                y: this.cy + Math.sin(theta) * this.ry
            });
        }
        return [pts];
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.ellipse(this.cx, this.cy, Math.max(0.1, this.rx), Math.max(0.1, this.ry), 0, 0, Math.PI * 2);
    }
}

export class PolygonShape extends BaseShape {
    constructor(cx, cy, radius, sides = 6, layerId = 0) {
        super(layerId, `${sides}-Sided Polygon`);
        this.type = 'polygon';
        this.cx = cx;
        this.cy = cy;
        this.radius = radius;
        this.sides = Math.max(3, sides);
    }

    getBounds() {
        return new BoundingBox(
            this.cx - this.radius,
            this.cy - this.radius,
            this.cx + this.radius,
            this.cy + this.radius
        );
    }

    translate(dx, dy) {
        this.cx += dx;
        this.cy += dy;
    }

    scale(sx, sy, originX, originY) {
        this.cx = originX + (this.cx - originX) * sx;
        this.cy = originY + (this.cy - originY) * sy;
        this.radius *= (Math.abs(sx) + Math.abs(sy)) / 2;
    }

    toPolylines() {
        const pts = [];
        for (let i = 0; i <= this.sides; i++) {
            const angle = (i / this.sides) * Math.PI * 2 - Math.PI / 2;
            pts.push({
                x: this.cx + Math.cos(angle) * this.radius,
                y: this.cy + Math.sin(angle) * this.radius
            });
        }
        return [pts];
    }

    draw(ctx) {
        const pts = this.toPolylines()[0];
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
    }
}

export class PathShape extends BaseShape {
    constructor(points = [], layerId = 0, closed = false, name = 'Path') {
        super(layerId, name);
        this.type = 'path';
        this.points = points; // Array of {x, y}
        this.closed = closed;
    }

    getBounds() {
        return BoundingBox.fromPoints(this.points);
    }

    translate(dx, dy) {
        for (const p of this.points) {
            p.x += dx;
            p.y += dy;
        }
    }

    scale(sx, sy, originX, originY) {
        for (const p of this.points) {
            p.x = originX + (p.x - originX) * sx;
            p.y = originY + (p.y - originY) * sy;
        }
    }

    toPolylines() {
        if (this.points.length < 2) return [];
        const copy = this.points.map(p => ({ x: p.x, y: p.y }));
        if (this.closed && copy.length > 2) {
            const first = copy[0];
            const last = copy[copy.length - 1];
            if (first.x !== last.x || first.y !== last.y) {
                copy.push({ x: first.x, y: first.y });
            }
        }
        return [copy];
    }

    draw(ctx) {
        if (this.points.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        if (this.closed) {
            ctx.closePath();
        }
    }
}

export class TextShape extends BaseShape {
    constructor(x, y, text = 'LightBurn', fontSize = 16, layerId = 0) {
        super(layerId, 'Text');
        this.type = 'text';
        this.x = x;
        this.y = y;
        this.text = text;
        this.fontSize = fontSize; // mm approximate
        this.fontFamily = 'Arial, sans-serif';
    }

    getBounds() {
        // Approximate vector text width/height
        const width = this.text.length * this.fontSize * 0.65;
        const height = this.fontSize;
        return new BoundingBox(this.x, this.y, this.x + width, this.y + height);
    }

    translate(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    scale(sx, sy, originX, originY) {
        this.x = originX + (this.x - originX) * sx;
        this.y = originY + (this.y - originY) * sy;
        this.fontSize *= Math.abs(sy);
    }

    toPolylines() {
        // Approximate box outline for CAM vector cutting
        const b = this.getBounds();
        return [[
            { x: b.minX, y: b.minY },
            { x: b.maxX, y: b.minY },
            { x: b.maxX, y: b.maxY },
            { x: b.minX, y: b.maxY },
            { x: b.minX, y: b.minY }
        ]];
    }

    draw(ctx) {
        ctx.save();
        ctx.font = `bold ${this.fontSize}px ${this.fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.fillText(this.text, this.x, this.y);
        ctx.strokeText(this.text, this.x, this.y);
        ctx.restore();
    }
}
