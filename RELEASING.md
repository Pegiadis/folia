# Releasing Folia

How to ship a new version and have every installed copy auto-update itself.

Folia uses [`electron-updater`](https://www.electron.build/auto-update) with a
**generic** provider: a plain folder on your web server (Hetzner) that holds the
installer plus an update manifest. On launch, each installed copy reads that
folder and updates itself in the background.

---

## One-time setup — already done ✅

Folia is deployed on the **moltbot** Hetzner server (`ssh moltbot`):

- **Live site:** https://folia.duckdns.org (static landing page in `/var/www/folia`)
- **Downloads:** `/var/www/folia/download/` → `Folia-Setup.exe`, `Folia-Portable.zip`
- **Update feed:** `/var/www/folia/updates/` → `latest.yml` + the versioned `.exe` + `.blockmap`
- **Caddy** serves it with auto-HTTPS; the block lives at the bottom of `/etc/caddy/Caddyfile`

The update URL is already set in `package.json` (baked into the app at build time):

```jsonc
// package.json → "build"
"publish": [
  {
    "provider": "generic",
    "url": "https://folia.duckdns.org/updates/"
  }
]
```

The update check is silent if the URL is unreachable, so a wrong URL fails quietly
(users just never get updates).

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

### 3. Upload to moltbot

electron-builder produces files with **spaces** in the name (`Folia Setup
X.Y.Z.exe`). We publish them under **space-free** URLs, so rename on upload and
point `latest.yml` at the clean name. Run from the project root (Git Bash):

```bash
ver="0.2.0"
cd release

# update feed: exe (clean name) + blockmap + a latest.yml rewritten to match
scp "Folia Setup $ver.exe"          moltbot:/var/www/folia/updates/Folia-Setup-$ver.exe
scp "Folia Setup $ver.exe.blockmap" moltbot:/var/www/folia/updates/Folia-Setup-$ver.exe.blockmap
sed "s/Folia Setup $ver.exe/Folia-Setup-$ver.exe/g" latest.yml > /tmp/latest.yml
scp /tmp/latest.yml                  moltbot:/var/www/folia/updates/latest.yml

# public download button (stable name) — copy the exe server-side, no re-upload
ssh moltbot "cp /var/www/folia/updates/Folia-Setup-$ver.exe /var/www/folia/download/Folia-Setup.exe \
  && find /var/www/folia -type f -exec chmod 644 {} \;"

# portable build (optional)
scp "Folia-$ver-portable-win.zip"   moltbot:/var/www/folia/download/Folia-Portable.zip
```

`latest.yml` must sit next to the `.exe` it names. Keep older installers in
`updates/` — the manifest always points at the newest, and delta downloads may
reference the previous build.

> The landing page's **Download** button is the stable `/download/Folia-Setup.exe`,
> so it never changes — existing users auto-update from `updates/` regardless.

### Verify

```bash
curl -sI https://folia.duckdns.org/download/Folia-Setup.exe | grep -i 'HTTP\|length'
curl -s  https://folia.duckdns.org/updates/latest.yml
```

---

## What users experience

1. They launch Folia → it quietly checks `https://folia.duckdns.org/updates/latest.yml`.
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
