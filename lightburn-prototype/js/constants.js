// LightBurn Prototype - Constants & Default Configurations

export const MACHINE_DEFAULTS = {
    bedWidth: 400,        // mm
    bedHeight: 400,       // mm
    maxFeedRate: 6000,    // mm/min
    rapidFeedRate: 4000,  // mm/min
    acceleration: 1000,   // mm/s^2
    maxPower: 1000,       // GRBL $30 setting (max spindle/laser PWM)
    laserMode: 'GRBL-M4', // 'GRBL-M4' (dynamic) or 'GRBL-M3' (constant) or 'Ruida-DSP'
    originCorner: 'Bottom-Left', // 'Bottom-Left', 'Top-Left', 'Top-Right', 'Bottom-Right'
};

// 16 Default LightBurn-Style Layers
export const DEFAULT_LAYERS = [
    { id: 0, code: 'C00', name: 'Black (Cut)',      color: '#1a1a1a', mode: 'Line',      speed: 300,  power: 90, minPower: 20, passes: 1, airAssist: true,  kerf: 0.15, interval: 0.10, output: true },
    { id: 1, code: 'C01', name: 'Blue (Engrave)',   color: '#0066cc', mode: 'Fill',      speed: 3500, power: 30, minPower: 10, passes: 1, airAssist: false, kerf: 0.00, interval: 0.08, output: true },
    { id: 2, code: 'C02', name: 'Red (Score)',      color: '#cc1111', mode: 'Line',      speed: 1500, power: 20, minPower: 10, passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: true },
    { id: 3, code: 'C03', name: 'Green (Fill+Line)',color: '#109618', mode: 'Fill+Line', speed: 2500, power: 35, minPower: 15, passes: 1, airAssist: false, kerf: 0.10, interval: 0.10, output: true },
    { id: 4, code: 'C04', name: 'Yellow (Cut 2)',   color: '#e69900', mode: 'Line',      speed: 250,  power: 95, minPower: 30, passes: 2, airAssist: true,  kerf: 0.18, interval: 0.10, output: true },
    { id: 5, code: 'C05', name: 'Orange',           color: '#ff6600', mode: 'Line',      speed: 800,  power: 45, minPower: 15, passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: true },
    { id: 6, code: 'C06', name: 'Cyan',             color: '#00b4d8', mode: 'Fill',      speed: 4000, power: 25, minPower: 10, passes: 1, airAssist: false, kerf: 0.00, interval: 0.06, output: true },
    { id: 7, code: 'C07', name: 'Magenta',          color: '#c71585', mode: 'Line',      speed: 1200, power: 50, minPower: 20, passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: true },
    { id: 8, code: 'C08', name: 'Light Blue',       color: '#4cc9f0', mode: 'Fill',      speed: 3000, power: 30, minPower: 10, passes: 1, airAssist: false, kerf: 0.00, interval: 0.08, output: true },
    { id: 9, code: 'C09', name: 'Lime',             color: '#70e000', mode: 'Line',      speed: 1800, power: 30, minPower: 10, passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: true },
    { id: 10, code: 'C10', name: 'Purple',          color: '#7209b7', mode: 'Fill',      speed: 2800, power: 40, minPower: 15, passes: 1, airAssist: false, kerf: 0.00, interval: 0.08, output: true },
    { id: 11, code: 'C11', name: 'Pink',            color: '#f72585', mode: 'Line',      speed: 1000, power: 40, minPower: 15, passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: true },
    { id: 12, code: 'C12', name: 'Teal',            color: '#2a9d8f', mode: 'Line',      speed: 1600, power: 35, minPower: 15, passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: true },
    { id: 13, code: 'C13', name: 'Brown',           color: '#8b5a2b', mode: 'Fill',      speed: 2000, power: 55, minPower: 20, passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: true },
    { id: 14, code: 'T01', name: 'Tool 1 (Guide)',  color: '#ff0055', mode: 'Tool',      speed: 1000, power: 0,  minPower: 0,  passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: false },
    { id: 15, code: 'T02', name: 'Tool 2 (Align)',  color: '#00f5d4', mode: 'Tool',      speed: 1000, power: 0,  minPower: 0,  passes: 1, airAssist: false, kerf: 0.00, interval: 0.10, output: false },
];

// Curated Material Presets for 10W-20W Diode & 40W-60W CO2 Lasers
export const MATERIAL_PRESETS = [
    {
        name: '3mm Baltic Birch Plywood',
        category: 'Wood',
        operations: [
            { name: 'Vector Cut', mode: 'Line', speed: 320, power: 90, passes: 1, airAssist: true, kerf: 0.14 },
            { name: 'Fine Engrave', mode: 'Fill', speed: 3600, power: 25, passes: 1, airAssist: false, interval: 0.08 },
            { name: 'Vector Score', mode: 'Line', speed: 1800, power: 18, passes: 1, airAssist: false, kerf: 0.00 },
        ]
    },
    {
        name: '3mm Cast Acrylic (Clear/Black)',
        category: 'Plastics',
        operations: [
            { name: 'Polished Cut', mode: 'Line', speed: 220, power: 95, passes: 1, airAssist: true, kerf: 0.16 },
            { name: 'Frosted Engrave', mode: 'Fill', speed: 4200, power: 20, passes: 1, airAssist: false, interval: 0.06 },
        ]
    },
    {
        name: 'Vegetable Tanned Leather 2.0mm',
        category: 'Leather/Fabrics',
        operations: [
            { name: 'Clean Cut', mode: 'Line', speed: 450, power: 75, passes: 1, airAssist: true, kerf: 0.12 },
            { name: 'Dark Emboss Engrave', mode: 'Fill', speed: 3000, power: 22, passes: 1, airAssist: false, interval: 0.10 },
        ]
    },
    {
        name: 'Black Anodized Aluminum',
        category: 'Metals / Coated',
        operations: [
            { name: 'White Bleach Mark', mode: 'Fill', speed: 2200, power: 55, passes: 1, airAssist: false, interval: 0.05 },
        ]
    },
    {
        name: 'Natural Slate Coaster',
        category: 'Stone/Ceramic',
        operations: [
            { name: 'Contrast Engrave', mode: 'Fill', speed: 2800, power: 45, passes: 1, airAssist: false, interval: 0.08 },
        ]
    },
    {
        name: 'Corrugated Cardboard 4mm',
        category: 'Paper/Cardboard',
        operations: [
            { name: 'High Speed Cut', mode: 'Line', speed: 900, power: 65, passes: 1, airAssist: true, kerf: 0.20 },
            { name: 'Surface Crease', mode: 'Line', speed: 2200, power: 15, passes: 1, airAssist: false, kerf: 0.00 },
        ]
    }
];

export const TOOL_MODES = {
    SELECT: 'select',
    RECTANGLE: 'rect',
    CIRCLE: 'circle',
    POLYGON: 'polygon',
    LINE: 'line',
    TEXT: 'text',
    PAN: 'pan',
    MEASURE: 'measure',
    TEST_GRID: 'test_grid'
};
