// ═══════════════════════════════════════════════════════════════
//  WORLD — globe map data, campaign clock, mission registry
// ═══════════════════════════════════════════════════════════════

// Simplified continent outlines. [lon, lat] pairs.
// Low-poly but recognisable at globe scale.
const CONTINENTS = [
  { name: 'NORTH AMERICA', pts: [
    [-168,66],[-160,71],[-140,70],[-128,70],[-115,69],[-100,69],[-85,70],[-80,73],
    [-70,68],[-64,60],[-56,52],[-60,47],[-66,45],[-70,42],[-74,39],[-76,35],
    [-81,31],[-80,25],[-83,25],[-85,30],[-90,29],[-94,29],[-97,26],[-97,22],
    [-95,18],[-92,16],[-87,16],[-83,9],[-79,9],[-77,8],[-83,15],[-88,21],
    [-97,26],[-105,22],[-110,24],[-114,30],[-117,33],[-122,37],[-124,42],
    [-124,48],[-131,53],[-136,58],[-145,60],[-152,58],[-158,56],[-165,60],
    [-168,66]] },
  { name: 'SOUTH AMERICA', pts: [
    [-77,8],[-72,12],[-64,11],[-60,8],[-52,5],[-50,0],[-44,-2],[-38,-6],
    [-35,-8],[-38,-13],[-39,-18],[-42,-23],[-48,-26],[-53,-34],[-57,-38],
    [-62,-40],[-65,-45],[-68,-50],[-66,-55],[-70,-55],[-74,-50],[-74,-44],
    [-73,-37],[-71,-30],[-70,-23],[-70,-18],[-76,-14],[-79,-8],[-81,-5],
    [-80,0],[-78,5],[-77,8]] },
  { name: 'EUROPE', pts: [
    [-10,36],[-9,43],[-2,43],[0,47],[-2,49],[2,51],[4,53],[8,54],[10,57],
    [12,56],[15,55],[19,54],[21,56],[24,58],[28,60],[30,60],[28,66],[25,68],
    [21,70],[28,71],[40,68],[45,66],[50,68],[60,70],[68,73],[75,72],[70,67],
    [62,66],[58,58],[52,52],[48,46],[40,44],[34,45],[30,46],[28,44],[24,42],
    [20,40],[16,41],[12,38],[9,40],[12,44],[14,46],[10,44],[6,43],[3,42],
    [-2,39],[-6,37],[-10,36]] },
  { name: 'AFRICA', pts: [
    [-17,15],[-16,20],[-13,25],[-9,30],[-5,35],[0,36],[8,37],[11,34],
    [16,31],[22,32],[27,31],[32,31],[34,28],[38,22],[40,15],[43,12],
    [46,11],[51,12],[51,7],[47,4],[43,0],[40,-3],[40,-10],[38,-16],
    [35,-20],[33,-26],[31,-30],[27,-33],[22,-34],[18,-34],[16,-29],
    [13,-23],[12,-17],[13,-12],[9,-2],[9,4],[5,5],[0,5],[-5,5],[-9,5],
    [-13,9],[-16,12],[-17,15]] },
  { name: 'ASIA', pts: [
    [40,44],[48,46],[52,52],[58,58],[62,66],[70,67],[75,72],[90,76],
    [105,78],[115,74],[128,73],[140,72],[150,70],[160,70],[170,69],
    [180,66],[180,60],[170,60],[162,58],[155,52],[143,46],[140,42],
    [130,42],[128,35],[122,31],[120,24],[110,20],[105,10],[103,1],
    [100,6],[98,14],[95,16],[90,22],[88,21],[82,17],[76,8],[73,15],
    [70,22],[66,25],[60,25],[57,22],[52,25],[48,29],[44,36],[40,40],
    [40,44]] },
  { name: 'AUSTRALIA', pts: [
    [113,-22],[114,-27],[118,-34],[123,-34],[129,-32],[134,-33],[138,-35],
    [141,-38],[146,-39],[150,-37],[153,-30],[153,-25],[148,-20],[145,-15],
    [142,-11],[136,-12],[131,-12],[126,-14],[122,-17],[117,-20],[113,-22]] },
  { name: 'GREENLAND', pts: [
    [-45,60],[-52,64],[-53,68],[-56,71],[-58,76],[-50,80],[-30,83],
    [-20,80],[-22,74],[-30,68],[-38,64],[-45,60]] },
  { name: 'INDONESIA', pts: [
    [95,5],[100,2],[104,-2],[106,-6],[112,-8],[118,-9],[124,-9],[130,-8],
    [135,-4],[140,-3],[138,-8],[130,-3],[122,-3],[118,-3],[112,-2],
    [108,0],[103,1],[98,3],[95,5]] },
  { name: 'MADAGASCAR', pts: [
    [49,-12],[50,-16],[48,-20],[47,-25],[45,-25],[44,-21],[44,-16],[46,-13],[49,-12]] },
  { name: 'JAPAN', pts: [
    [141,45],[145,44],[142,40],[140,36],[136,34],[132,33],[130,31],
    [131,34],[136,37],[139,40],[141,45]] },
  { name: 'UK', pts: [
    [-5,50],[-3,54],[-3,58],[-5,58],[-6,55],[-8,52],[-5,50]] },
  { name: 'NZ', pts: [
    [173,-35],[178,-38],[177,-41],[172,-44],[168,-47],[167,-45],[171,-41],[173,-35]] }
];

// ── PORTS & BASES ─────────────────────────────────────────────
const PORTS = [
  { id:'norfolk',   name:'NORFOLK',        country:'USA',          lon:-76.3, lat:36.9, type:'navy',    unlocked:true  },
  { id:'mayport',   name:'MAYPORT',        country:'USA',          lon:-81.4, lat:30.4, type:'navy',    unlocked:true  },
  { id:'rota',      name:'ROTA',           country:'SPAIN',        lon: -6.3, lat:36.6, type:'navy',    unlocked:true  },
  { id:'capetown',  name:'CAPE TOWN',      country:'S. AFRICA',    lon: 18.4, lat:-33.9,type:'civ',     unlocked:false },
  { id:'portlouis', name:'PORT LOUIS',     country:'MAURITIUS',    lon: 57.5, lat:-20.2,type:'civ',     unlocked:false },
  { id:'djibouti',  name:'DJIBOUTI',       country:'DJIBOUTI',     lon: 43.1, lat: 11.6,type:'navy',    unlocked:false },
  { id:'salalah',   name:'SALALAH',        country:'OMAN',         lon: 54.0, lat: 17.0,type:'civ',     unlocked:false },
  { id:'bahrain',   name:'NSA BAHRAIN',    country:'BAHRAIN',      lon: 50.6, lat: 26.2,type:'navy',    unlocked:false },
  { id:'jebelali',  name:'JEBEL ALI',      country:'UAE',          lon: 55.0, lat: 25.0,type:'civ',     unlocked:false },
  { id:'diego',     name:'DIEGO GARCIA',   country:'BIOT',         lon: 72.4, lat: -7.3,type:'navy',    unlocked:false }
];

// ── CAMPAIGN CLOCK ────────────────────────────────────────────
// Time advances only through transit and mission duration.
class CampaignClock {
  constructor() {
    // Near-future start
    this.epoch = new Date(Date.UTC(2031, 2, 4, 6, 0, 0)); // 04 MAR 2031, 0600Z
    this.minutes = 0;
  }
  get date() { return new Date(this.epoch.getTime() + this.minutes * 60000); }
  advanceMinutes(m) { this.minutes += m; }
  advanceHours(h) { this.minutes += h * 60; }
  advanceDays(d) { this.minutes += d * 1440; }

  fmtDate() {
    const d = this.date;
    const mons = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${String(d.getUTCDate()).padStart(2,'0')} ${mons[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  fmtTime() {
    const d = this.date;
    return `${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}Z`;
  }
  fmtFull() { return `${this.fmtTime()}  ${this.fmtDate()}`; }
  get dayNumber() { return Math.floor(this.minutes / 1440) + 1; }
}

// ── GREAT-CIRCLE DISTANCE ─────────────────────────────────────
function gcDistanceNm(lon1, lat1, lon2, lat2) {
  const R = 3440.065; // earth radius in nm
  const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180, dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Interpolate along a great circle, t = 0..1
function gcInterp(lon1, lat1, lon2, lat2, t) {
  const p1 = lat1*Math.PI/180, l1 = lon1*Math.PI/180;
  const p2 = lat2*Math.PI/180, l2 = lon2*Math.PI/180;
  const d = 2*Math.asin(Math.sqrt(Math.sin((p2-p1)/2)**2 +
            Math.cos(p1)*Math.cos(p2)*Math.sin((l2-l1)/2)**2));
  if (d < 1e-9) return { lon: lon1, lat: lat1 };
  const A = Math.sin((1-t)*d)/Math.sin(d), B = Math.sin(t*d)/Math.sin(d);
  const x = A*Math.cos(p1)*Math.cos(l1) + B*Math.cos(p2)*Math.cos(l2);
  const y = A*Math.cos(p1)*Math.sin(l1) + B*Math.cos(p2)*Math.sin(l2);
  const z = A*Math.sin(p1) + B*Math.sin(p2);
  return {
    lat: Math.atan2(z, Math.sqrt(x*x+y*y)) * 180/Math.PI,
    lon: Math.atan2(y, x) * 180/Math.PI
  };
}

// ── MISSION REGISTRY ──────────────────────────────────────────
const HANDLER = 'EVA  ·  SPEARPOINT OPERATIONS';

const MISSION_TYPE = {
  NAVY:     { label:'USN TASKING',   col:'#4da6ff', pays:false, freeRearm:true  },
  CONTRACT: { label:'CONTRACT',      col:'#ffd60a', pays:true,  freeRearm:false },
  HUMAN:    { label:'HUMANITARIAN',  col:'#30d158', pays:false, freeRearm:false },
  DISTRESS: { label:'DISTRESS CALL', col:'#ff9f0a', pays:false, freeRearm:false }
};

const MISSIONS = [
  {
    id:'m01_florida', type:'NAVY', act:1, art:'assets/cape_canaveral.png',
    name:'WORKUPS',
    subtitle:'Drone intercept exercise',
    lon:-79.6, lat:29.4,
    brief:'Fleet workups off Cape Canaveral. Target drones will simulate a ' +
          'cruise-missile profile. Demonstrate detection, designation and engagement. ' +
          'Weapons free on designated targets only.',
    handler:'Sea trials complete. Take her out.',
    payment:0,
    reqPrev:null,
    tutorial:true
  },
  {
    id:'m02_sar_capetown', type:'DISTRESS', act:1,
    name:'MAN OVERBOARD',
    subtitle:'Search and rescue — South Atlantic',
    lon:14.2, lat:-34.8,
    brief:'Distress relay from a yacht 180 nm west of Cape Agulhas. One person ' +
          'in the water, position uncertain. Sea state 3, water temperature 16C. ' +
          'Survival window is measured in hours, not days.',
    handler:'A yacht went silent. Someone is in the water. ' +
            'This does not pay. Advise if you intend to divert.',
    payment:0,
    reqPrev:'m01_florida',
    refusable:true,
    // Tier is hidden from the player until it resolves
    reward: {
      unlockPort: 'capetown',
      headline: 'Rescued mariner identified',
      detail: 'The survivor was a trade delegation attache. Cape Town has ' +
              'extended standing port privileges to DDG-144.',
      kind: 'good',
      rep: { public: +8 }
    },
    consequence: {
      headline: 'Search called off — one lost at sea',
      detail: 'No other vessel diverted. The yacht owner has been declared ' +
              'missing presumed drowned. He was travelling on a diplomatic passport.',
      kind: 'bad',
      rep: { public: -6 }
    },
    consequenceDelayHours: 30
  },
  {
    id:'m03_supply', type:'HUMAN', act:1,
    name:'RELIEF RUN',
    subtitle:'Medical supply delivery — Mauritius',
    lon:57.5, lat:-20.2,
    brief:'Cyclone damage has cut the outer islands from resupply. ' +
          'Deliver medical pallets by helicopter. No hostile activity expected.',
    handler:'Routine. Cargo is loaded. Coordinates attached.',
    payment:45000,
    reqPrev:'m02_sar_capetown',
    refusable:true,
    reward: {
      unlockPort: 'portlouis',
      headline: 'Relief delivered to outer islands',
      detail: 'Port Louis has offered DDG-144 berthing and resupply at cost.',
      kind: 'good',
      rep: { public: +5 }
    },
    consequence: {
      headline: 'Relief shipment reached islands late',
      detail: 'A commercial charter completed the delivery four days behind ' +
              'schedule. No casualties reported.',
      kind: 'info',
      rep: { public: -2 }
    },
    consequenceDelayHours: 96
  },
  {
    id:'m04_pirates', type:'CONTRACT', act:1,
    name:'INTERDICTION',
    subtitle:'Piracy response — Gulf of Aden',
    lon:48.5, lat:12.6,
    brief:'Product tanker under attack by four small craft. Client requests ' +
          'immediate intervention. Rules of engagement permit disabling fire ' +
          'against vessels demonstrating hostile intent.',
    handler:'Client is paying premium for speed. Four skiffs, one tanker. ' +
            'Do not let this become a hostage situation.',
    payment:180000,
    reqPrev:'m03_supply'
  },
  {
    id:'m05_hormuz', type:'CONTRACT', act:2,
    name:'CHOKEPOINT',
    subtitle:'Blockade support — Strait of Hormuz',
    lon:56.35, lat:26.55,
    brief:'A tanker running dark is attempting to break the cordon. ' +
          'Her AIS profile does not match her hull. Locate, identify, and ' +
          'disable. She is loaded. Do not sink her.',
    handler:'The strait is closed. Something is trying to leave. ' +
            'Find it before it reaches open water.',
    payment:320000,
    reqPrev:'m04_pirates'
  }
];

// ── CAMPAIGN STATE ────────────────────────────────────────────
class Campaign {
  constructor() {
    this.clock = new CampaignClock();
    this.shipLon = -76.3; this.shipLat = 36.9;   // Norfolk
    this.credits = 0;
    this.completed = [];
    this.refused = [];
    this.newsFeed = [];
    this.currentMission = null;
    this.transit = null;
    this.ports = JSON.parse(JSON.stringify(PORTS));
    this.operator = 'SPEARPOINT GLOBAL SOLUTIONS';
    this.master = 'MITCHELL';
    this.reputation = { navy: 100, corporate: 50, public: 50 };
    this.pendingConsequences = [];
    this.launchSiteChoice = null;
    this.sabotageKnown = false;
    this.act = 1;
  }

  // A mission is "resolved" whether you did it or walked away.
  // Refusing must not dead-end the campaign — it changes the
  // outcome, not the availability of everything downstream.
  isResolved(id) {
    return this.completed.includes(id) || this.refused.includes(id);
  }

  availableMissions() {
    return MISSIONS.filter(m => {
      if (this.isResolved(m.id)) return false;
      if (m.reqPrev && !this.isResolved(m.reqPrev)) return false;
      return true;
    });
  }

  distanceTo(lon, lat) {
    return gcDistanceNm(this.shipLon, this.shipLat, lon, lat);
  }
  transitHours(lon, lat, speedKts = 18) {
    return this.distanceTo(lon, lat) / speedKts;
  }

  addNews(headline, detail, kind, opts) {
    this.newsFeed.unshift({
      headline, detail, kind: kind || 'info',
      lie: !!(opts && opts.lie),
      stamp: `${this.clock.fmtTime()}  ${this.clock.fmtDate()}`
    });
    if (this.newsFeed.length > 30) this.newsFeed.pop();
  }

  completeMission(m, payout) {
    this.completed.push(m.id);
    if (payout) this.credits += payout;
    this.shipLon = m.lon; this.shipLat = m.lat;
    if (m.reward) {
      const r = m.reward;
      this.addNews(r.headline, r.detail, r.kind || 'good');
      if (r.unlockPort) this.unlockPort(r.unlockPort);
      if (r.rep) {
        for (const [k, v] of Object.entries(r.rep)) {
          this.reputation[k] = Math.max(0, Math.min(100, (this.reputation[k] || 50) + v));
        }
      }
    }
  }

  refuseMission(m) {
    this.refused.push(m.id);
    // Consequences land later, not immediately. The player should
    // have moved on before they find out what it cost.
    if (m.consequence) {
      this.pendingConsequences.push({
        missionId: m.id,
        fireAtMinutes: this.clock.minutes + (m.consequenceDelayHours || 36) * 60,
        ...m.consequence
      });
    }
  }

  // Called whenever the clock advances — fires any due consequences
  checkConsequences() {
    const fired = [];
    for (let i = this.pendingConsequences.length - 1; i >= 0; i--) {
      const c = this.pendingConsequences[i];
      if (this.clock.minutes >= c.fireAtMinutes) {
        this.addNews(c.headline, c.detail, c.kind || 'bad', { lie: c.lie });
        if (c.unlockPort) this.unlockPort(c.unlockPort);
        if (c.rep) {
          for (const [k, v] of Object.entries(c.rep)) {
            this.reputation[k] = Math.max(0, Math.min(100, (this.reputation[k] || 50) + v));
          }
        }
        fired.push(c);
        this.pendingConsequences.splice(i, 1);
      }
    }
    return fired;
  }

  unlockPort(id) {
    const p = this.ports.find(p => p.id === id);
    if (p) p.unlocked = true;
  }
}

// Headless test export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONTINENTS, PORTS, MISSIONS, MISSION_TYPE,
                     CampaignClock, Campaign, gcDistanceNm, gcInterp };
}
