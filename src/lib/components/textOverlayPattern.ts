export function patternStyleForUrl(patternUrl: string | undefined): string {
	if (!patternUrl) return '';
	return `
		background-image: url('${patternUrl}');
		background-size: cover;
		background-position: center;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		mix-blend-mode: screen;
		filter: contrast(1.25) saturate(1.15);
		opacity: 0.98;
		display: inline;
	`;
}

