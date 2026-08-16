import type { ICssTemplate } from './template';

export type DomMode = 'shadow' | 'light';

export type StyleEntry = string | ICssTemplate;

export type Disposable = {
	dispose: () => void,
};

export type IReactiveOwner = {
	readonly ownedResources: Set<Disposable>,
	recordSchedule?: (label: string) => void,
	recordExecution?: (label: string) => void,
	notifyUpdated?: (label: string) => void,
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
