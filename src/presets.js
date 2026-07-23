export const DEFAULTS = Object.freeze({
  surgePeak: 3,
  riverStart: 1.0,
  rainProfile: 'hurricane',
  rainStart: 6,
  rainRate: 1.5,
  rainTotal: 8,
  rainDuration: 12,
  soilSaturation: 55,
  ditchCapacity: 100,
  culvertCapacity: 100,
  debrisBlockage: 0,
  neighborhoodElevation: 4.5,
  slabHeight: 1.2,
  pumpEnabled: false,
  simulationHours: 48,
  timeStepHours: 0.1
});

export const PRESETS = Object.freeze({
  rainOnly: {
    name: 'Rain only',
    description: 'Heavy rain with a low downstream boundary. Water may briefly fill the ditch but drains comparatively well.',
    values: {
      ...DEFAULTS,
      surgePeak: 0.2,
      riverStart: 0.5,
      rainRate: 1.8,
      rainTotal: 7,
      rainDuration: 10,
      soilSaturation: 55,
      ditchCapacity: 130,
      culvertCapacity: 130,
      debrisBlockage: 0
    }
  },
  surgeOnly: {
    name: 'Surge only',
    description: 'A high lake and river with little neighborhood rainfall. The house remains dry in this inland conceptual setting.',
    values: {
      ...DEFAULTS,
      surgePeak: 7,
      riverStart: 1.2,
      rainRate: 0.15,
      rainTotal: 0.6,
      rainDuration: 8,
      soilSaturation: 45,
      ditchCapacity: 100,
      culvertCapacity: 100
    }
  },
  moderateCompound: {
    name: 'Moderate compound flooding',
    description: 'Moderate surge and several inches of rain slow drainage enough to produce localized yard flooding.',
    values: {
      ...DEFAULTS,
      surgePeak: 4.2,
      riverStart: 1.3,
      rainRate: 1.8,
      rainTotal: 9,
      rainDuration: 12,
      soilSaturation: 65,
      ditchCapacity: 95,
      culvertCapacity: 90,
      debrisBlockage: 10
    }
  },
  majorCompound: {
    name: 'Major compound flooding',
    description: 'High surge, saturated soil, and heavy rainfall severely restrict drainage and can bring water to the house.',
    values: {
      ...DEFAULTS,
      surgePeak: 7.5,
      riverStart: 2.0,
      rainRate: 3.1,
      rainTotal: 18,
      rainDuration: 16,
      soilSaturation: 92,
      ditchCapacity: 85,
      culvertCapacity: 75,
      debrisBlockage: 20,
      slabHeight: 1.0
    }
  },
  blockedCulvert: {
    name: 'Blocked culvert',
    description: 'Moderate rain and surge combine with an obstructed culvert, producing faster upstream accumulation.',
    values: {
      ...DEFAULTS,
      surgePeak: 4.0,
      riverStart: 1.2,
      rainRate: 2.0,
      rainTotal: 10,
      rainDuration: 12,
      soilSaturation: 72,
      ditchCapacity: 95,
      culvertCapacity: 70,
      debrisBlockage: 65
    }
  },
  custom: {
    name: 'Custom',
    description: 'Adjust all parameters manually.',
    values: { ...DEFAULTS }
  }
});

export function clonePreset(key) {
  const preset = PRESETS[key] ?? PRESETS.custom;
  return { ...preset.values };
}
