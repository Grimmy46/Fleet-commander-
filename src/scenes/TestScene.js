// ═══════════════════════════════════════════════════════════════
//  TEST SCENE — the first 3D scene of the new engine
//
//  Proves the foundation works end to end: sky and sun lighting,
//  an ocean, a placeholder destroyer sailing on the fixed-step
//  simulation, and an angled RTS-style camera following it.
//
//  Units: 1 world unit = 1 metre. +X east, -Z north, +Y up.
//  The real ocean, RTS camera controls and ship model come in
//  later 0.20 tasks (#3, #4, #7). This is scaffolding.
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const KTS = 0.514444;           // metres per second per knot

export class TestScene {
  init(engine) {
    this.engine = engine;
    this.root = new THREE.Scene();
    this.root.fog = new THREE.FogExp2(0x9fb4c8, 0.00011);

    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 5, 60000);

    this._buildSky();
    this._buildOcean();
    this.ship = buildPlaceholderDestroyer();
    this.root.add(this.ship);

    // Simulation state: a slow starboard circle at 12 knots.
    // prev/cur are kept so rendering can interpolate between ticks.
    this.sim = {
      cur:  { x: 0, z: 0, hdg: 0 },
      prev: { x: 0, z: 0, hdg: 0 },
      speed: 12 * KTS,
      turnRate: THREE.MathUtils.degToRad(0.6)   // degrees per second
    };
    this.t = 0;
  }

  _buildSky() {
    const sky = new Sky();
    sky.scale.setScalar(45000);
    const u = sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.85;

    // Late-afternoon sun, low in the south-west
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(
      1, THREE.MathUtils.degToRad(90 - 18), THREE.MathUtils.degToRad(215));
    u.sunPosition.value.copy(this.sunDir);
    this.root.add(sky);

    // Bake the sky into an environment map for reflections
    const pmrem = new THREE.PMREMGenerator(this.engine.renderer);
    const skyScene = new THREE.Scene();
    skyScene.add(sky.clone());
    this.envMap = pmrem.fromScene(skyScene).texture;
    this.root.environment = this.envMap;
    pmrem.dispose();

    const sun = new THREE.DirectionalLight(0xffe2c0, 2.6);
    sun.position.copy(this.sunDir).multiplyScalar(2000);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = -250; s.right = 250; s.top = 250; s.bottom = -250; s.near = 100; s.far = 5000;
    this.sun = sun;
    this.root.add(sun, sun.target);
    this.root.add(new THREE.HemisphereLight(0xbcd4ec, 0x0b2236, 0.6));
  }

  _buildOcean() {
    this.waterNormals = makeWaterNormalTexture(256);
    this.waterNormals.wrapS = this.waterNormals.wrapT = THREE.RepeatWrapping;
    this.waterNormals.repeat.set(450, 450);     // ~180 m per tile

    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d3550,
      roughness: 0.48,
      metalness: 0.0,
      normalMap: this.waterNormals,
      normalScale: new THREE.Vector2(0.2, 0.2),
      envMapIntensity: 0.45
    });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(80000, 80000), mat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.receiveShadow = true;
    this.ocean = ocean;
    this.root.add(ocean);
  }

  // Fixed step: advance the simulation exactly dt seconds
  update(dt) {
    const s = this.sim;
    s.prev.x = s.cur.x; s.prev.z = s.cur.z; s.prev.hdg = s.cur.hdg;
    s.cur.hdg += s.turnRate * dt;
    s.cur.x += Math.sin(s.cur.hdg) * s.speed * dt;
    s.cur.z -= Math.cos(s.cur.hdg) * s.speed * dt;
    this.t += dt;
  }

  // Per frame: interpolate and draw
  render(alpha, realDt) {
    const s = this.sim;
    const x = s.prev.x + (s.cur.x - s.prev.x) * alpha;
    const z = s.prev.z + (s.cur.z - s.prev.z) * alpha;
    const hdg = s.prev.hdg + (s.cur.hdg - s.prev.hdg) * alpha;
    const t = this.t + alpha * this.engine.loop.step;

    // Ship pose with a gentle roll and pitch
    this.ship.position.set(x, Math.sin(t * 0.7) * 0.25, z);
    this.ship.rotation.set(Math.sin(t * 0.45) * 0.008, -hdg, Math.sin(t * 0.6) * 0.018, 'YXZ');

    // Scroll the water normals in two directions for movement
    this.waterNormals.offset.set(t * 0.004, t * 0.0025);

    // Angled RTS camera trailing the ship (fixed for now; #3 adds controls)
    const dist = 520, pitch = THREE.MathUtils.degToRad(52), yaw = hdg + THREE.MathUtils.degToRad(155);
    const cx = x + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = z - Math.cos(yaw) * Math.cos(pitch) * dist;
    this.camera.position.set(cx, Math.sin(pitch) * dist, cz);
    this.camera.lookAt(x, 0, z);

    // Keep the shadow camera centred on the ship
    this.sun.position.set(x, 0, z).addScaledVector(this.sunDir, 2000);
    this.sun.target.position.set(x, 0, z);
    this.sun.target.updateMatrixWorld();
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.waterNormals.dispose();
    this.envMap.dispose();
  }
}

// A seamlessly tileable water normal map built from sine waves
// with whole-number wave vectors, so the scene needs no texture
// files and the tile edges line up exactly.
function makeWaterNormalTexture(size) {
  const data = new Uint8Array(size * size * 4);
  // [kx, ky, amplitude, phase] — kx/ky are cycles per tile
  const waves = [
    [2, 1, 1.0, 0.0], [-1, 3, 0.8, 1.3], [3, -2, 0.6, 2.1], [5, 2, 0.4, 0.7],
    [-4, 5, 0.3, 4.2], [7, -3, 0.22, 3.3], [-6, -7, 0.15, 5.1], [9, 8, 0.1, 1.9],
    [-11, 6, 0.08, 2.7], [13, -10, 0.06, 0.4]
  ];
  const strength = 0.02;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      for (const [kx, ky, a, p] of waves) {
        const c = Math.cos(2 * Math.PI * (kx * x + ky * y) / size + p) * a * 2 * Math.PI;
        dx += c * kx; dy += c * ky;
      }
      const nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      data[i]     = ((nx / l) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Rough DDG silhouette: 155 m hull, superstructure, mast, funnels,
// gun. Bow points to -Z. Replaced by a real model in task #7.
function buildPlaceholderDestroyer() {
  const g = new THREE.Group();
  const grey = new THREE.MeshStandardMaterial({ color: 0x7d8790, roughness: 0.7, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.8, metalness: 0.2 });
  const deck = new THREE.MeshStandardMaterial({ color: 0x4b5258, roughness: 0.9 });

  // Hull: plan-view outline extruded downward
  const L = 155, B = 20;
  const shape = new THREE.Shape();
  shape.moveTo(0, -L / 2);                         // bow tip
  shape.quadraticCurveTo(B * 0.5, -L * 0.18, B / 2, L * 0.1);
  shape.lineTo(B * 0.45, L / 2);                   // transom
  shape.lineTo(-B * 0.45, L / 2);
  shape.lineTo(-B / 2, L * 0.1);
  shape.quadraticCurveTo(-B * 0.5, -L * 0.18, 0, -L / 2);
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false });
  hullGeo.rotateX(Math.PI / 2);                    // extrude down from deck level
  hullGeo.translate(0, 6, 0);
  const hull = new THREE.Mesh(hullGeo, [deck, grey]);
  g.add(hull);

  const box = (w, h, d, x, y, z, m = grey) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    g.add(b);
    return b;
  };
  box(14, 9, 26, 0, 10.5, -14);                    // forward superstructure
  box(10, 5, 8, 0, 17.5, -17);                     // bridge / SPY-1 block
  box(12, 7, 22, 0, 9.5, 18);                      // aft superstructure + hangar
  box(3.5, 9, 4, 0, 18, 6, dark);                  // funnel 1
  box(3.5, 9, 4, 0, 16, 22, dark);                 // funnel 2
  box(8, 0.8, 9, 0, 6.4, -40, dark);               // forward VLS
  box(8, 0.8, 12, 0, 6.4, 34, dark);               // aft VLS

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 18, 8), dark);
  mast.position.set(0, 28, -12);
  g.add(mast);

  const turret = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 3, 12), grey);
  turret.position.set(0, 7.5, -55);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 9, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.4, -5);
  turret.add(barrel);
  g.add(turret);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
