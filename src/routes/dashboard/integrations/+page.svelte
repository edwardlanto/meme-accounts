<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { authFetch } from '$lib/authFetch';
	import {
		Plug, PlugZap, Unplug, ExternalLink, AlertCircle, CheckCircle2, Loader2,
	} from 'lucide-svelte';
	import IntegrationPlatformIcon from '$lib/components/IntegrationPlatformIcon.svelte';
	import {
		INTEGRATION_PLATFORMS,
		type ZernioConnectPlatform,
	} from '$lib/integrations/zernio-platforms';

	type Status = { ok: boolean; missing: string[] };
	type Connection = {
		id: string;
		provider_account_id: string;
		provider_account_label: string;
		meta: { platform?: string; username?: string | null; handle?: string | null };
	};

	let userId = $state('');
	let zernioStatus = $state<Status | null>(null);
	let connections = $state<Connection[]>([]);
	let loading = $state(true);
	let syncing = $state(false);
	let busyPlatform = $state<ZernioConnectPlatform | null>(null);
	let banner = $state<{ kind: 'success' | 'error'; message: string } | null>(null);

	function accountsForPlatform(platform: ZernioConnectPlatform): Connection[] {
		return connections.filter(
			(c) => String(c.meta?.platform ?? '').toLowerCase() === platform
		);
	}

	function displayHandle(conn: Connection): string {
		const u = conn.meta?.username ?? conn.meta?.handle;
		if (u) return u.startsWith('@') ? u : `@${u}`;
		const label = conn.provider_account_label ?? '';
		const dash = label.indexOf(' — ');
		if (dash >= 0) {
			const tail = label.slice(dash + 3).trim();
			if (tail) return tail.startsWith('@') ? tail : `@${tail}`;
		}
		return label || 'Connected account';
	}

	function connect(platform: ZernioConnectPlatform) {
		if (!userId) {
			goto('/login');
			return;
		}
		if (!zernioStatus?.ok) {
			banner = {
				kind: 'error',
				message: 'Add ZERNIO_API_KEY and PUBLIC_APP_URL to your environment, then restart the server.',
			};
			return;
		}
		const next = encodeURIComponent('/dashboard/integrations');
		window.location.href = `/api/auth/zernio/start?platform=${platform}&userId=${encodeURIComponent(userId)}&next=${next}`;
	}

	async function disconnect(platform: ZernioConnectPlatform) {
		const accounts = accountsForPlatform(platform);
		if (!accounts.length) return;
		const label = INTEGRATION_PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
		if (!confirm(`Disconnect ${label}? You can reconnect anytime.`)) return;

		busyPlatform = platform;
		try {
			const res = await authFetch('/api/integrations/zernio/disconnect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ platform }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Disconnect failed');
			if (data.zernioWarning) {
				banner = {
					kind: 'success',
					message: `${label} removed locally. Zernio reported: ${data.zernioWarning}`,
				};
			} else {
				banner = { kind: 'success', message: `${label} disconnected.` };
			}
			await loadConnections();
		} catch (e: any) {
			banner = { kind: 'error', message: e?.message ?? 'Could not disconnect' };
		} finally {
			busyPlatform = null;
		}
	}

	async function loadConnections() {
		const { data, error } = await supabase
			.from('social_connections')
			.select('id, provider_account_id, provider_account_label, meta')
			.eq('user_id', userId)
			.eq('provider', 'zernio');
		if (error) throw new Error(error.message);
		connections = (data ?? []) as Connection[];
	}

	async function syncFromZernio() {
		if (!zernioStatus?.ok) return;
		syncing = true;
		try {
			const res = await authFetch('/api/integrations/zernio/sync', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Sync failed');
			await loadConnections();
		} catch (e: any) {
			banner = { kind: 'error', message: e?.message ?? 'Sync failed' };
		} finally {
			syncing = false;
		}
	}

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const zernioError = params.get('zernio_error');
		const zernioConnected = params.get('zernio_connected');

		if (zernioError) {
			banner = {
				kind: 'error',
				message:
					`Connection failed: ${zernioError}` +
					(params.get('desc') ? ` — ${params.get('desc')}` : ''),
			};
		} else if (zernioConnected === '1') {
			banner = { kind: 'success', message: 'Account connected and synced.' };
		}

		const { data } = await supabase.auth.getUser();
		userId = data.user?.id ?? '';
		if (!userId) {
			goto('/login');
			return;
		}

		try {
			const statusRes = await fetch('/api/integrations/zernio/status');
			zernioStatus = await statusRes.json();
		} catch {
			zernioStatus = { ok: false, missing: ['(failed to check)'] };
		}

		try {
			await loadConnections();
			if (zernioConnected === '1') {
				await syncFromZernio();
			}
		} catch (e: any) {
			banner = { kind: 'error', message: e?.message ?? 'Failed to load connections' };
		}

		loading = false;

		if (zernioError || zernioConnected) {
			await goto('/dashboard/integrations', { replaceState: true });
		}
	});
</script>

<div class="integrations-shell">
	<div class="ambient" aria-hidden="true">
		<div class="orb orb-a"></div>
		<div class="orb orb-b"></div>
		<div class="orb orb-c"></div>
	</div>

	<div class="integrations-panel">
		<header class="page-head">
			<p class="eyebrow">Integrations</p>
			<h1 class="page-title">Connect your accounts</h1>
			<p class="page-sub">
				Link your business profiles to publish and schedule from Carousel Studio.
				<a href="https://docs.zernio.com/sdks" target="_blank" rel="noopener noreferrer" class="doc-link">Zernio API</a>
			</p>
		</header>

		{#if banner}
			<div class="banner banner--{banner.kind} glass" role="status">
				{#if banner.kind === 'success'}
					<CheckCircle2 size={16} />
				{:else}
					<AlertCircle size={16} />
				{/if}
				<p>{banner.message}</p>
			</div>
		{/if}

		{#if !zernioStatus?.ok && !loading}
			<div class="setup-card glass">
				<div class="setup-icon"><Plug size={17} /></div>
				<div class="setup-copy">
					<p class="setup-title">Zernio API not configured</p>
					<p class="setup-desc">
						Add to <code>.env</code> and restart. Keys at
						<a href="https://zernio.com" target="_blank" rel="noopener noreferrer" class="doc-link">zernio.com</a>
						→ Settings → API Keys.
					</p>
				</div>
				<pre class="env-snippet">ZERNIO_API_KEY=sk_…{'\n'}PUBLIC_APP_URL=http://localhost:5173</pre>
				{#if zernioStatus?.missing?.length}
					<p class="setup-missing">Missing: {zernioStatus.missing.join(', ')}</p>
				{/if}
			</div>
		{/if}

		{#if loading}
			<div class="loading-card glass">
				<Loader2 size={20} class="spin" />
				<span>Loading connections…</span>
			</div>
		{:else}
			<div class="platform-stack glass">
				<ul class="platform-list">
					{#each INTEGRATION_PLATFORMS as platform, i (platform.id)}
						{@const linked = accountsForPlatform(platform.id)}
						{@const connected = linked.length > 0}
						{@const primary = linked[0]}
						<li class="platform-row" class:platform-row--last={i === INTEGRATION_PLATFORMS.length - 1}>
							<div
								class="platform-icon-wrap"
								style="--brand: {platform.color}; --brand-bg: {platform.bg}"
							>
								<IntegrationPlatformIcon platform={platform.id} size={22} />
							</div>
							<div class="platform-body">
								<div class="platform-title-row">
									<span class="platform-name">{platform.label}</span>
									{#if connected}
										<span class="connected-badge">Connected</span>
									{/if}
								</div>
								{#if connected && primary}
									<p class="platform-handle">{displayHandle(primary)}</p>
									{#if linked.length > 1}
										<p class="platform-extra">+{linked.length - 1} more</p>
									{/if}
								{/if}
							</div>
							<div class="platform-actions">
								{#if connected}
									<button
										type="button"
										class="btn-ghost"
										disabled={busyPlatform === platform.id}
										onclick={() => disconnect(platform.id)}
									>
										{#if busyPlatform === platform.id}
											<Loader2 size={14} class="spin" />
										{:else}
											<Unplug size={14} />
										{/if}
										Disconnect
									</button>
								{:else}
									<button
										type="button"
										class="btn-primary"
										disabled={!zernioStatus?.ok || busyPlatform === platform.id}
										onclick={() => connect(platform.id)}
									>
										<PlugZap size={14} />
										Connect
									</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>

			{#if zernioStatus?.ok}
				<footer class="panel-footer">
					<button
						type="button"
						class="btn-sync"
						disabled={syncing}
						onclick={() => syncFromZernio()}
					>
						{#if syncing}
							<Loader2 size={14} class="spin" />
						{:else}
							<Plug size={14} />
						{/if}
						{syncing ? 'Syncing…' : 'Refresh from Zernio'}
					</button>
					<a
						href="https://docs.zernio.com/"
						target="_blank"
						rel="noopener noreferrer"
						class="docs-link"
					>
						<ExternalLink size={13} />
						Documentation
					</a>
				</footer>
			{/if}
		{/if}
	</div>
</div>

<style>
	.integrations-shell {
		position: relative;
		min-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 24px 64px;
		overflow: hidden;
		font-family: var(--font-body), var(--font-sans), system-ui, sans-serif;
		color: var(--app-text);
	}

	.ambient {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(72px);
		opacity: 0.55;
	}
	.orb-a {
		width: 420px;
		height: 420px;
		top: -12%;
		left: 50%;
		transform: translateX(-58%);
		background: color-mix(in oklab, var(--color-violet) 22%, transparent);
	}
	.orb-b {
		width: 320px;
		height: 320px;
		bottom: 8%;
		right: 12%;
		background: color-mix(in oklab, #a8c4ff 35%, transparent);
	}
	.orb-c {
		width: 260px;
		height: 260px;
		bottom: 22%;
		left: 8%;
		background: color-mix(in oklab, var(--color-lime) 18%, transparent);
	}
	:root[data-theme='dark'] .orb-a {
		opacity: 0.35;
		background: color-mix(in oklab, var(--color-violet) 30%, transparent);
	}
	:root[data-theme='dark'] .orb-b {
		opacity: 0.28;
		background: color-mix(in oklab, #6366f1 25%, transparent);
	}
	:root[data-theme='dark'] .orb-c {
		opacity: 0.22;
	}

	.integrations-panel {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 480px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}

	.glass {
		background: color-mix(in oklab, var(--app-surface-2) 82%, transparent);
		backdrop-filter: blur(20px) saturate(1.4);
		-webkit-backdrop-filter: blur(20px) saturate(1.4);
		border: 1px solid color-mix(in oklab, var(--app-text) 8%, transparent);
		box-shadow:
			0 1px 0 color-mix(in oklab, #fff 60%, transparent) inset,
			0 24px 48px -20px color-mix(in oklab, var(--app-text) 12%, transparent);
	}
	:root[data-theme='dark'] .glass {
		background: color-mix(in oklab, var(--app-surface-2) 72%, transparent);
		box-shadow:
			0 1px 0 color-mix(in oklab, #fff 6%, transparent) inset,
			0 24px 56px -16px rgba(0, 0, 0, 0.55);
	}

	.page-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 10px;
		padding: 0 8px 4px;
	}

	.eyebrow {
		margin: 0;
		font-family: var(--font-mono), ui-monospace, monospace;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--app-text-3);
	}

	.page-title {
		margin: 0;
		font-family: var(--font-display), var(--font-sans), system-ui, sans-serif;
		font-size: clamp(26px, 4vw, 32px);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.1;
		color: var(--app-text);
	}

	.page-sub {
		margin: 0;
		font-size: 14px;
		line-height: 1.65;
		color: var(--app-text-2);
		max-width: 38ch;
	}

	.doc-link {
		color: var(--app-text);
		text-decoration: underline;
		text-underline-offset: 3px;
		text-decoration-color: color-mix(in oklab, var(--app-text) 28%, transparent);
		transition: opacity 0.15s ease;
	}
	.doc-link:hover { opacity: 0.7; }

	.banner {
		width: 100%;
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 12px 16px;
		border-radius: 16px;
		font-size: 13px;
		line-height: 1.5;
	}
	.banner p { margin: 0; flex: 1; text-align: left; }
	.banner--success {
		color: #15803d;
		background: color-mix(in oklab, #22c55e 10%, var(--app-surface-2));
	}
	:root[data-theme='dark'] .banner--success { color: #86efac; }
	.banner--error {
		color: #dc2626;
		background: color-mix(in oklab, #ef4444 8%, var(--app-surface-2));
	}
	:root[data-theme='dark'] .banner--error { color: #fca5a5; }

	.setup-card {
		width: 100%;
		padding: 20px;
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.setup-icon {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in oklab, var(--app-text) 5%, transparent);
		color: var(--app-text-2);
	}
	.setup-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--app-text);
	}
	.setup-desc {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--app-text-2);
		line-height: 1.55;
	}
	.setup-desc code {
		font-family: var(--font-mono), ui-monospace, monospace;
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 6px;
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
	}
	.env-snippet {
		margin: 0;
		padding: 14px 16px;
		border-radius: 12px;
		background: color-mix(in oklab, var(--app-text) 4%, var(--app-bg));
		border: 1px solid color-mix(in oklab, var(--app-text) 6%, transparent);
		font-family: var(--font-mono), ui-monospace, monospace;
		font-size: 11px;
		line-height: 1.6;
		color: var(--app-text-2);
		overflow-x: auto;
	}
	.setup-missing {
		margin: 0;
		font-size: 11px;
		color: var(--app-text-3);
		font-family: var(--font-mono), ui-monospace, monospace;
	}

	.loading-card {
		width: 100%;
		padding: 40px 24px;
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		font-size: 13px;
		color: var(--app-text-3);
	}

	:global(.spin) {
		animation: spin 0.75s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.platform-stack {
		width: 100%;
		border-radius: 22px;
		overflow: hidden;
	}

	.platform-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.platform-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 18px;
		border-bottom: 1px solid color-mix(in oklab, var(--app-text) 7%, transparent);
		transition: background 0.15s ease;
	}
	.platform-row--last {
		border-bottom: none;
	}
	.platform-row:hover {
		background: color-mix(in oklab, var(--app-text) 3%, transparent);
	}

	.platform-icon-wrap {
		width: 42px;
		height: 42px;
		border-radius: 12px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--brand-bg);
		color: var(--brand);
		border: 1px solid color-mix(in oklab, var(--brand) 18%, transparent);
	}

	.platform-body {
		flex: 1;
		min-width: 0;
		text-align: left;
	}

	.platform-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.platform-name {
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--app-text);
	}

	.connected-badge {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 3px 7px;
		border-radius: 999px;
		background: color-mix(in oklab, #22c55e 12%, transparent);
		color: #15803d;
	}
	:root[data-theme='dark'] .connected-badge {
		color: #86efac;
	}

	.platform-handle {
		margin: 3px 0 0;
		font-size: 12px;
		color: var(--app-text-3);
	}
	.platform-extra {
		margin: 2px 0 0;
		font-size: 11px;
		color: var(--app-text-3);
	}

	.platform-actions {
		flex-shrink: 0;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: 999px;
		border: none;
		background: var(--app-text);
		color: var(--app-bg);
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
		box-shadow: 0 2px 8px color-mix(in oklab, var(--app-text) 18%, transparent);
	}
	.btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px color-mix(in oklab, var(--app-text) 22%, transparent);
	}
	.btn-primary:disabled {
		opacity: 0.35;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}
	:root[data-theme='dark'] .btn-primary {
		background: #f4f4f5;
		color: #0a0a0a;
	}

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 999px;
		border: 1px solid color-mix(in oklab, var(--app-text) 12%, transparent);
		background: transparent;
		color: var(--app-text-2);
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.btn-ghost:hover:not(:disabled) {
		background: color-mix(in oklab, var(--app-text) 5%, transparent);
		color: var(--app-text);
	}
	.btn-ghost:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.panel-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding-top: 4px;
	}

	.btn-sync {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 16px;
		border-radius: 999px;
		border: 1px solid color-mix(in oklab, var(--app-text) 10%, transparent);
		background: color-mix(in oklab, var(--app-surface-2) 70%, transparent);
		backdrop-filter: blur(12px);
		color: var(--app-text-2);
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.btn-sync:hover:not(:disabled) {
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
		color: var(--app-text);
	}
	.btn-sync:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.docs-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--app-text-3);
		text-decoration: none;
		transition: color 0.15s ease;
	}
	.docs-link:hover {
		color: var(--app-text-2);
	}

	@media (max-width: 520px) {
		.integrations-shell {
			padding: 32px 16px 48px;
			align-items: flex-start;
		}
		.platform-row {
			flex-wrap: wrap;
			padding: 14px 16px;
		}
		.platform-actions {
			width: 100%;
			display: flex;
			justify-content: flex-end;
			padding-top: 4px;
		}
	}
</style>
