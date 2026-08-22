/** Runtime configuration for Revia's development behaviour. */
export type ReviaConfiguration = {
	/** When `true`, failed components render a visible diagnostic instead of remaining empty. */
	development?: boolean,
};

let development = true;

/** Configures the shared Revia runtime. Call this once during application startup when needed. */
export function configureRevia(configuration: ReviaConfiguration): void {
	if (typeof configuration.development === 'boolean') {
		development = configuration.development;
	}
}

/** Returns whether Revia currently renders development diagnostics. */
export function isReviaDevelopment(): boolean {
	return development;
}
