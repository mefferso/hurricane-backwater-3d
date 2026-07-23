import { DEFAULTS, PRESETS, clonePreset } from './presets.js';
import { simulateHydrology, getDrainageRecoveryTime, describeState } from './hydrology.js';
import { FloodScene } from './scene.js';
import { HydroCharts } from './charts.js';
import { AppUI, formatLengthFeet, formatRain, formatTime } from './ui.js';

const ui = new AppUI();
const scene = new FloodScene(document.getElementById('scene-container'));
const charts = new HydroCharts();

let paramsA = { ...DEFAULTS };
let paramsB = clonePreset('rainOnly');
let resultA = simulateHydrology(paramsA);
let resultB = simulateHydrology(paramsB);
let comparisonEnabled = false;
let activeScenario = 'A';
let currentIndex = 0;
let playing = false;
let playbackPosition = 0;
let previousFrameTime = performance.now();

const timelineSlider = document.getElementById('timeline-slider');
const playPauseButton = document.getElementById('play-pause');
const comparisonControls = document.getElementById('comparison-controls');
const comparisonSummary = document.getElementById('comparison-summary');
const scenarioBadge = document.getElementById('scenario-badge');

ui.writeParams(paramsA);
recalculate(true);

function activeResult() {
  return comparisonEnabled && activeScenario === 'B' ? resultB : resultA;
}

function activeParams() {
  return comparisonEnabled && activeScenario === 'B' ? paramsB : paramsA;
}

function recalculate(resetTimeline = false) {
  resultA = simulateHydrology(paramsA);
  resultB = simulateHydrology(paramsB);
  timelineSlider.max = String(resultA.series.length - 1);

  if (resetTimeline) {
    currentIndex = 0;
    playbackPosition = 0;
    timelineSlider.value = '0';
    setPlaying(false);
  } else {
    currentIndex = Math.min(currentIndex, resultA.series.length - 1);
    playbackPosition = currentIndex;
  }

  charts.update(resultA, resultB, comparisonEnabled, ui.unitSystem);
  updateDisplay();
}

function updateDisplay() {
  const result = activeResult();
  const params = activeParams();
  const point = result.series[Math.min(currentIndex, result.series.length - 1)];
  if (!point) return;

  scene.update(point, params, point.time / params.simulationHours);
  charts.setCursor(point.time);
  timelineSlider.value = String(currentIndex);

  const status = describeState(point, params);
  document.getElementById('status-message').textContent = status.title;
  document.getElementById('status-detail').textContent = status.detail;

  const efficiency = Math.round(point.drainageEfficiency);
  document.getElementById('efficiency-value').textContent = `${efficiency}%`;
  const gauge = document.getElementById('gauge-ring');
  gauge.style.setProperty('--value', `${efficiency}%`);
  gauge.style.background = `conic-gradient(${efficiency < 25 ? '#ff756a' : efficiency < 55 ? '#f2b84b' : '#7be3c3'} ${efficiency}%, rgba(145,183,199,0.16) 0)`;

  const metric = ui.unitSystem === 'metric';
  document.getElementById('metric-time').textContent = point.timeLabel;
  document.getElementById('metric-rain').textContent = formatRain(point.cumulativeRain, ui.unitSystem);
  document.getElementById('metric-surge').textContent = formatLengthFeet(point.lakeRise, ui.unitSystem);
  document.getElementById('metric-river').textContent = formatLengthFeet(point.riverLevel, ui.unitSystem);
  document.getElementById('metric-ditch').textContent = formatLengthFeet(point.ditchDepth, ui.unitSystem);
  document.getElementById('metric-yard').textContent = formatLengthFeet(point.yardDepth, ui.unitSystem, true);

  const slabDistance = point.slabElevation - point.yardWaterElevation;
  const slabText = formatLengthFeet(Math.abs(slabDistance), ui.unitSystem, Math.abs(slabDistance) < 1);
  document.getElementById('metric-slab-distance').textContent = slabDistance >= 0 ? slabText : `${slabText} above`;
  document.getElementById('metric-max-house').textContent = formatLengthFeet(result.summary.maxHouseDepth, ui.unitSystem, true);

  const yardFloodTime = result.summary.yardFloodTime;
  document.getElementById('yard-flood-time').textContent = yardFloodTime == null
    ? 'Not expected'
    : point.time < yardFloodTime
      ? formatTime(yardFloodTime)
      : `Occurred ${formatTime(yardFloodTime).toLowerCase()}`;

  const recoveryTime = getDrainageRecoveryTime(result, currentIndex);
  document.getElementById('drainage-resume-time').textContent = point.drainageEfficiency >= 65 && !point.reverseFlow
    ? 'Already efficient'
    : recoveryTime == null
      ? 'After timeline'
      : formatTime(recoveryTime);

  scenarioBadge.textContent = comparisonEnabled ? `Scenario ${activeScenario} in 3D` : 'Scenario A';
  scenarioBadge.style.color = activeScenario === 'B' ? '#d896ff' : '#44c7f4';

  document.getElementById('compare-a-yard').textContent = formatLengthFeet(resultA.summary.maxYardDepth, ui.unitSystem, true);
  document.getElementById('compare-b-yard').textContent = formatLengthFeet(resultB.summary.maxYardDepth, ui.unitSystem, true);
  document.getElementById('compare-a-house').textContent = formatLengthFeet(resultA.summary.maxHouseDepth, ui.unitSystem, true);
  document.getElementById('compare-b-house').textContent = formatLengthFeet(resultB.summary.maxHouseDepth, ui.unitSystem, true);

  // Keep the primary scene labels in feet for public-facing continuity, while metric readouts remain available.
  if (metric) {
    document.querySelector('.unit-toggle span').title = '3D labels remain in feet; dashboard values are metric.';
  }
}

function setPlaying(value) {
  playing = value;
  playPauseButton.textContent = playing ? 'Pause' : 'Play';
  previousFrameTime = performance.now();
}

function setCurrentIndex(index) {
  const max = activeResult().series.length - 1;
  currentIndex = Math.max(0, Math.min(max, Math.round(index)));
  playbackPosition = currentIndex;
  updateDisplay();
}

function playbackLoop(now) {
  const elapsedSeconds = Math.min((now - previousFrameTime) / 1000, 0.25);
  previousFrameTime = now;
  if (playing) {
    const speed = Number(document.getElementById('simulation-speed').value);
    const stepsPerHour = 1 / activeParams().timeStepHours;
    playbackPosition += elapsedSeconds * speed * stepsPerHour;
    if (playbackPosition >= activeResult().series.length - 1) {
      playbackPosition = activeResult().series.length - 1;
      setPlaying(false);
    }
    const nextIndex = Math.round(playbackPosition);
    if (nextIndex !== currentIndex) {
      currentIndex = nextIndex;
      updateDisplay();
    }
  }
  requestAnimationFrame(playbackLoop);
}
requestAnimationFrame(playbackLoop);

ui.onParameterInput(() => {
  ui.markCustom();
  paramsA = ui.readParams(DEFAULTS);
  ui.updateControlLabels(paramsA);
  recalculate(false);
});

ui.presetSelect.addEventListener('change', () => {
  const key = ui.presetSelect.value;
  paramsA = clonePreset(key);
  ui.writeParams(paramsA);
  recalculate(true);
});

document.getElementById('reset-scenario').addEventListener('click', () => {
  const key = ui.presetSelect.value;
  paramsA = key === 'custom' ? { ...DEFAULTS } : clonePreset(key);
  ui.writeParams(paramsA);
  recalculate(true);
});

document.getElementById('comparison-enabled').addEventListener('change', (event) => {
  comparisonEnabled = event.target.checked;
  comparisonControls.classList.toggle('hidden', !comparisonEnabled);
  comparisonSummary.classList.toggle('hidden', !comparisonEnabled);
  if (!comparisonEnabled) activeScenario = 'A';
  document.querySelectorAll('[data-view-scenario]').forEach((button) => {
    button.classList.toggle('active', button.dataset.viewScenario === activeScenario);
  });
  charts.update(resultA, resultB, comparisonEnabled, ui.unitSystem);
  updateDisplay();
});

ui.comparisonPreset.addEventListener('change', () => {
  paramsB = clonePreset(ui.comparisonPreset.value);
  resultB = simulateHydrology(paramsB);
  charts.update(resultA, resultB, comparisonEnabled, ui.unitSystem);
  updateDisplay();
});

document.querySelectorAll('[data-view-scenario]').forEach((button) => {
  button.addEventListener('click', () => {
    activeScenario = button.dataset.viewScenario;
    document.querySelectorAll('[data-view-scenario]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    updateDisplay();
  });
});

document.getElementById('unit-system').addEventListener('change', (event) => {
  ui.setUnitSystem(event.target.value, paramsA);
  charts.update(resultA, resultB, comparisonEnabled, ui.unitSystem);
  updateDisplay();
});

document.getElementById('view-overview').addEventListener('click', (event) => {
  scene.setView('overview');
  document.getElementById('view-overview').classList.add('active');
  document.getElementById('view-closeup').classList.remove('active');
  event.currentTarget.blur();
});

document.getElementById('view-closeup').addEventListener('click', (event) => {
  scene.setView('closeup');
  document.getElementById('view-closeup').classList.add('active');
  document.getElementById('view-overview').classList.remove('active');
  event.currentTarget.blur();
});

document.getElementById('reset-camera').addEventListener('click', () => scene.resetCamera());
document.getElementById('toggle-labels').addEventListener('click', (event) => {
  const visible = scene.toggleLabels();
  event.currentTarget.classList.toggle('active', visible);
});

timelineSlider.addEventListener('input', () => {
  setPlaying(false);
  setCurrentIndex(Number(timelineSlider.value));
});

playPauseButton.addEventListener('click', () => {
  if (!playing && currentIndex >= activeResult().series.length - 1) setCurrentIndex(0);
  setPlaying(!playing);
});

document.getElementById('step-back').addEventListener('click', () => {
  setPlaying(false);
  setCurrentIndex(currentIndex - Math.round(1 / activeParams().timeStepHours));
});

document.getElementById('step-forward').addEventListener('click', () => {
  setPlaying(false);
  setCurrentIndex(currentIndex + Math.round(1 / activeParams().timeStepHours));
});

document.getElementById('reset-playback').addEventListener('click', () => {
  setPlaying(false);
  setCurrentIndex(0);
});

window.addEventListener('keydown', (event) => {
  if (event.target.matches('input, select, button')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    setPlaying(!playing);
  } else if (event.key === 'ArrowRight') {
    setCurrentIndex(currentIndex + Math.round(1 / activeParams().timeStepHours));
  } else if (event.key === 'ArrowLeft') {
    setCurrentIndex(currentIndex - Math.round(1 / activeParams().timeStepHours));
  }
});

window.addEventListener('beforeunload', () => scene.dispose());
