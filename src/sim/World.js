// ═══════════════════════════════════════════════════════════════
//  WORLD — the whole simulation. Owns every entity and advances
//  them in fixed steps. Knows nothing about Three.js, the DOM or
//  the screen: it can run in a test at thousands of times real
//  speed, and its entire state saves to JSON.
//
//  Rules:
//   - Only step() changes state. Outside code sends orders with
//     command(); they are applied at the start of the next step,
//     in order. Same commands + same steps = same result.
//   - Entity state is plain data (numbers, strings, arrays).
//   - Each entity keeps `prev`, its pose before the last step,
//     so the renderer can interpolate between steps.
// ═══════════════════════════════════════════════════════════════
import { SHIP_TYPES } from './shipTypes.js';
import { createShipState, stepShip, orderSpeed, orderHeading, orderRudder } from './ShipPhysics.js';

export const SAVE_VERSION = 1;

const ORDERS = {
  speed:   (e, spec, c) => orderSpeed(e.phys, spec, c.kts),
  heading: (e, spec, c) => orderHeading(e.phys, spec, c.deg),
  rudder:  (e, spec, c) => orderRudder(e.phys, spec, c.deg)
};

export class World {
  constructor() {
    this.time = 0;          // simulated seconds
    this.tick = 0;          // steps taken
    this.nextId = 1;
    this.entities = [];     // ordered: iteration order is part of determinism
    this._queue = [];       // pending commands
    this.events = [];       // what happened during the last step
  }

  // ── Entities ───────────────────────────────────────────────
  addShip({ type = 'ddg', name = '', faction = 'neutral', x = 0, y = 0, hdg = 0, speed = 0 } = {}) {
    if (!SHIP_TYPES[type]) throw new Error(`Unknown ship type "${type}"`);
    const phys = createShipState({ x, y, hdg, speed });
    const e = {
      id: this.nextId++,
      kind: 'ship',
      type, name, faction,
      phys,
      prev: { x: phys.x, y: phys.y, hdg: phys.hdg }
    };
    this.entities.push(e);
    this.events.push({ type: 'spawned', id: e.id });
    return e.id;
  }

  get(id) { return this.entities.find((e) => e.id === id) || null; }
  specOf(e) { return SHIP_TYPES[e.type]; }

  // ── Orders ─────────────────────────────────────────────────
  /** Queue an order, e.g. { id, order: 'speed', kts: 20 }. */
  command(cmd) {
    if (!ORDERS[cmd.order]) throw new Error(`Unknown order "${cmd.order}"`);
    this._queue.push(cmd);
  }

  // ── Step ───────────────────────────────────────────────────
  step(dt) {
    this.events = [];
    for (const cmd of this._queue) {
      const e = this.get(cmd.id);
      if (e) ORDERS[cmd.order](e, this.specOf(e), cmd);
    }
    this._queue.length = 0;

    for (const e of this.entities) {
      const p = e.phys;
      e.prev.x = p.x; e.prev.y = p.y; e.prev.hdg = p.hdg;
      if (e.kind === 'ship') stepShip(p, this.specOf(e), dt);
    }
    this.time += dt;
    this.tick++;
  }

  // ── Save / load ────────────────────────────────────────────
  snapshot() {
    return JSON.parse(JSON.stringify({
      version: SAVE_VERSION,
      time: this.time,
      tick: this.tick,
      nextId: this.nextId,
      entities: this.entities,
      queue: this._queue
    }));
  }

  static restore(snap) {
    if (snap.version !== SAVE_VERSION) throw new Error(`Unsupported save version ${snap.version}`);
    const w = new World();
    const copy = JSON.parse(JSON.stringify(snap));
    w.time = copy.time;
    w.tick = copy.tick;
    w.nextId = copy.nextId;
    w.entities = copy.entities;
    w._queue = copy.queue;
    return w;
  }
}
