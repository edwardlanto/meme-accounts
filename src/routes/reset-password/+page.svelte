<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { AlertCircle, CheckCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { AuthPageShell } from '$lib/components/marketing';
	import { supabase } from '$lib/supabase';
	import { authModalHref } from '$lib/auth-modal';

	let password = $state('');
	let confirm = $state('');
	let loading = $state(false);
	let checking = $state(true);
	let error = $state('');
	let saved = $state(false);
	let hasSession = $state(false);

	onMount(() => {
		let alive = true;
		const { data } = supabase.auth.onAuthStateChange((event, session) => {
			if (!alive) return;
			if (session) hasSession = true;
			if (event === 'PASSWORD_RECOVERY') hasSession = true;
			checking = false;
		});

		void supabase.auth.getSession().then(({ data: { session } }) => {
			if (!alive) return;
			if (session) hasSession = true;
			checking = false;
		});

		return () => {
			alive = false;
			data.subscription.unsubscribe();
		};
	});

	async function savePassword(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const next = password.trim();
		if (next.length < 8) {
			error = 'Password must be at least 8 characters.';
			return;
		}
		if (next !== confirm) {
			error = 'Passwords do not match.';
			return;
		}
		loading = true;
		const { error: err } = await supabase.auth.updateUser({ password: next });
		loading = false;
		if (err) {
			error = err.message;
			return;
		}
		saved = true;
		password = '';
		confirm = '';
		window.setTimeout(() => {
			void goto('/dashboard');
		}, 1400);
	}
</script>

<svelte:head>
	<title>Set a new password | Meme Accounts</title>
	<meta name="description" content="Choose a new password for your Meme Accounts account." />
	<meta name="robots" content="noindex" />
</svelte:head>

<AuthPageShell
	eyebrow="Account"
	title="Set a new password"
	description={hasSession || checking
		? 'Pick something you’ll remember. At least 8 characters.'
		: 'This reset link is missing or expired. Request a new one to continue.'}
>
	{#if checking}
		<p class="mk-auth-lead" style="margin:0">Checking your reset link…</p>
	{:else if saved}
		<div class="mk-auth-success">
			<div class="mk-auth-success-icon" aria-hidden="true"><CheckCircle size={28} /></div>
			<p class="mk-auth-ok">Password updated. Taking you to the dashboard…</p>
			<Button href="/dashboard" size="marketing">Open dashboard</Button>
		</div>
	{:else if !hasSession}
		<div class="mk-auth-error" role="alert">
			<AlertCircle size={14} />
			<span>That link didn’t create a session. Request a fresh reset email.</span>
		</div>
		<Button href="/forgot-password" size="marketing">Forgot password</Button>
		<p class="mk-auth-foot">
			<a href={authModalHref('login')}>Back to sign in</a>
		</p>
	{:else}
		{#if error}
			<div class="mk-auth-error" role="alert">
				<AlertCircle size={14} />
				<span>{error}</span>
			</div>
		{/if}

		<form class="mk-auth-form" onsubmit={savePassword}>
			<label class="mk-auth-label">
				New password
				<input
					class="mk-auth-input"
					type="password"
					bind:value={password}
					required
					minlength="8"
					autocomplete="new-password"
					placeholder="At least 8 characters"
				/>
			</label>
			<label class="mk-auth-label">
				Confirm password
				<input
					class="mk-auth-input"
					type="password"
					bind:value={confirm}
					required
					minlength="8"
					autocomplete="new-password"
					placeholder="Repeat password"
				/>
			</label>
			<Button type="submit" size="marketing" disabled={loading}>
				{loading ? 'Saving…' : 'Update password'}
			</Button>
		</form>
	{/if}
</AuthPageShell>
