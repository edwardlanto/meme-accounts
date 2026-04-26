<script lang="ts">
import HighlightedText from '$lib/components/HighlightedText.svelte';
import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
import type { TextElementKind, TextStyle } from '$lib/types';

interface TweetProps {
	// Top tweet
	topName?: string;
	topHandle?: string;
	topAvatar?: string;
	topVerified?: boolean;
	topText?: string;
	topImage?: string;
	// Bottom reply
	bottomName?: string;
	bottomHandle?: string;
	bottomAvatar?: string;
	bottomVerified?: boolean;
	bottomText?: string;
	// Style
	templateTheme?: 'light' | 'dark';
	scale?: number;
	interactive?: boolean;
	exportRef?: HTMLElement | null;
	selectedText?: TextElementKind | null;
	onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
	onHeadlineRangeSelect?: (start: number, end: number) => void;
	headlineStyle?: TextStyle;
	/** Optional per-field style overrides (font/size/color/etc). */
	tweetStyles?: Partial<Record<
		| 'tweetTopName'
		| 'tweetTopHandle'
		| 'tweetTopText'
		| 'tweetBottomName'
		| 'tweetBottomHandle'
		| 'tweetBottomText',
		TextStyle
	>>;
	showToolbar?: boolean;
	/** When set, tweet body is editable on the canvas (built-in highlight toolbar). */
	onTopTextChange?: (v: string) => void;
	onBottomTextChange?: (v: string) => void;
	onTopNameChange?: (v: string) => void;
	onTopHandleChange?: (v: string) => void;
	onBottomNameChange?: (v: string) => void;
	onBottomHandleChange?: (v: string) => void;
}

let {
	topName      = 'Chef 👨‍🍳',
	topHandle    = '@chefsevenn',
	topAvatar    = '',
	topVerified  = true,
	topText      = 'Ketchup or mayo or mustard?',
	topImage     = '/templates/tweet/demo-bg.jpg',
	bottomName   = 'Mo Mohler',
	bottomHandle = '@MoMohler',
	bottomAvatar = '',
	bottomVerified = true,
	bottomText   = '3 straight misses chef. These appear to be French fries.',
	templateTheme = 'light',
	scale        = 1,
	interactive  = true,
	exportRef    = $bindable<HTMLElement | null>(null),
	selectedText = null,
	onTextSelect,
	onHeadlineRangeSelect,
	headlineStyle = {},
	tweetStyles = {},
	showToolbar = false,
	onTopTextChange,
	onBottomTextChange,
	onTopNameChange,
	onTopHandleChange,
	onBottomNameChange,
	onBottomHandleChange,
}: TweetProps = $props();

	const topEditable = $derived(!!interactive && typeof onTopTextChange === 'function');
	const bottomEditable = $derived(!!interactive && typeof onBottomTextChange === 'function');
	const topNameEditable = $derived(!!interactive && typeof onTopNameChange === 'function');
	const topHandleEditable = $derived(!!interactive && typeof onTopHandleChange === 'function');
	const bottomNameEditable = $derived(!!interactive && typeof onBottomNameChange === 'function');
	const bottomHandleEditable = $derived(!!interactive && typeof onBottomHandleChange === 'function');
	const tweetHighlightDefault = '#1D9BF0';
	const isLight = $derived(templateTheme === 'light');
	const surface = $derived(isLight ? '#F7F9FA' : '#0b0b0b');
	const card = $derived(isLight ? '#FFFFFF' : '#111111');
	const card2 = $derived(isLight ? '#F0F3F4' : '#0f0f10');
	const divider = $derived(isLight ? '#EFF3F4' : 'rgba(255,255,255,0.10)');
	const textPrimary = $derived(isLight ? '#0F1419' : '#F3F5F7');
	const textSecondary = $derived(isLight ? '#536471' : 'rgba(243,245,247,0.62)');

	function styleCss(s: TextStyle) {
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', 'Inter', system-ui, sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		if (s.align) bits.push(`text-align: ${s.align};`);
		return bits.join(' ');
	}

	const topNameCss = $derived(styleCss(tweetStyles.tweetTopName ?? {}));
	const topHandleCss = $derived(styleCss(tweetStyles.tweetTopHandle ?? {}));
	const topTextCss = $derived(styleCss(tweetStyles.tweetTopText ?? {}));
	const bottomNameCss = $derived(styleCss(tweetStyles.tweetBottomName ?? {}));
	const bottomHandleCss = $derived(styleCss(tweetStyles.tweetBottomHandle ?? {}));
	const bottomTextCss = $derived(styleCss(tweetStyles.tweetBottomText ?? {}));

	const W = 1080;
	const H = 1350;

	/** Initials fallback for missing avatar */
	function initials(name: string) {
		return name.replace(/[^\w\s]/g, '').trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
	}

	/** Simple hash → hue for coloured initials placeholder */
	function nameHue(name: string) {
		let h = 0;
		for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
		return Math.abs(h) % 360;
	}
</script>

<!-- Outer wrapper — controls display size -->
<div style="
	width: {W * scale}px;
	height: {H * scale}px;
	overflow: hidden;
	border-radius: {scale < 1 ? '12px' : '0'};
	flex-shrink: 0;
	position: relative;
">
	<!-- Inner at 1080×1350 — full bleed, no card wrapper -->
	<div
		bind:this={exportRef}
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			background: {surface};
			transform: scale({scale});
			transform-origin: top left;
			font-family: 'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			overflow: hidden;
		"
	>

		<!-- ── Top tweet — fills top portion ──────────────────────────────────── -->
		<div style="
			flex: 1;
			background: {card};
			padding: 72px 80px 52px;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			border-bottom: 3px solid {divider};
		">
			<!-- Profile row -->
			<div style="display: flex; align-items: center; gap: 28px; margin-bottom: 44px;">
				<!-- Avatar -->
				<div style="
					width: 112px; height: 112px; border-radius: 50%; flex-shrink: 0;
					overflow: hidden;
					{topAvatar ? '' : `background: hsl(${nameHue(topName)}, 60%, 50%);`}
					display: flex; align-items: center; justify-content: center;
				">
					{#if topAvatar}
						<img src={topAvatar} alt="" style="width:100%;height:100%;object-fit:cover;" />
					{:else}
						<span style="color:#fff;font-size:44px;font-weight:700;letter-spacing:-1px;">{initials(topName)}</span>
					{/if}
				</div>
				<!-- Name / handle -->
				<div style="flex:1;min-width:0;">
					<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
						<CanvasMarkupTextBlock
							value={topName}
							interactive={topNameEditable}
							defaultColor={tweetHighlightDefault}
							toolbarKind="tweetTopName"
							selected={selectedText === 'tweetTopName'}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
							rows={1}
							{showToolbar}
							ariaLabel="Top name"
							fontFamily="'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif"
							fontSize={tweetStyles.tweetTopName?.fontSize ?? 44}
							onTextChange={onTopNameChange}
						>
							{#snippet display()}
								<span style="font-size:44px;font-weight:800;color:{textPrimary};letter-spacing:-0.5px;line-height:1.1; {topNameCss}">{topName}</span>
							{/snippet}
						</CanvasMarkupTextBlock>
						{#if topVerified}
							<svg width="36" height="36" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:2px;">
								<circle cx="12" cy="12" r="12" fill="#1D9BF0"/>
								<path d="M9.5 16.5l-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" fill="white"/>
							</svg>
						{/if}
					</div>
					<CanvasMarkupTextBlock
						value={topHandle}
						interactive={topHandleEditable}
						defaultColor={tweetHighlightDefault}
						toolbarKind="tweetTopHandle"
						selected={selectedText === 'tweetTopHandle'}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
						rows={1}
						{showToolbar}
						ariaLabel="Top handle"
						fontFamily="'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif"
						fontSize={tweetStyles.tweetTopHandle?.fontSize ?? 36}
						onTextChange={onTopHandleChange}
					>
						{#snippet display()}
							<span style="font-size:36px;color:{textSecondary};font-weight:400;line-height:1.2; {topHandleCss}">{topHandle}</span>
						{/snippet}
					</CanvasMarkupTextBlock>
				</div>
			</div>

			<!-- Tweet text -->
			<div style="margin: 0 0 44px;">
				<CanvasMarkupTextBlock
					value={topText}
					interactive={topEditable}
					defaultColor={tweetHighlightDefault}
					toolbarKind="tweetTopText"
					selected={selectedText === 'tweetTopText'}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					rows={1}
					minHeight="0px"
					{showToolbar}
					ariaLabel="Tweet text"
					fontFamily={(tweetStyles.tweetTopText?.fontFamily ?? headlineStyle.fontFamily) ?? "'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif"}
					fontSize={tweetStyles.tweetTopText?.fontSize ?? 58}
					onTextChange={onTopTextChange}
				>
					{#snippet display()}
						<HighlightedText
							as="p"
							text={topText}
							defaultColor={tweetHighlightDefault}
							style="font-size:58px; font-weight:400; color:{textPrimary}; line-height:1.35; margin:0; letter-spacing:-0.3px; word-break:break-word; flex-shrink: 0; {topTextCss}"
						/>
					{/snippet}
				</CanvasMarkupTextBlock>
			</div>

			<!-- Attached image -->
			{#if topImage}
				<div style="border-radius:24px;overflow:hidden;margin-bottom:44px;border:2px solid {divider};flex-shrink:0;">
					<img src={topImage} alt="" style="width:100%;display:block;max-height:560px;object-fit:cover;" />
				</div>
			{/if}

			<!-- Spacer -->
			<div style="flex:1;"></div>

			<!-- Engagement row (static decorative) -->
			<div style="
				display:flex;gap:56px;align-items:center;
				padding-top:36px;
				border-top:2px solid {divider};
				color:{textSecondary};font-size:32px;
				flex-shrink: 0;
			">
				<span>💬 <span style="font-weight:500;">4.2K</span></span>
				<span>🔁 <span style="font-weight:500;">12.8K</span></span>
				<span>❤️ <span style="font-weight:500;">89.4K</span></span>
			</div>
		</div>

		<!-- ── Reply tweet — fills bottom portion ─────────────────────────────── -->
		<div style="
			flex: 1;
			background: {card2};
			padding: 60px 80px 72px;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
		">
			<!-- "Replying to" label -->
			<p style="font-size:28px;color:{textSecondary};margin:0 0 36px;font-weight:400;">
				Replying to <span style="color:#1D9BF0;">{topHandle}</span>
			</p>

			<!-- Profile row -->
			<div style="display:flex;align-items:center;gap:24px;margin-bottom:40px;">
				<!-- Avatar -->
				<div style="
					width:104px;height:104px;border-radius:50%;flex-shrink:0;overflow:hidden;
					{bottomAvatar ? '' : `background:hsl(${nameHue(bottomName)},60%,45%);`}
					display:flex;align-items:center;justify-content:center;
				">
					{#if bottomAvatar}
						<img src={bottomAvatar} alt="" style="width:100%;height:100%;object-fit:cover;" />
					{:else}
						<span style="color:#fff;font-size:40px;font-weight:700;">{initials(bottomName)}</span>
					{/if}
				</div>
				<!-- Name / handle -->
				<div style="flex:1;min-width:0;">
					<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
						<CanvasMarkupTextBlock
							value={bottomName}
							interactive={bottomNameEditable}
							defaultColor={tweetHighlightDefault}
							toolbarKind="tweetBottomName"
							selected={selectedText === 'tweetBottomName'}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
							rows={1}
							{showToolbar}
							ariaLabel="Bottom name"
							fontFamily="'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif"
							fontSize={tweetStyles.tweetBottomName?.fontSize ?? 42}
							onTextChange={onBottomNameChange}
						>
							{#snippet display()}
								<span style="font-size:42px;font-weight:800;color:{textPrimary};letter-spacing:-0.5px;line-height:1.1; {bottomNameCss}">{bottomName}</span>
							{/snippet}
						</CanvasMarkupTextBlock>
						{#if bottomVerified}
							<svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:2px;">
								<circle cx="12" cy="12" r="12" fill="#1D9BF0"/>
								<path d="M9.5 16.5l-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" fill="white"/>
							</svg>
						{/if}
					</div>
					<CanvasMarkupTextBlock
						value={bottomHandle}
						interactive={bottomHandleEditable}
						defaultColor={tweetHighlightDefault}
						toolbarKind="tweetBottomHandle"
						selected={selectedText === 'tweetBottomHandle'}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
						rows={1}
						{showToolbar}
						ariaLabel="Bottom handle"
						fontFamily="'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif"
						fontSize={tweetStyles.tweetBottomHandle?.fontSize ?? 34}
						onTextChange={onBottomHandleChange}
					>
						{#snippet display()}
							<span style="font-size:34px;color:{textSecondary};font-weight:400; {bottomHandleCss}">{bottomHandle}</span>
						{/snippet}
					</CanvasMarkupTextBlock>
				</div>
			</div>

			<!-- Reply text -->
			<CanvasMarkupTextBlock
				value={bottomText}
				interactive={bottomEditable}
				defaultColor={tweetHighlightDefault}
				toolbarKind="tweetBottomText"
				selected={selectedText === 'tweetBottomText'}
				onTextSelect={onTextSelect}
				onHeadlineRangeSelect={onHeadlineRangeSelect}
				rows={1}
				minHeight="0px"
				{showToolbar}
				ariaLabel="Reply text"
				fontFamily={headlineStyle.fontFamily ?? "'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif"}
				fontSize={headlineStyle.fontSize ?? 56}
				onTextChange={onBottomTextChange}
			>
				{#snippet display()}
					<HighlightedText
						as="p"
						text={bottomText}
						defaultColor={tweetHighlightDefault}
						style="font-size:56px; font-weight:400; color:{textPrimary}; line-height:1.35; margin:0; letter-spacing:-0.3px; word-break:break-word; {bottomTextCss}"
					/>
				{/snippet}
			</CanvasMarkupTextBlock>
		</div>

		<!-- X watermark -->
		<div style="
			position:absolute;bottom:32px;right:64px;
			font-size:24px;font-weight:700;color:{textSecondary};opacity:0.35;
			letter-spacing:0;font-family:inherit;
		">𝕏 / twitter</div>
	</div>
</div>
