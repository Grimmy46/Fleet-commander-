# Fleet Command — Design Doc (draft v2)

Status: draft v2 · Owner: Grimmy46 · Last updated: 14 Oct 2026

## 1. The pitch

**You run a private navy.** Take contracts around the world's most dangerous waters, fight in fast, readable naval battles, get paid, and turn one leased destroyer into a fleet.

Feel: **Command & Conquer: Generals – Zero Hour, at sea.** A 3D battlefield seen from an angled RTS camera, punchy explosions, units you select and command, and a sidebar where money turns into firepower. Modern missiles, real geography, arcade handling.

## 2. Design pillars

1. **Real world, readable game.** Real coastlines, real ships, real weapons, but the game always tells the player what matters. If you find a man overboard, a big marker pops up. Objectives sit on the map, not only in a list.
2. **Operator in the fight, captain at the big moments.** In combat you command and fire yourself. At key story moments (divert to a distress call? fire on a launch site ashore? expose the sabotage or stay quiet?) the game pauses and the player decides with a clear choice card. Choices change the story, reputation and later contracts.
3. **Every shot costs money.** Missiles aren't free and don't come back between missions. Contracts pay; ammunition, repairs and upgrades cost. Spending wisely is part of winning.
4. **Start small, grow big.** One weapon in the first mission. Each mission adds one new system. The end game is a fleet.

## 3. Core loop

```
CONTRACT BOARD ──► PREPARE ──► TRANSIT ──► MISSION ──► DEBRIEF ──┐
 pick a job        rearm,       short,       fight,      pay,      │
 see pay & risk    repair,      skippable    rescue,     reputation│
                   upgrade                   escort      news      │
      ▲                                                            │
      └────────────────────────────────────────────────────────────┘
```

Each mission should last 8–15 minutes. Transit is a short animated sequence, not gameplay.

## 4. Combat feel

- **Camera:** a Zero Hour-style **angled 3D RTS camera** looking down on the battle. Scroll with mouse at the screen edge or WASD, zoom with the wheel from a close look at your ship out to the whole area, rotate with middle mouse. A **minimap** in the corner shows the full area, and fully zoomed out the view blends into the tactical map with NATO symbols.
- **RTS controls:** left-click or drag a box to select units (your ship, the helo, later escorts). Right-click to move or attack. Hotkeys for weapons and abilities. Control groups (Ctrl+1–9) once you have a fleet.
- **Arcade scale:** real ranges are compressed for play. The real radar horizon is about 15 nm against a sea-skimming missile; in-game distances are shortened so threats arrive in seconds, not minutes, and you can actually see them.
- **Readable threats:** incoming missiles get a big red marker, a time-to-impact countdown and a direction arrow at the screen edge.
- **Weapons:** select the ship, pick a weapon on the command bar (or press its key), click a target. No hidden 0.5-second hover-to-lock.
- **Feedback:** every hit, miss and kill has a clear sound, a visual and a short line of text.
- **Command bar:** a bottom or side panel like the Zero Hour sidebar, showing the selected unit's weapons, ammo and abilities as big icons with cooldowns and prices.
- **Contractor powers:** like Generals powers, unlocked with money and reputation: UAV recon sweep, airstrike, electronic jamming, emergency resupply drop. Each has a cooldown and a cost.

## 5. The first 15 minutes (onboarding)

1. **UI tour:** 5 slides before the first mission: your ship, moving, contacts, weapons, objectives. Skippable, and viewable again from Settings.
2. **Mission 1 "Workups": gun only.** Only the 5-inch gun panel is visible. Shoot slow surface drones. Teaches: move, find a target, fire.
3. **Mission 1b: ESSM unlocked.** Incoming target drones. Teaches: lock and fire a missile, read the threat marker.
4. **Mission 2: helicopter unlocked.** The man-overboard search.
5. Each new panel appears with a highlight the first time it's needed. The full HUD only appears once the player has unlocked everything.

## 6. Helicopter redesign

Problem today: you select the helo and click points on the map. It's fiddly, its state is unclear, and it felt buggy.

New design: **give orders, not waypoints.** Click the helo (or press H) to open an order menu:

| Order | What happens |
|---|---|
| Search area | Drag a circle on the map. The helo flies a search pattern on its own and reveals anything inside. |
| Rescue | Fly to a found survivor, hover, winch up (progress bar), return. |
| Deliver | Pick up cargo on deck, fly to a drop zone, lower it (progress bar). |
| Scout | Fly ahead and extend your radar picture. |
| Attack (upgrade) | Later: anti-ship missiles or torpedoes. |
| Return | Comes home, lands, refuels. |

Always visible on the helo icon: current order, a fuel ring, and a clear "RETURNING — LOW FUEL" state. Discovery moment: when the search finds the survivor, a large marker appears, a ping sound plays and the camera nudges toward it.

## 7. Economy

**Money in:** contract payment, plus bonuses (fast completion, no civilian damage, client vessel undamaged, optional objectives).

**Money out:**
- Ammunition: every missile and gun round has a price. Prices are tuned for the game, not real-world: an SM-6 should hurt, a gun round shouldn't.
- Repairs: damage carries over until repaired in port.
- Upgrades and new ships.

**Reputation** (Navy, Corporate, Public) decides which contracts appear and how much they pay. Turning down a rescue is cheaper, but Public reputation drops.

## 8. Upgrades and fleet

Upgrade tree, bought in port:

| Branch | Examples |
|---|---|
| Weapons | Extra VLS cells, Naval Strike Missile launchers, better gun ammunition, laser CIWS |
| Defense | Chaff and decoys, SeaRAM, armor plating, damage control teams |
| Sensors | Radar range, faster classification, a scout drone |
| Mobility | Top speed, turn rate, acceleration |
| Aviation | Second helicopter, helo weapons, faster refuel |

**Fleet (later):** buy more ships (fast patrol boat → frigate → destroyer), deployed like RTS units: select, right-click to move or attack, set stance (guard, follow, hold fire), put in control groups. The flagship is your most important unit; lose it and the mission fails.

## 9. Audio

Move from synthesized beeps to recorded, layered samples: launches, gun reports, explosions, the klaxon, radio chatter, helo rotor, ocean ambience. Sounds are positioned in 3D, so a missile coming from the left sounds like it. Keep the existing priority mixing, which works well. Use CC0 or licensed libraries only, and log every source in MUSIC-ATTRIBUTION.txt.

## 10. Visual direction

- **Ocean:** animated water with waves, foam, wakes, weather and time of day.
- **Ships:** proper 3D models with bold silhouettes that read from the RTS camera, team-color highlights and selection rings like Zero Hour.
- **Effects:** big readable explosions, missile smoke trails, tracer fire, burning wrecks and debris; arcade-scale, not subtle.
- **World map:** real coastline data instead of hand-drawn shapes, and a nicer globe with route lines, ports and contract markers.
- **UI:** larger type, fewer panels, and a clear color language (red = threat, green = friendly or objective done, yellow = objective, blue = info). Game-style markers over the 3D view.

## 11. Technology

- Stay on the web stack (JavaScript + Electron) so the current test-build pipeline keeps working.
- **Three.js** for 3D rendering, **Vite** for modern modules and fast reloads.
- Clean split: simulation (rules, physics), rendering, UI and content kept separate.
- Content in data files: weapons, ships, upgrades, missions, prices.
- Save system from day one (auto-save + Continue).
- Automated tests keep running on every push.

## 12. Roadmap

| Milestone | Goal | Playable result |
|---|---|---|
| 0.20 New foundation | Rebuild the engine on Three.js + Vite: RTS camera, minimap, selection, save system, data files | Your ship on a 3D ocean: select it, right-click to move, fire the gun at targets |
| 0.21 First 15 minutes | Command bar UI, UI tour slides, gun-only and ESSM missions | A new player can learn the game without help |
| 0.22 Helo and search | Order-based helicopter, man-overboard mission with discovery markers | Mission 2 rebuilt and fun |
| 0.23 Paid to fight | Economy, rearm, repair, first upgrade branch | Money matters between missions |
| 0.24 Sound and spectacle | New sample-based audio, explosions, smoke, weather | Combat sounds and looks right |
| 0.25 Rest of Act 1 | Relief run, interdiction and escort ported and polished | Full Act 1 on the new engine |
| 0.26 Story choices | Choice cards for major story decisions, branching consequences in Act 1 and 2 | The player shapes the Spearpoint story |
| 0.30 Fleet | Buy more ships, RTS fleet control, control groups, contractor powers | First taste of running a fleet |
| 1.0 Steam | Steam build, cloud saves, achievements, store page | Release-ready on Steam |

The current 0.14 build stays downloadable until 0.21 is better.

## 13. Decisions made

1. **View:** 3D with an angled RTS camera, in the style of Command & Conquer: Generals – Zero Hour.
2. **Story:** keep Commander Mitchell and the Spearpoint story. The player makes the major story decisions through choice cards.
3. **Platform:** Windows now. Steam later, so saves, settings and builds are designed to move to Steam without rework.
