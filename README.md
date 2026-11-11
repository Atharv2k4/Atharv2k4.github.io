# Atharv Yadav — portfolio

Static site: plain HTML, CSS and JavaScript. No build step, no dependencies, no backend.

## Files

```
index.html                    all content (readable without JavaScript)
favicon.svg
404.html                      shown for wrong addresses
projects/autodidact.html      case-study page for the AUTODIDACT project
.nojekyll                     tells GitHub Pages to serve files as-is
assets/
  Atharv_Yadav_CV.pdf         the file behind every "Download CV" button
  css/style.css               all styling; colours are variables at the top
  js/main.js                  menu, scroll reveals, nav highlight, lazy-loads arm.js
  js/arm.js                   the 3D hero (robot arm), bundled with three.js; optional
  fonts/                      Archivo + JetBrains Mono (SIL Open Font License)
  img/hero-arm.avif/.webp     static hero image (plus -640 versions for phones)
  img/og.png                  preview image for LinkedIn / WhatsApp links
src/arm.src.js                readable source of the 3D hero (not loaded by the site)
publish.bat                   one-click commit and push (Windows)
```

## Publish (Windows)

1. On github.com, create a new **public**, **empty** repository named `Atharv2k4.github.io`
   (no README, no .gitignore, no licence).
2. Double-click `publish.bat` in this folder. It commits everything and pushes to that repository.
   The first time, Git may open a browser window asking you to sign in to GitHub.
3. On GitHub: Settings → Pages → "Deploy from a branch" → `main` → `/ (root)`.

After any later change, double-click `publish.bat` again.

## Still open

- Publication: add the DOI or Springer link when you have it (there is a comment in
  `index.html` showing where).

## Updating things later

**Add a project.** In `index.html`, find `PROJECTS`. Copy one whole
`<article class="card reveal"> … </article>` block, paste it inside `<div class="cards">`,
and edit the label, title, text, chips and link. The drawing inside
`<div class="card-art">` is optional: delete that div for a text-only card, or use a photo:

```html
<div class="card-art"><img src="assets/img/my-project.webp" width="640" height="360" loading="lazy" alt="Short description"></div>
```

Export photos as WebP, about 1280 px wide, and keep `width`, `height` and `loading="lazy"`.

**Make a different project the big one.** Move the class `card-lead` to that card.

**Replace the CV.** Overwrite `assets/Atharv_Yadav_CV.pdf` with the new file, same name.

**Change colours.** Edit the variables in `:root` at the top of `assets/css/style.css`
(`--amber` is the accent).

**Change the 3D hero.** Edit `src/arm.src.js`, then rebuild the bundle (needs Node.js):

```
npm i three esbuild
npx esbuild src/arm.src.js --bundle --minify --format=iife --outfile=assets/js/arm.js
```

**Remove the 3D hero.** Delete `assets/js/arm.js`. The static image stays.

## How the hero behaves

The page first shows a static image. `arm.js` (about 130 KB compressed) loads only after
the page has finished loading, and not at all when the visitor has reduced motion or data
saver on, or the device reports 2 or fewer CPU cores or 2 GB or less memory, or has no
WebGL. While running it is capped at 30 fps, pauses when scrolled out of view or when the
tab is hidden, and switches back to the static image if the device can't keep up.
