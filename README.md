# 🍪 ElDevoraCucas

[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Firefox extension that reads cookies from the networks scrapmf supports and writes
them as a Netscape `cookies.txt`. It also implants a `cookies.txt` back into a
browser.

Runs on Firefox for Android and desktop. Needs Firefox 109 or newer.

Extension ID: `eldevoracucas@mfapplications`

## 📡 Networks

Instagram, TikTok, Twitter/X, VSCO, Threads, Facebook.

The popup dropdown ticks one, several, or all of them. An export writes the
cookies of the ticked networks and skips the rest.

## 📤 Export

1. Log in to the sites you want inside Firefox.
2. Click the ElDevoraCucas icon.
3. Tick the networks in the dropdown.
4. Type a file name. The extension appends `.txt`.
5. Press **Download cookies.txt** or **Copy to clipboard**.

The popup stores your network selection and file name in `storage.local` and
restores them the next time you open it.

## 🩹 Implant

The implant page writes cookies into a browser. Open it from the popup with
**Open Implant Page**, or from the add-on options.

Paste Netscape text, drop a `.txt` file onto the zone, or pick one from the file
chooser. The page skips any domain outside the six networks above and overwrites
the session cookies of the domains in the file. Log in again on any site you
replaced.

## ⌨️ Shortcut

`Ctrl+Shift+F12` exports from any supported site without opening the popup.

Firefox owns the binding. Change it at `about:addons`, gear icon next to
ElDevoraCucas, **Manage Extension Shortcuts**.

The shortcut needs a keyboard with a Ctrl key. A touch-only phone has no path to
it, so on Android you open the popup and tap **Download cookies.txt**.

## 📦 Install

### Android

Release Firefox for Android accepts signed add-ons only. Sideloading an unsigned
`.xpi` fails, and `xpinstall.signatures.required` has no effect on release
builds. One route works today:

**Firefox Nightly**, with signing off:

1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
2. Push the file to the phone from a computer:
   ```bash
   adb push ElDevoraCucasMF.xpi /mnt/sdcard/
   ```
3. In Firefox, open `file:///mnt/sdcard/` and tap `ElDevoraCucasMF.xpi`.
4. Accept the blocked add-on warning, then the unverified warning.

**addons.mozilla.org**, once the listing goes live. AMO signs the build and the
install survives updates.

### Desktop

`about:debugging` → **This Firefox** → **Load Temporary Add-on** → pick
`manifest.json`. You load the folder, not the `.xpi`. Temporary installs clear
when Firefox closes.

## 📱 Android workflow

Install the build, log in to the sites you want, export, then point scrapmf at
the file from Termux:

```bash
cp ~/storage/downloads/cookies.txt ~/.config/scrapmf/cookies/android.txt

scrapmf scrape "https://www.instagram.com/example_user/" \
  --cookies ~/.config/scrapmf/cookies/android.txt
```

Firefox writes downloads to `~/storage/downloads`, which Termux reaches through
the symlink that `termux-setup-storage` creates. Run `termux-setup-storage` once
per fresh install.

scrapmf reads the file you hand it and does not refresh it. An expired session
stays expired until you export again.

## 🛠️ Development

```bash
node tests/cookies.test.js
```

The test covers the Netscape conversion in `lib/cookies.js`. There is no build
step: `manifest.json` at the root is the extension.

To rebuild the package:

```bash
zip -r -X ElDevoraCucasMF.xpi manifest.json background.js content.js lib icons options popup README.md tests LICENSE
```

`manifest.json` has to sit at the archive root or Firefox rejects the file.

## 🔒 Privacy

The extension makes no network requests and collects nothing. It reads cookie
values for the six networks and writes them where you ask.

An exported file holds live session cookies. Anyone holding the file can act as
you on those sites until the sessions expire. Keep it out of shared storage and
out of git.

## 📜 License

MIT. The full text sits in [`LICENSE`](LICENSE).

Anyone may use, modify, and redistribute this extension, including for money, as
long as the copyright line stays with the copies. The extension carries no
warranty of any kind.