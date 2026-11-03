# Client Instagram previews

Static pages (GitHub Pages) + a Google Apps Script bound to each client's posting schedule.

- `preview.html?c=<client>` – what the client sees: Instagram-like feed, full-screen reels, comment and approve on every post.
- `studio.html?c=<client>` – team view: drag to reorder, pin, remove, edit captions, then **📤 Posting Schedule-ში გადატანა**.
- `clients/<client>/config.json` – profile texts, posts (media, caption, which schedule row they match) and the Apps Script URL (`api`).
- `clients/<client>/media/` – images and compressed reels.
- `apps-script/Code.gs` – backend. Comments turn the schedule row pink, approvals yellow; layout is stored in a hidden `_preview` tab, feedback in `_comments`.

## New client
1. Copy `clients/likedent` to `clients/<new>`, replace media and `config.json`.
2. In the client's schedule sheet: Extensions > Apps Script, paste `Code.gs`, Deploy > Web app (Execute as me, Anyone).
3. Put the `/exec` URL in `config.json` as `api`. The first team code typed in Studio becomes that client's code.
