<script lang="ts">
	import { page } from '$app/stores';
	import { AlertCircle, CheckCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { AuthPageShell } from '$lib/components/marketing';
	import { supabase } from '$lib/supabase';
	import { authModalHref, passwordResetRedirectTo } from '$lib/auth-modal';

	let email = $state(String($page.url.searchParams.get('email') ?? '').trim());
	let loading = $state(false);
	let error = $state('');
	let sent = $state(false);

	async function sendReset(e: SubmitEvent) {
		e.preventDefault();
		const value = email.trim();
		if (!value) {
			error = 'Enter the email on your account.';
			return;
		}
		loading = true;
		error = '';
		const { error: err } = await supabase.auth.resetPasswordForEmail(value, {
			redirectTo: passwordResetRedirectTo(location.origin),
		});
		loading = false;
		if (err) {
			error = err.message;
			return;
		}
		sent = true;
	}
</script>

<svelte:head>
	<title>Forgot password | Meme Accounts</title>
	<meta name="description" content="Reset your Meme Accounts password. We’ll email you a link." />
	<meta name="robots" content="noindex" />
</svelte:head>

<AuthPageShell
	eyebrow="Account"
	title="Forgot password"
	description="Enter the email on your account. If it exists, we’ll send a reset link."
>
	{#if sent}
		<div class="mk-auth-success">
			<div class="mk-auth-success-icon" aria-hidden="true"><CheckCircle size={28} /></div>
			<p class="mk-auth-ok">
				If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way.
				Check spam if you don’t see it in a few minutes.
			</p>
			<Button href={authModalHref('login')} variant="outline" size="marketing">Back to sign in</Button>
		</div>
	{:else}
		{#if error}
			<div class="mk-auth-error" role="alert">
				<AlertCircle size={14} />
				<span>{error}</span>
			</div>
		{/if}

		<form class="mk-auth-form" onsubmit={sendReset}>
			<label class="mk-auth-label">
				Email
				<input
					class="mk-auth-input"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					placeholder="you@example.com"
				/>
			</label>
			<Button type="submit" size="marketing" disabled={loading}>
				{loading ? 'Sending…' : 'Send reset link'}
			</Button>
		</form>

		<p class="mk-auth-foot">
			Remembered it? <a href={authModalHref('login')}>Sign in</a>
		</p>
	{/if}
</AuthPageShell>
