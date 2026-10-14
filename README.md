# Hormuz – Fleet Command

Real-time naval command simulation set in the Strait of Hormuz.

## Where the game is going

See the [design doc](docs/DESIGN.md) and the [milestones](https://github.com/Grimmy46/Fleet-commander-/milestones) for the plan.

## Download the latest test build

Every push to `main` is tested and built automatically.

- [Installer (HormuzFleetCommand-Setup.exe)](https://github.com/Grimmy46/Fleet-commander-/releases/download/test-build/HormuzFleetCommand-Setup.exe)
- [Portable (HormuzFleetCommand.exe)](https://github.com/Grimmy46/Fleet-commander-/releases/download/test-build/HormuzFleetCommand.exe), no install needed
- [All test builds and notes](https://github.com/Grimmy46/Fleet-commander-/releases/tag/test-build)

The build is unsigned, so Windows SmartScreen may warn you. Click "More info" and then "Run anyway".

## How the automation works

`.github/workflows/test-build.yml` runs on every push and pull request:

1. **Smoke test:** syntax-checks every script, then loads the game in headless Chromium and plays from the main menu into a tactical mission. Any script error, console error or missing file fails the build. Screenshots are attached to each run.
2. **Windows build:** packages the installer and portable exe with electron-builder, stamped `0.14.<run number>`.
3. **Publish:** on `main` only, replaces the rolling `test-build` pre-release with the new files.

Pull requests get the test and build (downloadable from the Actions run page) without publishing.

## Running from source

Install [Node.js](https://nodejs.org) (LTS), then:

| Command | What it runs |
|---|---|
| `Play Hormuz.bat` or `npm start` | The new 3D engine (0.20, in progress) with live reload: save a file in `src/` and the game updates instantly |
| `Play Legacy 0.14.bat` or `npm run legacy` | The old 0.14 canvas game |
| `npm run preview` | The new engine from built files, exactly as the installer runs it |
| `npm run build` | Windows installer in `dist/` |

## Project layout

| Path | Contents |
|---|---|
| `src/sim/` | Simulation: game rules and physics, no graphics. Runs in tests far faster than real time and saves to JSON |
| `src/render/` | Renderer: draws the simulation with Three.js, never changes it |
| `src/engine/`, `src/scenes/` | Game loop and scenes that connect the simulation, renderer and input |
| `electron/main.js` | Electron entry point for both engines |
| `game.html`, `js/`, `assets/` | Legacy 0.14 game, kept playable until the new engine replaces it |
| `tests/` | Automated smoke tests for both engines |
| `docs/DESIGN.md` | Design doc |

See `README.txt` for 0.14 controls and details.
