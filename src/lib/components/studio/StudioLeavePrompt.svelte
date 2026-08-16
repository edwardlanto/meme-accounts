<script lang="ts">
	import { tick } from 'svelte';
	import { X } from 'lucide-svelte';

	let {
		open = false,
		name = $bindable(''),
		busy = false,
		error = '',
		onStay,
		onDiscard,
		onSave,
	}: {
		open?: boolean;
		name?: string;
		busy?: boolean;
		error?: string;
		onStay: () => void;
		onDiscard: () => void;
		onSave: () => void | Promise<void>;
	} = $props();

	let rootEl = $state<HTMLDivElement | null>(null);
	let nameInputEl = $state<HTMLInputElement | null>(null);
	const canSave = $derived(!!String(name ?? '').trim() && !busy);

	$effect(() => {
		const el = rootEl;
		if (!el || typeof document === 'undefined') return;
		document.body.appendChild(el);
		return () => {
			el.remove();
		};
	});

	$effect(() => {
		if (!open || typeof document === 'undefined') return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !busy) onStay();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	$effect(() => {
		if (!open) return;
		void tick().then(() => {
			nameInputEl?.focus();
			nameInputEl?.select();
		});
	});
</script>

{#if open}
	<div bind:this={rootEl} class="leave-root">
		<div class="leave-backdrop" role="presentation" onclick={() => !busy && onStay()}>
			<div
				class="leave-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="studio-leave-title"
				onclick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					class="leave-close"
					onclick={() => onStay()}
					disabled={busy}
					aria-label="Close"
				>
					<X size={18} />
				</button>

				<h2 id="studio-leave-title" class="leave-title">Save unsaved changes?</h2>
				<p class="leave-sub">
					You have edits that aren’t saved as a template. Leave without saving, or save this layout
					before you go.
				</p>

				{#if error}
					<div class="leave-error" role="alert">{error}</div>
				{/if}

				<label class="leave-label" for="studio-leave-name">Template name</label>
				<input
					id="studio-leave-name"
					bind:this={nameInputEl}
					class="leave-input"
					type="text"
					bind:value={name}
					disabled={busy}
					required
					aria-required="true"
					placeholder="Name this template"
					autocomplete="off"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							if (canSave) void onSave();
						}
					}}
				/>

				<button
					type="button"
					class="leave-submit"
					disabled={!canSave}
					onclick={() => void onSave()}
				>
					{#if busy}
						<span class="leave-spinner" aria-hidden="true"></span>
						Saving…
					{:else}
						Save template
					{/if}
				</button>

				<div class="leave-secondary">
					<button type="button" class="leave-ghost" disabled={busy} onclick={() => onDiscard()}>
						Don’t save
					</button>
					<button type="button" class="leave-outline" disabled={busy} onclick={() => onStay()}>
						Stay
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.leave-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(15, 15, 16, 0.42);
		backdrop-filter: blur(10px);
		animation: leaveFadeIn 0.18s ease;
	}
	@keyframes leaveFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.leave-modal {
		position: relative;
		width: min(420px, 100%);
		padding: 28px 24px 22px;
		border-radius: 18px;
		background: #ffffff;
		border: 1px solid rgba(15, 15, 16, 0.1);
		color: #0f0f10;
		font-family: var(--font-body, system-ui, sans-serif);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.7) inset,
			0 24px 64px rgba(15, 15, 16, 0.16);
		animation: leavePopIn 0.2s ease;
	}
	@keyframes leavePopIn {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.leave-close {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: rgba(15, 15, 16, 0.45);
		cursor: pointer;
	}
	.leave-close:hover:not(:disabled) {
		background: rgba(15, 15, 16, 0.05);
		color: #0f0f10;
	}
	.leave-close:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.leave-title {
		margin: 0 0 6px;
		padding-right: 36px;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.15;
		color: #0f0f10;
	}
	.leave-sub {
		margin: 0 0 18px;
		font-size: 14px;
		line-height: 1.45;
		color: #5b5b62;
	}
	.leave-error {
		padding: 10px 12px;
		margin-bottom: 12px;
		border-radius: 10px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.22);
		font-size: 13px;
		color: #b91c1c;
	}
	.leave-label {
		display: block;
		margin: 0 0 8px;
		font-size: 12px;
		font-weight: 600;
		color: #5b5b62;
	}
	.leave-input {
		width: 100%;
		height: 48px;
		padding: 0 14px;
		box-sizing: border-box;
		background: #fff;
		border: 1px solid rgba(15, 15, 16, 0.14);
		border-radius: 12px;
		color: #0f0f10;
		font: inherit;
		font-size: 14px;
		outline: none;
	}
	.leave-input:focus {
		border-color: #7bf1a8;
		box-shadow: 0 0 0 3px rgba(123, 241, 168, 0.28);
	}
	.leave-input:disabled {
		opacity: 0.65;
	}
	.leave-input::placeholder {
		color: #9a9aa1;
	}
	.leave-submit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 50px;
		margin-top: 14px;
		border: 1px solid #7bf1a8;
		border-radius: 999px;
		background: #7bf1a8;
		color: #0f0f10;
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			transform 0.2s ease;
	}
	.leave-submit:hover:not(:disabled) {
		background: #a7f7c6;
		border-color: #a7f7c6;
		transform: translateY(-1px);
	}
	.leave-submit:disabled {
		opacity: 0.7;
		cursor: not-allowed;
		transform: none;
	}
	.leave-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(15, 15, 16, 0.2);
		border-top-color: #0f0f10;
		border-radius: 999px;
		animation: leaveSpin 0.7s linear infinite;
	}
	@keyframes leaveSpin {
		to {
			transform: rotate(360deg);
		}
	}
	.leave-secondary {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}
	.leave-ghost,
	.leave-outline {
		flex: 1;
		height: 44px;
		border-radius: 999px;
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}
	.leave-ghost {
		border: none;
		background: transparent;
		color: #5b5b62;
	}
	.leave-ghost:hover:not(:disabled) {
		background: rgba(15, 15, 16, 0.05);
		color: #0f0f10;
	}
	.leave-outline {
		border: 1px solid rgba(15, 15, 16, 0.14);
		background: #fff;
		color: #0f0f10;
		box-shadow: 0 1px 2px rgba(15, 15, 16, 0.04);
	}
	.leave-outline:hover:not(:disabled) {
		background: #f6f7f9;
		border-color: rgba(15, 15, 16, 0.22);
	}
	.leave-ghost:disabled,
	.leave-outline:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
