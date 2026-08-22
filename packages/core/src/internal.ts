import type { ICssTemplate } from './template';

/** Selects whether a component renders into an open shadow root or directly into its host element. */
export type DomMode = 'shadow' | 'light';

export type IExternalStyleSheet = {
	readonly reviaKind: 'css-file',
	readonly href: string,
};

export type StyleEntry = string | ICssTemplate | IExternalStyleSheet;

export type Disposable = {
	dispose: () => void,
};

export type IReactiveOwner = {
	readonly ownedResources: Set<Disposable>,
	recordSchedule?: (label: string) => void,
	recordExecution?: (label: string) => void,
	notifyUpdated?: (label: string) => void,
	isFrozen?: () => boolean,
	deferReactiveWork?: (work: () => void) => void,
	handleError?: (error: unknown) => void,
};

export type IReactiveRenderHost = HTMLElement & IReactiveOwner & {
	readonly renderRoot: ShadowRoot | HTMLElement,
	readonly domMode: DomMode,
	debugEnabled: () => boolean,
	debugLabel: () => string,
	resolveStyles: () => StyleEntry[],
	getDebugPath: () => string | undefined,
	setDebugPath: (path: string | undefined) => void,
	getLightSlotTemplates: () => Map<string, Node[]> | null,
	ensureLightSlotTemplates: () => Map<string, Node[]>,
	hasCapturedLightSlotTemplates: () => boolean,
	markLightSlotTemplatesCaptured: () => void,
};
