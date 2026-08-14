<script lang="ts">
	import LegalDoc from '$lib/components/LegalDoc.svelte';
</script>

<svelte:head>
	<title>Privacy Policy | Meme Accounts</title>
	<meta name="description" content="How Meme Accounts collects, uses, and protects your data, including payments, AI features, and connected social accounts." />
</svelte:head>

<LegalDoc title="Meme Accounts | Privacy Policy" effectiveDate="August 12, 2026">
	<h2>1. Who we are</h2>
	<p>
		Meme Accounts (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides tools to design social posts,
		carousels, tweet-style graphics, and scheduled publishing. This policy explains what we
		collect and how we use it.
	</p>

	<h2>2. We collect user data</h2>
	<p>
		When you use Meme Accounts, we collect personal and usage data needed to run the Service.
		Categories include:
	</p>
	<ul>
		<li><strong>Account data</strong>: email, name, and authentication identifiers when you sign up.</li>
		<li><strong>Content you create or upload</strong>: templates, captions, images, videos, cutouts, brand assets, and schedules you upload or generate.</li>
		<li><strong>Connected accounts</strong>: OAuth tokens and profile metadata from platforms you connect (Instagram, TikTok, LinkedIn, YouTube, Bluesky, Google Business, etc.).</li>
		<li><strong>Payment data</strong>: billing is handled by Stripe. We store your plan, Stripe customer id, and subscription status, not full card numbers.</li>
		<li><strong>Usage &amp; diagnostics</strong>: basic logs, errors, IP/device signals as needed for security, and feature usage to keep the service reliable.</li>
	</ul>

	<h2>3. How we use information</h2>
	<ul>
		<li>Authenticate you and maintain your session.</li>
		<li>Render, export, store, and publish content you request.</li>
		<li>
			<strong>Run AI-assisted features</strong> (hooks, captions, variants, image generation,
			video clip analysis, and similar) by sending relevant prompts and media to
			<strong>third-party AI providers</strong>.
		</li>
		<li>Process subscriptions, send billing-related notices (via Stripe), and enforce plan limits (including free-trial export limits).</li>
		<li>Improve the product and prevent abuse.</li>
	</ul>
	<p>We do not sell your personal information.</p>

	<h2>4. Third-party data collectors &amp; processors</h2>
	<p>
		We share data with service providers who process it on our behalf to operate Meme Accounts.
		These include (as used):
	</p>
	<ul>
		<li><strong>Supabase</strong>: authentication and database.</li>
		<li><strong>Stripe</strong>: payments, invoices, subscription management, and renewal receipts/reminders.</li>
		<li><strong>Cloudflare R2</strong> (or equivalent object storage): uploaded and generated media files.</li>
		<li><strong>AI providers</strong>: including OpenRouter, Fal, and Google Vertex / Gemini for text, image, and video features.</li>
		<li><strong>Stock media APIs</strong>: Unsplash and Pexels when you search or insert stock assets.</li>
		<li><strong>Publishing / OAuth partners</strong>: e.g. Zernio and connected social networks when you authorize publishing.</li>
	</ul>
	<p>
		Connected social platforms receive only the content and permissions you authorize.
		Each provider has its own privacy policy governing their processing.
	</p>

	<h2>5. Cookies</h2>
	<p>
		We use essential cookies for login sessions. Theme preference may be stored in local storage.
		We do not use third-party advertising cookies.
	</p>

	<h2>6. Data retention &amp; deletion of uploads</h2>
	<ul>
		<li>OAuth tokens remain until you disconnect an integration.</li>
		<li>Created content and uploads remain until you delete them or close your account.</li>
		<li>
			<strong>Account deletion</strong>: from Settings → Account you can permanently delete your
			account. We cancel active Stripe subscriptions when possible, remove your account records,
			and purge media stored under your account prefix in object storage (uploads, drafts media,
			templates, videos). Residual backups or logs may take up to <strong>30 days</strong> to fully clear.
		</li>
		<li>You may also email <a href="mailto:support@memeaccounts.com">support@memeaccounts.com</a> to request deletion.</li>
	</ul>

	<h2>7. Your rights</h2>
	<p>
		Depending on where you live, you may have rights to access, correct, delete, or export your
		data, or to object to certain processing. Contact
		<a href="mailto:support@memeaccounts.com">support@memeaccounts.com</a>.
		You can revoke third-party access in each platform&apos;s settings at any time.
	</p>

	<h2>8. Security</h2>
	<p>
		Traffic is encrypted (HTTPS). Access tokens are stored in protected infrastructure and are
		not shared with other users. Payment card data is processed by Stripe under PCI DSS standards.
	</p>

	<h2>9. Children</h2>
	<p>Meme Accounts is not directed at children under 13. We do not knowingly collect data from children.</p>

	<h2>10. Changes</h2>
	<p>We may update this policy. Material changes will be posted here with a new effective date.</p>

	<h2>11. Contact</h2>
	<p>
		Questions: <a href="mailto:support@memeaccounts.com">support@memeaccounts.com</a>
	</p>
</LegalDoc>
