<svelte:head>
	<title>Privacy Policy — Dropslot</title>
</svelte:head>

<main class="wrap">
	<article class="doc">
		<a class="back" href="/">← Home</a>

		<h1>Dropslot — Privacy Policy</h1>
		<p class="meta">Effective date: April 22, 2026</p>

		<h2>1. What We Collect</h2>
		<ul>
			<li>Account information you provide (email, name).</li>
			<li>OAuth access tokens issued by third-party platforms (TikTok, Instagram, Facebook) so we can publish on your behalf.</li>
			<li>Content you upload to Dropslot (images, videos, captions, schedules).</li>
			<li>Basic usage analytics and error logs.</li>
		</ul>

		<h2>2. How We Use Your Information</h2>
		<ul>
			<li>To authenticate you and maintain your session.</li>
			<li>To publish or schedule content to the third-party services you connect.</li>
			<li>To improve the product and diagnose issues.</li>
		</ul>
		<p>We do not sell your personal data to third parties.</p>

		<h2>3. Third-Party Services</h2>
		<p>
			Dropslot integrates with TikTok, Instagram (Meta), and Facebook (Meta).
			When you connect one of these accounts, we receive access tokens and
			basic profile data from that platform. We use those tokens only to
			perform the actions you request (for example, uploading a video to
			your TikTok drafts or posting to a Facebook Page you administer).
		</p>

		<h2>4. Data Retention</h2>
		<ul>
			<li>OAuth tokens are stored until you disconnect the account.</li>
			<li>Scheduled content is stored until it is published or you delete it.</li>
			<li>Account data is deleted within 30 days of account deletion.</li>
		</ul>

		<h2>5. Your Rights</h2>
		<p>
			You may request deletion of your account and all associated data at
			any time by emailing <a href="mailto:support@dropslot.app">support@dropslot.app</a>.
			You can also revoke access to connected third-party accounts at any
			time inside the TikTok, Instagram, or Facebook settings.
		</p>

		<h2>6. Security</h2>
		<p>
			We use industry-standard encryption in transit (HTTPS) and at rest.
			Access tokens are stored in a protected database and are never
			exposed to other users.
		</p>

		<h2>7. Children&apos;s Privacy</h2>
		<p>
			Dropslot is not intended for users under 13 years of age. We do not
			knowingly collect personal data from children.
		</p>

		<h2>8. Changes to This Policy</h2>
		<p>
			We may update this Privacy Policy from time to time. Any changes
			will be posted on this page with an updated effective date.
		</p>

		<h2>9. Contact</h2>
		<p>
			Questions about this Privacy Policy: <a href="mailto:support@dropslot.app">support@dropslot.app</a>
		</p>
	</article>
</main>

<style>
	.wrap {
		min-height: 100vh;
		background: var(--app-bg);
		color: var(--app-text);
		font-family: 'DM Sans', system-ui, sans-serif;
		padding: 48px 24px 96px;
	}
	.doc {
		max-width: 720px;
		margin: 0 auto;
		line-height: 1.65;
	}
	.back {
		display: inline-block;
		margin-bottom: 32px;
		font-size: 13px;
		color: var(--app-text-2);
		text-decoration: none;
		font-family: 'Space Mono', monospace;
	}
	.back:hover { color: var(--app-text); }
	h1 {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(32px, 5vw, 44px);
		font-weight: 900;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
	}
	.meta {
		font-size: 13px;
		color: var(--app-text-3);
		font-family: 'Space Mono', monospace;
		margin: 0 0 48px;
	}
	h2 {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 20px;
		font-weight: 700;
		margin: 36px 0 10px;
		color: var(--app-text);
	}
	p {
		font-size: 15px;
		color: var(--app-text-2);
		margin: 0 0 12px;
	}
	ul {
		margin: 0 0 16px;
		padding-left: 20px;
	}
	li {
		font-size: 15px;
		color: var(--app-text-2);
		margin-bottom: 6px;
	}
	a {
		color: #e8ff48;
		text-decoration: none;
	}
	a:hover { text-decoration: underline; }
</style>
