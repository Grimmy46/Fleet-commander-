// Placeholder destroyer model, replaced by a real model in task #7.
import * as THREE from 'three';

// Rough DDG silhouette: 155 m hull, superstructure, mast, funnels,
// gun. Bow points to -Z. Replaced by a real model in task #7.
export function buildPlaceholderDestroyer() {
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
