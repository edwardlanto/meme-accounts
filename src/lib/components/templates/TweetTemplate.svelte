<script lang="ts">
	interface Props {
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
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
	}

	let {
		topName      = 'Chef 👨‍🍳',
		topHandle    = '@chefsevenn',
		topAvatar    = '',
		topVerified  = true,
		topText      = 'Ketchup or mayo or mustard?',
		topImage     = '',
		bottomName   = 'Mo Mohler',
		bottomHandle = '@MoMohler',
		bottomAvatar = '',
		bottomVerified = true,
		bottomText   = '3 straight misses chef. These appear to be French fries.',
		scale        = 1,
		interactive  = true,
		exportRef    = $bindable(null),
	}: Props = $props();

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
			background: #F7F9FA;
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
			background: #FFFFFF;
			padding: 72px 80px 52px;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			border-bottom: 3px solid #EFF3F4;
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
						<span style="font-size:44px;font-weight:800;color:#0F1419;letter-spacing:-0.5px;line-height:1.1;">{topName}</span>
						{#if topVerified}
							<svg width="36" height="36" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:2px;">
								<circle cx="12" cy="12" r="12" fill="#1D9BF0"/>
								<path d="M9.5 16.5l-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" fill="white"/>
							</svg>
						{/if}
					</div>
					<span style="font-size:36px;color:#536471;font-weight:400;line-height:1.2;">{topHandle}</span>
				</div>
			</div>

			<!-- Tweet text -->
			<p style="
				font-size:58px;
				font-weight:400;
				color:#0F1419;
				line-height:1.35;
				margin:0 0 44px;
				letter-spacing:-0.3px;
				word-break:break-word;
				flex-shrink: 0;
			">{topText}</p>

			<!-- Attached image -->
			{#if topImage}
				<div style="border-radius:24px;overflow:hidden;margin-bottom:44px;border:2px solid #EFF3F4;flex-shrink:0;">
					<img src={topImage} alt="" style="width:100%;display:block;max-height:560px;object-fit:cover;" />
				</div>
			{/if}

			<!-- Spacer -->
			<div style="flex:1;"></div>

			<!-- Engagement row (static decorative) -->
			<div style="
				display:flex;gap:56px;align-items:center;
				padding-top:36px;
				border-top:2px solid #EFF3F4;
				color:#536471;font-size:32px;
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
			background: #F0F3F4;
			padding: 60px 80px 72px;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
		">
			<!-- "Replying to" label -->
			<p style="font-size:28px;color:#536471;margin:0 0 36px;font-weight:400;">
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
						<span style="font-size:42px;font-weight:800;color:#0F1419;letter-spacing:-0.5px;line-height:1.1;">{bottomName}</span>
						{#if bottomVerified}
							<svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:2px;">
								<circle cx="12" cy="12" r="12" fill="#1D9BF0"/>
								<path d="M9.5 16.5l-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" fill="white"/>
							</svg>
						{/if}
					</div>
					<span style="font-size:34px;color:#536471;font-weight:400;">{bottomHandle}</span>
				</div>
			</div>

			<!-- Reply text -->
			<p style="
				font-size:56px;
				font-weight:400;
				color:#0F1419;
				line-height:1.35;
				margin:0;
				letter-spacing:-0.3px;
				word-break:break-word;
			">{bottomText}</p>
		</div>

		<!-- X watermark -->
		<div style="
			position:absolute;bottom:32px;right:64px;
			font-size:24px;font-weight:700;color:#536471;opacity:0.35;
			letter-spacing:0;font-family:inherit;
		">𝕏 / twitter</div>
	</div>
</div>
