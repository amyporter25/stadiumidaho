# How to preview Lot Studio

This Cloud Agent runs Lot Studio on a **remote VM**. `http://localhost:3000`
on that VM is not the same as `localhost` on your laptop. Clicking a
`localhost` link in chat opens **your** machine, which is why Chrome shows
connection refused (−102) even in Cursor Desktop.

Use one of the paths below.

## 1. Cursor Desktop — live preview (port forward)

You must be in the **Agents Window**, connected to **this** cloud agent,
not only in the classic editor / Composer panel.

1. `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) → **Open Agents Window**
2. Select this cloud agent in the sidebar so its tab is active
3. Look for the **plug icon** at the top-right of the editor panel
4. Click it → turn **Auto-Forward Ports** on if it is off
5. If port **3000** is missing, **manually forward 3000**
6. In that same plug menu, **open the forwarded port in the built-in browser**

Then go to `/studio?lot=46/3`.

Do **not** paste `http://localhost:3000` into system Chrome unless the plug
menu shows 3000 forwarded to your laptop. If local 3000 was already in use,
Cursor may map the VM to a **random** local port — the plug menu is the
source of truth.

Vite is started from `.cursor/environment.json` `terminals`. Cursor does not
always auto-detect those, so the manual forward step is expected.

## 2. Permanent public URL (no plug icon)

After GitHub Actions finishes:

**https://amyporter25.github.io/stadiumidaho/studio?lot=46/3**

Open that in Chrome or Safari. Every push to `main` or a `cursor/**` branch
updates this same URL.

### One-time GitHub setting (required once)

1. Open **https://github.com/amyporter25/stadiumidaho/settings/pages**
2. Under **Build and deployment → Source**, choose **GitHub Actions**
3. Open **https://github.com/amyporter25/stadiumidaho/actions/workflows/preview.yml** and click **Run workflow**

## 3. Run it on your own machine

```bash
git clone https://github.com/amyporter25/stadiumidaho.git
cd stadiumidaho
git checkout cursor/lot-studio-track-b-3c2b
npm ci
npm run dev
```

Then open `http://localhost:3000/studio?lot=46/3` in Chrome or Safari.

## 4. Screenshots when you only need a still

Latest captures: [`docs/preview/`](./preview/)
