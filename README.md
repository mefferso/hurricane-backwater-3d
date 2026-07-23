# Hurricane Backwater Flooding Explorer

An interactive, browser-based 3D educational visualization showing how a landfalling hurricane can contribute to residential flooding well inland from the immediate shoreline.

The central teaching point is that **storm surge does not need to physically reach a house to make rainfall flooding worse**. In this conceptual model, surge raises Lake Pontchartrain and the downstream river. That reduces the hydraulic gradient through the connected river–canal–ditch system, slowing or reversing drainage while rainfall continues to generate runoff upstream.

## Live site

The current `main` branch is automatically tested and deployed with GitHub Pages:

**https://mefferso.github.io/hurricane-backwater-3d/**

Deployment is handled by `.github/workflows/pages.yml`. A push to `main` runs the conceptual-model smoke test and then publishes the static files.

## Run the project

The application is static and does not require a build step.

1. Extract the project folder.
2. Open a terminal in the folder.
3. Start a local web server:

```bash
python3 -m http.server 8080
```

4. Visit `http://localhost:8080` in a modern browser.

On Windows, `py -m http.server 8080` also works.

> The project loads Three.js and Chart.js from jsDelivr. An internet connection is therefore required unless those libraries are later downloaded and referenced locally.

## Main features

- Freely rotatable, pannable, and zoomable Three.js scene
- Regional overview and house/ditch close-up camera views
- Fictional southeast Louisiana neighborhood and connected drainage system
- Animated hurricane cloud bands, rainfall, wind arrows, flow particles, and floodwater
- Storm-surge, rainfall, soil, drainage, culvert, blockage, elevation, slab, and pump controls
- Rain-only, surge-only, moderate compound, major compound, blocked-culvert, and custom scenarios
- Linked timeline, three synchronized charts, exact tooltips, and a vertical time cursor
- Plain-language status messages and drainage-efficiency readout
- Comparison mode with Scenario A/B overlays and rapid 3D switching
- US customary and metric dashboard units

## Conceptual hydrologic model

The model is a simplified water balance over a fictional neighborhood catchment.

### 1. Rainfall forcing

The selected rainfall profile produces a time-varying rainfall rate. The model supports:

- A constant rate
- An asymmetric hurricane pulse that ramps up, peaks, and then declines

The storm-total control acts as an accumulation cap. If the selected rate and duration cannot produce that amount, the modeled total will be lower.

### 2. Infiltration and runoff

Rainfall becomes runoff through a conceptual combination of:

- Impervious-area runoff
- Rainfall exceeding an infiltration capacity over pervious ground
- Reduced infiltration as initial soil saturation and cumulative rainfall increase

Runoff is converted to a volume over a representative fictional drainage area and routed into channel storage.

### 3. Connected drainage storage

The roadside ditch and larger canal are represented as combined channel storage with a stage–storage relationship. When the conceptual bankfull storage is exceeded, excess water spills into broad, shallow yard storage.

### 4. Downstream boundary and backwater

Lake storm surge follows a smooth rise-and-fall hydrograph. The river and canal respond with attenuation and lag.

Drainage discharge is based on a simplified head relationship:

```text
Q ∝ available capacity × sign(ΔH) × √|ΔH|
```

where:

- `ΔH` is the upstream ditch water-surface elevation minus the downstream canal water-surface elevation
- Positive `ΔH` produces downstream flow
- Small or zero `ΔH` produces weak or stagnant drainage
- Negative `ΔH` permits limited conceptual reverse flow

Culvert size, ditch/channel capacity, debris blockage, and optional pumping modify available discharge.

### 5. Yard and house flooding

Water enters yard storage only after the ditch reaches conceptual bankfull capacity. House water depth is calculated only when the yard water-surface elevation exceeds the selected slab elevation.

**Surge and rainfall are never simply added together as house flood depth.** Rainfall supplies the upstream water. Surge acts primarily by raising the downstream boundary and reducing the drainage gradient.

### 6. Recession

After rainfall ends:

- Yard water can return to the ditch once channel stages fall
- Small conceptual surface losses continue
- Drainage may remain slow until the river and lake recede

## Preset intent

The presets are tuned for qualitative education:

- **Rain only:** The selected rainfall is substantial, but the low downstream boundary allows the system to drain without yard flooding in the default preset.
- **Surge only:** The lake and river rise, but minimal local rainfall leaves the house and yard dry.
- **Moderate compound flooding:** The same drainage system overtops into the yard because rainfall coincides with a reduced downstream gradient.
- **Major compound flooding:** High surge, saturated soil, heavy rain, and reduced capacity can bring water above the house slab.
- **Blocked culvert:** Partial obstruction causes earlier and deeper neighborhood flooding.

## Parameters that can be calibrated

The current values are intentionally fictional. A future calibrated version could replace or tune:

- Catchment area and impervious fraction
- Infiltration-capacity relationship
- Ditch/canal stage–storage curves
- Ditch bank elevation and yard storage area
- Culvert geometry and discharge coefficient
- Pump capacity and operating rules
- Lake-to-river attenuation and lag
- River-to-canal backwater relationship
- Terrain, yard, and slab elevations
- Rainfall temporal distribution

## Limitations

This is **not** an engineering-grade hydrologic or hydraulic model. It does not solve the full Saint-Venant equations, represent a surveyed drainage network, model wave setup, forecast levee performance, reproduce pump-station operations, or account for every inlet, pipe, obstruction, soil type, tide, wind setup, and local elevation feature.

Do not use its numerical values for:

- Parcel-level flood prediction
- Evacuation decisions
- Insurance or legal determinations
- Drainage design
- Floodplain mapping
- Regulatory or emergency-warning thresholds

Its defensible use is explaining mechanisms, comparing controlled scenarios, and demonstrating why compound rainfall and downstream backwater can be worse than either factor alone.

## Replacing fictional inputs with real data

The code is modular so future versions can ingest:

- DEM or lidar terrain data
- Surveyed house slab and ditch elevations
- GIS drainage-channel and culvert geometry
- NWS or local rainfall observations and forecasts
- USGS river-stage data
- Lake Pontchartrain gauges and tide/surge observations
- ADCIRC or other surge-model output
- Pump-station status and capacity
- Calibrated hydrologic/hydraulic model results

Recommended integration path:

1. Replace the fictional Three.js geometry with terrain and channel meshes generated from GIS data.
2. Replace `surgeAtTime()` with observed or modeled lake stages.
3. Replace the conceptual river/canal response with gauge data or a routed hydraulic boundary.
4. Replace the runoff routine with calibrated basin parameters or external model output.
5. Keep the visualization layer separate from the authoritative calculation engine.

## Project structure

```text
index.html              Application shell and interface
styles.css              Responsive visual design
src/app.js              Application state, playback, and event wiring
src/scene.js            Three.js landscape, animation, camera, labels, and water
src/hydrology.js        Conceptual rainfall-runoff and backwater model
src/charts.js           Synchronized Chart.js time series and timeline cursor
src/ui.js               Controls, formatting, units, and interface helpers
src/presets.js          Default settings and scenario presets
```

## Keyboard controls

- `Space`: Play/pause
- `Right Arrow`: Step forward one simulation hour
- `Left Arrow`: Step backward one simulation hour
