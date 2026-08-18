<script lang="ts">
	import { tick } from 'svelte';
	import { Loader, Sparkles, X } from 'lucide-svelte';

	let {
		open = false,
		title,
		description,
		prompt = $bindable(''),
		placeholder = '',
		recommended = '',
		busy = false,
		canSubmit = true,
		submitLabel = 'Generate',
		inputId = 'studio-ai-prompt-input',
		onClose,
		onSubmit,
	}: {
		open?: boolean;
		title: string;
		description: string;
		prompt?: string;
		placeholder?: string;
		/** Shown when the field is empty — also used as fallback on submit. */
		recommended?: string;
		busy?: boolean;
		canSubmit?: boolean;
		submitLabel?: string;
		inputId?: string;
		onClose: () => void;
		onSubmit: () => void | Promise<void>;
	} = $props();

	let rootEl = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

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
			if (e.key === 'Escape' && !busy) onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	$effect(() => {
		if (!open) return;
		void tick().then(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	});

	function handleSubmit() {
		if (!canSubmit || busy) return;
		void onSubmit();
	}
</script>

{#if open}
	<div bind:this={rootEl} class="ai-prompt-root">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="ai-prompt-backdrop"
			role="presentation"
			onclick={() => !busy && onClose()}
		>
			<div
				class="ai-prompt-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="studio-ai-prompt-title"
				onclick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					class="ai-prompt-close"
					onclick={() => onClose()}
					disabled={busy}
					aria-label="Close"
				>
					<X size={18} />
				</button>

				<div class="ai-prompt-icon" aria-hidden="true">
					<Sparkles size={18} strokeWidth={2.2} />
				</div>

				<h2 id="studio-ai-prompt-title" class="ai-prompt-title">{title}</h2>
				<p class="ai-prompt-sub">{description}</p>

				{#if recommended}
					<p class="ai-prompt-hint">
						<span class="ai-prompt-hint-label">Suggested</span>
						<span class="ai-prompt-hint-text">{recommended}</span>
					</p>
				{/if}

				<input
					id={inputId}
					bind:this={inputEl}
					class="ai-prompt-input"
					type="text"
					bind:value={prompt}
					{placeholder}
					disabled={busy}
					autocomplete="off"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							handleSubmit();
						}
					}}
				/>

				<div class="ai-prompt-actions">
					<button
						type="button"
						class="ai-prompt-btn ai-prompt-btn--ghost"
						disabled={busy}
						onclick={() => onClose()}
					>
						Cancel
					</button>
					<button
						type="button"
						class="ai-prompt-btn ai-prompt-btn--primary"
						disabled={busy || !canSubmit}
						onclick={handleSubmit}
					>
						{#if busy}
							<Loader size={15} class="ai-prompt-spin" />
							Generating…
						{:else}
							<Sparkles size={15} strokeWidth={2.2} />
							{submitLabel}
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.ai-prompt-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(15, 15, 16, 0.44);
		backdrop-filter: blur(10px);
		animation: aiPromptFadeIn 0.2s ease;
	}

	@keyframes aiPromptFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.ai-prompt-modal {
		position: relative;
		width: min(440px, 100%);
		padding: 26px 24px 22px;
		border-radius: 20px;
		background: #ffffff;
		border: 1px solid rgba(15, 15, 16, 0.1);
		color: #0f0f10;
		font-family: var(--font-body, system-ui, sans-serif);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.75) inset,
			0 28px 72px rgba(15, 15, 16, 0.18);
		animation: aiPromptPopIn 0.24s cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes aiPromptPopIn {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.ai-prompt-close {
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
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.ai-prompt-close:hover:not(:disabled) {
		background: rgba(15, 15, 16, 0.05);
		color: #0f0f10;
	}

	.ai-prompt-close:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ai-prompt-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		margin-bottom: 12px;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(123, 241, 168, 0.22), rgba(123, 241, 168, 0.08));
		color: #0a7a42;
		box-shadow: inset 0 0 0 1px rgba(123, 241, 168, 0.35);
	}

	.ai-prompt-title {
		margin: 0 0 6px;
		padding-right: 28px;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.2;
		color: #0f0f10;
	}

	.ai-prompt-sub {
		margin: 0 0 14px;
		font-size: 14px;
		line-height: 1.45;
		color: #5b5b62;
	}

	.ai-prompt-hint {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0 0 12px;
		padding: 10px 12px;
		border-radius: 12px;
		background: #f6f7f9;
		border: 1px solid rgba(15, 15, 16, 0.08);
	}

	.ai-prompt-hint-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #8a8a92;
	}

	.ai-prompt-hint-text {
		font-size: 13px;
		line-height: 1.4;
		color: #3d3d44;
		word-break: break-word;
	}

	.ai-prompt-input {
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
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.ai-prompt-input:focus {
		border-color: #7bf1a8;
		box-shadow: 0 0 0 3px rgba(123, 241, 168, 0.28);
	}

	.ai-prompt-input:disabled {
		opacity: 0.65;
	}

	.ai-prompt-input::placeholder {
		color: #9a9aa1;
	}

	.ai-prompt-actions {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: 10px;
		margin-top: 16px;
	}

	.ai-prompt-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		min-width: 0;
		height: 46px;
		padding: 0 16px;
		border-radius: 999px;
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			transform 0.15s ease,
			opacity 0.15s ease;
	}

	.ai-prompt-btn--ghost {
		border: 1px solid rgba(15, 15, 16, 0.14);
		background: #fff;
		color: #3d3d44;
		box-shadow: 0 1px 2px rgba(15, 15, 16, 0.04);
	}

	.ai-prompt-btn--ghost:hover:not(:disabled) {
		background: #f6f7f9;
		border-color: rgba(15, 15, 16, 0.22);
		color: #0f0f10;
	}

	.ai-prompt-btn--primary {
		border: 1px solid #7bf1a8;
		background: #7bf1a8;
		color: #0f0f10;
	}

	.ai-prompt-btn--primary:hover:not(:disabled) {
		background: #a7f7c6;
		border-color: #a7f7c6;
		transform: translateY(-1px);
	}

	.ai-prompt-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	:global(.ai-prompt-spin) {
		animation: aiPromptSpin 0.7s linear infinite;
	}

	@keyframes aiPromptSpin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 420px) {
		.ai-prompt-actions {
			grid-template-columns: 1fr;
		}
	}
</style>
