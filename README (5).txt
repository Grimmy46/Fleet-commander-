================================================================
  HORMUZ - FLEET COMMAND
  Build 0.14  ·  Helicopter rescue  ·  Real-time naval simulation
================================================================

  This build is the FOUNDATION ONLY.
  No combat, no enemies, no mission logic yet - by design.
  The question this build answers is: does commanding the ship
  feel right? Everything else gets built on top of that.


  RUNNING IT
  --------------------------------------------------------------
  Install Node.js once:  https://nodejs.org  (LTS button)

  Then double-click:  Play Hormuz.bat
     First run takes 1-2 minutes. No console window after that.

  For a real installer:  Build Installer.bat
     Produces dist\HormuzFleetCommand-Setup.exe - a normal
     Windows wizard with install location, desktop shortcut,
     Start Menu entry, and Add/Remove Programs registration.

     If that errors with "Cannot create symbolic link",
     see FIX-Build-Errors.txt. Short version: it is already
     fixed, just run it again. The build is not required
     to play - Play Hormuz.bat works on its own.


  CONTROLS — MENU AND CHART
  --------------------------------------------------------------
  Up / Down       Navigate menu
  Enter           Select
  Click marker    Review tasking
  B               Ship's log — maintenance and system access
  Wheel           Zoom chart
  Drag            Pan chart
  Space           Skip transit
  Esc             Back
  F11 / Alt+Enter Fullscreen

  CONTROLS — TACTICAL
  --------------------------------------------------------------
  LEFT CLICK      Select a contact (focuses sensors on it)
  RIGHT CLICK     Steer ownship toward that point
  MOUSE WHEEL     Zoom (zooms toward cursor)
  MIDDLE DRAG     Pan the camera
  W / S           Increase / decrease ordered speed by 5 kts
  A / D           HOLD for continuous rudder
  H               Launch / recall the Seahawk
  Click helo      Select it
  Click chart     Send the selected helo there
  Esc             Deselect
  F               Toggle camera follow
  SPACE           FIRE if a solution exists, otherwise pause
  1 2 3 4 5       Pause · 1x · 4x · 15x · 60x time
  + / -           Zoom
  M               Sound effects on / off
  [  /  ]         Effects volume down / up
  N               Music on / off
  ,  /  .         Music volume down / up
  F3              Performance overlay
  T               Weapons drill panel
  Z / C / B / G   SM-2 / ESSM / SM-6 / 5-inch gun
  V               Toggle SINGLE / DOUBLE salvo
  X               Clear firing solution
  ESC             Deselect / disarm
  F11             Fullscreen


  WHAT IS REAL IN THIS BUILD
  --------------------------------------------------------------
  GEOGRAPHY
    Coastlines projected from actual lat/lon. The narrowest
    crossing measures 21.1 nm - the real strait is ~21 nm.
    Bandar Abbas to Khasab measures 60.0 nm, also correct.
    Qeshm, Hormuz, Larak, Hengam islands all in true position.
    The Traffic Separation Scheme lanes are drawn where the
    real inbound/outbound shipping lanes run.

  THE SHIP - DDG-144, Arleigh Burke class Flight IIA
             Operated by Spearpoint Global Solutions
             Master: MITCHELL
    Length 155.3 m, beam 20.1 m, 9,217 tons full load
    31 knots flank, 4x LM2500 gas turbines
    0 to 30 knots takes 106 seconds
    90-degree turn at 20 knots takes 81 seconds
    No steerage way at zero speed - the rudder does nothing
    20 knots for one hour covers exactly 20.00 nm

  RADAR - this is geometry, not a stat
    Horizon = 2.23 x (sqrt(radar height) + sqrt(target height))
    SPY-1D sits 20 m above the waterline.
      vs VLCC tanker (32 m)  =  22.6 nm
      vs small skiff (3 m)   =  13.8 nm
    A supertanker is visible 8.8 nm further than a skiff.
    This falls out of the physics - nothing is special-cased.

  MAGAZINE - real Flight IIA loadout, 88 of 96 VLS cells
    40  SM-2MR Block IIIB      anti-air, 90 nm
     8  SM-6 Dual I            anti-air/surface, 130 nm
    32  ESSM Block II          point defense, 27 nm
        (8 cells, quad-packed - 4 missiles per cell)
    24  Tomahawk Block V       land attack, 900 nm
     8  VL-ASROC               anti-submarine, 12 nm
   600  rounds  Mk 45 5"/62 gun, 13 nm, 20 rpm
     6  Mk 54 torpedoes
  1550  rounds  Phalanx CIWS
     2  MH-60R Seahawk (Flight IIA twin hangar)

    VLS CANNOT BE RELOADED AT SEA. This is true of the real
    ship and it will be the core of the resource economy:
    missiles are irreplaceable, gun rounds are cheap but
    require closing inside 13 nm.


  SENSORS AND CLASSIFICATION
  --------------------------------------------------------------
  Contacts move through four states:

    UNKNOWN     radar return only - bearing and range
    TRACKING    course and speed solved, track number assigned
    CLASSIFIED  vessel category known (tanker/warship/etc)
    IDENTIFIED  specific vessel name

  Automatic progression takes about 30 seconds to reach
  CLASSIFIED. Click a contact to focus sensors on it and that
  drops to about 9 seconds - roughly 3.3x faster.

  You can only focus one contact at a time. That is the
  tactical choice.

  Contacts that drop below the horizon go to LAST KNOWN and
  are drawn as a dashed marker at their final solved position.
  Hold is lost after 90 seconds and the track degrades a state.


  THE ZOOM
  --------------------------------------------------------------
  Continuous from 6 to 2600 pixels per nautical mile.
  Three rendering tiers cross over automatically:

    STRATEGIC   under 55 px/nm    NATO symbology
                Friendly = semicircle, hostile = diamond,
                neutral = square, unknown = circle with ?
                Velocity leaders scale with speed.

    TACTICAL    55 to 380 px/nm   simplified hull shapes

    DETAIL      over 380 px/nm    full Flight IIA model
                Mk 45 gun with faceted Mod 4 shield,
                32-cell forward VLS and 64-cell aft VLS with
                individual cell hatches, four SPY-1D array
                faces, rotating SPS-67 surface search radar,
                twin funnels, Mk 32 torpedo tubes, the twin
                helicopter hangar that identifies Flight IIA,
                flight deck with landing circle and H marking,
                red/green running lights, hull number 114.

    Zoom all the way in and the ship is 168 pixels long.


  TIME
  --------------------------------------------------------------
  Pause, 1x, 4x, 15x, 60x. Physics sub-steps at high
  compression so the ship never tunnels through a turn.
  Clock shows Zulu time and mission elapsed.


  WEAPONS AND ENGAGEMENT  (build 0.2)
  --------------------------------------------------------------
  Press [T] to open the WEAPONS DRILL and spawn inbound
  missiles. Waves from a single subsonic round up to a
  50-missile saturation raid and a Mach 2.5 supersonic pack.

  THE ENGAGEMENT SEQUENCE

    1  ALARM       Inbounds cross the radar horizon.
                   Red vignette, VAMPIRE banner, and time
                   automatically drops to 1x.

    2  PICK WEAPON Click SM-2 / ESSM / SM-6 in the left panel,
                   or press Z / C / B.  G for the 5-inch gun.

    3  DESIGNATE   HOLD the cursor on an inbound for 0.5
                   seconds. An acquisition ring closes as you
                   hold, then snaps to LOCKED.
                   Sweep across several to build the salvo.

    4  FIRE        SPACE, or click the FIRE button.
                   Everything locked launches at once.

    Right-click a locked track to release it.  X clears the
    whole solution.  ESC drops the weapon entirely.

  WHY THE SALVO IS CAPPED AT 4

    SM-2 and ESSM are semi-active. They home on radar energy
    reflected off the target, so the ship must illuminate the
    target through terminal phase. An Arleigh Burke carries
    three AN/SPG-62 illuminators. Three - we allow four for
    feel. That hardware limit IS the cap.

    SM-6 has its own active seeker. Fire and forget, no
    illuminator needed, no meaningful cap.
    You carry 8 of them. That is the whole tension.

  SINGLE vs DOUBLE SALVO   [V]

    Real doctrine is shoot-shoot-look: two interceptors per
    inbound, because one round is about 70 percent reliable.
    Two gets you 91 percent.

    Measured over 500 simulated shots the SM-2 hit rate came
    out at exactly 70.0 percent.

    SINGLE   80 interceptors cover 80 targets
             expected leakers against a 50-raid:  15.0
    DOUBLE   80 interceptors cover only 40 targets
             expected leakers against a 50-raid:  13.6
             (ten of those never get engaged at all)

    Those numbers are almost identical. Neither doctrine wins.
    That balance was not tuned - it fell out of the real
    magazine count and the real single-shot reliability.

  THE ENGAGEMENT WINDOW IS THE WHOLE GAME

    A sea-skimming missile flies at about 5 metres.
    Radar horizon against it:  2.23 x (sqrt 20 + sqrt 5)
    = 14.96 nautical miles.

    Your ESSM reaches 27 nm. You cannot use that range,
    because you cannot SEE the missile until 15 nm.
    The horizon is the constraint, not the weapon.

      Mach 0.9 subsonic   91 seconds from detection to impact
      Mach 2.5 supersonic 33 seconds

    Every engagement begins inside 15 nm with a clock running.

  A MEASURED SATURATION RUN

    50 inbound at Mach 0.95, aggressively engaged, averaged
    over five runs:

      SINGLE salvo   35.8 killed   14.2 leaked
                     ends with 22 ESSM and 8 SM-6 in reserve
      DOUBLE salvo   37.0 killed   13.0 leaked
                     ends with the magazine completely empty

    One extra kill for every round you own. On a wave this
    size, SINGLE is the better doctrine - but you will not
    know that until you have run dry once.

    (An earlier build reported 42 killed. That figure was
    wrong: fast threats were stepping past the ship and
    orbiting instead of impacting, which handed the player
    unlimited time to engage. Fixed in 0.4 - the impact
    threshold now scales with the per-tick step so a Mach
    2.5 missile at 60x compression still connects. The
    corrected number matches the predicted 15.0 leakers
    almost exactly.)

  AUDIO  (build 0.3)
  --------------------------------------------------------------
  Everything is synthesized live with Web Audio oscillators
  and filtered noise. There are no sound files in this folder.

  WHAT YOU HEAR

    KLAXON        Two-tone naval air-action alarm, looping
                  while anything is inbound. The cadence
                  TIGHTENS as time-to-impact shrinks - from
                  8 klaxons per 5 seconds up to 15. You can
                  hear how much time you have left without
                  reading the clock.

    LOCK TICKS    A rising tick while the acquisition ring
                  closes. Pitch climbs with progress.

    LOCK ON       Two-note rising resolve with a radar
                  shimmer. THIS is your confirmation that a
                  target is designated - you do not have to
                  look away from the threat to know it took.

    SOLUTION FULL Three ascending pips when you hit the
                  salvo cap.

    VLS LAUNCH    Hatch thump, igniter crack, then the
                  booster roar sweeping down from 1500 Hz to
                  260 Hz, with a doppler whistle as it climbs
                  out. A four-round salvo staggers by 160 ms
                  so it ripples rather than stacking.

    5-INCH GUN    Sharp report with a hard low-end thump.
    CIWS          Twelve rapid pulses - the Phalanx buzzsaw.

    INTERCEPT     Warhead crack, then detonation with debris
                  shimmer.
    MISS          Duller and hollow. You will learn to
                  recognise this one immediately.

    LEAKER        A missile got through. Deep sustained boom,
                  hull groan, and it is meant to feel bad.

  PRIORITY MIXING

    During a 50-missile raid there are more sounds than
    voices. Rather than dropping randomly, sounds are tiered:

      ALWAYS      klaxon, lock confirm, leaker impact,
                  UI feedback
      IMPORTANT   launches, intercepts
      AMBIENT     lock ticks, launch whistle, debris

    Ambient detail yields first. Verified under stress: with
    80 simultaneous launch calls saturating the bus, the
    alarm, lock confirmation and impact sounds all still
    fire. You never miss information because the mix is busy.

  AUDIO INDICATOR

    Top right corner shows a five-bar volume meter and mute
    state.  M toggles.  [ and ] adjust volume.

    Browsers and Electron both require a user gesture before
    audio can start - click once in the window and it comes
    alive.


  LAUNCH VISUALS

    Vertical launch renders in phases. The booster ignites
    and the round climbs almost straight up - from above it
    barely moves, it just grows and brightens with a rising
    glow ring. At 1.2 seconds it pitches over toward the
    bearing and accelerates away.

    Smoke persists for 26 seconds and drifts. After a heavy
    engagement the water is covered in trails.


  NOT BUILT YET
  --------------------------------------------------------------
  The 5-inch gun has an engagement profile but no aimpoint
  selection yet (rudder / engines / superstructure).
  Helicopter and AWACS are stubbed but cannot launch.
  No mission objectives or scoring. MV ZAGROS DAWN is still
  out there running dark, and nothing happens when you
  find her.

  Next session: the gun aimpoint mechanic and mission one.

================================================================
