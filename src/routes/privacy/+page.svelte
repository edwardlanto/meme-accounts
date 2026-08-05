<script lang="ts">
	import LegalDoc from '$lib/components/LegalDoc.svelte';
</script>

<svelte:head>
	<title>Privacy Policy — Carousel Studio</title>
	<meta name="description" content="How Carousel Studio collects, uses, and protects your data — including payments, AI features, and connected social accounts." />
</svelte:head>

<LegalDoc title="Carousel Studio — Privacy Policy" effectiveDate="August 5, 2026">
	<h2>1. Who we are</h2>
	<p>
		Carousel Studio (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides tools to design social posts,
		carousels, tweet-style graphics, and scheduled publishing. This policy explains what we
		collect and how we use it.
	</p>

	<h2>2. Information we collect</h2>
	<ul>
		<li><strong>Account data</strong> — email, name, and authentication identifiers when you sign up.</li>
		<li><strong>Content you create</strong> — templates, captions, images, videos, and schedules you upload or generate.</li>
		<li><strong>Connected accounts</strong> — OAuth tokens and profile metadata from platforms you connect (Instagram, TikTok, LinkedIn, YouTube, Bluesky, Google Business, etc.).</li>
		<li><strong>Payment data</strong> — billing is handled by Stripe. We store your plan, Stripe customer id, and subscription status — not full card numbers.</li>
		<li><strong>Usage & diagnostics</strong> — basic logs, errors, and feature usage to keep the service reliable.</li>
	</ul>

	<h2>3. How we use information</h2>
	<ul>
		<li>Authenticate you and maintain your session.</li>
		<li>Render, export, and publish content you request.</li>
		<li>Run AI-assisted features (hooks, captions, image generation) using third-party AI providers.</li>
		<li>Process subscriptions and enforce plan limits (including free-trial export limits).</li>
		<li>Improve the product and prevent abuse.</li>
	</ul>
	<p>We do not sell your personal information.</p>

	<h2>4. Third-party services</h2>
	<p>
		We use Supabase (auth & database), Stripe (payments), cloud storage (e.g. R2), and AI/media
		providers (OpenRouter, Fal, Vertex, Unsplash, Pexels, etc.). Connected social platforms
		receive only the content and permissions you authorize.
	</p>

	<h2>5. Cookies</h2>
	<p>
		We use essential cookies for login sessions. Theme preference may be stored in local storage.
		We do not use third-party advertising cookies.
	</p>

	<h2>6. Data retention</h2>
	<ul>
		<li>OAuth tokens remain until you disconnect an integration.</li>
		<li>Created content remains until you delete it or close your account.</li>
		<li>Account data is deleted within 30 days of a verified deletion request.</li>
	</ul>

	<h2>7. Your rights</h2>
	<p>
		You may access, correct, or delete your data by contacting
		<a href="mailto:support@carouselstudio.app">support@carouselstudio.app</a>.
		You can revoke third-party access in each platform&apos;s settings at any time.
	</p>

	<h2>8. Security</h2>
	<p>
		Traffic is encrypted (HTTPS). Access tokens are stored in protected infrastructure and are
		not shared with other users. Payment card data is processed by Stripe under PCI DSS standards.
	</p>

	<h2>9. Children</h2>
	<p>Carousel Studio is not directed at children under 13. We do not knowingly collect data from children.</p>

	<h2>10. Changes</h2>
	<p>We may update this policy. Material changes will be posted here with a new effective date.</p>

	<h2>11. Contact</h2>
	<p>
		Questions: <a href="mailto:support@carouselstudio.app">support@carouselstudio.app</a>
	</p>
</LegalDoc>
