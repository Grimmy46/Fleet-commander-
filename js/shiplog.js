// ═══════════════════════════════════════════════════════════════
//  SHIP'S LOG — maintenance and access records
//
//  These exist so the sabotage in Act 2 can be DISCOVERED rather
//  than announced. Every entry below is plausible routine work.
//  One of them is not.
// ═══════════════════════════════════════════════════════════════

const LOG_CATEGORY = {
  MAINT:  { label: 'MAINTENANCE',    col: '#5a9bc4' },
  ACCESS: { label: 'SYSTEM ACCESS',  col: '#8a9bb0' },
  SUPPLY: { label: 'SUPPLY',         col: '#6aa88a' },
  CREW:   { label: 'PERSONNEL',      col: '#9b8ab0' },
  FAULT:  { label: 'FAULT REPORT',   col: '#c47a5a' }
};

// dayOffset is days before the campaign start.
// flagged: only ever true after the reveal — it is what the
// player is shown when they go back and look.
const SHIP_LOG = [
  { day:-11, cat:'CREW',   who:'SPEARPOINT TRANSFER',
    text:'Vessel transferred to Spearpoint Global Solutions. Crew of 214 retained ' +
         'from prior operator. Master: MITCHELL.' },

  { day:-9,  cat:'MAINT',  who:'ENGINEERING',
    text:'No.2 gas turbine borescope inspection complete. No findings.' },

  { day:-8,  cat:'SUPPLY', who:'LOGISTICS',
    text:'Mk 41 VLS canister load-out completed at Norfolk. 88 of 96 cells filled. ' +
         'Eight cells left empty pending Spearpoint procurement.' },

  { day:-7,  cat:'ACCESS', who:'SPEARPOINT TECHNICAL SERVICES',
    text:'Combat system software baseline updated to Spearpoint civil-operator ' +
         'configuration. Weapons release authority remapped to contractor ROE. ' +
         'Signed: R. HALDANE, Systems.' },

  { day:-7,  cat:'MAINT',  who:'ENGINEERING',
    text:'Rudder hydraulics topped up. Minor weep at the port ram, monitored.' },

  // ── THE ONE THAT MATTERS ──
  // Reads as routine. It is not. Two things are wrong: this
  // package touched the CIWS and aft VLS interlocks, and it was
  // signed by the same technical services group on a separate,
  // later visit that appears nowhere in the transfer schedule.
  { day:-6,  cat:'ACCESS', who:'SPEARPOINT TECHNICAL SERVICES',
    text:'Supplementary firmware package applied: Mk 15 CIWS fire-control ' +
         'interlock, aft VLS cell arbitration, and SPY-1D track handoff timing. ' +
         'Bench-tested, not live-fired. Signed: R. HALDANE, Systems.',
    sabotage: true },

  { day:-5,  cat:'MAINT',  who:'WEAPONS DEPT',
    text:'Mk 45 gun mount bore inspection and slew test. Satisfactory.' },

  { day:-4,  cat:'FAULT',  who:'COMBAT SYSTEMS',
    text:'Intermittent aft VLS cell-status reporting during self-test. Cleared on ' +
         'reset. Attributed to the new baseline. No further action.',
    hint: true },

  { day:-3,  cat:'SUPPLY', who:'LOGISTICS',
    text:'Aviation stores embarked. Two MH-60R airframes, spares for 90 days.' },

  { day:-2,  cat:'ACCESS', who:'SHIPS COMPANY',
    text:'Full combat system self-test. All stations report ready. ' +
         'CIWS reports READY on the built-in test.',
    hint: true },

  { day:-1,  cat:'MAINT',  who:'ENGINEERING',
    text:'Sea trials completed off the Virginia capes. 31.2 knots on trial. ' +
         'No defects carried forward.' },

  { day:0,   cat:'CREW',   who:'SPEARPOINT OPERATIONS',
    text:'Shakedown tasking assigned. Atlantic test range, Cape Canaveral.' }
];

// ── RUNTIME LOG ───────────────────────────────────────────────
// Entries added during play. Faults recorded here are what the
// player compares against the maintenance history.
class ShipLog {
  constructor() {
    this.entries = SHIP_LOG.map(e => ({ ...e, pre: true, read: false }));
    this.revealed = false;      // true once the sabotage is proven
    this.suspicion = 0;         // rises as faults accumulate
  }

  add(cat, who, text, opts = {}) {
    this.entries.push({
      day: opts.day !== undefined ? opts.day : null,
      cat, who, text, pre: false, read: false,
      fault: !!opts.fault, hint: !!opts.hint, sabotage: !!opts.sabotage,
      stamp: opts.stamp || null
    });
    if (opts.fault) this.suspicion++;
    return this.entries[this.entries.length - 1];
  }

  // Called when a system fails during a mission
  recordFault(system, detail, stamp) {
    return this.add('FAULT', 'COMBAT SYSTEMS',
      `${system}: ${detail}`, { fault: true, hint: true, stamp });
  }

  get sabotageEntry() { return this.entries.find(e => e.sabotage); }
  get hints() { return this.entries.filter(e => e.hint); }
  get unread() { return this.entries.filter(e => !e.read).length; }

  // The reveal — links the fault record to the access record
  reveal() {
    this.revealed = true;
    const s = this.sabotageEntry;
    if (s) s.exposed = true;
    return s;
  }

  // Everything the player would need to reach the conclusion
  evidence() {
    return this.entries.filter(e => e.hint || e.sabotage || e.fault);
  }
}

// ── THE REVEAL TEXT ───────────────────────────────────────────
// Used when the player is finally shown what happened.
const SABOTAGE_REVEAL = {
  title: 'CROSS-REFERENCE COMPLETE',
  findings: [
    'The CIWS did not fail. It was told not to engage.',
    '',
    'The firmware package applied six days before departure altered the ' +
    'Mk 15 fire-control interlock. Under a specific track-classification ' +
    'condition — a sea-skimming contact originating from a land bearing — ' +
    'the mount holds fire and reports READY.',
    '',
    'The same package touched aft VLS cell arbitration. The intermittent ' +
    'self-test faults logged on day minus four were not the new baseline ' +
    'settling. They were the modification failing its own checks.',
    '',
    'The package is signed R. HALDANE, Spearpoint Technical Services. ' +
    'It does not appear on the transfer work schedule. It was a separate ' +
    'visit.'
  ],
  implication: [
    'A warship taking a hit it should have stopped is worth more than a ' +
    'tanker taking one.',
    '',
    'Insurance underwriters price a route on demonstrated risk. If a ' +
    'guided-missile destroyer cannot protect itself, nothing on that ' +
    'route can be protected. Escort rates rise. Hull premiums rise. ' +
    'Cargo insurance rises. Crude prices follow.',
    '',
    'Spearpoint sells escorts.'
  ],
  irony: [
    'The launcher was meant to survive.',
    '',
    'It was meant to fire again, and again, and each time the premium ' +
    'would climb. Reporting it up the chain would have kept it standing ' +
    'for weeks while somebody decided whose problem it was.',
    '',
    'Destroying it inside the hour cost them the entire mechanism.',
    '',
    'That is why the reaction was what it was.'
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SHIP_LOG, ShipLog, LOG_CATEGORY, SABOTAGE_REVEAL };
}

// ═══════════════════════════════════════════════════════════════
//  THE LAUNCH SITE DECISION
//  Report it and the launcher survives. Strike it and it does not.
//  Either way Spearpoint goes on the record denying knowledge.
// ═══════════════════════════════════════════════════════════════

const LAUNCH_SITE_OUTCOMES = {

  // ── REPORT IT ─────────────────────────────────────────────
  // The "responsible" choice. It is the one Spearpoint needs.
  report: {
    id: 'report',
    label: 'REPORT THE SITE',
    blurb: 'Pass the coordinates to CTF 150 and continue the escort. ' +
           'Somebody else decides what happens next.',
    immediate: {
      headline: 'Coordinates passed to coalition task force',
      detail: 'Spearpoint has forwarded the launch site position to CTF 150. ' +
              'Tasking authority rests with the coalition.',
      kind: 'info'
    },
    // Delayed consequences, in the order they land
    consequences: [
      { delayHours: 26,
        headline: 'MV KESTREL BAY struck — three crew lost',
        detail: 'A product tanker under separate escort was hit by a coastal ' +
                'anti-ship missile 40 nm from the position you reported. ' +
                'The launch site had not been actioned.',
        kind: 'bad',
        rep: { public: -4 } },

      { delayHours: 34,
        headline: 'Spearpoint: "We had no knowledge of any launch capability"',
        detail: 'Chairman Callum Reyne told reporters the company was unaware ' +
                'of any shore-based threat on the route and called the attack ' +
                '"a failure of state actors, not of private escort."',
        kind: 'bad',
        lie: true,
        rep: { corporate: +6, public: -2 } },

      { delayHours: 40,
        headline: 'Underwriters raise Gulf transit premiums 34 percent',
        detail: 'Marine insurers cited "demonstrated shore-launch capability ' +
                'against escorted shipping". Spearpoint escort contracts are ' +
                'reported to be heavily oversubscribed.',
        kind: 'bad',
        rep: { corporate: +10 } }
    ],
    // What the player is told at debrief
    debrief: 'You did what the rules require.',
    // Only meaningful after the reveal
    hindsight: 'They needed the launcher to keep firing. You let it.'
  },

  // ── STRIKE IT ─────────────────────────────────────────────
  // Immediate public cost. It is also the only thing that stops it.
  strike: {
    id: 'strike',
    label: 'TOMAHAWK THE SITE',
    blurb: 'Destroy the launcher now. A private vessel striking a land target ' +
           'is a line nobody has crossed.',
    cost: { tlam: 2 },
    immediate: {
      headline: 'Land strike conducted by private vessel',
      detail: 'DDG-144 launched two cruise missiles against a coastal position. ' +
              'The launcher is assessed destroyed. There is no precedent for this.',
      kind: 'warn'
    },
    consequences: [
      { delayHours: 8,
        headline: 'Spearpoint distances itself from the strike',
        detail: 'Chairman Callum Reyne called the action "unilateral and ' +
                'unauthorised" and said the master would face review. The ' +
                'company also stated it had no prior knowledge of any launch ' +
                'capability on that coastline.',
        kind: 'bad',
        lie: true,
        rep: { corporate: -18, public: -6 } },

      { delayHours: 20,
        headline: 'Coalition confirms the site was active',
        detail: 'CTF 150 assessed the position as a prepared coastal ' +
                'anti-ship battery with additional rounds on site. No further ' +
                'launches have been observed.',
        kind: 'good',
        rep: { public: +8 } },

      { delayHours: 52,
        headline: 'Gulf transit premiums hold steady',
        detail: 'Underwriters left rates unchanged, citing the removal of the ' +
                'shore-launch threat. Escort demand is reported flat.',
        kind: 'good',
        rep: { corporate: -8 } }
    ],
    debrief: 'You broke a rule that exists for good reasons.',
    hindsight: 'You cost them the entire mechanism. That is why they were angry.'
  }
};

// Applies an outcome to the campaign. Consequences are queued,
// not fired, so they arrive while the player has moved on.
function applyLaunchSiteChoice(camp, choiceId) {
  const o = LAUNCH_SITE_OUTCOMES[choiceId];
  if (!o || !camp) return null;

  camp.launchSiteChoice = choiceId;
  if (o.immediate) {
    camp.addNews(o.immediate.headline, o.immediate.detail, o.immediate.kind);
  }
  for (const c of o.consequences) {
    camp.pendingConsequences.push({
      missionId: 'm05_launchsite',
      fireAtMinutes: camp.clock.minutes + c.delayHours * 60,
      headline: c.headline,
      detail: c.detail,
      kind: c.kind,
      rep: c.rep,
      lie: !!c.lie
    });
  }
  return o;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.LAUNCH_SITE_OUTCOMES = LAUNCH_SITE_OUTCOMES;
  module.exports.applyLaunchSiteChoice = applyLaunchSiteChoice;
}
