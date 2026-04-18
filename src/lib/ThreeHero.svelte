<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';

	let canvas: HTMLCanvasElement;
	let animationId: number;
	let renderer: THREE.WebGLRenderer;

	onMount(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
		camera.position.set(0, 0, 6);

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// Floating carousel cards
		const cards: THREE.Mesh[] = [];
		const cardData = [
			{ x: -2.4, y: 0.8, z: -1.5, rotY: 0.25, delay: 0 },
			{ x: 0,    y: 0.2, z:  0,   rotY: 0,    delay: 1.2 },
			{ x: 2.4,  y: 0.8, z: -1.5, rotY: -0.25,delay: 0.6 },
			{ x: -1.2, y: -1.2, z: -2,  rotY: 0.15, delay: 1.8 },
			{ x: 1.2,  y: -1.2, z: -2,  rotY: -0.15,delay: 2.4 },
		];

		const cardColors = [
			[0x8B5CF6, 0x06B6D4],
			[0x7c3aed, 0x0891b2],
			[0xa78bfa, 0x22d3ee],
			[0x6d28d9, 0x0e7490],
			[0x8B5CF6, 0x818cf8],
		];

		cardData.forEach((d, i) => {
			const geo = new THREE.PlaneGeometry(1.2, 1.7, 1, 1);

			// Gradient via vertex colors
			const mat = new THREE.MeshBasicMaterial({
				color: cardColors[i][0],
				transparent: true,
				opacity: 0.12,
				side: THREE.DoubleSide,
			});

			const card = new THREE.Mesh(geo, mat);
			card.position.set(d.x, d.y, d.z);
			card.rotation.y = d.rotY;
			card.userData = { ...d, time: d.delay };

			// Border frame
			const edges = new THREE.EdgesGeometry(geo);
			const lineMat = new THREE.LineBasicMaterial({
				color: cardColors[i][0],
				transparent: true,
				opacity: 0.35,
			});
			const wireframe = new THREE.LineSegments(edges, lineMat);
			card.add(wireframe);

			// Inner glow plane
			const innerGeo = new THREE.PlaneGeometry(1.0, 1.5);
			const innerMat = new THREE.MeshBasicMaterial({
				color: cardColors[i][1],
				transparent: true,
				opacity: 0.05,
			});
			const inner = new THREE.Mesh(innerGeo, innerMat);
			inner.position.z = 0.01;
			card.add(inner);

			scene.add(card);
			cards.push(card);
		});

		// Ambient particles
		const particleGeo = new THREE.BufferGeometry();
		const count = 120;
		const positions = new Float32Array(count * 3);
		for (let i = 0; i < count * 3; i++) {
			positions[i] = (Math.random() - 0.5) * 14;
		}
		particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		const particleMat = new THREE.PointsMaterial({
			color: 0x8B5CF6,
			size: 0.025,
			transparent: true,
			opacity: 0.5,
		});
		scene.add(new THREE.Points(particleGeo, particleMat));

		// Cyan particle layer
		const pGeo2 = new THREE.BufferGeometry();
		const pos2 = new Float32Array(60 * 3);
		for (let i = 0; i < 60 * 3; i++) pos2[i] = (Math.random() - 0.5) * 14;
		pGeo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
		const pMat2 = new THREE.PointsMaterial({ color: 0x06B6D4, size: 0.018, transparent: true, opacity: 0.4 });
		scene.add(new THREE.Points(pGeo2, pMat2));

		// Mouse parallax
		let mouseX = 0, mouseY = 0;
		const onMouse = (e: MouseEvent) => {
			mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
			mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
		};
		window.addEventListener('mousemove', onMouse);

		let t = 0;
		const animate = () => {
			animationId = requestAnimationFrame(animate);
			t += 0.008;

			cards.forEach((card, i) => {
				const d = cardData[i];
				const phase = t + d.delay;
				card.position.y = d.y + Math.sin(phase * 0.8) * 0.18;
				card.rotation.z = Math.sin(phase * 0.5) * 0.04;
				card.position.x = d.x + mouseX * (0.05 + i * 0.01);
				card.position.y += mouseY * 0.04;
				(card.material as THREE.MeshBasicMaterial).opacity =
					0.1 + Math.sin(phase * 0.6) * 0.04;
			});

			camera.rotation.x = mouseY * 0.06;
			camera.rotation.y = mouseX * 0.08;

			renderer.render(scene, camera);
		};
		animate();

		const onResize = () => {
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		};
		window.addEventListener('resize', onResize);

		return () => {
			window.removeEventListener('mousemove', onMouse);
			window.removeEventListener('resize', onResize);
		};
	});

	onDestroy(() => {
		if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(animationId);
		renderer?.dispose();
	});
</script>

<canvas bind:this={canvas} class="absolute inset-0 w-full h-full"></canvas>
