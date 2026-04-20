<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { AlertTriangle, CheckCircle2, ExternalLink, Image, KeyRound } from 'lucide-svelte';

	type Status = { ok: boolean; missing: string[]; present: string[] };
	let status = $state<Status | null>(null);
	let loading = $state(true);
	let userId = $state<string>('');

	onMount(async () => {
		const { data } = await supabase.auth.getUser();
		userId = data.user?.id ?? '';

		try {
			const res = await fetch('/api/integrations/meta/status');
			status = await res.json();
		} catch {
			status = { ok: false, missing: ['(failed to load status)'], present: [] };
		}
		loading = false;
	});

	function connectInstagram() {
		if (!userId) {
			alert('You must be logged in to connect Instagram.');
			goto('/login');
			return;
		}
		if (!status?.ok) {
			alert(`Missing credentials: ${(status?.missing ?? []).join(', ')}`);
			return;
		}
		window.location.href = `/api/auth/meta/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	const envSnippet = $derived(
		[
			'## Required env vars (server-side)',
			'META_APP_ID=',
			'META_APP_SECRET=',
			'META_REDIRECT_URI=',
			'',
			'## Already used by your server routes',
			'SUPABASE_URL=',
			'SUPABASE_SERVICE_KEY=',
		].join('\n')
	);
</script>

<div class="p-8 max-w-4xl">
	<div class="flex items-start justify-between mb-8">
		<div>
			<h1 class="font-display font-bold text-2xl text-white">Settings</h1>
			<p class="font-body text-sm text-white/40 mt-1">Integrations and credentials.</p>
		</div>
	</div>

	<div class="rounded-2xl bg-[#0d0d0d] border border-white/10 overflow-hidden">
		<div class="px-5 py-4 border-b border-white/6 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Image size={16} class="text-pink-400" />
				<p class="text-sm font-display font-semibold text-white/85">Instagram (Business) via Meta</p>
			</div>
			<a
				href="/dashboard/post-scheduler"
				class="text-[11px] font-mono text-white/35 hover:text-white/70 transition-colors inline-flex items-center gap-1.5"
			>
				Back to scheduler <ExternalLink size={12} />
			</a>
		</div>

		<div class="p-5">
			{#if loading}
				<p class="text-sm text-white/40 font-body">Checking credentials…</p>
			{:else}
				{#if status?.ok}
					<div class="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 mb-4 flex items-start gap-3">
						<CheckCircle2 size={16} class="text-emerald-300 mt-0.5" />
						<div class="min-w-0">
							<p class="text-sm font-body text-emerald-200/90">Credentials detected. You can connect Instagram.</p>
							<p class="text-[12px] font-body text-emerald-200/50 mt-1">
								Supports scheduling for Posts, Reels, Carousels, and Stories.
								Auto-publish is possible for Posts/Reels/Carousels; Stories generally require manual publish (we’ll treat them as reminders).
							</p>
						</div>
					</div>
				{:else}
					<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 mb-4 flex items-start gap-3">
						<AlertTriangle size={16} class="text-amber-300 mt-0.5" />
						<div class="min-w-0">
							<p class="text-sm font-body text-amber-200/90">Instagram connect is not configured yet.</p>
							<p class="text-[12px] font-body text-amber-200/60 mt-1">
								Missing: <span class="font-mono">{(status?.missing ?? []).join(', ')}</span>
							</p>
						</div>
					</div>

					<div class="rounded-2xl bg-white/2 border border-white/8 p-4 mb-4">
						<div class="flex items-center gap-2 mb-2">
							<KeyRound size={14} class="text-white/40" />
							<p class="text-[11px] font-mono text-white/40 uppercase tracking-widest">What to add to your env</p>
						</div>
						<pre class="text-[11px] leading-relaxed font-mono text-white/50 bg-black/30 border border-white/10 rounded-xl p-3 overflow-auto">{envSnippet}</pre>
						<p class="text-[12px] font-body text-white/35 mt-3">
							When you set these, restart the dev server. This page will automatically turn green when it detects them.
						</p>
					</div>
				{/if}

				<div class="flex items-center gap-2">
					<button
						onclick={connectInstagram}
						class="px-4 py-2.5 rounded-2xl text-sm font-semibold font-body transition-all
							{status?.ok ? 'bg-pink-500/90 hover:bg-pink-500 text-white' : 'bg-white/5 text-white/35 border border-white/10 cursor-not-allowed'}"
						disabled={!status?.ok}
					>
						Connect Instagram
					</button>
					<a
						href="https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing"
						target="_blank"
						rel="noreferrer"
						class="text-[12px] font-body text-white/35 hover:text-white/70 transition-colors"
					>
						Meta docs (publishing)
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>

