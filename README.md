# Hormuz – Fleet Command

Real-time naval command simulation set in the Strait of Hormuz.

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

Install [Node.js](https://nodejs.org) (LTS), then double-click `Play Hormuz.bat` or run `npm install` and `npm start`. See `README.txt` for controls and full details.
