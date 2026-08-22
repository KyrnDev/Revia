import type { IExternalStyleSheet } from './internal';

/**
 * References an external CSS file from a component's `static styles` or `styles()` result.
 * Use an `import.meta.url` relative URL for ESM-safe component-local styles.
 *
 * @example
 * cssFile(new URL('./my-card.css', import.meta.url))
 */
export function cssFile(path: string | URL): IExternalStyleSheet {
	return {
		reviaKind: 'css-file',
		href: String(path),
	};
}
