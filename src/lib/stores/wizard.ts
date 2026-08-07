import { writable } from 'svelte/store';
import type { GeneratedSlide } from '../../routes/api/generate-slides/+server.js';

export interface WizardState {
	carouselId: string | null;
	images: string[]; // data URLs (resized)
	slides: GeneratedSlide[];
	topic: string;
	style: string;
	brandColor: string;
	brandName: string;
}

const initial: WizardState = {
	carouselId: null,
	images: [],
	slides: [],
	topic: '',
	style: 'dark',
	brandColor: '#7bf1a8',
	brandName: 'Your Brand',
};

export const wizardStore = writable<WizardState>(initial);

export function resetWizard() {
	wizardStore.set({ ...initial });
}
