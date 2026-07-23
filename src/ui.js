import { PRESETS } from './presets.js';

const PARAM_INPUTS = {
  surgePeak: 'surge-peak',
  riverStart: 'river-start',
  rainProfile: 'rain-profile',
  rainStart: 'rain-start',
  rainRate: 'rain-rate',
  rainTotal: 'rain-total',
  rainDuration: 'rain-duration',
  soilSaturation: 'soil-saturation',
  ditchCapacity: 'ditch-capacity',
  culvertCapacity: 'culvert-capacity',
  debrisBlockage: 'debris-blockage',
  neighborhoodElevation: 'neighborhood-elevation',
  slabHeight: 'slab-height',
  pumpEnabled: 'pump-enabled'
};

const NUMERIC_PARAMS = new Set([
  'surgePeak', 'riverStart', 'rainStart', 'rainRate', 'rainTotal', 'rainDuration',
  'soilSaturation', 'ditchCapacity', 'culvertCapacity', 'debrisBlockage',
  'neighborhoodElevation', 'slabHeight'
]);

export class AppUI {
  constructor() {
    this.unitSystem = 'imperial';
    this.elements = Object.fromEntries(
      Object.entries(PARAM_INPUTS).map(([key, id]) => [key, document.getElementById(id)])
    );
    this.presetSelect = document.getElementById('preset-select');
    this.comparisonPreset = document.getElementById('comparison-preset');
    this.populatePresets();
    this.bindCollapsibles();
    this.bindDialog();
  }

  populatePresets() {
    for (const [key, preset] of Object.entries(PRESETS)) {
      const optionA = new Option(preset.name, key);
      this.presetSelect.add(optionA);
      if (key !== 'custom') this.comparisonPreset.add(new Option(preset.name, key));
    }
    this.presetSelect.value = 'custom';
    this.comparisonPreset.value = 'rainOnly';
  }

  bindCollapsibles() {
    document.querySelectorAll('.section-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        const body = document.getElementById(button.dataset.section);
        const open = body.classList.toggle('open');
        button.setAttribute('aria-expanded', String(open));
        button.lastElementChild.textContent = open ? '−' : '+';
      });
    });
  }

  bindDialog() {
    const dialog = document.getElementById('about-dialog');
    document.getElementById('about-button').addEventListener('click', () => dialog.showModal());
    document.getElementById('close-about').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  readParams(base = {}) {
    const params = { ...base };
    for (const [key, element] of Object.entries(this.elements)) {
      if (key === 'pumpEnabled') params[key] = element.checked;
      else if (NUMERIC_PARAMS.has(key)) params[key] = Number(element.value);
      else params[key] = element.value;
    }
    return params;
  }

  writeParams(params) {
    for (const [key, element] of Object.entries(this.elements)) {
      if (params[key] == null) continue;
      if (key === 'pumpEnabled') element.checked = Boolean(params[key]);
      else element.value = String(params[key]);
    }
    this.updateControlLabels(params);
  }

  updateControlLabels(params) {
    const metric = this.unitSystem === 'metric';
    const feet = (value) => metric ? `${(value * 0.3048).toFixed(2)} m` : `${value.toFixed(1)} ft`;
    const inches = (value) => metric ? `${(value * 25.4).toFixed(0)} mm` : `${value.toFixed(1)} in`;
    const rate = (value) => metric ? `${(value * 25.4).toFixed(0)} mm/hr` : `${value.toFixed(1)} in/hr`;

    document.getElementById('surge-peak-value').textContent = `${feet(params.surgePeak)}${metric ? '' : ` · ${(params.surgePeak * 0.3048).toFixed(2)} m`}`;
    document.getElementById('river-start-value').textContent = feet(params.riverStart);
    document.getElementById('rain-rate-value').textContent = rate(params.rainRate);
    document.getElementById('rain-total-value').textContent = inches(params.rainTotal);
    document.getElementById('rain-duration-value').textContent = `${params.rainDuration.toFixed(1)} hr`;
    document.getElementById('soil-saturation-value').textContent = `${Math.round(params.soilSaturation)}%`;
    document.getElementById('ditch-capacity-value').textContent = `${Math.round(params.ditchCapacity)}%`;
    document.getElementById('culvert-capacity-value').textContent = `${Math.round(params.culvertCapacity)}%`;
    document.getElementById('debris-blockage-value').textContent = `${Math.round(params.debrisBlockage)}%`;
    document.getElementById('neighborhood-elevation-value').textContent = feet(params.neighborhoodElevation);
    document.getElementById('slab-height-value').textContent = feet(params.slabHeight);
  }

  onParameterInput(callback) {
    Object.values(this.elements).forEach((element) => {
      const eventName = element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input';
      element.addEventListener(eventName, () => callback());
    });
  }

  setPreset(key) {
    this.presetSelect.value = key;
  }

  markCustom() {
    this.presetSelect.value = 'custom';
  }

  setUnitSystem(system, params) {
    this.unitSystem = system;
    this.updateControlLabels(params);
  }
}

export function formatTime(hours) {
  if (hours == null) return 'Not expected';
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `Hour ${whole}:${String(minutes === 60 ? 0 : minutes).padStart(2, '0')}`;
}

export function formatLengthFeet(valueFeet, unitSystem, smallDepth = false) {
  if (unitSystem === 'metric') {
    return smallDepth ? `${(valueFeet * 30.48).toFixed(1)} cm` : `${(valueFeet * 0.3048).toFixed(2)} m`;
  }
  return smallDepth ? `${(valueFeet * 12).toFixed(1)} in` : `${valueFeet.toFixed(1)} ft`;
}

export function formatRain(valueInches, unitSystem) {
  return unitSystem === 'metric' ? `${(valueInches * 25.4).toFixed(0)} mm` : `${valueInches.toFixed(1)} in`;
}
