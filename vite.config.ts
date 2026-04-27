import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 3000
	},
	// bits-ui ships .svelte sources; if externalized, Node SSR cannot load them (ERR_UNKNOWN_FILE_EXTENSION).
	ssr: {
		noExternal: ['bits-ui']
	}
});
