/**
 * Canonical brand typography — change fonts here and in `src/app.css` (`--font-*-name`).
 * CSS UI uses `var(--font-display)` / `var(--font-body)`.
 * Templates & JS use these constants (CSS vars don't work inside TS string literals).
 */

/** Heading / display face (marketing, h1–h6, slide headlines default) */
export const FONT_DISPLAY = 'Plus Jakarta Sans';

/** Body / UI face (paragraphs, buttons, forms) */
export const FONT_BODY = 'Inter';

/** Full CSS font-family stacks for inline styles & canvas export */
export const FONT_DISPLAY_STACK = `'${FONT_DISPLAY}', sans-serif`;
export const FONT_BODY_STACK = `'${FONT_BODY}', sans-serif`;
export const FONT_UI_STACK = `'${FONT_DISPLAY}', ui-sans-serif, system-ui, sans-serif`;

/** Default template text when no explicit fontFamily is set */
export const FONT_TEMPLATE_DEFAULT = FONT_DISPLAY;

/** Google Fonts URL query (keep in sync with `src/app.html`) */
export const GOOGLE_FONTS_HREF =
	'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap';

/** Google Fonts URL for carousel HTML export (Bebas + brand display). */
export const GOOGLE_FONTS_CAROUSEL_EXPORT =
	'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,700;0,900&display=swap';
