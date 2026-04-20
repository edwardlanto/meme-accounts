/** Starter template definitions — add new templates here */

export interface StarterTemplate {
	id: string;
	name: string;
	description: string;
	href: string;           // where clicking navigates
	previewBg: string;      // static asset path for the preview background
	previewText: string;    // placeholder headline shown in the card
	previewSource: string;  // source label shown in the card
	badge: string;          // chip label (e.g. "News")
	badgeColor: string;     // tailwind text colour class for the badge
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
	{
		id: 'news',
		name: 'News Studio',
		description: 'AI writes the copy, Vertex generates the images',
		href: '/dashboard/studio',
		previewBg: '/templates/news/demo-bg.jpg',
		previewText: 'YOUR HEADLINE WILL APPEAR HERE',
		previewSource: 'Markets',
		badge: 'News',
		badgeColor: 'text-amber-400',
	},
	{
		id: 'image-quote',
		name: 'Image Quote',
		description: 'Top image + bold all-caps quote block',
		href: '/dashboard/composer',
		previewBg: '/templates/image-quote/demo-bg.png',
		previewText: '',
		previewSource: '',
		badge: 'Quote',
		badgeColor: 'text-white/70',
	},
	{
		id: 'tweet',
		name: 'Tweet Carousel',
		description: 'Turn viral tweet exchanges into shareable slides',
		href: '/dashboard/composer',
		previewBg: '',
		previewText: '',
		previewSource: '',
		badge: 'Tweet',
		badgeColor: 'text-sky-400',
	},
	{
		id: 'text',
		name: 'Text Carousel',
		description: 'Dark branded text carousels for any niche',
		href: '/dashboard/composer',
		previewBg: '',
		previewText: '',
		previewSource: '',
		badge: 'Text',
		badgeColor: 'text-white/60',
	},
	{
		id: 'article',
		name: 'Article Carousel',
		description: 'Text + image breakdown slides with accent highlights',
		href: '/dashboard/composer',
		previewBg: '',
		previewText: '',
		previewSource: '',
		badge: 'Article',
		badgeColor: 'text-emerald-400',
	},
	{
		id: 'brand',
		name: 'Brand Carousel',
		description: 'Upload brand images → AI extracts style → 7-slide branded carousel',
		href: '/dashboard/brand-studio',
		previewBg: '',
		previewText: '',
		previewSource: '',
		badge: 'Brand',
		badgeColor: 'text-violet-400',
	},
];
