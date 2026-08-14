#!/usr/bin/env node
/**
 * One-off: replace hardcoded Plus Jakarta Sans with FONT_TEMPLATE_DEFAULT / FONT_UI_STACK
 * and inject brand-fonts import where needed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const raw = execSync(
	`rg -l 'Plus Jakarta Sans' src --glob '!src/lib/fonts/brand-fonts.ts' --glob '!src/app.css' --glob '!*.md'`,
	{ encoding: 'utf8' },
);
const files = raw
	.trim()
	.split('\n')
	.filter(Boolean);

const DISPLAY_IMPORT =
	"import { FONT_TEMPLATE_DEFAULT, FONT_UI_STACK } from '$lib/fonts/brand-fonts';";
const DISPLAY_ONLY_IMPORT = "import { FONT_TEMPLATE_DEFAULT } from '$lib/fonts/brand-fonts';";

for (const file of files) {
	let src = readFileSync(file, 'utf8');
	if (file.endsWith('brand-fonts.ts')) continue;

	const usesUiStack = src.includes("'Plus Jakarta Sans', ui-sans-serif") ||
		src.includes('`Plus Jakarta Sans`, ui-sans-serif');

	let next = src
		.replace(/'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif/g, 'FONT_UI_STACK')
		.replace(/`'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif`/g, 'FONT_UI_STACK')
		.replace(/fontFamily:\s*'Plus Jakarta Sans'/g, 'fontFamily: FONT_TEMPLATE_DEFAULT')
		.replace(/fontFamily=\{[^}]*'Plus Jakarta Sans'/g, (m) => m.replace("'Plus Jakarta Sans'", 'FONT_TEMPLATE_DEFAULT'))
		.replace(/\?\? 'Plus Jakarta Sans'/g, '?? FONT_TEMPLATE_DEFAULT')
		.replace(/fontFamily="Plus Jakarta Sans"/g, 'fontFamily={FONT_TEMPLATE_DEFAULT}')
		.replace(/font-family:\s*'Plus Jakarta Sans', sans-serif/g, 'font-family: var(--font-display)')
		.replace(/font-family:\s*'Plus Jakarta Sans', -apple-system[^;]+;/g, 'font-family: var(--font-body);')
		.replace(/font-family:\s*'Plus Jakarta Sans', system-ui[^;]+;/g, 'font-family: var(--font-display);')
		.replace(/font-family="Plus Jakarta Sans,/g, 'font-family="var(--font-display),')
		.replace(/fontFamily:\s*'Plus Jakarta Sans', sans-serif/g, 'fontFamily: FONT_TEMPLATE_DEFAULT')
		.replace(/\{ family: 'Plus Jakarta Sans'/g, "{ family: FONT_TEMPLATE_DEFAULT")
		.replace(/family === 'Plus Jakarta Sans'/g, 'family === FONT_TEMPLATE_DEFAULT')
		.replace(/scheduleFontFaceHint\('Plus Jakarta Sans'/g, "scheduleFontFaceHint(FONT_TEMPLATE_DEFAULT")
		.replace(/font-family: Plus Jakarta Sans,/g, 'font-family: var(--font-display),');

	// Remaining bare strings
	next = next.replace(/'Plus Jakarta Sans'/g, 'FONT_TEMPLATE_DEFAULT');

	const needsImport =
		next.includes('FONT_TEMPLATE_DEFAULT') || next.includes('FONT_UI_STACK');
	const hasImport = next.includes("from '$lib/fonts/brand-fonts'");

	if (needsImport && !hasImport && (file.endsWith('.ts') || file.endsWith('.svelte'))) {
		if (file.endsWith('.svelte')) {
			next = next.replace(
				/(<script[^>]*>\n)/,
				`$1\t${usesUiStack ? DISPLAY_IMPORT : DISPLAY_ONLY_IMPORT}\n`,
			);
		} else {
			next = next.replace(
				/^/,
				`${usesUiStack ? DISPLAY_IMPORT : DISPLAY_ONLY_IMPORT}\n`,
			);
		}
	}

	if (file === 'src/lib/fonts.ts') {
		next = readFileSync(file, 'utf8');
		next = `import { FONT_BODY, FONT_TEMPLATE_DEFAULT } from '$lib/fonts/brand-fonts';\n\n${next}`;
		next = next.replace(
			/\{ family: 'Plus Jakarta Sans'/,
			'{ family: FONT_TEMPLATE_DEFAULT',
		);
		next = next.replace(
			/if \(family === 'Plus Jakarta Sans'\)/,
			'if (family === FONT_TEMPLATE_DEFAULT)',
		);
		next = next.replace(
			/scheduleFontFaceHint\('Plus Jakarta Sans'/,
			'scheduleFontFaceHint(FONT_TEMPLATE_DEFAULT',
		);
		// Add Inter to GOOGLE_FONTS if missing
		if (!next.includes("family: FONT_BODY")) {
			next = next.replace(
				/export const GOOGLE_FONTS/,
				"export const GOOGLE_FONTS",
			);
		}
	}

	if (next !== src) {
		writeFileSync(file, next);
		console.log('updated', file);
	}
}

console.log('done', files.length, 'files scanned');
