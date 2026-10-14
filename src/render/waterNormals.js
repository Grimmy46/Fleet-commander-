import * as THREE from 'three';

// A seamlessly tileable water normal map built from sine waves
// with whole-number wave vectors, so the scene needs no texture
// files and the tile edges line up exactly.
export function makeWaterNormalTexture(size) {
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

