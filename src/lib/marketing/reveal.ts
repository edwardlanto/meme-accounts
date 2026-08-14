/** IntersectionObserver scroll-reveal for `.mk-reveal` elements. */
export function revealOnScroll(node: HTMLElement) {
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.classList.add('in');
					io.unobserve(entry.target);
				}
			}
		},
		{ threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
	);

	io.observe(node);

	requestAnimationFrame(() => {
		const r = node.getBoundingClientRect();
		if (r.top < window.innerHeight * 0.95 && r.bottom > 0) {
			node.classList.add('in');
			io.unobserve(node);
		}
	});

	return {
		destroy() {
			io.disconnect();
		},
	};
}

/** Observe all `.mk-reveal` nodes under a container (e.g. onMount). */
export function initReveal(container: ParentNode = document) {
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.classList.add('in');
					io.unobserve(entry.target);
				}
			}
		},
		{ threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
	);

	const els = Array.from(container.querySelectorAll<HTMLElement>('.mk-reveal'));
	for (const el of els) io.observe(el);

	requestAnimationFrame(() => {
		for (const el of els) {
			const r = el.getBoundingClientRect();
			if (r.top < window.innerHeight * 0.95 && r.bottom > 0) {
				el.classList.add('in');
				io.unobserve(el);
			}
		}
	});

	return () => io.disconnect();
}
