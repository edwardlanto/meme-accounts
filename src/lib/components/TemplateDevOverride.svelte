<script lang="ts">
	import { Bookmark, Copy, Pin, RotateCcw, Wrench } from 'lucide-svelte';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import {
		clearTemplateDevOverride,
		formatTemplateDevOverrideTime,
		isTemplateDevToolsEnabled,
		loadTemplateDevOverride,
		setTemplateDevOverrideEnabled,
		TEMPLATE_DEV_OVERRIDE_EVENT,
		type TemplateDevOverride,
	} from '$lib/studio/template-dev-override';
	import type { TemplateId } from '$lib/studio/template-ids';

	type Props = {
		templateId: TemplateId;
		templateLabel: string;
		onPin: () => void;
		onApply: () => void;
		onSaveTemplate: () => void | Promise<void>;
	};

	let { templateId, templateLabel, onPin, onApply, onSaveTemplate }: Props = $props();

	const enabled = $derived(isTemplateDevToolsEnabled());
	let open = $state(false);
	let tick = $state(0);
	let copyState = $state('');
	let saveBusy = $state(false);

	const override = $derived.by((): TemplateDevOverride | null => {
		void tick;
		return loadTemplateDevOverride(templateId);
	});
	const pinned = $derived(!!override);
	const active = $derived(!!override?.enabled);
	const stamped = $derived(formatTemplateDevOverrideTime(override?.updatedAt));

	$effect(() => {
		if (!enabled || typeof window === 'undefined') return;
		const onChange = () => {
			tick += 1;
		};
		window.addEventListener(TEMPLATE_DEV_OVERRIDE_EVENT, onChange);
		window.addEventListener('storage', onChange);
		return () => {
			window.removeEventListener(TEMPLATE_DEV_OVERRIDE_EVENT, onChange);
			window.removeEventListener('storage', onChange);
		};
	});

	function toggleEnabled() {
		if (!override) return;
		const next = !override.enabled;
		setTemplateDevOverrideEnabled(templateId, next);
		if (next) onApply();
	}

	async function copyJson() {
		if (!override) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(override, null, 2));
			copyState = 'Copied';
		} catch {
			copyState = 'Copy failed';
		}
		window.setTimeout(() => {
			copyState = '';
		}, 1400);
	}

	async function saveNamed() {
		if (saveBusy) return;
		saveBusy = true;
		try {
			await onSaveTemplate();
		} finally {
			saveBusy = false;
		}
	}
</script>

{#if enabled}
	<div class="tdo" data-template-dev-override={templateId}>
		<Popover bind:open>
			<PopoverTrigger
				class="tdo-chip {active ? 'is-on' : pinned ? 'is-pinned' : ''}"
				title="Developer template override"
			>
				<Wrench size={11} strokeWidth={2.2} />
				<span class="tdo-kicker">DEV</span>
				<span class="tdo-name">{templateLabel}</span>
				{#if active}
					<span class="tdo-dot" aria-hidden="true"></span>
				{/if}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="bottom"
				sideOffset={8}
				class="tdo-panel z-[240] w-[300px] rounded-2xl border border-black/[0.08] bg-[#111] p-0 text-white shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
			>
				<div class="px-3.5 pt-3 pb-2.5">
					<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E8FF48]">
						Template override
					</p>
					<p class="mt-1 text-[13px] font-semibold tracking-tight">{templateLabel}</p>
					<p class="mt-1 text-[11px] leading-snug text-white/48">
						Design on the canvas, pin it as this template’s default, then save a named template when you like it.
					</p>
					{#if stamped}
						<p class="mt-1.5 text-[10px] text-white/35">Pinned {stamped}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-1.5 px-3.5 pb-3.5">
					<button type="button" class="tdo-btn tdo-btn-primary" onclick={onPin}>
						<Pin size={13} />
						Pin this design
					</button>
					{#if pinned}
						<button type="button" class="tdo-btn" onclick={onApply}>
							Apply pin to slides
						</button>
						<button type="button" class="tdo-btn" onclick={toggleEnabled}>
							{active ? 'Pause override' : 'Resume override'}
						</button>
						<button type="button" class="tdo-btn" onclick={copyJson}>
							<Copy size={13} />
							{copyState || 'Copy JSON'}
						</button>
						<button
							type="button"
							class="tdo-btn tdo-btn-danger"
							onclick={() => clearTemplateDevOverride(templateId)}
						>
							<RotateCcw size={13} />
							Clear pin
						</button>
					{/if}
					<button type="button" class="tdo-btn tdo-btn-save" onclick={() => void saveNamed()} disabled={saveBusy}>
						<Bookmark size={13} />
						{saveBusy ? 'Saving…' : 'Save as template'}
					</button>
				</div>
			</PopoverContent>
		</Popover>
	</div>
{/if}

<style>
	.tdo {
		pointer-events: auto;
	}

	:global(.tdo-chip) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px 0 8px;
		border-radius: 999px;
		border: 1px solid rgba(10, 10, 10, 0.1);
		background: rgba(17, 17, 17, 0.92);
		color: #f4f4f5;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
		cursor: pointer;
	}

	:global(.tdo-chip:hover) {
		background: #111;
	}

	:global(.tdo-chip.is-on) {
		border-color: rgba(232, 255, 72, 0.45);
	}

	:global(.tdo-chip.is-pinned:not(.is-on)) {
		border-color: rgba(255, 255, 255, 0.22);
	}

	.tdo-kicker {
		color: #e8ff48;
	}

	.tdo-name {
		max-width: 9.5rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 650;
		letter-spacing: 0;
		text-transform: none;
		color: rgba(255, 255, 255, 0.88);
	}

	.tdo-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: #e8ff48;
		box-shadow: 0 0 0 3px rgba(232, 255, 72, 0.18);
	}

	.tdo-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		height: 34px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.05);
		color: rgba(255, 255, 255, 0.9);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.tdo-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.09);
	}

	.tdo-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.tdo-btn-primary {
		background: #e8ff48;
		border-color: #e8ff48;
		color: #111;
	}

	.tdo-btn-primary:hover:not(:disabled) {
		background: #f3ff7a;
	}

	.tdo-btn-save {
		margin-top: 4px;
		background: #fff;
		border-color: #fff;
		color: #111;
	}

	.tdo-btn-danger {
		color: #fda4af;
		border-color: rgba(253, 164, 175, 0.22);
	}
</style>
