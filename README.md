# Alien Arrangement Table 👽

An online, iPad-friendly version of the classic **"Aliens" periodic-table trends
lab** (activity by John Bergmann and Jeff Christopherson). Instead of cutting out
paper cards, students drag alien cards around a zoomable "table," arrange them into
a pattern, and look for trends — no scissors required.

Built as a single static site (no build step, no dependencies) for free hosting on
**GitHub Pages**.

## What students can do

- **Move a card:** drag it. It **snaps to the grid** when released.
- **Pan the table:** drag any empty spot.
- **Zoom:** pinch with two fingers, or use the **+ / −** buttons.
- **Look closely at one card:** double-tap it to zoom right in.
- **See the whole arrangement:** tap **Fit**.
- **See part of the array:** pan and zoom to any region.
- **Stack cards:** drop a card onto another and they stack, with a badge showing
  how many are in the pile (and a fanned edge so it's clearly a stack). Drag the
  top card off to unstack.
- **Stack all / Spread out:** gather every card into one deck, or lay them all out.
- **Blank card:** add a “?” card to mark where a missing alien belongs.
- **Two sets:** choose **Set A** or **Set B** at the start; switch anytime from the
  menu. Each set’s arrangement is saved separately on the iPad.

There is **no answer key and no way to check answers** — by design. Students
organize and predict on their own.

## Designed for iPad

Touch-first: one-finger drag to move cards or pan, two-finger pinch to zoom,
double-tap to inspect. Page zoom/scroll and text selection are disabled so the
gestures feel like a native app. Arrangements auto-save in the browser, so a
sleep/refresh won’t lose work.

## Run locally

```bash
python3 -m http.server 4180
```

Then open <http://localhost:4180>. (Opening `index.html` directly also works.)

## Deploy to GitHub Pages

1. Create a repository on GitHub.
2. Push this folder:

   ```bash
   git init
   git add .
   git commit -m "Alien Arrangement Table"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```

3. **Settings → Pages → Source: Deploy from a branch → main → / (root)**.
4. Visit `https://<your-username>.github.io/<repo>/`.

The empty `.nojekyll` file makes GitHub Pages serve the files as-is.

## Project structure

```
index.html    # screens + toolbars
styles.css     # styling (table, grid, cards, sheets)
app.js         # pan/zoom canvas, drag, grid-snap, stacking, autosave
data.js        # the two alien card sets
images/        # 40 alien cards (A01–A20, B01–B20), transparent PNGs
.nojekyll      # serve files unmodified on GitHub Pages
```

## Credits

Alien artwork and the original activity are from the *"Aliens Activity"* worksheet
by **John Bergmann and Jeff Christopherson**. The alien drawings were cut from that
worksheet for use as movable cards.
