<footer class="footer">
	<div class="container footer-grid">
		<div class="footer-brand">
			<a href="/" class="brand">
				<img
					src="/logo/meme-accounts-logo.webp"
					alt="Meme Accounts"
					class="brand-logo"
					width="180"
					height="28"
				/>
			</a>
			<p class="footer-tag">Create. Test. Grow. Built for meme pages.</p>
		</div>

		<div class="footer-col">
			<p class="footer-h">Tools</p>
			<a href="/instagram-carousel-maker">Instagram Carousel</a>
			<a href="/instagram-grid-maker">Instagram Grid</a>
			<a href="/linkedin-carousel-maker">LinkedIn Carousel</a>
			<a href="/fake-tweet-maker">Tweet Maker</a>
		</div>

		<div class="footer-col">
			<p class="footer-h">Product</p>
			<a href="/pricing">Pricing</a>
			<a href="/#features">Features</a>
			<a href="/#how">How it works</a>
			<a href="/#faq">FAQs</a>
		</div>

		<div class="footer-col">
			<p class="footer-h">Legal</p>
			<a href="/privacy">Privacy</a>
			<a href="/terms">Terms</a>
			<a href="/refund-policy">Refund Policy</a>
		</div>
	</div>

	<div class="container footer-bottom">
		<p>© 2026 Meme Accounts. All rights reserved.</p>
		<p class="footer-fine">
			Meme Accounts is a template studio for meme page creators. Brand names belong to their respective
			owners.
		</p>
	</div>
</footer>

<style>
	.footer {
		--ap-bg: #ffffff;
		--ap-text: #0f0f10;
		--ap-text-2: #5b5b62;
		--ap-text-3: #9a9aa1;
		--ap-line: rgba(15, 15, 16, 0.08);
		background: var(--ap-bg);
		padding: 64px 0 40px;
		border-top: 1px solid var(--ap-line);
		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		color: var(--ap-text);
	}
	.container {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 32px;
	}
	.footer-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr;
		gap: 40px;
		padding-bottom: 48px;
	}
	.footer-brand .brand {
		display: inline-flex;
		align-items: center;
		margin-bottom: 14px;
		text-decoration: none;
	}
	.brand-logo {
		display: block;
		height: 28px;
		width: auto;
		max-width: min(200px, 52vw);
		object-fit: contain;
	}
	.footer-tag {
		font-size: 14px;
		color: var(--ap-text-2);
		max-width: 280px;
		line-height: 1.55;
		margin: 0;
	}
	.footer-col {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.footer-h {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ap-text-3);
		margin: 0 0 6px;
	}
	.footer-col a {
		font-size: 14px;
		color: var(--ap-text-2);
		text-decoration: none;
		transition: color 0.2s;
	}
	.footer-col a:hover {
		color: var(--ap-text);
	}
	.footer-bottom {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 24px;
		border-top: 1px solid var(--ap-line);
		font-size: 13px;
		color: var(--ap-text-3);
	}
	.footer-bottom p {
		margin: 0;
	}
	.footer-fine {
		max-width: 640px;
		line-height: 1.5;
	}

	@media (max-width: 860px) {
		.footer-grid {
			grid-template-columns: 1fr 1fr;
		}
		.footer-brand {
			grid-column: 1 / -1;
		}
		.container {
			padding: 0 20px;
		}
	}
</style>
