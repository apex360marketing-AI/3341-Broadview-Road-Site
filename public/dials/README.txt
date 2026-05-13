VALORA Scroll Dials
===================

5 self-contained SVG dials with scroll-driven animation. Pure SVG + inline JS,
zero dependencies, ~1–3 KB each.

Files
-----
  compass.svg   Industrial gauge that rotates proportionally to scroll delta.
  progress.svg  Outer arc fills 0→100% as the page scrolls. Live % in centre.
  morph.svg     Organic 36-vertex blob whose silhouette flows with scroll.
  atom.svg      3 elliptical orbits with planet dots at parallax speeds.
  knot.svg      Lissajous parametric curve (a=7, b=6) redraws as scroll evolves.

How to use on ANOTHER site
--------------------------
Each SVG has a <script> embedded that listens to the PARENT window's scroll
event. For the animation to run, embed via <object> or <iframe> — NOT <img>:

    <object type="image/svg+xml" data="/dials/compass.svg"
            width="120" height="120"></object>

For static use (no animation — page-load snapshot only), embed via <img>:

    <img src="/dials/compass.svg" alt="Scroll compass" width="120" height="120" />

Sizing
------
SVG scales cleanly. Set any width/height on the embed element. The viewBox is
60×60 so aspect ratio is locked square.

Colors
------
The dials use the VALORA teal accent: stroke = #7DD8D8 (bright teal). To
re-skin, open the SVG in a text editor and global-replace the hex value.

Browser support
---------------
Modern browsers (Chrome, Firefox, Safari, Edge). Inline SVG scripting works
everywhere the SVG is loaded as a DOCUMENT (object/iframe). When loaded as
an IMAGE (img/background-image), browsers block the script for security — the
SVG renders static instead.

License
-------
Use freely on any project — no attribution required.
