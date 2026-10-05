// ═══════════════════════════════════════════════════════════════
//  SCENARIOS — per-mission regions, spawns, and objectives
// ═══════════════════════════════════════════════════════════════

// ── REGIONS ───────────────────────────────────────────────────
const REGIONS = {

  // Open Atlantic off Cape Canaveral. Coast on the west edge only.
  florida: {
    id: 'florida',
    name: 'ATLANTIC TEST RANGE',
    subtitle: 'Cape Canaveral OPAREA',
    originLat: 28.20, originLon: -80.85,
    spanLat: 1.60, spanLon: 1.70,
    land: [
      { name: 'FLORIDA', country: 'USA',
        coords: [
          [29.80,-81.30],[29.60,-81.20],[29.40,-81.10],[29.20,-81.02],
          [29.00,-80.94],[28.80,-80.82],[28.62,-80.72],[28.46,-80.60],
          [28.40,-80.52],[28.32,-80.58],[28.24,-80.62],[28.20,-80.70],
          [28.20,-81.30]
        ]
      },
      { name: 'MERRITT ISLAND', country: '',
        coords: [
          [28.72,-80.70],[28.66,-80.62],[28.58,-80.58],[28.52,-80.62],
          [28.56,-80.72],[28.64,-80.76]
        ]
      }
    ],
    ownStart: { lat: 28.62, lon: -80.28, hdg: 95 },
    depthMax: 200,
    ambient: 'clear'
  },

  // Deep South Atlantic west of Cape Agulhas. No land at all.
  southatlantic: {
    id: 'southatlantic',
    name: 'SOUTH ATLANTIC',
    subtitle: '180 nm west of Cape Agulhas',
    originLat: -35.90, originLon: 13.10,
    spanLat: 1.70, spanLon: 2.00,
    land: [],
    ownStart: { lat: -34.85, lon: 14.30, hdg: 250 },
    depthMax: 3000,
    ambient: 'overcast'
  },

  // Outer islands north of Mauritius — the relief run.
  mauritius: {
    id: 'mauritius',
    name: 'MASCARENE BASIN',
    subtitle: 'Outer islands, north of Mauritius',
    originLat: -20.60, originLon: 56.90,
    spanLat: 1.30, spanLon: 1.40,
    land: [
      { name: 'ÎLE PLATE', country: 'MAURITIUS',
        coords: [[-19.88,57.62],[-19.85,57.66],[-19.87,57.70],[-19.91,57.71],
                 [-19.94,57.68],[-19.93,57.63]] },
      { name: 'ÎLE RONDE', country: 'MAURITIUS',
        coords: [[-19.68,57.76],[-19.66,57.79],[-19.69,57.81],[-19.71,57.78]] }
    ],
    ownStart: { lat: -20.15, lon: 57.35, hdg: 40 },
    depthMax: 1200, ambient: 'clear'
  },

  // Gulf of Aden — piracy response.
  aden: {
    id: 'aden',
    name: 'GULF OF ADEN',
    subtitle: 'Internationally Recommended Transit Corridor',
    originLat: 12.10, originLon: 48.00,
    spanLat: 1.40, spanLon: 1.50,
    land: [
      { name: 'SOMALI COAST', country: 'SOMALIA',
        coords: [[12.14,48.00],[12.20,48.35],[12.16,48.70],[12.10,49.10],
                 [12.10,48.00]] }
    ],
    ownStart: { lat: 12.66, lon: 48.30, hdg: 250 },
    depthMax: 2000, ambient: 'haze'
  },

  // Gulf of Oman — the escort finale, with a coastline to the north.
  oman: {
    id: 'oman',
    name: 'GULF OF OMAN',
    subtitle: 'Approaches to the Strait of Hormuz',
    originLat: 24.20, originLon: 57.20,
    spanLat: 1.60, spanLon: 1.70,
    land: [
      { name: 'MAKRAN COAST', country: '',
        coords: [[25.80,57.20],[25.72,57.55],[25.66,57.90],[25.74,58.25],
                 [25.80,58.60],[25.80,58.90],[25.80,57.20]] },
      { name: 'RAS AL HADD', country: 'OMAN',
        coords: [[24.30,58.55],[24.24,58.75],[24.20,58.90],[24.20,58.55]] }
    ],
    ownStart: { lat: 24.95, lon: 57.60, hdg: 55 },
    depthMax: 3000, ambient: 'haze'
  },

  // The existing strait, rebuilt from the same real coordinates.
  hormuz: {
    id: 'hormuz',
    name: 'STRAIT OF HORMUZ',
    subtitle: 'Iran / Oman',
    originLat: 25.95, originLon: 55.60,
    spanLat: 1.45, spanLon: 1.35,
    land: null,   // filled below from geo.js LANDMASSES
    tss: null,    // filled below
    ownStart: { lat: 26.52, lon: 56.28, hdg: 55 },
    depthMax: 80,
    ambient: 'haze'
  }
};

// Reuse the real Hormuz data already defined in geo.js
if (typeof LANDMASSES !== 'undefined') REGIONS.hormuz.land = LANDMASSES;
if (typeof TSS !== 'undefined') REGIONS.hormuz.tss = TSS;

// ── OBJECTIVE ─────────────────────────────────────────────────
class Objective {
  constructor(id, text, opts = {}) {
    this.id = id;
    this.text = text;
    this.done = false;
    this.failed = false;
    this.optional = !!opts.optional;
    this.hidden = !!opts.hidden;
    this.progress = opts.progress || null;  // {cur,max}
    this.hint = opts.hint || null;
  }
}

// ── BASE SCENARIO ─────────────────────────────────────────────
class Scenario {
  constructor(mission) {
    this.mission = mission;
    this.objectives = [];
    this.state = 'running';   // running | complete | failed
    this.elapsed = 0;
    this.tutorial = [];       // queued tutorial prompts
    this.activePrompt = null;
    this.promptT = 0;
    this.result = null;
  }
  obj(id) { return this.objectives.find(o => o.id === id); }
  complete(id) {
    const o = this.obj(id);
    if (o && !o.done) {
      o.done = true;
      if (typeof Audio !== 'undefined') Audio.lockFull();
      return true;
    }
    return false;
  }
  allDone() { return this.objectives.filter(o => !o.optional).every(o => o.done); }
  prompt(text, sub) {
    this.activePrompt = { text, sub, t: 0 };
    this.promptT = 0;
  }
  // Contextual guidance shown persistently in the mission panel.
  // Override per scenario. Returns { heading, body, keys[] }.
  guidance(G) {
    return { heading: 'STAND BY', body: 'Await orders.', keys: [] };
  }
  // Short status line for the panel header
  statusLine(G) { return ''; }
  update(dt, ctxObj) {}
  onEvent(evt, data) {}
}

// ── MISSION 1: DRONE INTERCEPT (tutorial) ─────────────────────
class DroneScenario extends Scenario {
  constructor(mission) {
    super(mission);
    this.region = REGIONS.florida;
    this.waveIdx = 0;
    this.waveTimer = 8;
    this.dronesKilled = 0;
    this.dronesLeaked = 0;
    this.totalDrones = 9;
    this.phase = 'transit';   // transit -> range -> engage -> done
    this.rangeReached = false;
    this.introShown = false;

    this.objectives = [
      new Objective('reach', 'Proceed to the range',
        { hint: 'Right-click the water to steer.  W / S adjust speed.  Press 3 or 4 to compress time.' }),
      new Objective('detect', 'Detect and designate the first drone',
        { hint: 'Hold the cursor on a contact for half a second.' }),
      new Objective('kill', 'Destroy target drones',
        { progress: { cur: 0, max: 9 } })
    ];

    this.waves = [
      { n: 1, mach: 0.55, delay: 0,  note: 'Single drone, subsonic. Take your time.' },
      { n: 2, mach: 0.60, delay: 55, note: 'Two inbound. You may designate both before firing.' },
      { n: 3, mach: 0.70, delay: 55, note: 'Three now. Watch the salvo cap.' },
      { n: 3, mach: 0.85, delay: 50, note: 'Final wave. Faster profile.' }
    ];
  }

  rangeCentre() {
    return ll2nm(28.63, -80.16);
  }

  update(dt, G) {
    this.elapsed += dt;
    const { own, board } = G;

    if (!this.introShown) {
      this.introShown = true;
      this.prompt('MAKE FOR THE RANGE',
        'Right-click ahead to steer.  W / S for speed.  Keys 1-5 compress time.');
      G.log('RANGE CONTROL: Cleared into the pattern. Report when on station.', 'ok');
    }

    // Objective 1 — get to the range
    if (!this.rangeReached) {
      const c = this.rangeCentre();
      const d = Math.hypot(own.x - c.x, own.y - c.y);
      if (d < 4.5 && own.speed >= 6) {
        this.rangeReached = true;
        this.complete('reach');
        this.phase = 'engage';
        this.waveTimer = 6;
        G.log('RANGE CONTROL: On station. Drone launch in 6 seconds.', 'ok');
        this.prompt('WEAPONS FREE', 'Target drones only. Engage as they appear.');
      }
    }

    // Wave spawning
    if (this.phase === 'engage' && this.waveIdx < this.waves.length) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        const w = this.waves[this.waveIdx];
        const brg = 60 + Math.random() * 60;
        board.spawnWave(w.n, {
          rangeNm: 22, mach: w.mach, stagger: 3.0, spread: 30,
          bearing: brg, altM: 40, name: 'DRONE', airframe: 'drone'
        });
        G.log(`RANGE CONTROL: ${w.n} drone${w.n>1?'s':''} away, bearing ${Math.round(brg)}.`, 'warn');
        if (w.note) this.prompt(`WAVE ${this.waveIdx + 1} OF ${this.waves.length}`, w.note);
        this.waveIdx++;
        this.waveTimer = this.waves[this.waveIdx] ? this.waves[this.waveIdx].delay : 999;
      }
    }

    // Track kills
    const k = board.killed;
    if (k !== this.dronesKilled) {
      this.dronesKilled = k;
      const o = this.obj('kill');
      o.progress.cur = k;
      if (!this.obj('detect').done) this.complete('detect');
      if (k >= this.totalDrones) {
        this.complete('kill');
      }
    }
    this.dronesLeaked = board.leakers;

    // Completion — all waves fired and the sky is clear
    if (this.phase === 'engage' && this.waveIdx >= this.waves.length &&
        board.threats.length === 0 && this.state === 'running') {
      this.state = 'complete';
      this.result = {
        killed: this.dronesKilled,
        leaked: this.dronesLeaked,
        total: this.totalDrones,
        time: this.elapsed
      };
    }
  }

  onEvent(evt, data, G) {
    if (evt === 'lock' && !this.obj('detect').done) {
      this.complete('detect');
    }
  }

  guidance(G) {
    const { own, board, fc } = G;

    if (!this.rangeReached) {
      const c = this.rangeCentre();
      const d = Math.hypot(own.x - c.x, own.y - c.y);
      const brg = (Math.atan2(c.x - own.x, -(c.y - own.y)) * 180 / Math.PI + 360) % 360;
      const eta = own.speed > 1 ? (d / own.speed) * 60 : null;
      return {
        heading: 'MAKE FOR THE RANGE',
        body: `The exercise area is ${d.toFixed(1)} nm away on bearing ` +
              `${String(Math.round(brg)).padStart(3,'0')}. Drones launch once you are on station.`,
        stat: eta !== null ? `ETA ${eta.toFixed(0)} min at ${own.speed.toFixed(0)} kts`
                           : 'DEAD IN THE WATER — increase speed',
        keys: [
          ['RIGHT-CLICK', 'steer toward the marked zone'],
          ['W / S', 'increase or decrease speed'],
          ['A / D', 'hold for rudder'],
          ['3 or 4', 'compress time to close faster']
        ],
        marker: { x: c.x, y: c.y, r: 4.5, label: 'EXERCISE AREA' }
      };
    }

    const live = board.detectedThreats.length;
    const pending = this.waves.length - this.waveIdx;

    if (live === 0) {
      return {
        heading: pending > 0 ? 'AWAITING NEXT WAVE' : 'RANGE CLEAR',
        body: pending > 0
          ? `Range control is preparing wave ${this.waveIdx + 1} of ${this.waves.length}. ` +
            `Select a weapon now so you are ready when they appear.`
          : 'All waves complete. Stand by for range control to secure the exercise.',
        stat: pending > 0 ? `NEXT LAUNCH IN ${Math.max(0, this.waveTimer).toFixed(0)}s` : '',
        keys: pending > 0 ? [
          ['Z', 'arm SM-2 — the workhorse'],
          ['C', 'arm ESSM — short range'],
          ['H', 'launch the Seahawk to see further']
        ] : []
      };
    }

    if (!fc.weapon) {
      return {
        heading: 'SELECT A WEAPON',
        body: `${live} drone${live>1?'s':''} inbound. You cannot designate a target ` +
              `until a weapon is armed. SM-2 is the right choice here.`,
        stat: 'WEAPONS TIGHT',
        keys: [
          ['Z', 'arm SM-2'],
          ['C', 'arm ESSM'],
          ['click', 'or click a weapon in the left panel']
        ]
      };
    }

    if (fc.locked.length === 0) {
      return {
        heading: 'DESIGNATE TARGETS',
        body: `Hold the cursor steady on a red drone marker for half a second. ` +
              `An acquisition ring closes, then it locks. Sweep across several ` +
              `to build a salvo.`,
        stat: `${fc.weapon.toUpperCase()} ARMED  ·  0/${fc.cap} DESIGNATED`,
        keys: [
          ['HOVER 0.5s', 'designate a target'],
          ['RIGHT-CLICK', 'release a designated track'],
          ['X', 'clear the whole solution']
        ]
      };
    }

    return {
      heading: 'CLEARED TO FIRE',
      body: `${fc.locked.length} target${fc.locked.length>1?'s':''} designated. ` +
            `Press SPACE to launch, or keep designating up to ${fc.cap}.`,
      stat: `${fc.locked.length}/${fc.cap} DESIGNATED  ·  ${fc.doubleSalvo?'DOUBLE':'SINGLE'} SALVO`,
      keys: [
        ['SPACE', 'fire the salvo'],
        ['V', 'toggle single / double'],
        ['X', 'clear and start over']
      ]
    };
  }

  statusLine(G) {
    if (!this.rangeReached) return 'IN TRANSIT';
    if (this.waveIdx >= this.waves.length && G.board.threats.length === 0) return 'COMPLETE';
    return `WAVE ${Math.min(this.waveIdx, this.waves.length)} OF ${this.waves.length}`;
  }
}

// ── MISSION 2: SEARCH AND RESCUE ──────────────────────────────
// Simplified per design: heat map narrows it, then a block search.
class SarScenario extends Scenario {
  constructor(mission) {
    super(mission);
    this.region = REGIONS.southatlantic;
    this.phase = 'brief';       // brief -> search -> found -> recover
    this.searchCells = [];
    this.cellSize = 4.0;        // nm per cell
    this.survivor = null;
    this.datum = null;
    this.drifted = null;
    this.found = false;
    this.recovered = false;
    this.survivalMin = 260;     // minutes of survival time remaining
    this.heloOut = false;
    this.helo = null;
    this.cellsSearched = 0;
    this.hoist = 0;            // 0..1 progress of the rescue hoist
    this.hoistBy = null;       // 'HELO' | 'SHIP'
    this.heloCells = 0;        // cells the aircraft cleared

    this.objectives = [
      new Objective('grid', 'Establish a search grid over the datum',
        { hint: 'Press G to lay a grid. Drifted datum is marked.' }),
      new Objective('search', 'Search cells until the survivor is located',
        { progress: { cur: 0, max: 12 } }),
      new Objective('recover', 'Recover the survivor',
        { hint: 'Ship: close within 1 nm under 8 knots. Helo: hold overhead to hoist.' })
    ];
  }

  init(G) {
    // Datum = reported position. Real position has drifted downwind.
    this.datum = ll2nm(-34.90, 13.95);
    const driftBrg = 118 * Math.PI / 180;   // Agulhas current sets SE
    const driftNm = 6.5;
    this.drifted = {
      x: this.datum.x + Math.sin(driftBrg) * driftNm,
      y: this.datum.y - Math.cos(driftBrg) * driftNm
    };
    // Survivor sits somewhere near the drifted datum
    const a = Math.random() * Math.PI * 2, r = Math.random() * 5.5;
    this.survivor = {
      x: this.drifted.x + Math.cos(a) * r,
      y: this.drifted.y + Math.sin(a) * r
    };
    this.buildGrid();
    G.log('CIC: Datum plotted from the distress relay.', 'info');
    G.log('CIC: Agulhas current sets 118 at 1.4 knots. Datum has drifted.', 'warn');
    this.prompt('SEARCH AND RESCUE',
      'The reported position is stale. Search downstream of the drift.');
  }

  buildGrid() {
    this.searchCells = [];
    const N = 4;   // 4x3 grid centred on the drifted datum
    const M = 3;
    const w = this.cellSize;
    const x0 = this.drifted.x - (N * w) / 2;
    const y0 = this.drifted.y - (M * w) / 2;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const cx = x0 + i * w + w / 2;
        const cy = y0 + j * w + w / 2;
        // Probability heat: gaussian falloff from the drifted datum.
        // A linear ramp never reached a convincing peak, so the map
        // gave no real guidance about where to look first.
        const d = Math.hypot(cx - this.drifted.x, cy - this.drifted.y);
        const sigma = w * 1.15;
        const p = Math.max(0.04, Math.exp(-(d * d) / (2 * sigma * sigma)));
        this.searchCells.push({
          x: x0 + i * w, y: y0 + j * w, w,
          cx, cy, prob: p, searched: false, label: `${String.fromCharCode(65+i)}${j+1}`
        });
      }
    }
    this.obj('search').progress.max = this.searchCells.length;
  }

  update(dt, G) {
    this.elapsed += dt;
    const { own } = G;

    if (this.phase === 'brief') {
      this.phase = 'search';
      this.complete('grid');
    }

    // Survival clock
    this.survivalMin -= dt / 60;
    if (this.survivalMin <= 0 && !this.recovered && this.state === 'running') {
      this.state = 'failed';
      this.result = { recovered: false, reason: 'Survival window elapsed.' };
      return;
    }

    // Sweep cells. The ship uses lookouts and surface search;
    // the helicopter sees a much wider swathe from altitude and
    // covers ground roughly three times faster.
    const helo = G.helo;
    const searchers = [{ x: own.x, y: own.y, r: 3.2, by: 'SHIP' }];
    if (helo && helo.airborne && helo.altM > 200) {
      searchers.push({ x: helo.x, y: helo.y, r: 5.6, by: 'HELO' });
    }

    for (const c of this.searchCells) {
      if (c.searched) continue;
      const hit = searchers.find(s2 => Math.hypot(s2.x - c.cx, s2.y - c.cy) < s2.r);
      if (hit) {
        c.searched = true;
        c.by = hit.by;
        this.cellsSearched++;
        if (hit.by === 'HELO') this.heloCells++;
        this.obj('search').progress.cur = this.cellsSearched;
        // Is the survivor in this cell?
        if (this.survivor.x >= c.x && this.survivor.x < c.x + c.w &&
            this.survivor.y >= c.y && this.survivor.y < c.y + c.w) {
          this.found = true;
          this.complete('search');
          G.log(hit.by === 'HELO'
            ? 'SEAHAWK 01: Visual on the survivor. Person in the water.'
            : 'LOOKOUT: CONTACT — person in the water, bearing green!', 'alert');
          this.prompt('SURVIVOR SIGHTED',
            'Hoist with the helo, or bring the ship alongside under 8 knots.');
          if (typeof Audio !== 'undefined') Audio.lockOn();
        } else {
          G.log(`Cell ${c.label} searched — negative.`, 'info');
        }
      }
    }

    // ── RECOVERY ──
    // Two ways to do it. The helicopter is faster but needs to
    // hold a hover; the ship is slower but always available.
    if (this.found && !this.recovered) {
      const dShip = Math.hypot(own.x - this.survivor.x, own.y - this.survivor.y);
      const dHelo = helo && helo.airborne
        ? Math.hypot(helo.x - this.survivor.x, helo.y - this.survivor.y) : 999;

      // Helicopter hoist — must be within half a mile and slow
      const heloOverhead = helo && helo.airborne && dHelo < 0.5 && helo.speed < 30;
      if (heloOverhead) {
        if (this.hoistBy !== 'HELO') {
          this.hoistBy = 'HELO';
          G.log('SEAHAWK 01: Overhead. Rescue swimmer going down.', 'ok');
          this.prompt('HOIST IN PROGRESS', 'Hold the hover. Roughly forty seconds.');
        }
        this.hoist = Math.min(1, this.hoist + dt / 40);
      } else if (dShip < 1.0 && own.speed < 8) {
        if (this.hoistBy !== 'SHIP') {
          this.hoistBy = 'SHIP';
          G.log('BRIDGE: Alongside. Rigging the recovery net.', 'ok');
          this.prompt('RECOVERY IN PROGRESS', 'Hold station. Roughly a minute.');
        }
        this.hoist = Math.min(1, this.hoist + dt / 60);
      } else {
        // Drifted off — the hoist backs off rather than resetting
        if (this.hoistBy) this.hoist = Math.max(0, this.hoist - dt / 25);
        if (this.hoist <= 0) this.hoistBy = null;
        if (dShip < 1.0 && own.speed >= 8 && !this._slowWarn) {
          this._slowWarn = true;
          G.log('BRIDGE: Reduce speed below 8 knots to recover.', 'warn');
        }
      }

      if (this.hoist >= 1) {
        this.recovered = true;
        this.complete('recover');
        this.state = 'complete';
        this.result = {
          recovered: true,
          by: this.hoistBy,
          minutesLeft: Math.max(0, this.survivalMin),
          cellsSearched: this.cellsSearched,
          heloCells: this.heloCells,
          time: this.elapsed
        };
        G.log(this.hoistBy === 'HELO'
          ? 'SEAHAWK 01: Survivor recovered. Returning to the ship.'
          : 'BRIDGE: Survivor aboard. Corpsman attending.', 'ok');
      }
    }
  }

  guidance(G) {
    const { own } = G;
    if (this.recovered) {
      return { heading: 'SURVIVOR ABOARD', body: 'Well done.', stat: '', keys: [] };
    }
    if (this.found) {
      const helo = G.helo;
      const dShip = Math.hypot(own.x - this.survivor.x, own.y - this.survivor.y);
      const dHelo = helo && helo.airborne
        ? Math.hypot(helo.x - this.survivor.x, helo.y - this.survivor.y) : null;

      if (this.hoist > 0) {
        return {
          heading: this.hoistBy === 'HELO' ? 'HOISTING' : 'RECOVERING',
          body: this.hoistBy === 'HELO'
            ? 'Rescue swimmer is in the water. Hold the hover until the ' +
              'hoist completes.'
            : 'Recovery net is rigged. Hold station until they are aboard.',
          stat: `${Math.round(this.hoist * 100)}% COMPLETE`,
          keys: this.hoistBy === 'HELO'
            ? [['HOLD HERE', 'keep the helo hovering']]
            : [['S', 'keep speed under 8 kts']]
        };
      }

      if (helo && helo.airborne) {
        return {
          heading: 'HOIST OR COME ALONGSIDE',
          body: `Survivor located. The Seahawk can hoist them in about forty ` +
                `seconds — vector it overhead and hold. Or bring the ship ` +
                `alongside under eight knots.`,
          stat: `HELO ${dHelo.toFixed(1)} nm  ·  SHIP ${dShip.toFixed(1)} nm`,
          keys: [
            ['CLICK HELO', 'then click the survivor'],
            ['HOLD HERE', 'button to hover and hoist'],
            ['RIGHT-CLICK', 'or steer the ship there']
          ],
          marker: { x: this.survivor.x, y: this.survivor.y, r: 0.5, label: 'SURVIVOR' }
        };
      }

      return {
        heading: 'CLOSE AND RECOVER',
        body: `Survivor in sight ${dShip.toFixed(1)} nm away. Come alongside and ` +
              `reduce to under eight knots. Launching the Seahawk would be faster.`,
        stat: own.speed >= 8 ? `TOO FAST — ${own.speed.toFixed(0)} kts`
                             : `${own.speed.toFixed(0)} kts — ready`,
        keys: [
          ['H', 'launch the Seahawk — much faster'],
          ['RIGHT-CLICK', 'steer to the survivor'],
          ['S', 'reduce speed below 8 kts']
        ],
        marker: { x: this.survivor.x, y: this.survivor.y, r: 0.5, label: 'SURVIVOR' }
      };
    }
    const next = this.searchCells.filter(c => !c.searched)
                   .sort((a,b) => b.prob - a.prob)[0];
    const rem = this.searchCells.filter(c => !c.searched).length;
    return {
      heading: 'SEARCH THE GRID',
      body: `The reported position is stale — the current has carried them ` +
            `southeast. Sail through a cell to search it. Work the highest ` +
            `probability cells first.`,
      stat: next ? `BEST CELL: ${next.label} at ${Math.round(next.prob*100)}%  ·  ${rem} unsearched`
                 : `${rem} cells remaining`,
      keys: [
        ['H', 'launch the Seahawk — searches 7x faster'],
        ['CLICK HELO', 'then click a cell to send it'],
        ['RIGHT-CLICK', 'steer the ship into a cell'],
        ['3 or 4', 'compress time while searching']
      ],
      marker: next ? { x: next.cx, y: next.cy, r: this.cellSize/2, label: 'HIGHEST PROBABILITY' } : null
    };
  }

  statusLine(G) {
    if (this.recovered) return 'RECOVERED';
    if (this.found) return 'SURVIVOR SIGHTED';
    return `${this.cellsSearched}/${this.searchCells.length} CELLS`;
  }
}


// ═══════════════════════════════════════════════════════════════
//  MISSION 3 — RELIEF RUN  (side mission, skippable)
//  Helicopter cargo. Pick pallets off a supply ship, fly them to
//  the island, come back. Every trip costs fuel and clock.
// ═══════════════════════════════════════════════════════════════
class CargoScenario extends Scenario {
  constructor(mission) {
    super(mission);
    this.region = REGIONS.mauritius;
    this.pallets = 3;
    this.delivered = 0;
    this.carrying = 0;
    this.load = 0;            // 0..1 winch progress
    this.loadMode = null;     // 'PICKUP' | 'DROP'
    this.supply = null;       // {x,y} supply ship
    this.island = null;       // {x,y} drop zone
    this.objectives = [
      new Objective('launch', 'Launch the Seahawk',
        { hint: 'Press H. The ship cannot deliver this cargo.' }),
      new Objective('deliver', 'Deliver relief pallets to the island',
        { progress: { cur: 0, max: 3 } })
    ];
  }

  init(G) {
    this.supply = ll2nm(-19.95, 57.55);
    this.island = ll2nm(-19.88, 57.66);
    G.log('CIC: MV KAROO STAR is holding station with the relief pallets.', 'info');
    G.log('CIC: Drop zone is the airstrip on Ile Plate.', 'info');
    this.prompt('RELIEF RUN',
      'Three pallets. Winch each off the supply ship, fly it in, set it down.');
  }

  update(dt, G) {
    this.elapsed += dt;
    const helo = G.helo;
    if (!helo) return;

    if (helo.airborne && !this.obj('launch').done) {
      this.complete('launch');
      G.log('SEAHAWK 01: Airborne. Proceeding to the supply ship.', 'ok');
    }
    if (!helo.airborne) { this.load = 0; this.loadMode = null; return; }

    const hovering = helo.speed < 30;
    const dSup = Math.hypot(helo.x - this.supply.x, helo.y - this.supply.y);
    const dIsl = Math.hypot(helo.x - this.island.x, helo.y - this.island.y);

    if (this.carrying === 0 && dSup < 0.6 && hovering && this.delivered < this.pallets) {
      if (this.loadMode !== 'PICKUP') {
        this.loadMode = 'PICKUP';
        G.log('SEAHAWK 01: Over the supply ship. Rigging the load.', 'ok');
      }
      this.load = Math.min(1, this.load + dt / 25);
      if (this.load >= 1) {
        this.carrying = 1; this.load = 0; this.loadMode = null;
        G.log('SEAHAWK 01: Pallet is on the hook. Outbound to the island.', 'ok');
        this.prompt('CARGO ABOARD', 'Fly to the island and hold to set it down.');
      }
    } else if (this.carrying === 1 && dIsl < 0.7 && hovering) {
      if (this.loadMode !== 'DROP') {
        this.loadMode = 'DROP';
        G.log('SEAHAWK 01: Over the drop zone. Lowering.', 'ok');
      }
      this.load = Math.min(1, this.load + dt / 20);
      if (this.load >= 1) {
        this.carrying = 0; this.load = 0; this.loadMode = null;
        this.delivered++;
        this.obj('deliver').progress.cur = this.delivered;
        G.log(`SEAHAWK 01: Pallet ${this.delivered} of ${this.pallets} delivered.`, 'ok');
        if (typeof Audio !== 'undefined') Audio.lockFull();
        if (this.delivered >= this.pallets) {
          this.complete('deliver');
          this.state = 'complete';
          this.result = { delivered: this.delivered, total: this.pallets,
                          time: this.elapsed };
        }
      }
    } else {
      if (this.loadMode) this.load = Math.max(0, this.load - dt / 12);
      if (this.load <= 0) this.loadMode = null;
    }
  }

  guidance(G) {
    const helo = G.helo;
    if (!helo || !helo.airborne) {
      return { heading: 'LAUNCH THE SEAHAWK',
        body: 'The pallets go by air. Nothing here needs the ship.',
        stat: `${this.delivered} of ${this.pallets} delivered`,
        keys: [['H', 'launch the aircraft']] };
    }
    if (this.load > 0) {
      return { heading: this.loadMode === 'PICKUP' ? 'RIGGING THE LOAD' : 'LOWERING',
        body: 'Hold the hover until the winch finishes.',
        stat: `${Math.round(this.load * 100)}% COMPLETE`,
        keys: [['HOLD HERE', 'keep it steady']] };
    }
    if (this.carrying) {
      const d = Math.hypot(helo.x - this.island.x, helo.y - this.island.y);
      return { heading: 'FLY IT IN',
        body: 'Pallet is on the hook. Set down over the island drop zone.',
        stat: `${d.toFixed(1)} nm to the island  ·  fuel ${Math.round(helo.fuelPct*100)}%`,
        keys: [['CLICK HELO', 'then click the island'],
               ['HOLD HERE', 'to lower the load']],
        marker: { x: this.island.x, y: this.island.y, r: 0.7, label: 'DROP ZONE' } };
    }
    const d = Math.hypot(helo.x - this.supply.x, helo.y - this.supply.y);
    return { heading: 'COLLECT A PALLET',
      body: 'Hover over MV KAROO STAR and hold while the load is rigged.',
      stat: `${d.toFixed(1)} nm to the supply ship  ·  ${this.delivered}/${this.pallets} done`,
      keys: [['CLICK HELO', 'then click the supply ship'],
             ['HOLD HERE', 'to winch a pallet up']],
      marker: { x: this.supply.x, y: this.supply.y, r: 0.6, label: 'SUPPLY SHIP' } };
  }

  statusLine(G) { return `${this.delivered}/${this.pallets} PALLETS`; }
}

// ── FACTORY ───────────────────────────────────────────────────
function makeScenario(mission) {
  switch (mission.id) {
    case 'm01_florida':      return new DroneScenario(mission);
    case 'm02_sar_capetown': return new SarScenario(mission);
    case 'm03_supply':       return new CargoScenario(mission);
    case 'm04_pirates':      return new PirateScenario(mission);
    case 'm05_hormuz':       return new EscortScenario(mission);
    default: {
      const s = new Scenario(mission);
      s.region = REGIONS.hormuz;
      s.objectives = [ new Objective('placeholder', 'Free engagement — no objectives yet') ];
      return s;
    }
  }
}



// ═══════════════════════════════════════════════════════════════
//  SKIFFS — small craft that close and attack
// ═══════════════════════════════════════════════════════════════
const SKIFF_STATE = { APPROACH:'CLOSING', ATTACK:'ATTACKING', FLEE:'BREAKING OFF', DEAD:'DESTROYED' };

class Skiff {
  constructor(x, y, target) {
    this.x = x; this.y = y;
    this.target = target;          // the vessel it is attacking
    this.hdg = 0;
    this.speed = 24 + Math.random() * 8;
    this.maxSpeed = this.speed;
    this.hp = 1;
    this.state = SKIFF_STATE.APPROACH;
    this.dead = false;
    this.damageDone = 0;
    this.trackNum = 0;
    this._fireT = 0;
    this.type = 'skiff';
    this.faction = 'hostile';
  }

  update(dt, ownship) {
    if (this.dead) return;
    const t = this.target;
    if (!t) return;

    const dx = t.x - this.x, dy = t.y - this.y;
    const d = Math.hypot(dx, dy);

    if (this.state === SKIFF_STATE.FLEE) {
      // Run for the coast
      this.hdg = (Math.atan2(-dx, dy) * 180 / Math.PI + 360) % 360;
      this.speed = this.maxSpeed;
    } else {
      this.hdg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      if (d < 0.35) {
        this.state = SKIFF_STATE.ATTACK;
        this.speed = Math.min(this.speed, t.speed + 4);
        // Sustained small-arms and RPG fire against the hull
        this._fireT += dt;
        if (this._fireT > 2.5) {
          this._fireT = 0;
          this.damageDone += 1;
          if (t.boardingProgress !== undefined) t.boardingProgress += 1;
        }
      } else {
        this.state = SKIFF_STATE.APPROACH;
        this.speed = this.maxSpeed;
      }
    }

    const step = (this.speed / 3600) * dt;
    const rad = this.hdg * Math.PI / 180;
    this.x += Math.sin(rad) * step;
    this.y -= Math.cos(rad) * step;
  }

  kill() { this.dead = true; this.state = SKIFF_STATE.DEAD; }

  // Distance at which the ship's gun can reliably hit
  rangeTo(s) { return Math.hypot(s.x - this.x, s.y - this.y); }
}

// A merchant under attack, which the player is protecting
class ProtectedVessel {
  constructor(x, y, hdg, name, type) {
    this.x = x; this.y = y; this.hdg = hdg;
    this.name = name;
    this.type = type || 'tanker';
    this.speed = 13;
    this.boardingProgress = 0;    // rises while skiffs are alongside
    // A boarding is not instant. The crew resists and reaches the
    // citadel. This gives the player a few minutes to break it up.
    this.boardingLimit = 260;
    this.taken = false;
    this.faction = 'friendly';
    this.hits = 0;
  }
  update(dt) {
    const rad = this.hdg * Math.PI / 180;
    const step = (this.speed / 3600) * dt;
    this.x += Math.sin(rad) * step;
    this.y -= Math.cos(rad) * step;
    if (this.boardingProgress >= this.boardingLimit) this.taken = true;
  }
  get boardingPct() {
    return Math.min(1, this.boardingProgress / this.boardingLimit);
  }
}

// ═══════════════════════════════════════════════════════════════
//  MISSION 4 — INTERDICTION
//  Skiffs are alongside a tanker. Get there before they board her.
// ═══════════════════════════════════════════════════════════════
class PirateScenario extends Scenario {
  constructor(mission) {
    super(mission);
    this.region = REGIONS.aden;
    this.skiffs = [];
    this.victim = null;
    this.killed = 0;
    this.fled = 0;
    this.total = 6;
    this.warned = false;
    this.objectives = [
      new Objective('close', 'Close on the tanker under attack',
        { hint: 'She cannot outrun them. Every minute counts.' }),
      new Objective('clear', 'Disable or drive off the attacking craft',
        { progress: { cur: 0, max: 6 } }),
      new Objective('save', 'Prevent the tanker being boarded')
    ];
  }

  init(G) {
    const v = ll2nm(12.62, 48.20);
    this.victim = new ProtectedVessel(v.x, v.y, 265, 'MV HELLAS TRIUMPH', 'tanker');
    for (let i = 0; i < this.total; i++) {
      const a = (200 + i * 22) * Math.PI / 180;
      const r = 3.5 + Math.random() * 3.0;
      this.skiffs.push(new Skiff(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r, this.victim));
      this.skiffs[i].trackNum = 8000 + i;
    }
    G.log('DISTRESS: MV HELLAS TRIUMPH, six small craft closing, request immediate assistance.', 'alert');
    G.log('CIC: Rules of engagement permit disabling fire against craft showing hostile intent.', 'warn');
    this.prompt('PIRACY IN PROGRESS',
      'Six skiffs on a loaded tanker. Close the range and break up the attack.');
    if (typeof Audio !== 'undefined') Audio.newContact();
  }

  update(dt, G) {
    this.elapsed += dt;
    const { own } = G;
    if (!this.victim) return;

    this.victim.update(dt);
    for (const s of this.skiffs) s.update(dt, own);

    const d = Math.hypot(own.x - this.victim.x, own.y - this.victim.y);
    if (d < 8 && !this.obj('close').done) {
      this.complete('close');
      G.log('CIC: Tanker in visual range. Skiffs are alongside her.', 'warn');
    }
    if (d < 14 && !this.warned) {
      this.warned = true;
      G.log('BRIDGE: Bridge-to-bridge warning issued. They are not breaking off.', 'warn');
    }

    // Gunfire and CIWS engage skiffs inside their envelope
    this.engageSkiffs(dt, G);

    const alive = this.skiffs.filter(s => !s.dead && s.state !== SKIFF_STATE.FLEE).length;
    this.obj('clear').progress.cur = this.total - alive;
    if (alive === 0 && !this.obj('clear').done) {
      this.complete('clear');
      this.complete('save');
      this.state = 'complete';
      this.result = { killed: this.killed, fled: this.fled,
                      boarding: Math.round(this.victim.boardingPct * 100),
                      time: this.elapsed };
      G.log('MV HELLAS TRIUMPH: Attackers driven off. Thank you, Spearpoint.', 'ok');
    }

    if (this.victim.taken && this.state === 'running') {
      this.state = 'failed';
      this.obj('save').failed = true;
      this.result = { recovered: false, killed: this.killed,
                      reason: 'The tanker was boarded.' };
      G.log('*** MV HELLAS TRIUMPH BOARDED — CREW TAKEN ***', 'alert');
    }
  }

  // The 5in gun and CIWS handle small craft; missiles are useless here
  engageSkiffs(dt, G) {
    const { own, fc } = G;
    if (!fc || !fc.weapon) return;
    const E = (typeof ENGAGE !== 'undefined') ? ENGAGE[fc.weapon] : null;
    if (!E || (fc.weapon !== 'gun' && fc.weapon !== 'ciws')) return;

    this._gunT = (this._gunT || 0) + dt;
    const cycle = fc.weapon === 'gun' ? 3.0 : 1.2;
    if (this._gunT < cycle) return;
    this._gunT = 0;

    const inRange = this.skiffs.filter(s => !s.dead && s.rangeTo(own) < E.rangeNm);
    if (!inRange.length) return;
    inRange.sort((a, b) => a.rangeTo(own) - b.rangeTo(own));
    const tgt = inRange[0];

    if (Math.random() < E.pk) {
      tgt.kill();
      this.killed++;
      G.log(`Skiff ${tgt.trackNum} disabled and dead in the water.`, 'ok');
      if (typeof Audio !== 'undefined') Audio.intercept();
      // Losing boats breaks their nerve
      const left = this.skiffs.filter(s => !s.dead && s.state !== SKIFF_STATE.FLEE);
      if (this.killed >= 3 && left.length && Math.random() < 0.5) {
        const runner = left[Math.floor(Math.random() * left.length)];
        runner.state = SKIFF_STATE.FLEE;
        this.fled++;
        G.log(`Skiff ${runner.trackNum} is breaking off and running for the coast.`, 'info');
      }
    } else {
      if (typeof Audio !== 'undefined') Audio.gunFire();
    }
  }

  guidance(G) {
    const { own, fc } = G;
    const d = Math.hypot(own.x - this.victim.x, own.y - this.victim.y);
    const alive = this.skiffs.filter(s => !s.dead && s.state !== SKIFF_STATE.FLEE).length;
    const pct = Math.round(this.victim.boardingPct * 100);

    if (d > 13) {
      return { heading: 'CLOSE THE RANGE',
        body: 'They are already alongside her. Your gun reaches 13 nm — ' +
              'missiles are no use against boats this small.',
        stat: `${d.toFixed(1)} nm out  ·  boarding ${pct}%`,
        keys: [['RIGHT-CLICK', 'steer to the tanker'],
               ['W', 'flank speed'],
               ['3 or 4', 'compress time to close']],
        marker: { x: this.victim.x, y: this.victim.y, r: 1.5, label: 'MV HELLAS TRIUMPH' } };
    }
    if (!fc || (fc.weapon !== 'gun' && fc.weapon !== 'ciws')) {
      return { heading: 'ARM THE GUN',
        body: 'Small craft at close range. The 5 inch mount or CIWS, ' +
              'nothing else. A missile would sink the tanker.',
        stat: `${alive} craft still attacking  ·  boarding ${pct}%`,
        keys: [['G', 'arm the 5 inch gun'],
               ['CLICK', 'or pick it in the magazine panel']] };
    }
    return { heading: 'ENGAGE THE SKIFFS',
      body: 'The mount engages the nearest craft automatically while it ' +
            'bears. Keep the range closed and they will start breaking off.',
      stat: `${alive} attacking  ·  ${this.killed} disabled  ·  boarding ${pct}%`,
      keys: [['RIGHT-CLICK', 'keep station on the tanker'],
             ['G', 'gun'], ['CLICK CIWS', 'inside 1 nm']],
      marker: { x: this.victim.x, y: this.victim.y, r: 1.2, label: 'PROTECT' } };
  }

  statusLine(G) {
    const alive = this.skiffs.filter(s => !s.dead && s.state !== SKIFF_STATE.FLEE).length;
    return alive ? `${alive} CRAFT` : 'CLEAR';
  }
}

// ═══════════════════════════════════════════════════════════════
//  MISSION 5 — CHOKEPOINT
//  Escort a loaded tanker. Skiffs, then a coastal missile, then a
//  weapon that reports ready and does not fire, then a choice.
// ═══════════════════════════════════════════════════════════════
const ESC_PHASE = {
  ESCORT:  'ESCORT',
  SWARM:   'SWARM',
  VAMPIRE: 'VAMPIRE',
  SEARCH:  'SEARCH',
  DECIDE:  'DECIDE',
  DONE:    'DONE'
};

class EscortScenario extends Scenario {
  constructor(mission) {
    super(mission);
    this.region = REGIONS.oman;
    this.phase = ESC_PHASE.ESCORT;
    this.charge = null;          // the tanker we are escorting
    this.skiffs = [];
    this.skiffTotal = 8;
    this.killed = 0;
    this.phaseT = 0;
    this.ciwsFailed = false;
    this.ciwsFailLogged = false;
    this.vampireHandled = false;
    this.launchSite = null;
    this.siteFound = false;
    this.decision = null;
    this.gunKill = false;
    this.progressNm = 0;
    this.routeNm = 62;

    this.objectives = [
      new Objective('station', 'Take station on MV ZAGROS DAWN',
        { hint: 'Hold within 5 nm of her.' }),
      new Objective('swarm',   'Break up the small-craft attack',
        { progress: { cur: 0, max: 8 } }),
      new Objective('vampire', 'Defeat the inbound missile'),
      new Objective('site',    'Locate the launch site',
        { hint: 'Send the Seahawk along the coast.' }),
      new Objective('decide',  'Decide what to do about it')
    ];
  }

  init(G) {
    const c = ll2nm(25.05, 57.90);
    this.charge = new ProtectedVessel(c.x, c.y, 70, 'MV ZAGROS DAWN', 'supertanker');
    this.charge.speed = 12;
    this.launchSite = ll2nm(25.71, 57.72);   // on the northern coast
    G.log('EVA: Escort is MV ZAGROS DAWN, loaded, bound for the strait.', 'info');
    G.log('CIC: Take station and hold it. Threat picture is quiet.', 'ok');
    this.prompt('ESCORT UNDER WAY',
      'Stay within 5 nm of the tanker. Nothing is happening yet.');
  }

  update(dt, G) {
    this.elapsed += dt;
    this.phaseT += dt;
    const { own, board, fc, helo } = G;
    if (!this.charge) return;

    this.charge.update(dt);
    this.progressNm += (this.charge.speed / 3600) * dt;
    const dCharge = Math.hypot(own.x - this.charge.x, own.y - this.charge.y);
    const onStation = dCharge < 5;

    // ── PHASE 1: quiet escort ──
    if (this.phase === ESC_PHASE.ESCORT) {
      if (onStation && !this.obj('station').done) {
        this.complete('station');
        G.log('CIC: On station. Settle in, it is a long run.', 'ok');
      }
      if (this.obj('station').done && this.phaseT > 45) {
        this.phase = ESC_PHASE.SWARM;
        this.phaseT = 0;
        this.spawnSwarm(G);
      }
    }

    // ── PHASE 2: the swarm ──
    if (this.phase === ESC_PHASE.SWARM) {
      for (const s of this.skiffs) s.update(dt, own);
      this.engageSkiffs(dt, G);
      const alive = this.skiffs.filter(s => !s.dead && s.state !== SKIFF_STATE.FLEE).length;
      this.obj('swarm').progress.cur = this.skiffTotal - alive;

      // The missile launches while you still have boats to deal with
      if (alive <= 3 && !this.vampireLaunched) {
        this.vampireLaunched = true;
        this.launchVampire(G);
      }
      if (alive === 0 && !this.obj('swarm').done) {
        this.complete('swarm');
      }
    }

    // ── PHASE 3: the missile, and the failure ──
    if (this.vampireLaunched && !this.vampireHandled) {
      this.checkCiws(dt, G, board, fc, own);
      if (board.threats.length === 0) {
        this.vampireHandled = true;
        this.complete('vampire');
        this.phase = ESC_PHASE.SEARCH;
        this.phaseT = 0;
        G.log('CIC: Threat defeated. That came off the coast, not off a ship.', 'warn');
        G.log('EVA: Launch bearing puts it on the Makran shore. Find it.', 'info');
        this.prompt('WHERE DID THAT COME FROM',
          'Send the Seahawk north along the coast and look.');
      }
    }

    // ── PHASE 4: find the launcher ──
    if (this.phase === ESC_PHASE.SEARCH && !this.siteFound) {
      if (helo && helo.airborne && helo.altM > 200) {
        const d = Math.hypot(helo.x - this.launchSite.x, helo.y - this.launchSite.y);
        if (d < 6) {
          this.siteFound = true;
          this.complete('site');
          this.phase = ESC_PHASE.DECIDE;
          G.log('SEAHAWK 01: I have it. Prepared coastal position, transporter erector, ' +
                'and more rounds on the ground.', 'alert');
          this.prompt('LAUNCH SITE LOCATED',
            'Report it and move on, or destroy it. Both have a price.');
          if (typeof Audio !== 'undefined') Audio.lockOn();
        }
      }
    }

    // ── PHASE 5: the choice ──
    if (this.phase === ESC_PHASE.DECIDE && this.decision) {
      this.phase = ESC_PHASE.DONE;
      this.complete('decide');
      this.state = 'complete';
      this.result = {
        decision: this.decision,
        killed: this.killed,
        gunKill: this.gunKill,
        ciwsFailed: this.ciwsFailed,
        boarding: Math.round(this.charge.boardingPct * 100),
        time: this.elapsed
      };
    }

    if (this.charge.taken && this.state === 'running') {
      this.state = 'failed';
      this.result = { reason: 'The tanker was boarded.' };
    }
  }

  spawnSwarm(G) {
    const c = this.charge;
    for (let i = 0; i < this.skiffTotal; i++) {
      const a = (150 + i * 20) * Math.PI / 180;
      const r = 6 + Math.random() * 5;
      const s = new Skiff(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c);
      s.trackNum = 8100 + i;
      this.skiffs.push(s);
    }
    G.log('*** MULTIPLE SMALL CRAFT CLOSING ON THE ESCORT ***', 'alert');
    this.prompt('SMALL CRAFT ATTACK',
      'Eight boats on the tanker. The gun, not missiles.');
    if (typeof Audio !== 'undefined') Audio.newContact();
  }

  engageSkiffs(dt, G) {
    const { own, fc } = G;
    if (!fc || !fc.weapon) return;
    if (fc.weapon !== 'gun' && fc.weapon !== 'ciws') return;
    const E = ENGAGE[fc.weapon];
    this._gunT = (this._gunT || 0) + dt;
    const cycle = fc.weapon === 'gun' ? 3.0 : 1.2;
    if (this._gunT < cycle) return;
    this._gunT = 0;
    const inRange = this.skiffs.filter(s => !s.dead && s.rangeTo(own) < E.rangeNm);
    if (!inRange.length) return;
    inRange.sort((a, b) => a.rangeTo(own) - b.rangeTo(own));
    const tgt = inRange[0];
    if (Math.random() < E.pk) {
      tgt.kill(); this.killed++;
      G.log(`Skiff ${tgt.trackNum} disabled.`, 'ok');
      if (typeof Audio !== 'undefined') Audio.intercept();
    } else if (typeof Audio !== 'undefined') Audio.gunFire();
  }

  launchVampire(G) {
    const { board } = G;
    // Fired from the coast, so it comes in on a land bearing —
    // which is exactly the condition the modified interlock watches for
    const brg = (Math.atan2(this.charge.x - this.launchSite.x,
                 -(this.charge.y - this.launchSite.y)) * 180 / Math.PI + 360) % 360;
    board.spawnWave(1, { rangeNm: 22, mach: 0.85, bearing: brg,
                         altM: 8, name: 'VAMPIRE', stagger: 0 });
    G.log('*** VAMPIRE — SEA SKIMMER INBOUND FROM THE COAST ***', 'alert');
    this.prompt('MISSILE INBOUND',
      'Sea skimmer off the shore. Point defence, now.');
  }

  // CIWS reports READY and holds fire. The player has to use the gun.
  checkCiws(dt, G, board, fc, own) {
    const t = board.threats[0];
    if (!t) return;
    const d = Math.hypot(t.x - own.x, t.y - own.y);

    if (d < 8.0 && !this.ciwsFailLogged) {
      this.ciwsFailLogged = true;
      this.ciwsFailed = true;
      G.log('*** MK 15 CIWS: SYSTEM READY — NO ENGAGEMENT ***', 'alert');
      G.log('CIC: It says ready. It is not shooting. Go to the gun.', 'alert');
      this.prompt('CIWS WILL NOT ENGAGE',
        'The mount reports ready and holds fire. Use the 5 inch.');
      if (typeof Audio !== 'undefined') Audio.dryFire();
      if (G.log && typeof App !== 'undefined' && App.shipLog) {
        App.shipLog.recordFault('Mk 15 CIWS',
          'Reported READY, did not engage a sea-skimming contact from a land bearing.',
          'IN ACTION');
      }
    }

    // The 5in gun is the only thing that will take it
    if (fc && fc.weapon === 'gun' && d < ENGAGE.gun.rangeNm) {
      this._pdT = (this._pdT || 0) + dt;
      if (this._pdT > 2.0) {
        this._pdT = 0;
        if (Math.random() < 0.38) {
          t.dead = true;
          board.threats.splice(board.threats.indexOf(t), 1);
          board.killed++;
          this.gunKill = true;
          G.log('Gun engagement successful. Vampire destroyed.', 'ok');
          if (typeof Audio !== 'undefined') Audio.intercept();
        } else if (typeof Audio !== 'undefined') Audio.gunFire();
      }
    }
  }

  // Called by the UI when the player chooses
  choose(id, G) {
    if (this.phase !== ESC_PHASE.DECIDE || this.decision) return false;
    this.decision = id;
    if (typeof App !== 'undefined' && App.camp && typeof applyLaunchSiteChoice === 'function') {
      applyLaunchSiteChoice(App.camp, id);
    }
    if (id === 'strike') {
      G.log('Two Tomahawks away. Launch site assessed destroyed.', 'warn');
    } else {
      G.log('Coordinates passed to CTF 150. Resuming the escort.', 'info');
    }
    // Resolve now rather than waiting for the next tick
    this.phase = ESC_PHASE.DONE;
    this.complete('decide');
    this.state = 'complete';
    this.result = {
      decision: id, killed: this.killed, gunKill: this.gunKill,
      ciwsFailed: this.ciwsFailed,
      boarding: Math.round(this.charge ? this.charge.boardingPct * 100 : 0),
      time: this.elapsed
    };
    return true;
  }

  guidance(G) {
    const { own, fc, helo, board } = G;
    const dCharge = this.charge
      ? Math.hypot(own.x - this.charge.x, own.y - this.charge.y) : 0;

    if (this.phase === ESC_PHASE.DECIDE) {
      return { heading: 'YOUR CALL',
        body: 'A prepared coastal battery with rounds still on it. Report it ' +
              'up the chain, or destroy it yourself and answer for it.',
        stat: 'REPORT  or  TOMAHAWK',
        keys: [['R', 'report the position'],
               ['T', 'strike it with Tomahawks']],
        marker: { x: this.launchSite.x, y: this.launchSite.y, r: 2, label: 'LAUNCH SITE' } };
    }
    if (this.phase === ESC_PHASE.SEARCH) {
      const d = helo && helo.airborne
        ? Math.hypot(helo.x - this.launchSite.x, helo.y - this.launchSite.y) : null;
      return { heading: 'SEARCH THE COAST',
        body: 'That missile came off the shore. Put the Seahawk along the ' +
              'northern coastline and find where.',
        stat: helo && helo.airborne
          ? `Seahawk ${d.toFixed(0)} nm from the search area`
          : 'SEAHAWK ON DECK',
        keys: helo && helo.airborne
          ? [['CLICK HELO', 'then click the coastline']]
          : [['H', 'launch the Seahawk']],
        marker: { x: this.launchSite.x, y: this.launchSite.y, r: 6, label: 'SEARCH AREA' } };
    }
    if (this.vampireLaunched && !this.vampireHandled) {
      const t = board.threats[0];
      const tti = t ? Math.round(t.ttiSec(own)) : 0;
      if (this.ciwsFailed) {
        return { heading: 'GUN ENGAGEMENT',
          body: 'CIWS reports ready and is not firing. The 5 inch mount is ' +
                'all you have left. Get it armed.',
          stat: `IMPACT IN ${tti}s`,
          keys: [['G', 'arm the 5 inch gun']] };
      }
      return { heading: 'MISSILE INBOUND',
        body: 'Sea skimmer from the coast. Point defence.',
        stat: `IMPACT IN ${tti}s`,
        keys: [['C', 'ESSM'], ['G', '5 inch gun']] };
    }
    if (this.phase === ESC_PHASE.SWARM) {
      const alive = this.skiffs.filter(s => !s.dead && s.state !== SKIFF_STATE.FLEE).length;
      if (!fc || (fc.weapon !== 'gun' && fc.weapon !== 'ciws')) {
        return { heading: 'ARM THE GUN',
          body: 'Boats, not aircraft. Missiles will not help and would ' +
                'endanger the tanker.',
          stat: `${alive} craft closing  ·  boarding ${Math.round(this.charge.boardingPct*100)}%`,
          keys: [['G', 'arm the 5 inch gun']] };
      }
      return { heading: 'BREAK UP THE ATTACK',
        body: 'Stay between them and the tanker. The mount engages the ' +
              'nearest craft while it bears.',
        stat: `${alive} attacking  ·  ${this.killed} disabled`,
        keys: [['RIGHT-CLICK', 'keep station on the tanker']],
        marker: { x: this.charge.x, y: this.charge.y, r: 1.5, label: 'PROTECT' } };
    }
    return { heading: 'HOLD STATION',
      body: 'Stay within 5 nm of MV ZAGROS DAWN. It is quiet. It will not stay quiet.',
      stat: `${dCharge.toFixed(1)} nm from the escort  ·  ` +
            `${Math.round(this.progressNm)} of ${this.routeNm} nm run`,
      keys: [['RIGHT-CLICK', 'steer to the tanker'],
             ['3 or 4', 'compress time']],
      marker: this.charge
        ? { x: this.charge.x, y: this.charge.y, r: 5, label: 'MV ZAGROS DAWN' } : null };
  }

  statusLine(G) {
    if (this.phase === ESC_PHASE.DECIDE) return 'DECISION';
    if (this.phase === ESC_PHASE.SEARCH) return 'SEARCHING';
    if (this.vampireLaunched && !this.vampireHandled) return 'VAMPIRE';
    if (this.phase === ESC_PHASE.SWARM) {
      const a = this.skiffs.filter(s => !s.dead && s.state !== SKIFF_STATE.FLEE).length;
      return `${a} CRAFT`;
    }
    return 'ESCORT';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REGIONS, Scenario, DroneScenario, SarScenario, CargoScenario,
                     PirateScenario, EscortScenario, Skiff, ProtectedVessel,
                     Objective, makeScenario, SKIFF_STATE, ESC_PHASE };
}
