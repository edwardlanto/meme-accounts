<script lang="ts">
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { Slider } from '$lib/components/ui/slider';
	import { Switch } from '$lib/components/ui/switch';
	import {
		CIRCLE_SHADOW_COLORS,
		CIRCLE_SHADOW_NONE,
		CIRCLE_SHADOW_PRESETS,
		SHADOW_DIRECTIONS,
		activeShadowDirection,
		applyShadowDirection,
		circleShadowCss,
		circleShadowsMatch,
		type CircleShadow,
		type CircleShadowCast,
	} from '$lib/studio/circle-shadow';

	interface Props {
		shadow: CircleShadow;
		onInteract?: () => void;
		onOpenChange?: (open: boolean) => void;
	}

	let { shadow = $bindable(), onInteract, onOpenChange }: Props = $props();

	let open = $state(false);
	let showFine = $state(false);

	const previewCss = $derived(shadow.enabled ? circleShadowCss(shadow) : 'none');
	const previewOnDark = $derived(shadow.enabled && shadow.color.toLowerCase() === '#ffffff');
	const dirId = $derived(activeShadowDirection(shadow));

	function patch(next: Partial<CircleShadow>) {
		shadow = { ...shadow, ...next };
		onInteract?.();
	}

	function applyPreset(next: CircleShadow) {
		shadow = { ...next };
		onInteract?.();
	}

	function setSlider(key: 'opacity' | 'blur' | 'offsetX' | 'offsetY' | 'spread', raw: number | number[]) {
		const n = typeof raw === 'number' ? raw : raw[0];
		if (!Number.isFinite(n)) return;
		const value = key === 'opacity' ? n / 100 : n;
		patch({ [key]: value, enabled: true });
	}
</script>

<Popover
	bind:open
	onOpenChange={(o) => {
		open = o;
		onOpenChange?.(o);
		if (o) onInteract?.();
	}}
>
	<PopoverTrigger
		class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted {shadow.enabled
			? ''
			: 'opacity-55'}"
		title="Circle shadow"
		aria-label="Circle shadow"
		aria-pressed={shadow.enabled}
	>
		<span class="flex flex-col items-center leading-none">
			<span
				class="mb-0.5 block h-3.5 w-3.5 rounded-full border border-foreground/25"
				style="box-shadow: {previewCss}; background: {shadow.enabled ? shadow.color : 'transparent'};"
			></span>
			<span class="font-mono text-[8px] font-bold tracking-tight">SH</span>
		</span>
	</PopoverTrigger>
	<PopoverContent
		side="bottom"
		sideOffset={10}
		align="center"
		trapFocus={false}
		portalProps={{ to: 'body' }}
		onpointerdown={() => onInteract?.()}
		class="z-[80] w-[300px] gap-0 rounded-[16px] border-[#ebebeb] bg-white p-3.5 text-[#1a1a1a] shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
	>
		<div class="mb-3 flex items-center justify-between gap-2">
			<p class="text-[12px] font-semibold tracking-tight">Circle shadow</p>
			<Switch
				checked={shadow.enabled}
				onCheckedChange={(v) => patch({ enabled: v })}
				aria-label="Toggle circle shadow"
			/>
		</div>

		<div
			class="mb-3 flex h-[88px] items-center justify-center rounded-xl"
			style="background: {previewOnDark
				? '#1a1a1a'
				: 'linear-gradient(180deg, #f4f1ea 0%, #e4dfd4 100%)'};"
		>
			<span
				class="block h-11 w-11 rounded-full border-2 border-white bg-[#f3c623]"
				style="box-shadow: {previewCss};"
			></span>
		</div>

		<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Style</p>
		<div class="mb-3 grid grid-cols-3 gap-1.5">
			{#each CIRCLE_SHADOW_PRESETS as preset (preset.id)}
				{@const on = circleShadowsMatch(shadow, preset.value)}
				{@const darkChip = preset.value.color.toLowerCase() === '#ffffff'}
				<button
					type="button"
					onclick={() => applyPreset(preset.value)}
					class="flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 transition-colors
						{on ? 'border-[#1a1a1a] bg-[#f3f3f4]' : 'border-[#ebebeb] hover:bg-[#fafafa]'}"
					aria-pressed={on}
					title={preset.label}
				>
					<span
						class="flex h-9 w-full items-center justify-center rounded-md"
						style="background: {darkChip ? '#2a2a2a' : '#efece4'};"
					>
						<span
							class="block h-5 w-5 rounded-full border border-white/80 bg-[#f3c623]"
							style="box-shadow: {preset.value.enabled ? circleShadowCss(preset.value) : 'none'};"
						></span>
					</span>
					<span class="text-[8px] font-semibold uppercase tracking-wide {on ? 'text-[#111]' : 'text-[#666]'}">
						{preset.label}
					</span>
				</button>
			{/each}
		</div>

		<div class="mb-3 grid grid-cols-[1fr_auto] items-end gap-3">
			<div>
				<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Light</p>
				<div class="grid w-[84px] grid-cols-3 gap-0.5" role="group" aria-label="Shadow direction">
					{#each SHADOW_DIRECTIONS as d (d.id)}
						<button
							type="button"
							onclick={() => {
								shadow = applyShadowDirection(shadow, d.x, d.y);
								onInteract?.();
							}}
							class="flex h-6 w-6 items-center justify-center rounded-md border text-[9px] transition-colors
								{dirId === d.id
									? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
									: 'border-[#ebebeb] text-[#888] hover:bg-[#fafafa]'}"
							title={d.label}
							aria-label={d.label}
							aria-pressed={dirId === d.id}
						>
							{#if d.id === 'c'}
								<span class="block h-1.5 w-1.5 rounded-full bg-current"></span>
							{:else}
								<span class="leading-none">{d.id === 'n' ? '↑' : d.id === 's' ? '↓' : d.id === 'e' ? '→' : d.id === 'w' ? '←' : '·'}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
			<div class="min-w-0">
				<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Cast</p>
				<div class="grid grid-cols-2 gap-1" role="group" aria-label="Shadow cast">
					{#each [{ id: 'layered' as CircleShadowCast, label: 'Layered' }, { id: 'flat' as CircleShadowCast, label: 'Flat' }] as mode (mode.id)}
						<button
							type="button"
							onclick={() => patch({ cast: mode.id, enabled: true })}
							class="rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors
								{(shadow.cast ?? 'flat') === mode.id
									? 'border-[#1a1a1a] bg-[#f3f3f4] text-[#111]'
									: 'border-[#ebebeb] text-[#666] hover:bg-[#fafafa]'}"
						>
							{mode.label}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Color</p>
		<div class="mb-3 flex flex-wrap items-center gap-1.5">
			{#each CIRCLE_SHADOW_COLORS as c}
				<button
					type="button"
					onclick={() => patch({ color: c, enabled: true })}
					class="h-6 w-6 rounded-md border-2 transition-transform hover:scale-105
						{shadow.color.toLowerCase() === c.toLowerCase()
							? 'border-[#1a1a1a] ring-1 ring-[#1a1a1a]/30'
							: 'border-transparent'}"
					style="background: {c};"
					aria-label="Shadow color {c}"
					aria-pressed={shadow.color.toLowerCase() === c.toLowerCase()}
				></button>
			{/each}
			<input
				type="color"
				value={shadow.color}
				oninput={(e) => patch({ color: (e.currentTarget as HTMLInputElement).value, enabled: true })}
				class="h-6 w-8 cursor-pointer rounded border border-[#ebebeb] bg-white p-0.5"
				title="Custom shadow color"
			/>
		</div>

		<label class="mb-1 flex items-center justify-between text-[11px] font-medium text-[#555]">
			<span>Opacity</span>
			<span class="tabular-nums text-[#111]">{Math.round(shadow.opacity * 100)}%</span>
		</label>
		<Slider
			type="single"
			value={shadow.opacity * 100}
			min={0}
			max={100}
			step={1}
			onValueChange={(v) => setSlider('opacity', v)}
			class="mb-3 min-w-0"
		/>

		<label class="mb-1 flex items-center justify-between text-[11px] font-medium text-[#555]">
			<span>Blur</span>
			<span class="tabular-nums text-[#111]">{Math.round(shadow.blur)}px</span>
		</label>
		<Slider
			type="single"
			value={shadow.blur}
			min={0}
			max={120}
			step={1}
			onValueChange={(v) => setSlider('blur', v)}
			class="mb-2 min-w-0"
		/>

		<button
			type="button"
			class="mb-2 text-[10px] font-medium text-[#888] hover:text-[#111]"
			onclick={() => (showFine = !showFine)}
		>
			{showFine ? 'Hide' : 'Fine-tune'} offset & spread
		</button>

		{#if showFine}
			<label class="mb-1 flex items-center justify-between text-[11px] font-medium text-[#555]">
				<span>Offset X</span>
				<span class="tabular-nums text-[#111]">{Math.round(shadow.offsetX)}px</span>
			</label>
			<Slider
				type="single"
				value={shadow.offsetX}
				min={-40}
				max={40}
				step={1}
				onValueChange={(v) => setSlider('offsetX', v)}
				class="mb-3 min-w-0"
			/>

			<label class="mb-1 flex items-center justify-between text-[11px] font-medium text-[#555]">
				<span>Offset Y</span>
				<span class="tabular-nums text-[#111]">{Math.round(shadow.offsetY)}px</span>
			</label>
			<Slider
				type="single"
				value={shadow.offsetY}
				min={-40}
				max={40}
				step={1}
				onValueChange={(v) => setSlider('offsetY', v)}
				class="mb-3 min-w-0"
			/>

			<label class="mb-1 flex items-center justify-between text-[11px] font-medium text-[#555]">
				<span>Spread</span>
				<span class="tabular-nums text-[#111]">{Math.round(shadow.spread)}px</span>
			</label>
			<Slider
				type="single"
				value={shadow.spread}
				min={-16}
				max={40}
				step={1}
				onValueChange={(v) => setSlider('spread', v)}
				class="min-w-0"
			/>
		{/if}

		<button
			type="button"
			class="mt-3 text-[10px] font-medium text-[#888] hover:text-[#111]"
			onclick={() => applyPreset(CIRCLE_SHADOW_NONE)}
		>
			Clear shadow
		</button>
	</PopoverContent>
</Popover>
