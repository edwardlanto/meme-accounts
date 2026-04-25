<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { ArrowRight, AlertCircle } from 'lucide-svelte';

	let email    = $state('');
	let password = $state('');
	let loading  = $state(false);
	let error    = $state('');
	let mounted  = $state(false);

	import { onMount } from 'svelte';
	onMount(() => { mounted = true; });

	async function login() {
		loading = true; error = '';
		const { error: err } = await supabase.auth.signInWithPassword({ email, password });
		if (err) { error = err.message; loading = false; return; }
		goto('/dashboard');
	}

	async function loginWithGoogle() {
		await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
		});
	}
</script>

<svelte:head>
	<title>Sign in — Carousel Studio</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="root" class:mounted>

	<!-- Animated background blobs -->
	<div class="blob blob-a"></div>
	<div class="blob blob-b"></div>
	<div class="blob blob-c"></div>

	<!-- Noise grain -->
	<div class="grain"></div>

	<!-- Auth card -->
	<div class="card">

		<!-- Logo -->
		<a href="/" class="logo">
			<div class="logo-mark">CS</div>
			<span class="logo-text">Carousel<em>Studio</em></span>
		</a>

		<div class="card-header">
			<h1 class="card-title">Welcome back</h1>
			<p class="card-sub">Sign in to continue creating</p>
		</div>

		<!-- Google — primary action -->
		<button class="google-btn" onclick={loginWithGoogle}>
			<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
				<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
				<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
				<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
				<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
			</svg>
			Continue with Google
		</button>

		<div class="divider">
			<div class="divider-line"></div>
			<span class="divider-text">or</span>
			<div class="divider-line"></div>
		</div>

		<!-- Error -->
		{#if error}
			<div class="error-toast">
				<AlertCircle size={13} />
				<span>{error}</span>
			</div>
		{/if}

		<!-- Email / password form -->
		<form class="form" onsubmit={(e) => { e.preventDefault(); login(); }}>
			<div class="field">
				<label for="email" class="field-label">Email</label>
				<input
					id="email" type="email" bind:value={email} required
					placeholder="you@example.com" class="input"
					autocomplete="email"
				/>
			</div>

			<div class="field">
				<div class="field-row">
					<label for="password" class="field-label">Password</label>
					<a href="#" class="forgot">Forgot?</a>
				</div>
				<input
					id="password" type="password" bind:value={password} required
					placeholder="••••••••" class="input"
					autocomplete="current-password"
				/>
			</div>

			<button type="submit" disabled={loading} class="submit-btn">
				{#if loading}
					<span class="spinner"></span>
					Signing in…
				{:else}
					Sign in
					<ArrowRight size={15} />
				{/if}
			</button>
		</form>

		<p class="footer-text">
			Don't have an account?
			<a href="/signup" class="footer-link">Create one free →</a>
		</p>
	</div>
</div>

<style>
	/* ── Tokens ───────────────────────────────────────────── */
	:root {
		--lime: #E8FF48;
		--font-display: 'Fraunces', Georgia, serif;
		--font-body:    'DM Sans', sans-serif;
		--font-mono:    'Space Mono', monospace;
	}

	/* ── Root ─────────────────────────────────────────────── */
	.root {
		min-height: 100vh;
		background: var(--app-bg);
		color: var(--app-text);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-body);
		position: relative;
		overflow: hidden;
		opacity: 0;
		transition: opacity 0.5s ease;
	}
	.root.mounted { opacity: 1; }

	/* ── Animated blobs ───────────────────────────────────── */
	.blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(90px);
		pointer-events: none;
	}
	.blob-a {
		width: 560px; height: 440px;
		top: -160px; left: -140px;
		background: radial-gradient(ellipse, rgba(99,102,241,0.22), transparent 70%);
		animation: drift 22s ease-in-out infinite;
	}
	.blob-b {
		width: 480px; height: 560px;
		bottom: -180px; right: -120px;
		background: radial-gradient(ellipse, rgba(236,72,153,0.18), transparent 70%);
		animation: drift 28s ease-in-out infinite reverse;
		animation-delay: -9s;
	}
	.blob-c {
		width: 620px; height: 300px;
		top: 45%; left: 25%;
		background: radial-gradient(ellipse, rgba(20,184,166,0.12), transparent 70%);
		animation: drift 18s ease-in-out infinite;
		animation-delay: -15s;
	}
	@keyframes drift {
		0%, 100% { transform: translate(0, 0) scale(1); }
		33%       { transform: translate(28px, -22px) scale(1.04); }
		66%       { transform: translate(-18px, 28px) scale(0.96); }
	}

	/* ── Grain overlay ────────────────────────────────────── */
	.grain {
		position: fixed; inset: 0; pointer-events: none; z-index: 10; opacity: 0.035;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
		background-size: 256px;
	}

	/* ── Card ─────────────────────────────────────────────── */
	.card {
		position: relative; z-index: 20;
		width: 100%; max-width: 400px;
		margin: 24px;
		padding: 40px;
		background: color-mix(in oklab, var(--app-text) 3%, transparent);
		border: 1px solid var(--app-border);
		border-radius: 24px;
		backdrop-filter: blur(32px);
		-webkit-backdrop-filter: blur(32px);
		display: flex;
		flex-direction: column;
		gap: 24px;
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--app-text) 4%, transparent) inset,
			0 32px 80px color-mix(in oklab, var(--app-text) 14%, transparent);
	}

	/* ── Logo ─────────────────────────────────────────────── */
	.logo {
		display: flex; align-items: center; gap: 10px;
		text-decoration: none; align-self: flex-start;
	}
	.logo-mark {
		width: 30px; height: 30px; border-radius: 7px;
		background: var(--lime); color: #000;
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-mono); font-size: 10px; font-weight: 700;
		flex-shrink: 0;
	}
	.logo-text {
		font-family: var(--font-display); font-size: 16px; font-weight: 900;
		color: var(--app-text); letter-spacing: -0.02em;
	}
	.logo-text em { font-style: italic; color: var(--lime); }

	/* ── Header ───────────────────────────────────────────── */
	.card-header { display: flex; flex-direction: column; gap: 6px; }
	.card-title {
		font-family: var(--font-display); font-size: 26px; font-weight: 900;
		letter-spacing: -0.03em; color: var(--app-text); margin: 0;
	}
	.card-sub { font-size: 14px; color: var(--app-text-2); margin: 0; }

	/* ── Google button ────────────────────────────────────── */
	.google-btn {
		display: flex; align-items: center; justify-content: center; gap: 10px;
		width: 100%; padding: 12px 20px;
		background: color-mix(in oklab, var(--app-text) 4%, transparent);
		border: 1px solid var(--app-border);
		border-radius: 12px;
		font-size: 14px; font-weight: 500;
		font-family: var(--font-body);
		color: var(--app-text);
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, transform 0.15s;
	}
	.google-btn:hover {
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
		border-color: var(--app-border-hover);
		transform: translateY(-1px);
	}

	/* ── Divider ──────────────────────────────────────────── */
	.divider {
		display: flex; align-items: center; gap: 12px;
	}
	.divider-line {
		flex: 1; height: 1px;
		background: var(--app-border);
	}
	.divider-text {
		font-size: 11px; color: var(--app-text-3);
		font-family: var(--font-mono); letter-spacing: 0.06em;
	}

	/* ── Error ────────────────────────────────────────────── */
	.error-toast {
		display: flex; align-items: center; gap: 8px;
		padding: 10px 14px; border-radius: 10px;
		background: rgba(239,68,68,0.08);
		border: 1px solid rgba(239,68,68,0.2);
		font-size: 13px; color: #fca5a5;
	}

	/* ── Form ─────────────────────────────────────────────── */
	.form { display: flex; flex-direction: column; gap: 16px; }

	.field { display: flex; flex-direction: column; gap: 7px; }
	.field-row { display: flex; justify-content: space-between; align-items: center; }
	.field-label {
		font-size: 12px; font-weight: 500;
		color: var(--app-text-2);
		letter-spacing: 0.02em;
	}
	.forgot {
		font-size: 12px; color: var(--app-text-3);
		text-decoration: none; transition: color 0.15s;
	}
	.forgot:hover { color: var(--app-text-2); }

	.input {
		width: 100%;
		background: color-mix(in oklab, var(--app-text) 4%, transparent);
		border: 1px solid var(--app-border);
		border-radius: 10px;
		padding: 11px 14px;
		font-size: 14px;
		font-family: var(--font-body);
		color: var(--app-text);
		outline: none;
		transition: border-color 0.15s, background 0.15s;
		box-sizing: border-box;
	}
	.input::placeholder { color: var(--app-text-3); }
	.input:focus {
		border-color: rgba(232,255,72,0.4);
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
	}

	/* ── Submit ───────────────────────────────────────────── */
	.submit-btn {
		display: flex; align-items: center; justify-content: center; gap: 8px;
		width: 100%; padding: 13px 20px;
		background: var(--lime); color: #000;
		border: none; border-radius: 12px;
		font-size: 15px; font-weight: 700;
		font-family: var(--font-body);
		cursor: pointer;
		transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
		margin-top: 4px;
	}
	.submit-btn:hover:not(:disabled) {
		background: #f2ff6a;
		transform: translateY(-1px);
		box-shadow: 0 8px 28px rgba(232,255,72,0.28);
	}
	.submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

	/* ── Spinner ──────────────────────────────────────────── */
	.spinner {
		width: 14px; height: 14px; border-radius: 50%;
		border: 2px solid rgba(0,0,0,0.2);
		border-top-color: #000;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ── Footer ───────────────────────────────────────────── */
	.footer-text {
		text-align: center; font-size: 13px;
		color: var(--app-text-3); margin: 0;
	}
	.footer-link {
		color: var(--app-text-2); text-decoration: none;
		font-weight: 500; transition: color 0.15s;
	}
	.footer-link:hover { color: var(--lime); }

	/* ── Responsive ───────────────────────────────────────── */
	@media (max-width: 480px) {
		.card { padding: 28px 24px; border-radius: 20px; }
	}
</style>
