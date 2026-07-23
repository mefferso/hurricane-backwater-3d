const CFS_TO_ACRE_FT_PER_HOUR = 3600 / 43560;
const EPS = 1e-6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(edge1 - edge0, EPS), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Conceptual storm-surge hydrograph. Surge begins before the rainfall peak,
 * rises smoothly, then drains more slowly than it arrived.
 */
function surgeAtTime(t, peak) {
  const start = 2;
  const peakTime = 17;
  const end = 42;
  if (t <= start || peak <= 0) return 0;
  if (t < peakTime) {
    return peak * smoothstep(start, peakTime, t);
  }
  if (t < end) {
    const recession = 1 - smoothstep(peakTime, end, t);
    return peak * Math.pow(recession, 0.72);
  }
  return 0;
}

function potentialRainRate(t, params) {
  const start = Number(params.rainStart);
  const duration = Math.max(0, params.rainDuration);
  const local = t - start;
  if (local < 0 || local > duration || duration <= 0 || params.rainRate <= 0) return 0;

  if (params.rainProfile === 'constant') return params.rainRate;

  // Asymmetric hurricane pulse: gradual ramp, broad peak, quicker tail.
  const x = clamp(local / duration, 0, 1);
  const shape = Math.pow(Math.sin(Math.PI * x), 1.25) * (0.72 + 0.55 * x);
  return Math.min(params.rainRate, params.rainRate * shape / 1.05);
}

function timeLabel(hours) {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `${whole}:${String(minutes === 60 ? 0 : minutes).padStart(2, '0')}`;
}

/**
 * Runs a fictional, conceptual water-balance model. It is designed to
 * demonstrate process sensitivity, not reproduce a specific drainage system.
 */
export function simulateHydrology(inputParams) {
  const params = { ...inputParams };
  const dt = params.timeStepHours ?? 0.1;
  const hours = params.simulationHours ?? 48;
  const steps = Math.round(hours / dt);

  // Representative conceptual geometry.
  const catchmentAreaAcres = 115;
  const imperviousFraction = 0.38;
  const channelSurfaceAreaAcres = 5.8 * (params.ditchCapacity / 100);
  const yardStorageAreaAcres = 34;
  const ditchInvert = params.neighborhoodElevation - 3.0;
  const ditchBankElevation = params.neighborhoodElevation - 0.25;
  const slabElevation = params.neighborhoodElevation + params.slabHeight;
  const bankfullStage = ditchBankElevation - ditchInvert;

  const baseCulvertCfs = 78;
  const effectiveCulvertCfs = baseCulvertCfs
    * (params.culvertCapacity / 100)
    * (1 - params.debrisBlockage / 100);
  const baseChannelFactor = params.ditchCapacity / 100;
  const pumpCfs = params.pumpEnabled ? 115 : 0;

  let channelStorage = channelSurfaceAreaAcres * 0.35;
  let yardStorage = 0;
  let cumulativeRain = 0;
  let cumulativePotentialRain = 0;
  let maxHouseDepth = 0;
  let priorRiver = params.riverStart;
  let priorCanal = params.riverStart + 0.1;

  const series = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i * dt;
    const lakeRise = surgeAtTime(t, params.surgePeak);
    const lakeLevel = 0.4 + lakeRise;

    // River and canal respond to the downstream boundary with lag and attenuation.
    const riverTarget = params.riverStart + lakeRise * 0.38;
    const riverResponse = clamp(dt / 2.2, 0, 1);
    const riverLevel = priorRiver + (riverTarget - priorRiver) * riverResponse;
    priorRiver = riverLevel;

    const canalTarget = riverLevel + 0.05 + Math.max(0, lakeRise - 5) * 0.06;
    const canalResponse = clamp(dt / 1.25, 0, 1);
    const canalLevel = priorCanal + (canalTarget - priorCanal) * canalResponse;
    priorCanal = canalLevel;

    let rainRate = potentialRainRate(t, params);
    const possibleIncrement = rainRate * dt;
    const remainingRain = Math.max(0, params.rainTotal - cumulativePotentialRain);
    if (possibleIncrement > remainingRain && dt > 0) rainRate = remainingRain / dt;
    cumulativePotentialRain += rainRate * dt;
    cumulativeRain = cumulativePotentialRain;

    // Infiltration weakens with saturation and as the storm wets the soil.
    const dynamicSaturation = clamp(params.soilSaturation / 100 + cumulativeRain / 35, 0, 1);
    const infiltrationCapacity = 0.58 * Math.pow(1 - dynamicSaturation, 1.45) + 0.035;
    const perviousRunoffRate = Math.max(0, rainRate - infiltrationCapacity);
    const effectiveRunoffInHr = rainRate * imperviousFraction
      + perviousRunoffRate * (1 - imperviousFraction);
    const runoffAcreFt = (effectiveRunoffInHr / 12) * catchmentAreaAcres * dt;

    const ditchDepth = Math.max(0, channelStorage / Math.max(channelSurfaceAreaAcres, 0.5));
    const ditchWaterElevation = ditchInvert + ditchDepth;
    const head = ditchWaterElevation - canalLevel;

    // Orifice/channel-style conceptual discharge. Negative head permits modest reverse flow.
    const headMagnitude = Math.sqrt(Math.max(Math.abs(head), 0));
    const directionFactor = head >= 0 ? 1 : -0.055;
    const capacityCfs = effectiveCulvertCfs * baseChannelFactor;
    let dischargeCfs = directionFactor * capacityCfs * headMagnitude / Math.sqrt(2.5);

    // Pumps only help when they have somewhere lower to discharge.
    if (params.pumpEnabled && head > -0.4) {
      const pumpHeadPenalty = clamp((head + 0.4) / 1.0, 0.15, 1);
      dischargeCfs += pumpCfs * pumpHeadPenalty;
    }

    // Do not drain more positive volume than exists in the channel during one step.
    let dischargeAcreFt = dischargeCfs * CFS_TO_ACRE_FT_PER_HOUR * dt;
    if (dischargeAcreFt > channelStorage) {
      dischargeAcreFt = channelStorage;
      dischargeCfs = dischargeAcreFt / Math.max(CFS_TO_ACRE_FT_PER_HOUR * dt, EPS);
    }

    channelStorage += runoffAcreFt - dischargeAcreFt;
    channelStorage = Math.max(0, channelStorage);

    // Ditch overtopping moves water into broad, shallow yard storage.
    const bankfullStorage = channelSurfaceAreaAcres * bankfullStage;
    if (channelStorage > bankfullStorage) {
      const overtopping = (channelStorage - bankfullStorage) * clamp(0.35 + dt, 0.35, 0.75);
      channelStorage -= overtopping;
      yardStorage += overtopping;
    }

    // Yard can slowly return water to the ditch when channel stage falls below bank.
    const updatedDitchDepth = Math.max(0, channelStorage / Math.max(channelSurfaceAreaAcres, 0.5));
    const updatedDitchElevation = ditchInvert + updatedDitchDepth;
    const yardDepth = Math.max(0, yardStorage / yardStorageAreaAcres);
    const yardWaterElevation = params.neighborhoodElevation + yardDepth;
    if (yardStorage > 0 && updatedDitchElevation < ditchBankElevation - 0.15) {
      const returnHead = Math.max(0, yardWaterElevation - updatedDitchElevation);
      const returnAcreFt = Math.min(yardStorage, returnHead * 1.2 * dt);
      yardStorage -= returnAcreFt;
      channelStorage += returnAcreFt;
    }

    // Very slow surface losses after rainfall ends.
    if (rainRate < 0.01 && yardStorage > 0) {
      const surfaceLoss = Math.min(yardStorage, 0.012 * yardStorageAreaAcres * dt);
      yardStorage -= surfaceLoss;
    }

    const finalDitchDepth = Math.max(0, channelStorage / Math.max(channelSurfaceAreaAcres, 0.5));
    const finalDitchElevation = ditchInvert + finalDitchDepth;
    const finalYardDepth = Math.max(0, yardStorage / yardStorageAreaAcres);
    const finalYardElevation = params.neighborhoodElevation + finalYardDepth;
    const houseDepth = Math.max(0, finalYardElevation - slabElevation);
    maxHouseDepth = Math.max(maxHouseDepth, houseDepth);

    const reverseFlow = dischargeCfs < -0.5;
    // "Efficiency" describes the drainage system's available hydraulic capacity,
    // not merely the instantaneous discharge. An empty ditch can therefore be
    // 100% efficient even though no water is currently moving.
    const baselinePotentialHead = Math.max(0.5, ditchBankElevation - (params.riverStart + 0.1));
    const availablePotentialHead = ditchBankElevation - canalLevel;
    const gradientFactor = clamp(availablePotentialHead / baselinePotentialHead, 0, 1);
    const infrastructureFactor = clamp(
      (params.ditchCapacity / 100)
      * (params.culvertCapacity / 100)
      * (1 - params.debrisBlockage / 100),
      0,
      1
    );
    const pumpBonus = params.pumpEnabled && availablePotentialHead > -0.4 ? 10 : 0;
    const drainageEfficiency = reverseFlow
      ? 0
      : clamp(Math.pow(gradientFactor, 1.8) * infrastructureFactor * 100 + pumpBonus, 0, 100);

    series.push({
      index: i,
      time: t,
      timeLabel: timeLabel(t),
      rainRate,
      cumulativeRain,
      lakeRise,
      lakeLevel,
      riverLevel,
      canalLevel,
      ditchDepth: finalDitchDepth,
      ditchWaterElevation: finalDitchElevation,
      yardDepth: finalYardDepth,
      yardWaterElevation: finalYardElevation,
      houseDepth,
      slabElevation,
      dischargeCfs,
      drainageEfficiency,
      reverseFlow,
      infiltrationRate: Math.min(rainRate, infiltrationCapacity),
      runoffRate: effectiveRunoffInHr
    });
  }

  const yardFloodIndex = series.findIndex((point) => point.yardDepth >= 0.04);
  const houseFloodIndex = series.findIndex((point) => point.houseDepth >= 0.02);
  const peakYard = Math.max(...series.map((point) => point.yardDepth));
  const peakDitch = Math.max(...series.map((point) => point.ditchDepth));
  const minEfficiency = Math.min(...series.map((point) => point.drainageEfficiency));

  return {
    params,
    series,
    summary: {
      maxHouseDepth,
      maxYardDepth: peakYard,
      maxDitchDepth: peakDitch,
      minEfficiency,
      totalRain: series.at(-1)?.cumulativeRain ?? 0,
      yardFloodTime: yardFloodIndex >= 0 ? series[yardFloodIndex].time : null,
      houseFloodTime: houseFloodIndex >= 0 ? series[houseFloodIndex].time : null
    }
  };
}

export function getDrainageRecoveryTime(result, currentIndex) {
  const series = result.series;
  const current = series[currentIndex];
  if (!current) return null;
  if (current.drainageEfficiency >= 65 && !current.reverseFlow) return current.time;

  for (let i = currentIndex + 1; i < series.length - 3; i += 1) {
    const point = series[i];
    const later = series[i + 3];
    if (point.drainageEfficiency >= 65 && !point.reverseFlow && later.ditchDepth <= point.ditchDepth) {
      return point.time;
    }
  }
  return null;
}

export function describeState(point, params) {
  const ditchBankDepth = 2.75;
  if (point.houseDepth >= 0.02) {
    return {
      title: 'Water has reached the house slab.',
      detail: 'Rainfall-generated water has filled the drainage system and yard deeply enough to reach the conceptual slab elevation.'
    };
  }
  if (point.yardDepth >= 0.04) {
    return {
      title: 'Water is spreading into the yard.',
      detail: 'The roadside ditch has overtopped because runoff is arriving faster than the restricted drainage network can discharge it.'
    };
  }
  if (point.ditchDepth >= ditchBankDepth - 0.15) {
    return {
      title: 'The roadside ditch is at or near capacity.',
      detail: 'Only a small additional volume is needed before shallow water begins moving onto nearby yards.'
    };
  }
  if (point.reverseFlow) {
    return {
      title: 'Downstream backwater is producing reverse flow.',
      detail: 'The canal and river are temporarily higher than the neighborhood ditch, pushing water upstream through the drainage connection.'
    };
  }
  if (point.rainRate > 0.1 && point.drainageEfficiency < 35) {
    return {
      title: 'Runoff is entering faster than it can drain.',
      detail: 'Heavy rain is supplying water upstream while the elevated river sharply limits discharge toward Lake Pontchartrain.'
    };
  }
  if (point.lakeRise > params.surgePeak * 0.4 && point.drainageEfficiency < 65) {
    return {
      title: 'The elevated river is reducing downstream drainage.',
      detail: 'Storm surge has raised the lake and river, shrinking the water-surface slope that normally carries neighborhood runoff away.'
    };
  }
  if (point.lakeRise > 0.25 && point.time < 17) {
    return {
      title: 'Lake Pontchartrain is rising due to storm surge.',
      detail: 'The downstream boundary is climbing before the heaviest rain, setting the stage for slower drainage later.'
    };
  }
  if (point.rainRate < 0.05 && point.cumulativeRain > 0.5 && point.ditchDepth > 1.0 && point.drainageEfficiency < 65) {
    return {
      title: 'Rain has ended, but drainage remains delayed.',
      detail: 'Water is receding slowly because the lake and river are still elevated downstream.'
    };
  }
  if (point.rainRate > 0.05) {
    return {
      title: 'Rainfall runoff is entering the neighborhood ditch.',
      detail: 'The system is still moving water downstream, but available storage and drainage capacity are being used.'
    };
  }
  return {
    title: 'Drainage is functioning normally.',
    detail: 'Water can move from the ditch through the canal and river toward Lake Pontchartrain with a favorable hydraulic gradient.'
  };
}
