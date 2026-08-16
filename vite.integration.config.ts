import { resolve } from 'node:path';

import { defineConfig } from 'vite';

const workspaceRoot = import.meta.dirname;
const coreDistEntry = resolve(workspaceRoot, 'packages/core/dist/index.js');
const integrationRoot = resolve(workspaceRoot, 'packages/integration');
const integrationDistRoot = resolve(integrationRoot, 'dist');
const integrationIndex = resolve(integrationRoot, 'index.html');
const integrationContactForm = resolve(integrationRoot, 'contact-form.html');

export default defineConfig({
	root: integrationRoot,
	publicDir: false,
	server: {
		open: '/',
	},
	resolve: {
		alias: {
			'@revia/core': coreDistEntry,
		},
	},
	build: {
		target: 'esnext',
		outDir: integrationDistRoot,
		emptyOutDir: true,
		rollupOptions: {
			input: {
				index: integrationIndex,
				contactForm: integrationContactForm,
			},
		},
	},
});
