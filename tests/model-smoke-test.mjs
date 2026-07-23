import assert from 'node:assert/strict';
import { PRESETS } from '../src/presets.js';
import { simulateHydrology } from '../src/hydrology.js';

const results = Object.fromEntries(
  Object.entries(PRESETS).map(([key, preset]) => [key, simulateHydrology(preset.values)])
);

for (const [key, result] of Object.entries(results)) {
  assert.equal(result.series.length, 481, `${key} should cover 0–48 hours at 0.1-hour steps`);
  assert.ok(result.series.every((point) => Number.isFinite(point.ditchDepth)), `${key} contains invalid ditch depth`);
  assert.ok(result.series.every((point) => point.yardDepth >= 0 && point.houseDepth >= 0), `${key} contains negative flood depth`);
}

assert.ok(results.rainOnly.summary.maxHouseDepth === 0, 'Rain-only preset should keep the house dry');
assert.ok(results.surgeOnly.summary.maxYardDepth === 0, 'Surge-only preset should keep the inland yard dry');
assert.ok(results.moderateCompound.summary.maxYardDepth > 0, 'Moderate compound preset should flood the yard');
assert.ok(results.moderateCompound.summary.maxHouseDepth === 0, 'Moderate compound preset should remain below the default slab');
assert.ok(results.majorCompound.summary.maxHouseDepth > 0, 'Major compound preset should reach the house');
assert.ok(results.blockedCulvert.summary.yardFloodTime < results.moderateCompound.summary.yardFloodTime, 'Blocked culvert should produce earlier yard flooding');

console.log('Conceptual model smoke tests passed.');
