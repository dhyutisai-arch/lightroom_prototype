// LightBurn Prototype - Layer Management

import { DEFAULT_LAYERS } from './constants.js';

export class LayerManager {
    constructor() {
        // Clone default layers
        this.layers = JSON.parse(JSON.stringify(DEFAULT_LAYERS));
        this.activeLayerId = 0;
        this.listeners = [];
    }

    onChange(cb) {
        this.listeners.push(cb);
    }

    notify() {
        for (const cb of this.listeners) {
            cb(this.layers);
        }
    }

    getLayer(id) {
        return this.layers.find(l => l.id === id) || this.layers[0];
    }

    setActiveLayer(id) {
        this.activeLayerId = id;
        this.notify();
    }

    updateLayer(id, updates) {
        const layer = this.getLayer(id);
        if (layer) {
            Object.assign(layer, updates);
            this.notify();
        }
    }

    toggleOutput(id) {
        const layer = this.getLayer(id);
        if (layer) {
            layer.output = !layer.output;
            this.notify();
        }
    }

    toggleAir(id) {
        const layer = this.getLayer(id);
        if (layer) {
            layer.airAssist = !layer.airAssist;
            this.notify();
        }
    }

    // Render the bottom color palette swatches (C00 to C15)
    renderPalette(container, onSelect) {
        container.innerHTML = '';
        this.layers.forEach(layer => {
            const swatch = document.createElement('button');
            swatch.className = `palette-swatch ${layer.id === this.activeLayerId ? 'active' : ''}`;
            swatch.title = `${layer.code}: ${layer.name} (${layer.mode})`;
            swatch.style.backgroundColor = layer.color;
            swatch.innerHTML = `<span class="swatch-code">${layer.code}</span>`;

            swatch.addEventListener('click', () => {
                this.setActiveLayer(layer.id);
                if (onSelect) onSelect(layer.id);
            });

            container.appendChild(swatch);
        });
    }

    // Render the Cuts / Layers table on the right panel
    renderTable(tbody, usedLayerIds = new Set(), onSelectLayer) {
        tbody.innerHTML = '';

        // Display layers that are either used by shapes or currently active
        const displayLayers = this.layers.filter(l => usedLayerIds.has(l.id) || l.id === this.activeLayerId);

        if (displayLayers.length === 0) {
            displayLayers.push(this.layers[0]);
        }

        displayLayers.forEach(layer => {
            const tr = document.createElement('tr');
            tr.className = `layer-row ${layer.id === this.activeLayerId ? 'selected-layer' : ''}`;

            tr.innerHTML = `
                <td class="cell-code" style="border-left: 5px solid ${layer.color}">
                    <span class="layer-dot" style="background-color: ${layer.color}"></span>
                    <strong>${layer.code}</strong>
                </td>
                <td class="cell-mode">
                    <select class="layer-mode-select" data-id="${layer.id}">
                        <option value="Line" ${layer.mode === 'Line' ? 'selected' : ''}>Line (Cut)</option>
                        <option value="Fill" ${layer.mode === 'Fill' ? 'selected' : ''}>Fill (Engrave)</option>
                        <option value="Fill+Line" ${layer.mode === 'Fill+Line' ? 'selected' : ''}>Fill + Line</option>
                        <option value="Tool" ${layer.mode === 'Tool' ? 'selected' : ''}>Tool (Guide)</option>
                    </select>
                </td>
                <td class="cell-spd">
                    <input type="number" class="layer-num-input input-speed" data-id="${layer.id}" value="${layer.speed}" step="50" min="10" max="15000">
                </td>
                <td class="cell-pwr">
                    <input type="number" class="layer-num-input input-power" data-id="${layer.id}" value="${layer.power}" step="1" min="1" max="100">%
                </td>
                <td class="cell-passes">
                    <input type="number" class="layer-num-input input-passes" data-id="${layer.id}" value="${layer.passes}" min="1" max="50">
                </td>
                <td class="cell-check">
                    <input type="checkbox" class="layer-out-chk" data-id="${layer.id}" ${layer.output ? 'checked' : ''} title="Output to Laser">
                </td>
                <td class="cell-check">
                    <input type="checkbox" class="layer-air-chk" data-id="${layer.id}" ${layer.airAssist ? 'checked' : ''} title="Air Assist">
                </td>
            `;

            // Row click selects active layer
            tr.addEventListener('click', (e) => {
                if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
                this.setActiveLayer(layer.id);
                if (onSelectLayer) onSelectLayer(layer.id);
            });

            // Bind change handlers
            tr.querySelector('.layer-mode-select').addEventListener('change', (e) => {
                this.updateLayer(layer.id, { mode: e.target.value });
            });

            tr.querySelector('.input-speed').addEventListener('change', (e) => {
                this.updateLayer(layer.id, { speed: parseFloat(e.target.value) || 100 });
            });

            tr.querySelector('.input-power').addEventListener('change', (e) => {
                this.updateLayer(layer.id, { power: parseFloat(e.target.value) || 10 });
            });

            tr.querySelector('.input-passes').addEventListener('change', (e) => {
                this.updateLayer(layer.id, { passes: parseInt(e.target.value, 10) || 1 });
            });

            tr.querySelector('.layer-out-chk').addEventListener('change', (e) => {
                this.updateLayer(layer.id, { output: e.target.checked });
            });

            tr.querySelector('.layer-air-chk').addEventListener('change', (e) => {
                this.updateLayer(layer.id, { airAssist: e.target.checked });
            });

            tbody.appendChild(tr);
        });
    }
}
