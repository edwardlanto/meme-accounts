/** Typography — change brand fonts in `brand-fonts.ts` + matching `--font-*-name` in `app.css`. */
export {
	FONT_DISPLAY,
	FONT_BODY,
	FONT_DISPLAY_STACK,
	FONT_BODY_STACK,
	FONT_UI_STACK,
	FONT_TEMPLATE_DEFAULT,
	GOOGLE_FONTS_HREF,
} from './brand-fonts';

export {
	GOOGLE_FONTS,
	CATEGORY_LABELS,
	fontsByCategory,
	loadGoogleFont,
	type FontCategory,
	type GoogleFont,
} from './loader';
