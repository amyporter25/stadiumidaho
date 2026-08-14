# How to preview Lot Studio

Cloud Agent chats on [cursor.com](https://cursor.com/agents) **cannot** open
`http://localhost:3000`. That address is the agent’s remote VM, not your
laptop. Temporary tunnels (localtunnel, Pinggy, Cloudflare) also fail in
Cursor’s built-in browser. Use one of the paths below instead.

## 1. Permanent public preview (use this)

After GitHub Actions finishes, the live app is:

**https://amyporter25.github.io/stadiumidaho/studio?lot=46/3**

Open that in Chrome or Safari. Orbit the house, switch Whitestone front vs
side-entry, move it on the lot. Every push to `main` or a `cursor/**` branch
updates this same URL.

### One-time GitHub setting (only if that link 404s)

1. Open https://github.com/amyporter25/stadiumidaho/settings/pages
2. Under **Build and deployment → Source**, choose **GitHub Actions**
3. Re-run the **Preview** workflow if needed

## 2. Cursor Desktop (live server on the agent)

If you open this agent from **Cursor Desktop** (not the website):

1. Wait until the **Lot Studio** terminal is running
2. Click the **plug icon** (forwarded ports) in the editor
3. Open the forwarded port in the built-in browser, or
   `http://localhost:3000/studio?lot=46/3` in Chrome

This does **not** work from cursor.com in a regular browser tab.

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
