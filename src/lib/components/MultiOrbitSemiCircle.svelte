<script lang="ts">
	import { onMount } from 'svelte';

	type Platform = { name: string; color: string; icon: string; abbr?: string };

	interface Props {
		items: Platform[];
	}

	let { items }: Props = $props();

	let size = $state({ width: 0, height: 0 });

	onMount(() => {
		const update = () => {
			size = { width: window.innerWidth, height: window.innerHeight };
		};
		update();
		window.addEventListener('resize', update, { passive: true });
		return () => window.removeEventListener('resize', update);
	});

	const baseWidth = $derived(Math.min(size.width * 0.8, 700));
	const centerX = $derived(baseWidth / 2);
	const centerY = $derived(baseWidth * 0.5);

	const iconSize = $derived.by(() => {
		if (!size.width) return 32;
		if (size.width < 480) return Math.max(24, baseWidth * 0.05);
		if (size.width < 768) return Math.max(28, baseWidth * 0.06);
		return Math.max(32, baseWidth * 0.07);
	});

	// Don't repeat icons. We use each platform once.
	const uniq = $derived.by(() => (items ?? []).filter((p) => p?.icon).slice(0, 18));
	const ringCounts = $derived.by(() => {
		// Match the 3-ring look, but never repeat icons.
		const n = uniq.length;
		const a = Math.min(6, n);
		const b = Math.min(8, Math.max(0, n - a));
		const c = Math.min(10, Math.max(0, n - a - b));
		return [a, b, c].filter((x) => x > 0);
	});

	const radii = $derived.by(() => [baseWidth * 0.22, baseWidth * 0.36, baseWidth * 0.5]);
	const starts = $derived.by(() => [
		0,
		ringCounts[0] ?? 0,
		(ringCounts[0] ?? 0) + (ringCounts[1] ?? 0),
	]);

	function posOnSemiCircle(index: number, count: number, radius: number) {
		const denom = Math.max(1, count - 1);
		const angle = (index / denom) * 180; // 0..180
		const rad = (angle * Math.PI) / 180;
		const x = radius * Math.cos(rad);
		const y = radius * Math.sin(rad);
		return { angle, x, y };
	}
</script>

<section class="orbit-wrap section-light">
	<div class="orbit-inner">
		<h2 class="orbit-title">Integrations</h2>
		<p class="orbit-sub">Connect your favourite apps to your workflow.</p>

		<div
			class="orbit-stage"
			style="width: {baseWidth}px; height: {baseWidth * 0.6}px;"
		>
			<!-- Semi-circle glow background -->
			<div class="orbit-glow" aria-hidden="true"></div>

			{#each ringCounts as cnt, ringIdx (ringIdx)}
				{@const radius = radii[ringIdx] ?? radii[radii.length - 1]}
				{#each Array.from({ length: cnt }) as _, i (i)}
					{@const item = uniq[(starts[ringIdx] ?? 0) + i]}
					{#if item}
						{@const p = posOnSemiCircle(i, cnt, radius)}
						{@const tooltipAbove = p.angle > 90}
						<div
							class="orbit-icon group"
							style="
								left: {centerX + p.x - iconSize / 2}px;
								top: {centerY - p.y - iconSize / 2}px;
								width: {iconSize}px;
								height: {iconSize}px;
								z-index: {50 - ringIdx * 10 - i};
							"
						>
							<!-- Your existing icons (no repeats) -->
							<div class="orbit-icon-img" aria-label={item.name} title={item.name}>
								{#if item.icon === 'instagram'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none">
										<rect width="24" height="24" rx="6" fill="url(#ig-g-orbit)"/>
										<defs><linearGradient id="ig-g-orbit" x1="0" y1="24" x2="24" y2="0">
											<stop stop-color="#f09433"/><stop offset=".25" stop-color="#e6683c"/>
											<stop offset=".5" stop-color="#dc2743"/><stop offset=".75" stop-color="#cc2366"/>
											<stop offset="1" stop-color="#bc1888"/>
										</linearGradient></defs>
										<circle cx="12" cy="12" r="4.5" stroke="white" stroke-width="1.5" fill="none"/>
										<circle cx="17" cy="7" r="1" fill="white"/>
										<rect x="3" y="3" width="18" height="18" rx="5" stroke="white" stroke-width="1.5" fill="none"/>
									</svg>
								{:else if item.icon === 'tiktok'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="white">
										<path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.73a4.85 4.85 0 01-1-.04z"/>
									</svg>
								{:else if item.icon === 'facebook'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} style="color:{item.color}" fill="currentColor">
										<path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
									</svg>
								{:else if item.icon === 'linkedin'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} style="color:{item.color}" fill="currentColor">
										<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
									</svg>
								{:else if item.icon === 'x'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="#0a0a0a">
										<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
									</svg>
								{:else if item.icon === 'youtube'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} style="color:{item.color}" fill="currentColor">
										<path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
									</svg>
								{:else if item.icon === 'reddit'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} style="color:{item.color}" fill="currentColor">
										<path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"/>
									</svg>
								{:else if item.icon === 'pinterest'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} style="color:{item.color}" fill="currentColor">
										<path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
									</svg>
								{:else if item.icon === 'threads'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="#0a0a0a">
										<path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/>
									</svg>
								{:else if item.icon === 'snapchat'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="#0a0a0a">
										<path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>
									</svg>
								{:else if item.icon === 'bluesky'}
									<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} style="color:{item.color}" fill="currentColor">
										<path d="M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026"/>
									</svg>
								{:else}
									<div class="orbit-fallback" style="--accent:{item.color}">{item.abbr ?? item.name.slice(0, 1)}</div>
								{/if}
							</div>

							<!-- Tooltip -->
							<div class={`orbit-tip ${tooltipAbove ? 'tip-up' : 'tip-down'}`}>
								{item.name}
								<div class={`orbit-tip-caret ${tooltipAbove ? 'caret-up' : 'caret-down'}`}></div>
							</div>
						</div>
					{/if}
				{/each}
			{/each}
		</div>
	</div>
</section>

<style>
	.orbit-wrap {
		padding: 64px 0 40px;
		position: relative;
		width: 100%;
		overflow: hidden;
	}
	.orbit-inner {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		z-index: 1;
	}
	.orbit-title {
		margin: 18px 0 8px;
		font-size: clamp(36px, 4.4vw, 76px);
		line-height: 1;
		letter-spacing: -0.04em;
		font-weight: 900;
		color: #0a0a0a;
		font-family: var(--font-display);
	}
	.orbit-sub {
		margin: 0 0 26px;
		max-width: 42rem;
		font-size: clamp(14px, 1.7vw, 20px);
		color: rgba(10,10,10,0.55);
		font-family: var(--font-body);
	}
	.orbit-stage {
		position: relative;
	}
	.orbit-glow {
		position: absolute;
		left: 50%;
		top: -160px;
		transform: translateX(-50%);
		width: 1000px;
		height: 1000px;
		border-radius: 999px;
		background: radial-gradient(circle at center, rgba(0,0,0,0.25), transparent 70%);
		filter: blur(54px);
		pointer-events: none;
		z-index: 0;
	}
	.orbit-icon {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.orbit-icon-img {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 16px;
		background: rgba(255,255,255,0.65);
		border: 1px solid rgba(10,10,10,0.10);
		box-shadow: 0 16px 38px rgba(10,10,10,0.12);
	}
	.orbit-icon-img :global(svg) { display: block; }
	.orbit-fallback {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		border-radius: 16px;
		font-weight: 800;
		color: #0a0a0a;
		background: color-mix(in oklab, var(--accent) 14%, white);
	}

	/* Tooltip (hidden until hover) */
	.orbit-tip {
		position: absolute;
		width: 148px;
		padding: 7px 10px;
		border-radius: 12px;
		background: rgba(0,0,0,0.92);
		color: #fff;
		font-size: 12px;
		font-family: var(--font-body);
		box-shadow: 0 14px 34px rgba(0,0,0,0.22);
		opacity: 0;
		transform: translateY(6px);
		pointer-events: none;
		transition: opacity 160ms ease, transform 160ms ease;
	}
	.tip-up { bottom: calc(100% + 10px); }
	.tip-down { top: calc(100% + 10px); }
	.orbit-tip-caret {
		position: absolute;
		left: 50%;
		width: 10px;
		height: 10px;
		background: rgba(0,0,0,0.92);
		transform: translateX(-50%) rotate(45deg);
	}
	.caret-up { top: 100%; }
	.caret-down { bottom: 100%; }

	.group:hover .orbit-tip {
		opacity: 1;
		transform: translateY(0);
	}
</style>

