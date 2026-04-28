<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle, Sparkles } from 'lucide-svelte';

	let email    = $state('');
	let password = $state('');
	let fullName = $state('');
	let loading  = $state(false);
	let error    = $state('');
	let success  = $state(false);

	async function signup() {
		loading = true; error = '';
		const { error: err } = await supabase.auth.signUp({
			email, password,
			options: { data: { full_name: fullName } }
		});
		if (err) { error = err.message; loading = false; return; }
		success = true; loading = false;
	}

	async function loginWithGoogle() {
		await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
		});
	}

	const perks = [
		{ icon: '✦', text: 'AI carousel generation in seconds' },
		{ icon: '✦', text: 'Schedule to 6+ platforms at once' },
		{ icon: '✦', text: 'Viral content discovery engine' },
		{ icon: '✦', text: 'Brand kit & custom templates' },
	];
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="auth-root">
	<div class="auth-orb auth-orb--1"></div>
	<div class="auth-orb auth-orb--2"></div>
	<div class="auth-orb auth-orb--3"></div>

	<!-- Left panel: branding -->
	<div class="auth-brand">
		<div class="brand-inner">
			<a href="/" class="brand-logo">
				<div class="logo-mark">CS</div>
				<span class="logo-text">Carousel<em>Studio</em></span>
			</a>

			<div class="brand-copy">
				<div class="brand-badge">
					<Sparkles size={10} />
					Free forever · No credit card
				</div>
				<h2 class="brand-headline">Your audience is<br/>waiting. Let's grow.</h2>
				<p class="brand-sub">Create stunning carousels, schedule across every platform, and watch your engagement skyrocket.</p>
			</div>

			<div class="perk-list">
				{#each perks as perk}
					<div class="perk-item">
						<span class="perk-icon">{perk.icon}</span>
						<span class="perk-text">{perk.text}</span>
					</div>
				{/each}
			</div>

			<div class="brand-social-proof">
				<div class="avatars">
					<div class="av av--1">JL</div>
					<div class="av av--2">MK</div>
					<div class="av av--3">SA</div>
					<div class="av av--4">+</div>
				</div>
				<div class="proof-text">
					<p class="proof-count">8,400+ creators</p>
					<p class="proof-sub">already growing with Carousel Studio</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Right panel: form -->
	<div class="auth-form-panel">
		<div class="auth-form-wrap">

			{#if success}
				<div class="success-state">
					<div class="success-icon">
						<CheckCircle size={28} />
					</div>
					<h2 class="success-title">Check your inbox</h2>
					<p class="success-body">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and start creating.</p>
					<a href="/login" class="success-btn">Back to sign in →</a>
				</div>
			{:else}
				<div class="form-header">
					<h1 class="form-title">Create your account</h1>
					<p class="form-sub">Free forever. No credit card required.</p>
				</div>

				{#if error}
					<div class="error-banner">
						<AlertCircle size={14} class="shrink-0" />
						<p>{error}</p>
					</div>
				{/if}

				<form onsubmit={(e) => { e.preventDefault(); signup(); }} class="auth-form">
					<div class="field">
						<label for="name" class="field-label">Full name</label>
						<div class="input-wrap">
							<User size={14} class="input-icon" />
							<input
								id="name" type="text" bind:value={fullName} required
								placeholder="Jane Smith"
								class="input"
							/>
						</div>
					</div>

					<div class="field">
						<label for="email" class="field-label">Email address</label>
						<div class="input-wrap">
							<Mail size={14} class="input-icon" />
							<input
								id="email" type="email" bind:value={email} required
								placeholder="you@example.com"
								class="input"
							/>
						</div>
					</div>

					<div class="field">
						<label for="password" class="field-label">Password</label>
						<div class="input-wrap">
							<Lock size={14} class="input-icon" />
							<input
								id="password" type="password" bind:value={password} required
								placeholder="Min 8 characters"
								class="input"
							/>
						</div>
						<p class="field-hint">At least 8 characters</p>
					</div>

					<button type="submit" disabled={loading} class="submit-btn">
						{loading ? 'Creating account…' : 'Create free account'}
						{#if !loading}<ArrowRight size={15} />{/if}
					</button>

					<p class="terms-note">By signing up you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
				</form>

				<div class="divider">
					<div class="divider-line"></div>
					<span class="divider-text">or</span>
					<div class="divider-line"></div>
				</div>

				<button onclick={loginWithGoogle} class="google-btn">
					<svg width="18" height="18" viewBox="0 0 24 24">
						<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
						<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
						<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
						<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
					</svg>
					Continue with Google
				</button>

				<p class="form-footer">
					Already have an account?
					<a href="/login" class="form-link">Sign in →</a>
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.auth-root {
		min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr;
		background: var(--app-bg); color: var(--app-text); font-family: 'Lexend', sans-serif;
		position: relative; overflow: hidden;
	}

	.auth-orb {
		position: fixed; border-radius: 50%; pointer-events: none; filter: blur(80px);
	}
	.auth-orb--1 {
		width: 500px; height: 500px; top: -120px; left: -80px;
		background: radial-gradient(ellipse, rgba(139,92,246,0.07), transparent);
	}
	.auth-orb--2 {
		width: 400px; height: 400px; bottom: -100px; right: -80px;
		background: radial-gradient(ellipse, rgba(232,255,72,0.06), transparent);
	}
	.auth-orb--3 {
		width: 300px; height: 300px; top: 50%; left: 50%; transform: translate(-50%,-50%);
		background: radial-gradient(ellipse, rgba(6,182,212,0.04), transparent);
	}

	/* Brand panel */
	.auth-brand {
		background: var(--app-surface); border-right: 1px solid var(--app-border);
		display: flex; align-items: center; justify-content: center;
		padding: 60px 64px; position: relative;
	}
	.brand-inner { max-width: 400px; display: flex; flex-direction: column; gap: 44px; }

	.brand-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
	.logo-mark {
		width: 36px; height: 36px; border-radius: 9px;
		background: #E8FF48; color: #000;
		display: flex; align-items: center; justify-content: center;
		font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700;
	}
	.logo-text {
		font-family: 'Lexend', sans-serif; font-size: 18px; font-weight: 900;
		color: var(--app-text); letter-spacing: -0.02em;
	}
	.logo-text em { font-style: italic; color: #E8FF48; }

	.brand-copy { display: flex; flex-direction: column; gap: 16px; }

	.brand-badge {
		display: inline-flex; align-items: center; gap: 6px;
		padding: 5px 12px; border-radius: 100px;
		background: rgba(232,255,72,0.08); border: 1px solid rgba(232,255,72,0.2);
		font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700;
		color: #E8FF48; text-transform: uppercase; letter-spacing: 0.08em;
		width: fit-content;
	}

	.brand-headline {
		font-family: 'Lexend', sans-serif; font-size: clamp(28px, 3vw, 42px);
		font-weight: 900; line-height: 1.05; letter-spacing: -0.03em;
		color: var(--app-text); margin: 0;
	}
	.brand-sub { font-size: 15px; line-height: 1.65; color: var(--app-text-2); margin: 0; }

	.perk-list { display: flex; flex-direction: column; gap: 12px; }
	.perk-item { display: flex; align-items: center; gap: 12px; }
	.perk-icon {
		width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
		background: rgba(232,255,72,0.1); border: 1px solid rgba(232,255,72,0.2);
		display: flex; align-items: center; justify-content: center;
		font-size: 9px; color: #E8FF48;
	}
	.perk-text { font-size: 14px; color: var(--app-text-2); }

	.brand-social-proof {
		display: flex; align-items: center; gap: 14px;
		padding: 18px; border-radius: 14px;
		background: color-mix(in oklab, var(--app-text) 2%, transparent); border: 1px solid var(--app-border);
	}
	.avatars { display: flex; }
	.av {
		width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
		display: flex; align-items: center; justify-content: center;
		font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700;
		border: 2px solid #080808; margin-left: -8px;
	}
	.av:first-child { margin-left: 0; }
	.av--1 { background: rgba(139,92,246,0.3); color: #a78bfa; }
	.av--2 { background: rgba(6,182,212,0.3); color: #22d3ee; }
	.av--3 { background: rgba(232,255,72,0.2); color: #E8FF48; }
	.av--4 { background: color-mix(in oklab, var(--app-text) 6%, transparent); color: var(--app-text-2); font-size: 11px; }

	.proof-text { display: flex; flex-direction: column; gap: 2px; }
	.proof-count { font-family: 'Lexend', sans-serif; font-size: 16px; font-weight: 900; color: var(--app-text); margin: 0; }
	.proof-sub { font-size: 12px; color: var(--app-text-2); margin: 0; }

	/* Form panel */
	.auth-form-panel {
		display: flex; align-items: center; justify-content: center;
		padding: 60px 64px;
	}
	.auth-form-wrap { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 22px; }

	/* Success state */
	.success-state {
		display: flex; flex-direction: column; align-items: center;
		text-align: center; gap: 16px; padding: 20px 0;
	}
	.success-icon {
		width: 60px; height: 60px; border-radius: 50%;
		background: rgba(232,255,72,0.08); border: 1px solid rgba(232,255,72,0.25);
		display: flex; align-items: center; justify-content: center; color: #E8FF48;
	}
	.success-title {
		font-family: 'Lexend', sans-serif; font-size: 26px; font-weight: 900;
		letter-spacing: -0.03em; color: var(--app-text); margin: 0;
	}
	.success-body { font-size: 14px; color: var(--app-text-2); line-height: 1.65; margin: 0; }
	.success-body strong { color: var(--app-text); }
	.success-btn {
		margin-top: 8px; padding: 11px 24px; border-radius: 10px;
		background: color-mix(in oklab, var(--app-text) 4%, transparent); border: 1px solid var(--app-border);
		font-size: 14px; font-weight: 600; font-family: 'Lexend', sans-serif;
		color: var(--app-text-2); text-decoration: none; transition: all 0.15s;
	}
	.success-btn:hover { background: color-mix(in oklab, var(--app-text) 6%, transparent); color: var(--app-text); }

	/* Form header */
	.form-header { display: flex; flex-direction: column; gap: 8px; }
	.form-title {
		font-family: 'Lexend', sans-serif; font-size: 28px; font-weight: 900;
		letter-spacing: -0.03em; color: var(--app-text); margin: 0;
	}
	.form-sub { font-size: 14px; color: var(--app-text-2); margin: 0; }

	.error-banner {
		display: flex; align-items: center; gap: 8px;
		padding: 12px 14px; border-radius: 10px;
		background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
		font-size: 13px; color: #f87171;
	}
	.error-banner p { margin: 0; }

	.auth-form { display: flex; flex-direction: column; gap: 14px; }

	.field { display: flex; flex-direction: column; gap: 6px; }
	.field-label {
		font-size: 12px; font-weight: 600; text-transform: uppercase;
		letter-spacing: 0.07em; color: var(--app-text-2);
		font-family: 'Space Mono', monospace;
	}
	.field-hint { font-size: 11px; color: var(--app-text-3); margin: 0; }

	.input-wrap { position: relative; }
	:global(.input-icon) {
		position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
		color: var(--app-text-3); pointer-events: none;
	}
	.input {
		width: 100%; background: color-mix(in oklab, var(--app-text) 3%, transparent); border: 1px solid var(--app-border);
		border-radius: 10px; padding: 11px 12px 11px 38px;
		font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--app-text);
		outline: none; transition: border-color 0.15s; box-sizing: border-box;
	}
	.input::placeholder { color: var(--app-text-3); }
	.input:focus { border-color: rgba(232,255,72,0.35); background: color-mix(in oklab, var(--app-text) 4%, transparent); }

	.submit-btn {
		display: flex; align-items: center; justify-content: center; gap: 8px;
		width: 100%; padding: 13px; border-radius: 11px; border: none;
		background: #E8FF48; color: #0a0a0a;
		font-size: 15px; font-weight: 700; font-family: 'DM Sans', sans-serif;
		cursor: pointer; transition: all 0.2s; margin-top: 4px;
	}
	.submit-btn:hover:not(:disabled) { background: #f0ff70; box-shadow: 0 8px 28px rgba(232,255,72,0.3); transform: translateY(-1px); }
	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.terms-note {
		text-align: center; font-size: 11px; color: var(--app-text-3); margin: 0;
	}
	.terms-note a { color: var(--app-text-2); text-decoration: none; }
	.terms-note a:hover { color: var(--app-text); }

	.divider { display: flex; align-items: center; gap: 12px; }
	.divider-line { flex: 1; height: 1px; background: var(--app-border); }
	.divider-text { font-size: 12px; color: var(--app-text-3); font-family: 'Space Mono', monospace; }

	.google-btn {
		display: flex; align-items: center; justify-content: center; gap: 10px;
		width: 100%; padding: 11px; border-radius: 11px;
		background: color-mix(in oklab, var(--app-text) 3%, transparent); border: 1px solid var(--app-border);
		font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--app-text-2);
		cursor: pointer; transition: all 0.15s;
	}
	.google-btn:hover { background: color-mix(in oklab, var(--app-text) 5%, transparent); border-color: var(--app-border-hover); color: var(--app-text); }

	.form-footer {
		text-align: center; font-size: 14px; color: var(--app-text-2);
	}
	.form-link { color: #E8FF48; text-decoration: none; font-weight: 600; transition: opacity 0.15s; }
	.form-link:hover { opacity: 0.8; }
</style>
