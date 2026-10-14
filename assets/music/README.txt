================================================================
  MUSIC FOLDERS
================================================================

  Four folders, one per musical state:

    menu/       Main menu, world chart, briefing, debrief,
                settings, credits, story beats
    sailing/    Under way, nothing detected. Chill.
    tension/    Contacts held or a threat building. Uneasy.
    action/     Shooting. Full combat.

  Drop audio files into the folder that matches the mood.
  Supported: .mp3, .ogg, .m4a, .wav


  HOW THE STATES CHANGE
  ----------------------------------------------------------------

  Menu screens use menu/ and nothing else.

  Inside a mission the game moves between the other three ON ITS
  OWN, based on what is actually happening:

    SAILING   nothing held, no threats
    TENSION   unknown or hostile contacts held, or inbound
              missiles still far out
    ACTION    you have designated or fired, OR a missile is
              inside 45 seconds of impact

  Escalation is INSTANT - the moment something appears the music
  jumps up. Winding back down waits at least 12 seconds so the
  track does not flap between states during a running fight.

  The current state shows in the top right corner of the HUD
  during a mission.


  EMPTY FOLDERS ARE SAFE
  ----------------------------------------------------------------

  If a state has no tracks it falls back down the chain:

    action  ->  tension  ->  sailing  ->  menu

  So you can fill them in one at a time. An empty action/ folder
  just means tension music keeps playing during a fight, rather
  than silence.


  ADDING A TRACK — TWO STEPS
  ----------------------------------------------------------------

  1. Copy the file into the folder for its mood.

  2. Open  js/music.js  and add an entry to TRACKS:

       action_stormfront: {
         file: 'assets/music/action/stormfront.mp3',
         title: 'Stormfront',
         composer: 'Composer Name',
         licence: 'CC BY 4.0',
         licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
         source: 'https://...',
         gain: 0.8           // level trim, 1.0 = full
       },

     Then add the key to that state's playlist:

       const PLAYLISTS = {
         menu:    ['menu_legionnaire'],
         sailing: ['sail_legionnaire'],
         tension: [],
         action:  ['action_stormfront']
       };

  The prefix on the key is only a naming convention to keep
  things readable. What matters is the file path and which
  playlist array it appears in.


  MULTIPLE TRACKS PER STATE
  ----------------------------------------------------------------

  A state with several tracks SHUFFLES them and advances
  automatically when one ends. A state with one track loops it.

  Moving between screens that share a state does not restart the
  music.


  ATTRIBUTION IS AUTOMATIC
  ----------------------------------------------------------------

  Whatever you put in title / composer / licence appears on the
  in-game CREDITS screen and in the NOW PLAYING readout on the
  main menu. Creative Commons licences require attribution, so
  fill those fields in properly.

  If a file listed in TRACKS is missing, the game logs a warning,
  drops it from the playlist, and leaves it out of the credits.
  Nothing crashes.


  WHAT TO PUT WHERE
  ----------------------------------------------------------------

  menu/     Something with a theme. This is the first thing
            anyone hears. Marches work well here.

  sailing/  Long, sparse, slow. You may be on this screen for
            twenty minutes. Anything with a strong hook will
            wear out fast.

  tension/  Low drones, a pulse, strings that do not resolve.
            It should feel like waiting.

  action/   Percussion and drive. But keep the MIDRANGE clear -
            the klaxon, the lock confirmation and the difference
            between a hit and a miss all live there, and they
            carry information you need. Music that buries them
            makes the game harder to read, not more exciting.

            The game already ducks music to 28 percent when the
            alarm sounds, but sparse beats dense here.


  WHERE TO FIND MUSIC YOU CAN USE
  ----------------------------------------------------------------

  Scott Buckley          scottbuckley.com.au       CC BY
  Kevin MacLeod          incompetech.com           CC BY
  Free Music Archive     freemusicarchive.org      various
  US Marine Band         marineband.marines.mil    public domain
  US Navy Band           navyband.navy.mil         public domain
  Musopen                musopen.org               public domain

  Note on military recordings: works of the US federal
  government are public domain, but a specific RECORDING can
  carry its own copyright even when the composition does not.
  Wikimedia Commons is the safest source because every file
  states its licence explicitly.

================================================================
