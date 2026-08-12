/** Inner fill only — no `text-shadow` / `filter` (those un-clip the paint to a black box). */
export const CLIPPED_TEXT_FILL_CSS =
	'-webkit-background-clip: text; ' +
	'background-clip: text; ' +
	'-webkit-text-fill-color: transparent; ' +
	'color: transparent; ' +
	'text-shadow: none; ' +
	'filter: none; ' +
	'display: inline;';

/** Outer wrap: drop-shadow follows glyph alpha after clip. */
export const CLIPPED_TEXT_SHADOW_WRAP_CSS =
	'display: inline; text-shadow: none; filter: var(--text-drop-shadow, none);';

export function patternStyleForUrl(patternUrl: string | undefined): string {
	if (!patternUrl) return '';
	return (
		`background-image: url('${patternUrl}');` +
		`background-size: cover; background-position: center;` +
		CLIPPED_TEXT_FILL_CSS
	);
}

export function gradientTextFillCss(from: string, to: string): string {
	return `background-image: linear-gradient(90deg, ${from}, ${to});` + CLIPPED_TEXT_FILL_CSS;
}

export function wrapClippedFillHtml(fillStyle: string, escapedText: string): string {
	return `<span style="${CLIPPED_TEXT_SHADOW_WRAP_CSS}"><span style="${fillStyle}">${escapedText}</span></span>`;
}

