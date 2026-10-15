// ═══════════════════════════════════════════════════════════════
//  ENGINE — owns the WebGL renderer, the loop and the active scene
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { GameLoop } from './GameLoop.js';

// Cap the backing store. Beyond ~2.6M pixels the gain is
// invisible and the fill cost is not (carried over from 0.14).
const MAX_PIXELS = 2600000;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true    // clean depth from 120 m to 90 km zoom
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.55;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = null;
    this.loop = new GameLoop({
      step: 1 / 60,
      update: (dt) => this.scene && this.scene.update(dt),
      render: (alpha, realDt) => {
        if (!this.scene) return;
        this.scene.render(alpha, realDt);
        this.renderer.render(this.scene.root, this.scene.camera);
      }
    });

    this._onResize = this.resize.bind(this);
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  setScene(scene) {
    if (this.scene && this.scene.dispose) this.scene.dispose();
    this.scene = scene;
    scene.init(this);
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / (w * h));
    dpr = Math.max(0.75, dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    if (this.scene && this.scene.camera) {
      this.scene.camera.aspect = w / h;
      this.scene.camera.updateProjectionMatrix();
    }
  }

  start() { this.loop.start(); }

  // Snapshot for the debug overlay and the automated test
  stats() {
    const info = this.renderer.info;
    return {
      frames: this.loop.frames,
      ticks: this.loop.ticks,
      simTime: this.loop.simTime,
      timeScale: this.loop.timeScale,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      pixelRatio: this.renderer.getPixelRatio(),
      webgl: this.renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1'
    };
  }
}
