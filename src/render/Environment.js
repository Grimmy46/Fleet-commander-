// ═══════════════════════════════════════════════════════════════
//  ENVIRONMENT — sky, sun, ambient light, ocean. Placeholder until
//  task #4 (real ocean and coastlines).
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { makeWaterNormalTexture } from './waterNormals.js';

const OCEAN_SIZE = 400000;    // metres: covers the view at maximum zoom
const OCEAN_REPEAT = 2250;    // normal-map tiles across the ocean (~178 m each)
const FOG_BASE = 0.00011;
const TILE = OCEAN_SIZE / OCEAN_REPEAT;

export class Environment {
  constructor(renderer, root) {
    this.root = root;
    root.fog = new THREE.FogExp2(0x9fb4c8, FOG_BASE);

    // Sky, late-afternoon sun low in the south-west
    const sky = new Sky();
    sky.scale.setScalar(50000);       // must stay inside camera.far (≥ 60 km)
    const u = sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.85;
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(
      1, THREE.MathUtils.degToRad(90 - 18), THREE.MathUtils.degToRad(215));
    u.sunPosition.value.copy(this.sunDir);
    this.sky = sky;
    root.add(sky);

    // Bake the sky into an environment map for reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const skyScene = new THREE.Scene();
    skyScene.add(sky.clone());
    this.envMap = pmrem.fromScene(skyScene).texture;
    root.environment = this.envMap;
    pmrem.dispose();

    const sun = new THREE.DirectionalLight(0xffe2c0, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = -250; s.right = 250; s.top = 250; s.bottom = -250; s.near = 100; s.far = 5000;
    this.sun = sun;
    root.add(sun, sun.target);
    root.add(new THREE.HemisphereLight(0xbcd4ec, 0x0b2236, 0.6));

    // Ocean
    this.waterNormals = makeWaterNormalTexture(256);
    this.waterNormals.wrapS = this.waterNormals.wrapT = THREE.RepeatWrapping;
    this.waterNormals.repeat.set(OCEAN_REPEAT, OCEAN_REPEAT);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d3550, roughness: 0.48, metalness: 0.0,
      normalMap: this.waterNormals, normalScale: new THREE.Vector2(0.2, 0.2),
      envMapIntensity: 0.45
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE), mat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.receiveShadow = true;
    root.add(this.ocean);
  }

  /**
   * Keep ocean and shadows centred on the camera focus (metres),
   * the sky around the camera, and thin the fog as the camera
   * zooms out so the tactical view stays clear.
   */
  update(focusX, focusZ, t, camera, camDist) {
    // Snap the ocean to whole texture tiles so the pattern doesn't slide
    this.ocean.position.set(Math.round(focusX / TILE) * TILE, 0, Math.round(focusZ / TILE) * TILE);
    this.sky.position.copy(camera.position);
    this.root.fog.density = FOG_BASE * THREE.MathUtils.clamp(1500 / camDist, 0.02, 1);
    this.waterNormals.offset.set(t * 0.004, t * 0.0025);

    this.sun.position.set(focusX, 0, focusZ).addScaledVector(this.sunDir, 2000);
    this.sun.target.position.set(focusX, 0, focusZ);
    this.sun.target.updateMatrixWorld();
  }

  dispose() {
    this.waterNormals.dispose();
    this.envMap.dispose();
  }
}
