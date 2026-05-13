<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { AlertCircle, CheckCircle } from 'lucide-svelte';

	let email    = $state('');
	let password = $state('');
	let fullName = $state('');
	let loading  = $state(false);
	let error    = $state('');
	let success  = $state(false);
	let mounted  = $state(false);

	import { onMount } from 'svelte';
	onMount(() => { mounted = true; });

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

	type Testimonial = {
		name: string;
		role: string;
		initials: string;
		tint: string;
		content: string;
	};

	const colA: Testimonial[] = [
		{
			name: 'Vincent L.', role: 'Marketing Coordinator', initials: 'VL', tint: '#7B2D26',
			content: 'The UI is friendly and the AI content assistant is surprisingly effective for professional tones. I especially like how it adjusts to different industries.',
		},
		{
			name: 'Dilini R.', role: 'AI & Tech Consultant', initials: 'DR', tint: '#3D6B8C',
			content: "I just found out about Carousel Studio, a tool for scheduling carousels. Exactly what I wished for a few years back — it connects to LinkedIn, X, and Instagram from one dashboard. Focused on doing one thing well.",
		},
		{
			name: 'Johannes D.', role: 'CEO', initials: 'JD', tint: '#D67862',
			content: "As a privacy‑first company we appreciate being able to self‑host. It brings all the core functionality of a scheduler plus a lot of AI to make things faster. Great work!",
		},
		{
			name: 'George B.', role: 'Marketing Assistant', initials: 'GB', tint: '#A6B4C4',
			content: "It's so easy to jump in and start scheduling. I like that I can see all planned posts at a glance and edit them quickly if needed.",
		},
	];

	const colB: Testimonial[] = [
		{
			name: 'Maria Camila A.', role: 'Data Analyst', initials: 'MA', tint: '#FFB4A2',
			content: 'Carousel Studio changed how we manage our social presence by aggregating our platforms into one effective tool. Post scheduling and AI ideation make our work simple and effective.',
		},
		{
			name: 'Bartolomeo H.', role: 'CEO', initials: 'BH', tint: '#B5E48C',
			content: 'The carousel templates feel hand‑crafted, not AI‑generic. Our brand stays consistent across every post and the auto‑schedule keeps the calendar full without me thinking about it.',
		},
		{
			name: 'Sofia M.', role: 'Brand Designer', initials: 'SM', tint: '#FFC8DD',
			content: "I save my own templates and re‑use them for every drop. The studio editing flow is the closest thing to a real design tool I've found in a scheduler.",
		},
		{
			name: 'Ravi P.', role: 'Founder', initials: 'RP', tint: '#FFD6A5',
			content: 'Going from a news article to a finished slideshow takes me under two minutes. I post twice a day now without even thinking about it.',
		},
	];
</script>

<svelte:head>
	<title>Sign up — Carousel Studio</title>
</svelte:head>

<div class="root" class:mounted>
	<!-- ── Left: form card ─────────────────────────────────────── -->
	<section class="pane pane-form">
		<div class="form-shell">
			<a href="/" class="logo">
				<span class="logo-mark" aria-hidden="true"></span>
				<span class="logo-text">Carousel<em>Studio</em></span>
			</a>

			{#if success}
				<div class="success-state">
					<div class="success-icon" aria-hidden="true">
						<CheckCircle size={28} />
					</div>
					<h2 class="success-title">Check your inbox</h2>
					<p class="success-body">
						We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and start creating.
					</p>
					<a href="/login" class="success-btn">Back to sign in</a>
				</div>
			{:else}
				<div class="form-stack">
					<h1 class="form-title">Sign Up</h1>

					<div class="form-section">
						<p class="form-eyebrow">Continue With</p>

						<button type="button" class="oauth-btn" onclick={loginWithGoogle}>
							<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
								<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
								<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
								<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
								<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
							</svg>
							<span>Continue with Google</span>
						</button>

						<div class="divider" role="separator" aria-orientation="horizontal">
							<span class="divider-line"></span>
							<span class="divider-text">or</span>
							<span class="divider-line"></span>
						</div>

						{#if error}
							<div class="error-toast" role="alert">
								<AlertCircle size={14} />
								<span>{error}</span>
							</div>
						{/if}

						<form class="form" onsubmit={(e) => { e.preventDefault(); signup(); }}>
							<div class="field">
								<input
									id="name" type="text" bind:value={fullName} required
									placeholder="Full Name" class="input"
									autocomplete="name"
									aria-label="Full name"
								/>
							</div>

							<div class="field">
								<input
									id="email" type="email" bind:value={email} required
									placeholder="Email Address" class="input"
									autocomplete="email"
									aria-label="Email"
								/>
							</div>

							<div class="field">
								<input
									id="password" type="password" bind:value={password} required minlength={8}
									placeholder="Password (min 8 characters)" class="input"
									autocomplete="new-password"
									aria-label="Password"
								/>
							</div>

							<button type="submit" disabled={loading} class="submit-btn">
								{#if loading}
									<span class="spinner"></span>
									<span>Creating account…</span>
								{:else}
									Create account
								{/if}
							</button>

							<p class="terms-note">
								By signing up you agree to our
								<a href="/terms" class="footer-link">Terms</a>
								and
								<a href="/privacy" class="footer-link">Privacy Policy</a>.
							</p>

							<p class="footer-line">
								Already Have An Account?&nbsp;
								<a href="/login" class="footer-link">Sign In</a>
							</p>
						</form>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- ── Right: testimonials ─────────────────────────────────── -->
	<aside class="pane pane-marquee" aria-hidden="true">
		<h2 class="marquee-title">
			Over <span class="marquee-accent">20,000+</span> Creators use<br />
			Carousel Studio To Grow Their Social Presence
		</h2>

		<div class="marquee">
			<div class="marquee-mask marquee-mask-top"></div>
			<div class="marquee-mask marquee-mask-bottom"></div>

			<div class="marquee-cols">
				<div class="marquee-col marquee-up">
					{#each [...colA, ...colA] as t, i (i + '-' + t.name)}
						<article class="t-card">
							<header class="t-head">
								<span class="t-avatar" style={`background:${t.tint}`}>{t.initials}</span>
								<div class="t-meta">
									<p class="t-name">{t.name}</p>
									<p class="t-role">{t.role}</p>
								</div>
							</header>
							<p class="t-content">{t.content}</p>
						</article>
					{/each}
				</div>

				<div class="marquee-col marquee-down">
					{#each [...colB, ...colB] as t, i (i + '-' + t.name)}
						<article class="t-card">
							<header class="t-head">
								<span class="t-avatar" style={`background:${t.tint}`}>{t.initials}</span>
								<div class="t-meta">
									<p class="t-name">{t.name}</p>
									<p class="t-role">{t.role}</p>
								</div>
							</header>
							<p class="t-content">{t.content}</p>
						</article>
					{/each}
				</div>
			</div>
		</div>
	</aside>
</div>

<style>
	/* ── Root layout ─────────────────────────────────────────── */
	.root {
		min-height: 100vh;
		width: 100vw;
		padding: 12px;
		gap: 12px;
		display: flex;
		background: #0e0e0e;
		color: #ffffff;
		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		opacity: 0;
		transition: opacity 0.5s ease;
		box-sizing: border-box;
		overflow: hidden;
	}
	.root.mounted { opacity: 1; }

	.pane {
		display: flex;
		flex: 1;
		min-width: 0;
		border-radius: 12px;
	}

	/* ── Left form pane ─────────────────────────────────────── */
	.pane-form {
		background: #1a1919;
		padding: 40px 20px;
		flex: 1;
	}
	@media (min-width: 1024px) {
		.pane-form {
			flex: none;
			width: 600px;
		}
	}

	.form-shell {
		width: 100%;
		max-width: 440px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
		justify-content: center;
		min-height: 100%;
		padding: 12px;
		box-sizing: border-box;
	}

	.logo {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: #ffffff;
		align-self: flex-start;
	}
	.logo-mark {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background:
			radial-gradient(circle at 30% 30%, #fff 0%, #fff 30%, transparent 31%) 0 0/100% 100% no-repeat,
			conic-gradient(from 220deg, #1c1c1c, #3a3a3a, #1c1c1c);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.4) inset, 0 1px 2px rgba(0, 0, 0, 0.4);
	}
	.logo-text {
		font-family: 'Satoshi', sans-serif;
		font-size: 17px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.logo-text em {
		font-style: italic;
		font-weight: 700;
		color: #FC69FF;
	}

	.form-stack {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.form-title {
		margin: 0;
		font-family: 'Satoshi', sans-serif;
		font-size: 40px;
		font-weight: 500;
		letter-spacing: -0.8px;
		line-height: 1.05;
		color: #ffffff;
	}

	.form-section {
		margin-top: 32px;
		display: flex;
		flex-direction: column;
	}

	.form-eyebrow {
		margin: 0 0 12px;
		font-size: 14px;
		color: rgba(255, 255, 255, 0.92);
	}

	/* ── OAuth button ───────────────────────────────────────── */
	.oauth-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		height: 48px;
		padding: 0 20px;
		background: #2a2929;
		border: 1px solid #2b2a2a;
		border-radius: 10px;
		color: #ffffff;
		font-family: inherit;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
	}
	.oauth-btn:hover {
		background: #353333;
		border-color: #3a3939;
		transform: translateY(-1px);
	}

	/* ── Divider ────────────────────────────────────────────── */
	.divider {
		position: relative;
		height: 20px;
		margin: 24px 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.divider-line {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: #2b2a2a;
		transform: translateY(-50%);
	}
	.divider-text {
		position: relative;
		padding: 0 16px;
		background: #1a1919;
		color: rgba(255, 255, 255, 0.62);
		font-size: 14px;
		z-index: 1;
	}

	/* ── Error toast ────────────────────────────────────────── */
	.error-toast {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		margin-bottom: 12px;
		border-radius: 10px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.28);
		font-size: 13px;
		color: #fca5a5;
	}

	/* ── Form ───────────────────────────────────────────────── */
	.form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.field { display: flex; flex-direction: column; }

	.input {
		width: 100%;
		height: 48px;
		padding: 0 14px;
		background: #2a2929;
		border: 1px solid #2b2a2a;
		border-radius: 10px;
		color: #ffffff;
		font-family: inherit;
		font-size: 14px;
		outline: none;
		transition: border-color 0.18s ease, background 0.18s ease;
		box-sizing: border-box;
	}
	.input::placeholder { color: rgba(255, 255, 255, 0.42); }
	.input:focus {
		border-color: #FC69FF;
		background: #2f2d2d;
	}

	/* ── Submit ─────────────────────────────────────────────── */
	.submit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 52px;
		margin-top: 14px;
		background: #FC69FF;
		color: #1a0a1c;
		border: none;
		border-radius: 10px;
		font-family: inherit;
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.005em;
		cursor: pointer;
		transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
	}
	.submit-btn:hover:not(:disabled) {
		background: #ff85ff;
		transform: translateY(-1px);
		box-shadow: 0 12px 32px -10px rgba(252, 105, 255, 0.45);
	}
	.submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

	.spinner {
		width: 14px; height: 14px; border-radius: 50%;
		border: 2px solid rgba(26, 10, 28, 0.28);
		border-top-color: #1a0a1c;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ── Terms / footer lines ───────────────────────────────── */
	.terms-note {
		text-align: center;
		margin: 14px 0 0;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.55);
		line-height: 1.55;
	}
	.footer-line {
		text-align: center;
		margin: 16px 0 0;
		font-size: 14px;
		color: rgba(255, 255, 255, 0.78);
	}
	.footer-link {
		color: #ffffff;
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: font-weight 0.18s, color 0.18s;
	}
	.footer-link:hover {
		font-weight: 700;
		color: #FC69FF;
	}

	/* ── Success state ──────────────────────────────────────── */
	.success-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 16px;
		padding: 24px 0;
	}
	.success-icon {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: rgba(252, 105, 255, 0.12);
		border: 1px solid rgba(252, 105, 255, 0.32);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #FC69FF;
	}
	.success-title {
		font-family: 'Satoshi', sans-serif;
		font-size: 28px;
		font-weight: 500;
		letter-spacing: -0.6px;
		color: #ffffff;
		margin: 0;
	}
	.success-body {
		font-size: 14px;
		line-height: 1.65;
		color: rgba(255, 255, 255, 0.78);
		margin: 0;
		max-width: 360px;
	}
	.success-body strong { color: #ffffff; font-weight: 600; }
	.success-btn {
		margin-top: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		padding: 0 24px;
		background: #2a2929;
		border: 1px solid #2b2a2a;
		border-radius: 10px;
		color: #ffffff;
		font-family: inherit;
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
	}
	.success-btn:hover {
		background: #353333;
		border-color: #3a3939;
		transform: translateY(-1px);
	}

	/* ── Right marquee pane ─────────────────────────────────── */
	.pane-marquee {
		display: none;
		flex-direction: column;
		align-items: center;
		padding-top: 88px;
		font-size: 36px;
	}
	@media (min-width: 1024px) {
		.pane-marquee { display: flex; }
	}

	.marquee-title {
		margin: 0;
		font-family: 'Satoshi', sans-serif;
		font-size: 36px;
		font-weight: 500;
		line-height: 1.18;
		text-align: center;
		letter-spacing: -0.025em;
		color: #ffffff;
		max-width: 720px;
		padding: 0 24px;
	}
	.marquee-accent {
		font-size: 42px;
		color: #FC69FF;
		font-weight: 700;
	}

	.marquee {
		flex: 1;
		position: relative;
		width: 100%;
		max-width: 850px;
		margin: 30px 0;
	}

	.marquee-mask {
		position: absolute;
		left: 40px;
		right: 40px;
		height: 120px;
		z-index: 5;
		pointer-events: none;
	}
	.marquee-mask-top {
		top: 0;
		background: linear-gradient(180deg, #0e0e0e 0%, transparent 100%);
	}
	.marquee-mask-bottom {
		bottom: 0;
		background: linear-gradient(0deg, #0e0e0e 0%, transparent 100%);
	}

	.marquee-cols {
		position: absolute;
		inset: 0;
		padding: 0 40px;
		overflow: hidden;
		display: flex;
		gap: 12px;
		justify-content: center;
	}
	.marquee-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.marquee-up   { animation: marqueeUp 38s linear infinite; }
	.marquee-down { animation: marqueeDown 38s linear infinite; }

	@keyframes marqueeUp {
		0%   { transform: translateY(0); }
		100% { transform: translateY(-50%); }
	}
	@keyframes marqueeDown {
		0%   { transform: translateY(-50%); }
		100% { transform: translateY(0); }
	}

	/* ── Testimonial card ───────────────────────────────────── */
	.t-card {
		background: #1a1919;
		border: 1px solid #2b2a2a;
		border-radius: 16px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		flex-shrink: 0;
	}
	.t-head {
		display: flex;
		gap: 12px;
		min-width: 0;
		align-items: flex-start;
	}
	.t-avatar {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: 'Satoshi', sans-serif;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.02em;
		color: rgba(255, 255, 255, 0.92);
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
	}
	.t-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
		margin-top: -4px;
	}
	.t-name {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		color: #ffffff;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.t-role {
		margin: 0;
		font-size: 11px;
		font-weight: 400;
		color: #d1d1d1;
	}
	.t-content {
		margin: 0;
		font-size: 12px;
		font-weight: 400;
		line-height: 1.55;
		color: #ffffff;
		white-space: pre-line;
	}

	/* ── Reduced motion ─────────────────────────────────────── */
	@media (prefers-reduced-motion: reduce) {
		.marquee-up, .marquee-down { animation: none; }
		.root { transition: none; }
	}

	/* ── Small screens ──────────────────────────────────────── */
	@media (max-width: 600px) {
		.pane-form { padding: 24px 12px; }
		.form-title { font-size: 32px; letter-spacing: -0.6px; }
	}
</style>
