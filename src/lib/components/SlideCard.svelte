<script lang="ts">
	import type { GeneratedSlide } from '../../routes/api/generate-slides/+server.js';

	let {
		slide,
		images = [] as string[],
		brandColor = '#E8FF48',
		brandName = 'Your Brand',
		scale = 0.24,
		total = 8,
		exportRef = $bindable(null as HTMLElement | null),
	}: {
		slide: GeneratedSlide;
		images?: string[];
		brandColor?: string;
		brandName?: string;
		scale?: number;
		total?: number;
		exportRef?: HTMLElement | null;
	} = $props();

	const W = 1080;
	const H = 1350;

	const image = $derived(
		slide.imageIndex !== null &&
			slide.imageIndex !== undefined &&
			slide.imageIndex >= 0 &&
			images[slide.imageIndex]
			? images[slide.imageIndex]
			: null,
	);

	const headlineFontSize = $derived(() => {
		const len = slide.headline.length;
		if (len <= 15) return 96;
		if (len <= 25) return 82;
		if (len <= 35) return 70;
		if (len <= 50) return 58;
		return 48;
	});

	const accentRgb = $derived(() => {
		const hex = brandColor.replace('#', '');
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);
		return `${r}, ${g}, ${b}`;
	});
</script>

<!-- Outer wrapper controls display size -->
<div
	style="
    width: {W * scale}px;
    height: {H * scale}px;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
  "
>
	<!-- Inner at full resolution, scaled down -->
	<div
		bind:this={exportRef}
		style="
      width: {W}px;
      height: {H}px;
      transform: scale({scale});
      transform-origin: top left;
      position: absolute;
      top: 0;
      left: 0;
      background: #0a0a0a;
      color: #fff;
      overflow: hidden;
      font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
    "
	>
		<!-- ═══════════════════════════════════ HERO LAYOUT ═══════════════════ -->
		{#if slide.layout === 'hero' && image}
			<!-- Full-bleed image -->
			<div
				style="
          position: absolute; inset: 0;
          background-image: url('{image}');
          background-size: cover;
          background-position: center;
        "
			></div>

			<!-- Gradient overlay -->
			<div
				style="
          position: absolute; inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,0.08) 0%,
            rgba(0,0,0,0.15) 25%,
            rgba(0,0,0,0.55) 55%,
            rgba(0,0,0,0.92) 82%,
            rgba(0,0,0,0.98) 100%
          );
        "
			></div>

			<!-- Top: slide number pill -->
			<div
				style="
          position: absolute; top: 48px; left: 48px;
          font-family: 'Space Mono', monospace; font-size: 18px; color: rgba(255,255,255,0.6);
          background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
          padding: 10px 20px; border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.12);
        "
			>
				{String(slide.slideNumber ?? 1).padStart(2, '0')}
			</div>

			<!-- Bottom: headline -->
			<div
				style="
          position: absolute; bottom: 108px; left: 60px; right: 60px;
        "
			>
				{#if slide.subheadline}
					<p
						style="
              font-family: 'Space Mono', monospace; font-size: 20px;
              color: {brandColor}; letter-spacing: 0.12em;
              text-transform: uppercase; margin-bottom: 20px;
            "
					>
						{slide.subheadline}
					</p>
				{/if}
				<h2
					style="
            font-size: {headlineFontSize()}px; font-weight: 900;
            line-height: 1.04; letter-spacing: -0.02em;
            color: #ffffff; margin: 0;
          "
				>
					{slide.headline}
				</h2>
				{#if slide.body}
					<p
						style="
              font-family: 'DM Sans', sans-serif; font-size: 30px;
              color: rgba(255,255,255,0.65); margin-top: 24px;
              line-height: 1.5; font-weight: 300;
            "
					>
						{slide.body}
					</p>
				{/if}
			</div>
		{/if}

		<!-- ══════════════════════════════ TEXT-ONLY LAYOUT ══════════════════ -->
		{#if slide.layout === 'text-only' || (!image && slide.layout !== 'quote')}
			<!-- Background — subtle noise texture feel -->
			<div style="position: absolute; inset: 0; background: #0a0a0a;"></div>

			<!-- Accent vertical bar -->
			<div
				style="
          position: absolute; top: 140px; bottom: 108px; left: 48px;
          width: 5px; background: {brandColor}; border-radius: 2px;
          opacity: 0.9;
        "
			></div>

			<!-- Content area -->
			<div
				style="
          position: absolute; top: 120px; bottom: 108px;
          left: 88px; right: 60px;
          display: flex; flex-direction: column; justify-content: center;
        "
			>
				<!-- Label -->
				{#if slide.type === 'cta' || slide.type === 'hook'}
					<p
						style="
              font-family: 'Space Mono', monospace; font-size: 19px;
              color: {brandColor}; letter-spacing: 0.14em; text-transform: uppercase;
              margin-bottom: 32px; opacity: 0.9;
            "
					>
						{slide.type === 'cta' ? '— take action' : '— stop scrolling'}
					</p>
				{:else if slide.type === 'tip' || slide.type === 'value'}
					<p
						style="
              font-family: 'Space Mono', monospace; font-size: 19px;
              color: rgba(255,255,255,0.3); letter-spacing: 0.14em; text-transform: uppercase;
              margin-bottom: 32px;
            "
					>
						{slide.accentEmoji ?? '→'} tip {String(slide.slideNumber ?? 1).padStart(2, '0')}
					</p>
				{/if}

				<!-- Headline -->
				<h2
					style="
            font-size: {headlineFontSize()}px; font-weight: 900;
            line-height: 1.05; letter-spacing: -0.025em;
            color: #ffffff; margin: 0 0 28px 0;
          "
				>
					{slide.headline}
					{#if slide.accentEmoji && slide.type === 'cta'}
						<span style="font-size: 0.8em; margin-left: 8px;">{slide.accentEmoji}</span>
					{/if}
				</h2>

				<!-- Body -->
				{#if slide.body}
					<p
						style="
              font-family: 'DM Sans', sans-serif; font-size: 32px; font-weight: 300;
              line-height: 1.55; color: rgba(255,255,255,0.6);
              margin: 0 0 40px 0;
            "
					>
						{slide.body}
					</p>
				{/if}

				<!-- Bullets -->
				{#if slide.bullets?.length}
					<div style="display: flex; flex-direction: column; gap: 20px; margin-top: 8px;">
						{#each slide.bullets as bullet}
							<div
								style="
                  display: flex; align-items: flex-start; gap: 20px;
                  font-family: 'DM Sans', sans-serif; font-size: 30px;
                  font-weight: 400; color: rgba(255,255,255,0.8);
                  line-height: 1.4;
                "
							>
								<span
									style="
                    width: 10px; height: 10px; border-radius: 50%;
                    background: {brandColor}; flex-shrink: 0; margin-top: 12px;
                  "
								></span>
								{bullet}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Slide number (top right) -->
			<div
				style="
          position: absolute; top: 48px; right: 60px;
          font-family: 'Space Mono', monospace; font-size: 20px;
          color: rgba(255,255,255,0.2);
        "
			>
				{String(slide.slideNumber ?? 1).padStart(2, '0')} <span
					style="color: rgba(255,255,255,0.1)">/ {String(total).padStart(2, '0')}</span
				>
			</div>
		{/if}

		<!-- ══════════════════════════════════ QUOTE LAYOUT ══════════════════ -->
		{#if slide.layout === 'quote'}
			<div style="position: absolute; inset: 0; background: #0a0a0a;"></div>

			<!-- Big decorative quote mark -->
			<div
				style="
          position: absolute; top: 80px; left: 52px;
          font-size: 240px; font-weight: 900; font-style: italic;
          color: {brandColor}; line-height: 1; opacity: 0.18;
          font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
        "
			>"</div>

			<!-- Quote content -->
			<div
				style="
          position: absolute; inset: 0;
          display: flex; flex-direction: column; justify-content: center;
          padding: 0 80px 108px;
        "
			>
				<h2
					style="
            font-size: {headlineFontSize()}px; font-weight: 700; font-style: italic;
            line-height: 1.15; color: #ffffff;
            letter-spacing: -0.02em; margin: 0;
          "
				>
					{slide.headline}
				</h2>
				{#if slide.body}
					<p
						style="
              font-family: 'DM Sans', sans-serif; font-size: 30px;
              color: {brandColor}; margin-top: 40px; font-weight: 400;
              letter-spacing: 0.04em;
            "
					>
						{slide.body}
					</p>
				{/if}
			</div>

			<!-- Thin accent line at bottom of text area -->
			<div
				style="
          position: absolute; bottom: 130px; left: 80px;
          width: 100px; height: 3px; background: {brandColor}; opacity: 0.6;
        "
			></div>
		{/if}

		<!-- ══════════════════════ SPLIT LEFT (image left, text right) ════════ -->
		{#if slide.layout === 'split-left' && image}
			<div style="position: absolute; inset: 0; display: flex;">
				<!-- Image half -->
				<div
					style="
            width: 46%; height: 100%;
            background-image: url('{image}');
            background-size: cover; background-position: center;
            flex-shrink: 0;
          "
				></div>

				<!-- Thin accent divider -->
				<div style="width: 4px; background: {brandColor}; flex-shrink: 0; opacity: 0.7;"></div>

				<!-- Text half -->
				<div
					style="
            flex: 1; background: #0a0a0a;
            display: flex; flex-direction: column; justify-content: center;
            padding: 80px 56px 130px 56px;
          "
				>
					{#if slide.subheadline}
						<p
							style="
                font-family: 'Space Mono', monospace; font-size: 18px;
                color: {brandColor}; letter-spacing: 0.1em;
                text-transform: uppercase; margin-bottom: 24px;
              "
						>
							{slide.subheadline}
						</p>
					{/if}
					<h2
						style="
              font-size: {Math.min(headlineFontSize(), 68)}px; font-weight: 900;
              line-height: 1.06; color: #fff; margin: 0;
              letter-spacing: -0.02em;
            "
					>
						{slide.headline}
					</h2>
					{#if slide.body}
						<p
							style="
                font-family: 'DM Sans', sans-serif; font-size: 27px; font-weight: 300;
                color: rgba(255,255,255,0.6); line-height: 1.5; margin-top: 28px;
              "
						>
							{slide.body}
						</p>
					{/if}
					{#if slide.bullets?.length}
						<div style="display: flex; flex-direction: column; gap: 16px; margin-top: 32px;">
							{#each slide.bullets as bullet}
								<div
									style="
                    display: flex; align-items: flex-start; gap: 16px;
                    font-family: 'DM Sans', sans-serif; font-size: 25px;
                    color: rgba(255,255,255,0.75); line-height: 1.4;
                  "
								>
									<span
										style="
                      width: 8px; height: 8px; border-radius: 50%;
                      background: {brandColor}; flex-shrink: 0; margin-top: 10px;
                    "
									></span>
									{bullet}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- ══════════════════════ SPLIT RIGHT (text left, image right) ═══════ -->
		{#if slide.layout === 'split-right' && image}
			<div style="position: absolute; inset: 0; display: flex;">
				<!-- Text half -->
				<div
					style="
            flex: 1; background: #0a0a0a;
            display: flex; flex-direction: column; justify-content: center;
            padding: 80px 56px 130px 56px;
          "
				>
					{#if slide.subheadline}
						<p
							style="
                font-family: 'Space Mono', monospace; font-size: 18px;
                color: {brandColor}; letter-spacing: 0.1em;
                text-transform: uppercase; margin-bottom: 24px;
              "
						>
							{slide.subheadline}
						</p>
					{/if}
					<h2
						style="
              font-size: {Math.min(headlineFontSize(), 68)}px; font-weight: 900;
              line-height: 1.06; color: #fff; margin: 0;
              letter-spacing: -0.02em;
            "
					>
						{slide.headline}
					</h2>
					{#if slide.body}
						<p
							style="
                font-family: 'DM Sans', sans-serif; font-size: 27px; font-weight: 300;
                color: rgba(255,255,255,0.6); line-height: 1.5; margin-top: 28px;
              "
						>
							{slide.body}
						</p>
					{/if}
					{#if slide.bullets?.length}
						<div style="display: flex; flex-direction: column; gap: 16px; margin-top: 32px;">
							{#each slide.bullets as bullet}
								<div
									style="
                    display: flex; align-items: flex-start; gap: 16px;
                    font-family: 'DM Sans', sans-serif; font-size: 25px;
                    color: rgba(255,255,255,0.75); line-height: 1.4;
                  "
								>
									<span
										style="
                      width: 8px; height: 8px; border-radius: 50%;
                      background: {brandColor}; flex-shrink: 0; margin-top: 10px;
                    "
									></span>
									{bullet}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Thin accent divider -->
				<div style="width: 4px; background: {brandColor}; flex-shrink: 0; opacity: 0.7;"></div>

				<!-- Image half -->
				<div
					style="
            width: 46%; height: 100%;
            background-image: url('{image}');
            background-size: cover; background-position: center;
            flex-shrink: 0;
          "
				></div>
			</div>
		{/if}

		<!-- ═══════════════════════════════ SHARED FOOTER ════════════════════ -->
		{#if slide.layout !== 'hero'}
			<div
				style="
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 100px;
          border-top: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 88px 0 88px;
          background: rgba(10,10,10,0.95);
        "
			>
				<span
					style="
            font-family: 'Space Mono', monospace; font-size: 19px;
            color: rgba(255,255,255,0.25); letter-spacing: 0.06em; text-transform: uppercase;
          "
				>
					{brandName}
				</span>
				<span
					style="
            font-family: 'Space Mono', monospace; font-size: 19px;
            color: rgba(255,255,255,0.2);
          "
				>
					{String(slide.slideNumber ?? 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
				</span>
			</div>
		{:else}
			<!-- Hero footer -->
			<div
				style="
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 96px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 60px;
        "
			>
				<span
					style="
            font-family: 'Space Mono', monospace; font-size: 19px;
            color: rgba(255,255,255,0.4); letter-spacing: 0.06em; text-transform: uppercase;
          "
				>
					{brandName}
				</span>
				<span
					style="
            font-family: 'Space Mono', monospace; font-size: 19px;
            color: rgba(255,255,255,0.3);
          "
				>
					{String(slide.slideNumber ?? 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
				</span>
			</div>
		{/if}
	</div>
</div>
