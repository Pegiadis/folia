# Releasing Folia

How to ship a new version and have every installed copy auto-update itself.

Folia uses [`electron-updater`](https://www.electron.build/auto-update) with a
**generic** provider: a plain folder on your web server (Hetzner) that holds the
installer plus an update manifest. On launch, each installed copy reads that
folder and updates itself in the background.

---

## One-time setup

Before your first public build, set your real update URL in `package.json`. It
gets **baked into the app at build time**, so it must be correct *before* you
build the version you hand to users.

```jsonc
// package.json → "build"
"publish": [
  {
    "provider": "generic",
    "url": "https://folia.yourdomain.com/updates/"   // ← your Hetzner URL
  }
]
```

On the server, create the matching folder once:

```bash
ssh user@your-server "mkdir -p /var/www/folia/updates"
```

Make sure that folder is served over **HTTPS** at exactly the URL above. The
update check is silent if the URL is unreachable, so a wrong URL fails quietly
(users just never get updates) — double-check it.

---

## Releasing a new version

### 1. Bump the version

Edit `version` in `package.json` (Folia follows [semver](https://semver.org/)):

```jsonc
"version": "0.2.0"
```

> The auto-updater only offers an update when the server's version is **higher**
> than what's installed. Never reuse or lower a version number.

### 2. Build

```bash
npm run dist
```

This produces three files in `release/`:

| File | Purpose |
|------|---------|
| `Folia Setup X.Y.Z.exe` | the installer users download / auto-update pulls |
| `Folia Setup X.Y.Z.exe.blockmap` | lets updates download only changed chunks (smaller, faster) |
| `latest.yml` | the manifest the updater reads (version, filename, hash) |

> First build on a fresh machine? If `npm run dist` fails extracting
> `winCodeSign` with *"Cannot create symbolic link"*, manually extract the
> cached archive into its final folder name, then re-run `npm run dist`:
> ```bash
> SZ="node_modules/7zip-bin/win/x64/7za.exe"
> CACHE="$LOCALAPPDATA/electron-builder/Cache/winCodeSign"
> "$SZ" x -y "$CACHE/<cached>.7z" -o"$CACHE/winCodeSign-2.6.0"
> ```

### 3. Upload to the server

Upload **all three** files to your `updates/` folder. `latest.yml` must sit
next to the `.exe` it points to.

```powershell
# from the project root (PowerShell), replace user@your-server + version
$ver = "0.2.0"
scp "release\Folia Setup $ver.exe"          user@your-server:/var/www/folia/updates/
scp "release\Folia Setup $ver.exe.blockmap" user@your-server:/var/www/folia/updates/
scp "release\latest.yml"                     user@your-server:/var/www/folia/updates/
```

Keep older installers in the folder — `latest.yml` always points at the newest,
and delta downloads may reference the previous build.

### 4. (Optional) Update the public download

The landing page's **Download** button points at a stable filename
(`/download/Folia-Setup.exe`). To make new *first-time* downloads get the latest
version, also overwrite that file:

```powershell
scp "release\Folia Setup $ver.exe" user@your-server:/var/www/folia/download/Folia-Setup.exe
```

(Existing users don't need this — they auto-update from `updates/`.)

---

## What users experience

1. They launch Folia → it quietly checks `https://folia.yourdomain.com/updates/latest.yml`.
2. If a newer version exists, it downloads in the background.
3. When ready, a **"Update ready — Restart"** toast appears.
4. They click **Restart** (or it installs next time they quit). Done.

No reinstall, no SmartScreen prompt on updates, no action needed from you beyond
uploading the three files.

---

## Quick checklist

- [ ] `version` bumped in `package.json`
- [ ] `npm run dist` succeeded
- [ ] `Folia Setup X.Y.Z.exe`, `.blockmap`, and `latest.yml` uploaded to `updates/`
- [ ] (optional) `download/Folia-Setup.exe` overwritten for new downloads
- [ ] Tagged the release in version control (recommended): `git tag vX.Y.Z`
