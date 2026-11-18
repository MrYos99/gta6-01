// NEONFALL 2100 — every tuning number and colour in one place.
// The city is 600x600 m centred on the origin; the sea lies east of x = +300.
// Palette: sun-soaked sky, neon cyan / magenta / amber, one accent per district.

export const STEP = 1 / 60;

export const MAP = {
  half: 300, // map spans -300..+300 on x and z
  blockPitch: 60, // block centres every 60 m
  streetWidth: 12, // streets are 12 m wide
  blockSize: 48, // building plots are 48x48 m
  shoreX: 240, // beach starts here; sea beyond x = +300
  seaX: 300,
};

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 9,
  staminaMax: 6, // seconds of sprint
  staminaRegen: 3, // seconds to refill from empty
  jumpVelocity: 7, // ~1.2 m apex with gravity 20
  gravity: 20,
  radius: 0.5,
  height: 1.85,
};

export const CAMERA = {
  distance: 4.4,
  height: 2.4,
  shoulder: 0.7, // over-the-shoulder offset to the right
  pitchMin: -0.15,
  pitchMax: 0.55,
};

// District accent colours (hex numbers for three.js, CSS strings for canvas).
export const DISTRICTS = {
  spire: { name: 'The Spire', accent: 0x00f0ff, css: '#00f0ff', secondary: '#e8f4ff', minH: 45, maxH: 120 },
  gardens: { name: 'The Gardens', accent: 0x2de8c4, css: '#2de8c4', secondary: '#b78cff', minH: 8, maxH: 30 },
  neonrow: { name: 'Neon Row', accent: 0xff2d78, css: '#ff2d78', secondary: '#ffb300', minH: 15, maxH: 60 },
  rustworks: { name: 'Rustworks', accent: 0xffb300, css: '#ffb300', secondary: '#39ff6a', minH: 8, maxH: 35 },
  skyport: { name: 'Skyport Docks', accent: 0xff7a1a, css: '#ff7a1a', secondary: '#00f0ff', minH: 10, maxH: 25 },
  shore: { name: 'The Shore', accent: 0x2fa8ff, css: '#2fa8ff', secondary: '#e8d9a0', minH: 0, maxH: 0 },
};

export const PALETTE = {
  skyTop: '#7fb8ec',
  skyHorizon: '#e8f4ff',
  fog: '#dfeefc',
  sun: '#fff2d8',
  asphalt: '#474c56',
  pavement: '#5d626b',
  sand: '#e3d3a4',
  sea: '#1e7fb8',
  neonCyan: '#00f0ff',
  neonMagenta: '#ff2d78',
  amber: '#ffb300',
  toxicGreen: '#39ff6a',
  policeWhite: '#e8f4ff',
  policeRed: '#ff2233',
  coat: '#1a2233',
  skin: '#c98d64',
};

export const SAVE_KEY = 'neonfall2100.save';
export const BEST_KEY = 'neonfall2100.best';

// Debug visibility toggles for perf isolation (?hide=ground,buildings,props,
// sky,player). Empty by default; the QA harness uses them to find slow parts.
export const DEBUG_HIDE = new Set();

// Quality scaler: the shipped default must clear >=30 FPS in headless
// swiftshader at 1280x720. `?quality=high|med|low` overrides it.
export const QUALITY = { antialias: true, shadows: true, shadowSize: 1024, anisotropy: 8 };
export function applyQuality(name) {
  if (name === 'med') {
    QUALITY.antialias = false;
    QUALITY.shadows = true;
    QUALITY.shadowSize = 512;
    QUALITY.anisotropy = 4;
  } else if (name === 'low') {
    QUALITY.antialias = false;
    QUALITY.shadows = false;
    QUALITY.shadowSize = 512;
    QUALITY.anisotropy = 1;
  }
}
