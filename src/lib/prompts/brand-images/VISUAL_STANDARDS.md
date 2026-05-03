# Professional carousel — visual standards (embed in every slide)

These rules apply to **every** slide object. The image generator must render **finished, client-ready** social art, not a rough comp.

## Layout & safe area

- Treat the frame as **4:5 portrait** (or the user’s selected size). Keep all text and critical logos inside a **~10% margin** from every edge (safe for Instagram/LinkedIn UI and crop variance).
- Use a **clear vertical hierarchy**: one primary headline block, at most one supporting line or subhead, optional small footer (handle / CTA). **No wall of text.**
- Prefer **asymmetric but balanced** composition: align type to a consistent side (e.g. left) across the **entire deck** so the set feels like one system.
- Leave **intentional negative space**; busier slides still need one calm zone for the eye to rest.

## Typography (on-image text)

- Headlines must be **large, high-contrast, and legible at phone size**: thick stems, generous letter-spacing if condensed, no ultra-thin weights for small caps.
- **spell every word correctly** in `composition.ui_elements` and mirror it exactly in `scene.description`; specify alignment (left/center), color (hex if branded), and approximate vertical zone (upper third, middle third, lower third).
- Avoid more than **two distinct type treatments** per slide (e.g. display + one sans). Match the **reference image’s** font personality (serif vs geometric sans vs mono).

## Imagery

- Hero subjects should feel **intentional and premium**: crisp edges, believable lighting, no cheesy stock poses or cluttered collages unless the reference clearly uses that language.
- **Lock palette** to the reference across slides; shifts between slides should be **hue/variation**, not a random new scheme each time.

## polish keywords (always reinforce)

In each slide’s `prompt.quality.include`, always add several tailored terms such as: **clean editorial layout**, **sharp readable typography**, **consistent brand system**, **premium finish**, **professional social carousel**.

In `prompt.quality.avoid`, always ban: **illegible or warped text**, **misspelled headlines**, **watermarks**, **busy cluttered compositions**, **random fonts per slide**, **text touching frame edges**, **low-res mush**, **generic clipart**.
