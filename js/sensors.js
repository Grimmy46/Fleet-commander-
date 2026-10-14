// ═══════════════════════════════════════════════════════════════
//  SENSORS — detection, tracking, classification
//  Radar horizon is real geometry, not an arbitrary stat.
// ═══════════════════════════════════════════════════════════════

// Contact classification states
const TRACK_STATE = {
  UNKNOWN:    0,   // radar return only — bearing/range, no solution
  TRACKING:   1,   // course & speed solved
  CLASSIFIED: 2,   // vessel category known
  IDENTIFIED: 3    // specific vessel identified
};

const STATE_LABEL = ['UNKNOWN', 'TRACKING', 'CLASSIFIED', 'IDENTIFIED'];

// Time (seconds of continuous track) to advance each stage
const AUTO_CLASSIFY_TIME = {
  0: 12,   // UNKNOWN -> TRACKING
  1: 18,   // TRACKING -> CLASSIFIED   (total 30s to classify)
  2: 45    // CLASSIFIED -> IDENTIFIED (visual/ESM correlation)
};
// When the player focuses sensors on a contact, everything speeds up
const FOCUS_MULTIPLIER = 3.8;

// Typical mast/superstructure heights by vessel type (metres).
// Determines how far over the horizon a contact can be seen.
const MAST_HEIGHT = {
  supertanker:  32,
  tanker:       28,
  cargo:        24,
  ddg:          20,
  frigate:      16,
  patrol:        8,
  fastboat:      4,
  skiff:         3
};

// ── CONTACT ───────────────────────────────────────────────────
class Contact {
  constructor(ship) {
    this.ship = ship;              // the underlying real vessel
    this.state = TRACK_STATE.UNKNOWN;
    this.trackTime = 0;            // seconds of continuous hold
    this.held = false;             // currently detected this tick
    this.lostTime = 0;             // seconds since last hold
    this.focused = false;          // player has sensors focused
    this.trackNum = null;          // assigned track number
    // Last known solution — persists when contact fades
    this.lx = ship.x; this.ly = ship.y;
    this.lhdg = ship.hdg; this.lspd = ship.speed;
    this.detectedBy = null;        // 'RADAR' | 'HELO' | 'AWACS' | 'VISUAL'
  }

  get mastHeight() { return MAST_HEIGHT[this.ship.type] || 12; }

  // Displayed position — real position if held, last known if faded
  get dx() { return this.held ? this.ship.x : this.lx; }
  get dy() { return this.held ? this.ship.y : this.ly; }

  // What the player is allowed to know at this track state
  get displayName() {
    switch (this.state) {
      case TRACK_STATE.IDENTIFIED: return this.ship.vesselName || 'UNIDENTIFIED';
      case TRACK_STATE.CLASSIFIED: return categoryOf(this.ship.type);
      case TRACK_STATE.TRACKING:   return 'SURFACE CONTACT';
      default:                     return 'UNKNOWN';
    }
  }
  get knowsCourse() { return this.state >= TRACK_STATE.TRACKING; }
  get knowsType()   { return this.state >= TRACK_STATE.CLASSIFIED; }
  get knowsID()     { return this.state >= TRACK_STATE.IDENTIFIED; }

  // Progress toward next state, 0..1
  get progress() {
    const need = AUTO_CLASSIFY_TIME[this.state];
    if (need === undefined) return 1;
    return Math.min(1, this.trackTime / need);
  }

  update(dt, sensors) {
    // Is this contact within any sensor's horizon?
    let detected = false;
    let source = null;
    for (const s of sensors) {
      const dist = Math.hypot(this.ship.x - s.x, this.ship.y - s.y);
      const horizon = 2.23 * (Math.sqrt(s.heightM) + Math.sqrt(this.mastHeight));
      const limit = Math.min(horizon, s.maxNm);
      if (dist <= limit) { detected = true; source = s.name; break; }
    }

    this.held = detected;
    if (detected) {
      this.detectedBy = source;
      this.lostTime = 0;
      // Update last-known solution
      this.lx = this.ship.x; this.ly = this.ship.y;
      this.lhdg = this.ship.hdg; this.lspd = this.ship.speed;
      // Build track quality
      const mult = this.focused ? FOCUS_MULTIPLIER : 1;
      this.trackTime += dt * mult;
      const need = AUTO_CLASSIFY_TIME[this.state];
      if (need !== undefined && this.trackTime >= need) {
        this.state++;
        this.trackTime = 0;
        return 'PROMOTED';
      }
    } else {
      this.lostTime += dt;
      // Track decays if lost for a while — drops back a state after 90s
      if (this.lostTime > 90 && this.state > TRACK_STATE.UNKNOWN) {
        this.state--;
        this.lostTime = 0;
        this.trackTime = 0;
        return 'DEGRADED';
      }
    }
    return null;
  }
}

function categoryOf(type) {
  switch (type) {
    case 'supertanker': return 'VLCC TANKER';
    case 'tanker':      return 'TANKER';
    case 'cargo':       return 'CARGO VESSEL';
    case 'ddg':         return 'WARSHIP';
    case 'frigate':     return 'WARSHIP';
    case 'patrol':      return 'PATROL CRAFT';
    case 'fastboat':    return 'FAST ATTACK CRAFT';
    case 'skiff':       return 'SMALL CRAFT';
    default:            return 'SURFACE CONTACT';
  }
}

// ── SENSOR MANAGER ────────────────────────────────────────────
class SensorSuite {
  constructor(ownship) {
    this.own = ownship;
    this.contacts = [];
    this.nextTrackNum = 7001;
    this.helo = null;       // { x, y, fuel, ... } when airborne
    this.awacs = null;      // { x, y, timeLeft } when on station
    this.events = [];
  }

  addContact(ship) {
    const c = new Contact(ship);
    this.contacts.push(c);
    return c;
  }

  // Build the list of active sensor platforms
  activeSensors() {
    const list = [{
      name: 'RADAR',
      x: this.own.x, y: this.own.y,
      heightM: this.own.spec.radarHeightM,
      maxNm: this.own.spec.radarMaxNm
    }];
    if (this.helo && this.helo.airborne) {
      list.push({
        name: 'HELO',
        x: this.helo.x, y: this.helo.y,
        heightM: this.helo.altM || 900,
        maxNm: 80
      });
    }
    if (this.awacs && this.awacs.onStation) {
      list.push({
        name: 'AWACS',
        x: this.awacs.x, y: this.awacs.y,
        heightM: 9000,
        maxNm: 250
      });
    }
    return list;
  }

  update(dt) {
    const sensors = this.activeSensors();
    for (const c of this.contacts) {
      const ev = c.update(dt, sensors);
      if (ev === 'PROMOTED') {
        if (c.state === TRACK_STATE.TRACKING && !c.trackNum) {
          c.trackNum = this.nextTrackNum++;
          this.events.push({ msg: `NEW TRACK ${c.trackNum} — solution established`, t: 0, kind: 'track' });
        } else if (c.state === TRACK_STATE.CLASSIFIED) {
          this.events.push({ msg: `TRACK ${c.trackNum} classified: ${categoryOf(c.ship.type)}`, t: 0, kind: 'class' });
        } else if (c.state === TRACK_STATE.IDENTIFIED) {
          this.events.push({ msg: `TRACK ${c.trackNum} identified: ${c.ship.vesselName}`, t: 0, kind: 'id' });
        }
      } else if (ev === 'DEGRADED') {
        this.events.push({ msg: `TRACK ${c.trackNum} degraded — contact lost`, t: 0, kind: 'lost' });
      }
    }
    // Age events
    for (let i = this.events.length - 1; i >= 0; i--) {
      this.events[i].t += dt;
      if (this.events[i].t > 25) this.events.splice(i, 1);
    }
  }

  focus(contact) {
    for (const c of this.contacts) c.focused = false;
    if (contact) contact.focused = true;
  }

  // Current radar horizon against a reference target, for display ring
  horizonNm(targetHeightM = 28) {
    return 2.23 * (Math.sqrt(this.own.spec.radarHeightM) + Math.sqrt(targetHeightM));
  }
}

// Headless test export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Contact, SensorSuite, TRACK_STATE, STATE_LABEL,
                     MAST_HEIGHT, AUTO_CLASSIFY_TIME, categoryOf };
}
