<script lang="ts">
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import {
		CIRCLE_BORDER_PRESETS,
		loadRecentColors,
		rememberColor,
	} from '$lib/studio/recent-colors';

	interface Props {
		color: string;
		onInteract?: () => void;
		onOpenChange?: (open: boolean) => void;
	}

	let { color = $bindable('#FFFFFF'), onInteract, onOpenChange }: Props = $props();

	let open = $state(false);
	let recent = $state<string[]>(loadRecentColors());

	function apply(next: string) {
		const v = String(next ?? '').trim();
		if (!v) return;
		color = v;
		recent = rememberColor(v);
		onInteract?.();
	}
</script>

<Popover
	bind:open
	onOpenChange={(o) => {
		open = o;
		onOpenChange?.(o);
		if (o) {
			recent = loadRecentColors();
			onInteract?.();
		}
	}}
>
	<PopoverTrigger
		class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
		title="Change border color"
		aria-label="Change border color"
	>
		<span
			class="border-foreground/25 ring-foreground/15 box-border block h-[22px] w-[22px] rounded-md border-2 shadow-sm ring-1"
			style="background:{color}"
		></span>
	</PopoverTrigger>
	<PopoverContent
		side="bottom"
		sideOffset={10}
		align="center"
		trapFocus={false}
		portalProps={{ to: 'body' }}
		onpointerdown={() => onInteract?.()}
		class="z-[80] w-[220px] gap-0 rounded-[16px] border-[#ebebeb] bg-white p-3 text-[#1a1a1a] shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
	>
		<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Presets</p>
		<div class="mb-3 grid grid-cols-8 gap-1.5">
			{#each CIRCLE_BORDER_PRESETS as c}
				<button
					type="button"
					onclick={() => apply(c)}
					class="h-6 w-6 rounded-md border-2 transition-transform hover:scale-110
						{color.toLowerCase() === c.toLowerCase()
							? 'border-[#1a1a1a] ring-1 ring-[#1a1a1a]/25'
							: 'border-[#ebebeb]'}"
					style="background: {c};"
					aria-label="Border color {c}"
					aria-pressed={color.toLowerCase() === c.toLowerCase()}
				></button>
			{/each}
		</div>

		{#if recent.length}
			<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Recently used</p>
			<div class="mb-3 flex flex-wrap gap-1.5">
				{#each recent as c (c)}
					<button
						type="button"
						onclick={() => apply(c)}
						class="h-6 w-6 rounded-md border-2 transition-transform hover:scale-110
							{color.toLowerCase() === c.toLowerCase()
								? 'border-[#1a1a1a] ring-1 ring-[#1a1a1a]/25'
								: 'border-[#ebebeb]'}"
						style="background: {c};"
						aria-label="Recent color {c}"
					></button>
				{/each}
			</div>
		{/if}

		<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Custom</p>
		<div class="flex items-center gap-2">
			<input
				type="color"
				value={color}
				oninput={(e) => apply((e.currentTarget as HTMLInputElement).value)}
				class="h-8 w-10 cursor-pointer rounded-md border border-[#ebebeb] bg-white p-0.5"
				title="Custom color"
			/>
			<input
				type="text"
				value={color}
				oninput={(e) => apply((e.currentTarget as HTMLInputElement).value)}
				spellcheck="false"
				class="h-8 min-w-0 flex-1 rounded-md border border-[#ebebeb] px-2 font-mono text-[11px] uppercase tracking-wide text-[#111] outline-none focus:border-[#bbb]"
				aria-label="Hex color"
			/>
		</div>
	</PopoverContent>
</Popover>
