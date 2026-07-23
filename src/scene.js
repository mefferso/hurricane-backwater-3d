import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const FLOW_COLORS = {
  normal: 0x67f0cf,
  restricted: 0xf5bd52,
  reverse: 0xdc8cff
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function roundedBox(width, height, depth, radius, material) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, height / 2, 0);
  return new THREE.Mesh(geometry, material);
}

function makeLabel(title) {
  const element = document.createElement('div');
  element.className = 'scene-label';
  element.innerHTML = `<strong>${title}</strong><span>—</span>`;
  const object = new CSS2DObject(element);
  object.center.set(0.5, 1.1);
  return { object, element, title };
}

function createHouse(x, z, rotation = 0, scale = 1, highlighted = false) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  group.scale.setScalar(scale);

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: highlighted ? 0xe7ded0 : 0xb7bbb8, roughness: 0.88 })
  );
  foundation.position.y = 0.275;
  group.add(foundation);

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 3.7, 5.4),
    new THREE.MeshStandardMaterial({ color: highlighted ? 0xf1d6b8 : 0xd5c7b4, roughness: 0.8 })
  );
  walls.position.y = 2.4;
  group.add(walls);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(5.2, 2.3, 4),
    new THREE.MeshStandardMaterial({ color: highlighted ? 0x47748b : 0x5b6470, roughness: 0.9 })
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.78;
  roof.position.y = 5.05;
  group.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.3, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x31424d })
  );
  door.position.set(0, 1.55, 2.76);
  group.add(door);

  for (const wx of [-2.1, 2.1]) {
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 1.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x87c9dc, metalness: 0.15, roughness: 0.25 })
    );
    windowMesh.position.set(wx, 2.75, 2.77);
    group.add(windowMesh);
  }

  return group;
}

function createTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.22, 1.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6f4b2f })
  );
  trunk.position.y = 0.9;
  group.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x356f45, roughness: 1 })
  );
  crown.scale.set(1.15, 0.75, 1.1);
  crown.position.y = 2.25;
  group.add(crown);
  group.position.set(x, 0.18, z);
  group.scale.setScalar(scale);
  return group;
}

function createArrow(position, direction, color = 0xffffff, length = 3) {
  const arrow = new THREE.ArrowHelper(direction.clone().normalize(), position, length, color, 0.8, 0.45);
  arrow.line.material.transparent = true;
  arrow.line.material.opacity = 0.9;
  arrow.cone.material.transparent = true;
  arrow.cone.material.opacity = 0.9;
  return arrow;
}

export class FloodScene {
  constructor(container) {
    this.container = container;
    this.verticalScale = 0.42;
    this.labelsVisible = true;
    this.currentView = 'overview';
    this.clock = new THREE.Clock();
    this.flowParticles = [];
    this.windArrows = [];
    this.labels = {};

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb9c7);
    this.scene.fog = new THREE.FogExp2(0x94b9c4, 0.0075);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
    this.camera.position.set(-8, 55, 74);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.inset = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(0, 0, 0);
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 150;

    this.buildLighting();
    this.buildLandscape();
    this.buildNeighborhood();
    this.buildWaterNetwork();
    this.buildHurricane();
    this.buildRain();
    this.buildWind();
    this.buildMarkers();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.animate();

    const loader = this.container.querySelector('#scene-loading');
    if (loader) loader.remove();
  }

  buildLighting() {
    const hemi = new THREE.HemisphereLight(0xd7f0ff, 0x355943, 2.2);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0cc, 2.5);
    sun.position.set(-35, 55, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    this.scene.add(sun);
    this.sun = sun;
  }

  buildLandscape() {
    const terrainMaterial = new THREE.MeshStandardMaterial({ color: 0x668e57, roughness: 1 });
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(120, 78, 1, 1), terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.position.y = -0.18;
    this.scene.add(terrain);

    const neighborhoodPad = roundedBox(
      62, 0.35, 39, 2.5,
      new THREE.MeshStandardMaterial({ color: 0x78995f, roughness: 1 })
    );
    neighborhoodPad.position.set(-23, 0, -2);
    neighborhoodPad.receiveShadow = true;
    this.scene.add(neighborhoodPad);

    const distantMarsh = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 74),
      new THREE.MeshStandardMaterial({ color: 0x66896f, roughness: 1 })
    );
    distantMarsh.rotation.x = -Math.PI / 2;
    distantMarsh.position.set(25, -0.08, 0);
    distantMarsh.receiveShadow = true;
    this.scene.add(distantMarsh);

    // Simple elevation bands help the public read the fictional topography.
    const bandMaterial = new THREE.MeshBasicMaterial({ color: 0xcce0a5, transparent: true, opacity: 0.12 });
    for (let i = 0; i < 4; i += 1) {
      const band = new THREE.Mesh(new THREE.RingGeometry(7 + i * 5, 7.25 + i * 5, 64), bandMaterial);
      band.rotation.x = -Math.PI / 2;
      band.scale.y = 0.5;
      band.position.set(-28, 0.2, -7);
      this.scene.add(band);
    }
  }

  buildNeighborhood() {
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x515a60, roughness: 0.97 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(63, 7), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(-24, 0.22, 2.5);
    road.receiveShadow = true;
    this.scene.add(road);

    const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(7, 38), roadMaterial);
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(-7, 0.225, -2);
    crossRoad.receiveShadow = true;
    this.scene.add(crossRoad);

    const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xe8d48b });
    for (let x = -53; x < 4; x += 6) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.12), stripeMaterial);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.235, 2.5);
      this.scene.add(stripe);
    }

    const mainHouse = createHouse(-34, -7.5, 0, 1, true);
    mainHouse.position.y = 0.18;
    this.scene.add(mainHouse);
    this.mainHouse = mainHouse;

    const otherHomes = [
      [-20, -8, 0.04, 0.9],
      [-47, -9, -0.04, 0.82],
      [-28, 12, Math.PI, 0.82],
      [-12, 12, Math.PI, 0.76],
      [-45, 12, Math.PI, 0.72]
    ];
    otherHomes.forEach(([x, z, r, s]) => {
      const house = createHouse(x, z, r, s, false);
      house.position.y = 0.18;
      this.scene.add(house);
    });

    const treePositions = [
      [-53, -16, 1.2], [-39, -17, 0.9], [-25, -17, 1.1], [-14, -16, 0.85],
      [-51, 19, 1.0], [-36, 20, 0.8], [-22, 20, 1.15], [-3, 19, 0.85],
      [-58, 6, 0.75], [1, 8, 0.8]
    ];
    treePositions.forEach((args) => this.scene.add(createTree(...args)));

    // Culverts crossing driveways/road.
    const culvertMaterial = new THREE.MeshStandardMaterial({ color: 0x4c5558, metalness: 0.4, roughness: 0.55 });
    for (const x of [-43, -34, -22, -12]) {
      const culvert = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 4.5, 16), culvertMaterial);
      culvert.rotation.z = Math.PI / 2;
      culvert.position.set(x, -0.45, -1.4);
      this.scene.add(culvert);
    }

    // Drainage inlets.
    const grateMaterial = new THREE.MeshStandardMaterial({ color: 0x283338, metalness: 0.7, roughness: 0.5 });
    for (const x of [-49, -37, -25, -13]) {
      const grate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.65), grateMaterial);
      grate.position.set(x, 0.24, -0.65);
      this.scene.add(grate);
    }
  }

  buildWaterNetwork() {
    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x2e9dc0,
      transparent: true,
      opacity: 0.72,
      roughness: 0.22,
      metalness: 0.05,
      transmission: 0.08,
      depthWrite: false
    });

    this.lake = new THREE.Mesh(new THREE.PlaneGeometry(42, 78), waterMaterial.clone());
    this.lake.rotation.x = -Math.PI / 2;
    this.lake.position.set(48, -0.8, 0);
    this.scene.add(this.lake);

    this.river = roundedBox(35, 0.12, 10, 3.5, waterMaterial.clone());
    this.river.position.set(23, -0.64, 2);
    this.river.rotation.y = -0.08;
    this.scene.add(this.river);

    this.canal = roundedBox(27, 0.11, 4.2, 1.4, waterMaterial.clone());
    this.canal.position.set(-2.5, -0.72, -1.2);
    this.canal.rotation.y = 0.05;
    this.scene.add(this.canal);

    this.ditch = roundedBox(45, 0.1, 2.2, 0.7, waterMaterial.clone());
    this.ditch.position.set(-31, -0.82, -1.15);
    this.scene.add(this.ditch);

    this.yardFlood = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 18),
      new THREE.MeshPhysicalMaterial({
        color: 0xe0aa43,
        transparent: true,
        opacity: 0,
        roughness: 0.28,
        depthWrite: false
      })
    );
    this.yardFlood.rotation.x = -Math.PI / 2;
    this.yardFlood.position.set(-34, 0.25, -7.4);
    this.scene.add(this.yardFlood);

    this.houseFlood = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 6.4),
      new THREE.MeshPhysicalMaterial({
        color: 0xff856f,
        transparent: true,
        opacity: 0,
        roughness: 0.22,
        depthWrite: false
      })
    );
    this.houseFlood.rotation.x = -Math.PI / 2;
    this.houseFlood.position.set(-34, 0.65, -7.4);
    this.scene.add(this.houseFlood);

    this.slabLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-39, 0.7, -4.15),
        new THREE.Vector3(-29, 0.7, -4.15)
      ]),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.6, gapSize: 0.35 })
    );
    this.slabLine.computeLineDistances();
    this.scene.add(this.slabLine);

    const flowPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-49, -0.35, -1.15),
      new THREE.Vector3(-30, -0.35, -1.15),
      new THREE.Vector3(-12, -0.4, -1.1),
      new THREE.Vector3(3, -0.38, -0.6),
      new THREE.Vector3(17, -0.28, 1.0),
      new THREE.Vector3(36, -0.2, 1.4),
      new THREE.Vector3(52, -0.1, 0.8)
    ]);
    this.flowPath = flowPath;
    const particleGeometry = new THREE.SphereGeometry(0.22, 8, 8);
    for (let i = 0; i < 42; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: FLOW_COLORS.normal, transparent: true, opacity: 0.9 });
      const particle = new THREE.Mesh(particleGeometry, material);
      particle.userData.offset = i / 42;
      this.flowParticles.push(particle);
      this.scene.add(particle);
    }

    // Small overland flow arrows from yard toward ditch.
    this.overlandArrows = [];
    for (const x of [-41, -36, -31, -26]) {
      const arrow = createArrow(new THREE.Vector3(x, 0.5, -7), new THREE.Vector3(0, 0, 1), 0xf1c15c, 2.8);
      arrow.visible = false;
      this.overlandArrows.push(arrow);
      this.scene.add(arrow);
    }
  }

  buildHurricane() {
    this.hurricane = new THREE.Group();
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f3f2,
      transparent: true,
      opacity: 0.68,
      roughness: 1,
      depthWrite: false
    });
    const cloudGeometry = new THREE.SphereGeometry(1, 10, 8);
    for (let arm = 0; arm < 5; arm += 1) {
      for (let i = 0; i < 18; i += 1) {
        const a = i / 18 * Math.PI * 1.55 + arm * (Math.PI * 2 / 5);
        const radius = 2.2 + i * 0.46;
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial.clone());
        cloud.scale.set(1.3 + i * 0.025, 0.45, 0.85);
        cloud.position.set(Math.cos(a) * radius, (Math.random() - 0.5) * 0.8, Math.sin(a) * radius);
        cloud.rotation.y = -a;
        cloud.material.opacity = 0.62 - i * 0.012;
        this.hurricane.add(cloud);
      }
    }
    const eye = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.25, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xd9f2f5, transparent: true, opacity: 0.55 })
    );
    eye.rotation.x = Math.PI / 2;
    this.hurricane.add(eye);
    this.hurricane.position.set(58, 13, -30);
    this.hurricane.scale.setScalar(1.3);
    this.scene.add(this.hurricane);
  }

  buildRain() {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = -58 + Math.random() * 70;
      positions[i * 3 + 1] = 2 + Math.random() * 30;
      positions[i * 3 + 2] = -24 + Math.random() * 48;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xb9e7f5,
      size: 0.14,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this.rain = new THREE.Points(geometry, material);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  buildWind() {
    for (let i = 0; i < 8; i += 1) {
      const z = -20 + i * 6;
      const arrow = createArrow(new THREE.Vector3(8 + (i % 2) * 5, 5 + (i % 3), z), new THREE.Vector3(-1, 0, 0.35), 0xe8f5fa, 5);
      this.windArrows.push(arrow);
      this.scene.add(arrow);
    }
  }

  buildMarkers() {
    const markerData = {
      lake: ['Lake Pontchartrain', new THREE.Vector3(46, 3, 20)],
      river: ['River', new THREE.Vector3(23, 3, 3)],
      canal: ['Drainage canal', new THREE.Vector3(-3, 3, -1)],
      ditch: ['Roadside ditch', new THREE.Vector3(-25, 3, -1)],
      yard: ['Yard', new THREE.Vector3(-39, 3, -8)],
      house: ['House slab', new THREE.Vector3(-34, 7, -7)]
    };

    Object.entries(markerData).forEach(([key, [title, position]]) => {
      const group = new THREE.Group();
      group.position.copy(position);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 5, 8),
        new THREE.MeshBasicMaterial({ color: key === 'house' ? 0xffffff : 0x8fe4f3, transparent: true, opacity: 0.82 })
      );
      post.position.y = -2.5;
      group.add(post);
      const label = makeLabel(title);
      group.add(label.object);
      this.labels[key] = { ...label, group };
      this.scene.add(group);
    });
  }

  update(point, params, normalizedTime) {
    if (!point) return;
    const waterScale = this.verticalScale;
    const lakeY = -0.8 + point.lakeRise * waterScale * 0.5;
    const riverY = -0.64 + (point.riverLevel - params.riverStart) * waterScale * 0.48;
    const canalY = -0.72 + (point.canalLevel - params.riverStart) * waterScale * 0.48;
    const ditchY = -0.82 + point.ditchDepth * waterScale;

    this.lake.position.y = lakeY;
    this.river.position.y = riverY;
    this.canal.position.y = canalY;
    this.ditch.position.y = ditchY;

    const surgeRatio = clamp(point.lakeRise / Math.max(params.surgePeak, 0.1), 0, 1);
    const elevatedColor = new THREE.Color(0x62c6df);
    const normalColor = new THREE.Color(0x2e8fae);
    this.lake.material.color.copy(normalColor).lerp(elevatedColor, surgeRatio);
    this.river.material.color.copy(normalColor).lerp(elevatedColor, surgeRatio * 0.85);
    this.canal.material.color.copy(normalColor).lerp(elevatedColor, surgeRatio * 0.75);

    const yardOpacity = clamp(point.yardDepth * 2.4, 0, 0.68);
    this.yardFlood.material.opacity = yardOpacity;
    this.yardFlood.position.y = 0.24 + point.yardDepth * waterScale;
    const yardScale = 0.4 + clamp(point.yardDepth / 1.8, 0, 1) * 0.75;
    this.yardFlood.scale.set(yardScale, yardScale, 1);
    this.yardFlood.visible = point.yardDepth > 0.005;

    this.houseFlood.material.opacity = clamp(point.houseDepth * 1.8, 0, 0.76);
    this.houseFlood.position.y = 0.7 + point.houseDepth * waterScale;
    this.houseFlood.visible = point.houseDepth > 0.005;

    const slabY = 0.25 + params.slabHeight * waterScale;
    this.slabLine.position.y = slabY - 0.7;
    this.mainHouse.position.y = 0.18 + params.slabHeight * waterScale * 0.65;

    const flowMagnitude = clamp(Math.abs(point.dischargeCfs) / 80, 0.04, 1.5);
    const direction = point.reverseFlow ? -1 : 1;
    let flowColor = FLOW_COLORS.normal;
    if (point.reverseFlow) flowColor = FLOW_COLORS.reverse;
    else if (point.drainageEfficiency < 45) flowColor = FLOW_COLORS.restricted;

    this.flowParticles.forEach((particle, index) => {
      const progress = (particle.userData.offset + direction * normalizedTime * (0.35 + flowMagnitude * 0.8)) % 1;
      const wrapped = progress < 0 ? progress + 1 : progress;
      particle.position.copy(this.flowPath.getPointAt(wrapped));
      particle.position.y += Math.sin((normalizedTime * 15 + index) * 0.7) * 0.05;
      particle.material.color.setHex(flowColor);
      particle.material.opacity = clamp(0.25 + flowMagnitude * 0.55, 0.25, 0.95);
      particle.scale.setScalar(clamp(0.65 + flowMagnitude * 0.45, 0.6, 1.35));
    });

    this.overlandArrows.forEach((arrow) => {
      arrow.visible = point.yardDepth > 0.02;
      arrow.line.material.opacity = clamp(point.yardDepth * 2, 0.4, 1);
      arrow.cone.material.opacity = arrow.line.material.opacity;
    });

    const rainOpacity = clamp(point.rainRate / 2.2, 0, 0.82);
    this.rain.material.opacity = rainOpacity;
    this.rain.visible = point.rainRate > 0.01;

    const hurricaneProgress = clamp(point.time / 30, 0, 1);
    this.hurricane.position.x = 60 - hurricaneProgress * 28;
    this.hurricane.position.z = -31 + hurricaneProgress * 14;
    this.hurricane.position.y = 13 + Math.sin(point.time * 0.2) * 0.6;
    this.hurricane.scale.setScalar(1.0 + clamp(params.surgePeak / 10, 0, 1) * 0.6);

    const storminess = clamp((point.rainRate / 4 + point.lakeRise / 10) * 0.65, 0, 0.7);
    this.scene.background.setRGB(0.56 - storminess * 0.3, 0.72 - storminess * 0.32, 0.77 - storminess * 0.28);
    this.scene.fog.color.copy(this.scene.background);
    this.sun.intensity = 2.5 - storminess * 1.6;

    this.windArrows.forEach((arrow, i) => {
      arrow.visible = point.time > 1 && point.time < 38;
      const opacity = clamp(0.25 + point.lakeRise / 10 + point.rainRate / 6, 0.25, 0.95);
      arrow.line.material.opacity = opacity;
      arrow.cone.material.opacity = opacity;
      arrow.rotation.y = Math.sin(point.time * 0.12 + i) * 0.08;
    });

    this.updateLabels(point, params);
  }

  updateLabels(point, params) {
    const values = {
      lake: `+${point.lakeRise.toFixed(1)} ft`,
      river: `${point.riverLevel.toFixed(1)} ft`,
      canal: `${point.canalLevel.toFixed(1)} ft`,
      ditch: `${point.ditchDepth.toFixed(1)} ft deep`,
      yard: `${(point.yardDepth * 12).toFixed(1)} in`,
      house: point.houseDepth > 0.005 ? `${(point.houseDepth * 12).toFixed(1)} in above slab` : `${params.slabHeight.toFixed(1)} ft above yard`
    };
    Object.entries(this.labels).forEach(([key, label]) => {
      label.element.querySelector('span').textContent = values[key];
      label.group.visible = this.labelsVisible;
    });

    this.labels.lake.group.position.y = this.lake.position.y + 3;
    this.labels.river.group.position.y = this.river.position.y + 3;
    this.labels.canal.group.position.y = this.canal.position.y + 3;
    this.labels.ditch.group.position.y = this.ditch.position.y + 3;
    this.labels.yard.group.position.y = this.yardFlood.position.y + 3;
    this.labels.house.group.position.y = 6.8 + params.slabHeight * this.verticalScale * 0.65;
  }

  toggleLabels() {
    this.labelsVisible = !this.labelsVisible;
    Object.values(this.labels).forEach((label) => { label.group.visible = this.labelsVisible; });
    return this.labelsVisible;
  }

  setView(view) {
    this.currentView = view;
    if (view === 'closeup') {
      this.camera.position.set(-17, 24, 30);
      this.controls.target.set(-32, 0.8, -5);
    } else {
      this.camera.position.set(-8, 55, 74);
      this.controls.target.set(0, 0, 0);
    }
    this.controls.update();
  }

  resetCamera() {
    this.setView(this.currentView);
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
  }

  animate() {
    this.animationFrame = requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    this.controls.update();

    this.hurricane.rotation.y += delta * 0.18;
    const positions = this.rain.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      let y = positions.getY(i) - delta * 20;
      let x = positions.getX(i) - delta * 2.5;
      if (y < 0.4) y = 25 + Math.random() * 8;
      if (x < -62) x = 12;
      positions.setY(i, y);
      positions.setX(i, x);
    }
    positions.needsUpdate = true;

    this.lake.material.opacity = 0.7 + Math.sin(elapsed * 1.4) * 0.035;
    this.river.material.opacity = 0.7 + Math.sin(elapsed * 1.6 + 1) * 0.035;
    this.canal.material.opacity = 0.72 + Math.sin(elapsed * 1.8 + 2) * 0.035;

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}
