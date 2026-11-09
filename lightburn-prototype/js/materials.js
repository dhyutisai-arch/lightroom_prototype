// LightBurn Prototype - Material Library & Test Matrix Generator

import { MATERIAL_PRESETS } from './constants.js';
import { RectangleShape, TextShape } from './geometry.js';

export class MaterialManager {
    constructor(layerManager) {
        this.layerManager = layerManager;
        this.materials = MATERIAL_PRESETS;
    }

    renderList(container, onSelect) {
        container.innerHTML = '';

        this.materials.forEach(mat => {
            const card = document.createElement('div');
            card.className = 'material-card';

            let opsHtml = '';
            mat.operations.forEach((op, idx) => {
                opsHtml += `
                    <div class="material-op-row" data-mat="${mat.name}" data-op="${idx}">
                        <div class="op-name"><strong>${op.name}</strong> <span class="op-badge">${op.mode}</span></div>
                        <div class="op-specs">${op.speed} mm/min | ${op.power}% | ${op.passes} pass${op.passes > 1 ? 'es' : ''}</div>
                        <button class="btn-apply-preset" data-mat="${mat.name}" data-idx="${idx}">Apply to Layer</button>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="material-header">
                    <span class="material-category">${mat.category}</span>
                    <h4 class="material-title">${mat.name}</h4>
                </div>
                <div class="material-ops">${opsHtml}</div>
            `;

            container.appendChild(card);
        });

        // Bind apply buttons
        container.querySelectorAll('.btn-apply-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const matName = e.target.getAttribute('data-mat');
                const opIdx = parseInt(e.target.getAttribute('data-idx'), 10);
                const mat = this.materials.find(m => m.name === matName);
                if (mat && mat.operations[opIdx]) {
                    const op = mat.operations[opIdx];
                    this.layerManager.updateLayer(this.layerManager.activeLayerId, {
                        speed: op.speed,
                        power: op.power,
                        passes: op.passes,
                        mode: op.mode,
                        airAssist: op.airAssist || false,
                        kerf: op.kerf || 0.0
                    });
                    if (onSelect) onSelect(mat, op);
                }
            });
        });
    }

    /**
     * LightBurn's Iconic Feature: Automated Material Test Matrix Generator
     * Generates a 3x3 or 4x4 matrix of test squares with varying speed and power.
     */
    generateTestGrid(startX = 50, startY = 50) {
        const shapes = [];
        const speeds = [1000, 2000, 3000, 4000]; // Rows (mm/min)
        const powers = [20, 40, 60, 80];          // Columns (%)
        const squareSize = 15;                   // 15x15 mm squares
        const gap = 6;                           // mm gap

        // Title Header
        shapes.push(new TextShape(startX, startY - 20, 'MATERIAL TEST MATRIX', 6, 2));

        // Column Power Headers (Top)
        powers.forEach((p, colIdx) => {
            const x = startX + 25 + colIdx * (squareSize + gap);
            shapes.push(new TextShape(x, startY - 8, `${p}%`, 4, 2));
        });

        // Row Speed Headers & Test Squares
        speeds.forEach((s, rowIdx) => {
            const y = startY + rowIdx * (squareSize + gap);

            // Speed Label on left
            shapes.push(new TextShape(startX, y + 4, `${s}`, 4, 2));

            powers.forEach((p, colIdx) => {
                const x = startX + 25 + colIdx * (squareSize + gap);
                // Assign to Layer 1 (Engrave) or Layer 0 (Cut)
                const sq = new RectangleShape(x, y, squareSize, squareSize, 1);
                sq.name = `Test ${s}mm/min @ ${p}%`;
                shapes.push(sq);
            });
        });

        // Outer framing border
        const totalW = 25 + powers.length * (squareSize + gap) + 5;
        const totalH = speeds.length * (squareSize + gap) + 10;
        const border = new RectangleShape(startX - 5, startY - 12, totalW, totalH, 0);
        border.name = 'Test Grid Cutout';
        shapes.push(border);

        return shapes;
    }
}
