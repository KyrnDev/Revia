import {
	captureLightDomSlotTemplates,
	buildComponentStyles,
	projectLightDomSlots,
	renderTemplate,
} from './renderer';
import type { DomMode, IReactiveRenderHost, StyleEntry } from './internal';
import type { ITemplateResult } from './template';

export type { DomMode } from './internal';

export abstract class ReactiveElement extends HTMLElement implements IReactiveRenderHost {
	public static dom: DomMode = 'shadow';

	public static styles?: StyleEntry | StyleEntry[];

	public static debugRender = false;

	public styles?: () => StyleEntry | StyleEntry[] | null;

	public readonly renderRoot: ShadowRoot | this;

	public readonly ownedResources: Set<{ dispose: () => void }>;

	protected readonly _templateCleanups: Array<() => void>;

	protected readonly _debugStats: {
		scheduleRequests: number,
		renderExecutions: number,
		labelSchedules: Map<string, number>,
		labelExecutions: Map<string, number>,
	};

	public readonly domMode: DomMode;

	protected _hasCapturedLightSlotTemplates: boolean;

	protected _lightSlotTemplates: Map<string, Node[]> | null;

	protected _debugPath?: string;

	protected _hasCreated: boolean;

	protected _hasDisposed: boolean;

	protected _updatedHookScheduled: boolean;

	public constructor() {
		super();
		const componentClass = this.constructor as typeof ReactiveElement;
		this.ownedResources = new Set();
		this._templateCleanups = [];
		this._debugStats = {
			scheduleRequests: 0,
			renderExecutions: 0,
			labelSchedules: new Map(),
			labelExecutions: new Map(),
		};
		this.domMode = componentClass.dom === 'light' ? 'light' : 'shadow';
		this._hasCreated = false;
		this._hasDisposed = false;
		this._hasCapturedLightSlotTemplates = false;
		this._lightSlotTemplates = null;
		this._updatedHookScheduled = false;
		this.renderRoot = this.domMode === 'light'
			? this
			: this.attachShadow({ mode: 'open' });
		queueMicrotask(() => {
			this._ensureCreated();
		});
	}

	public connectedCallback(): void {
		this._ensureCreated();

		if (this.domMode === 'light') {
			captureLightDomSlotTemplates(this);
		}

		this._mount();
		this.connected();
	}

	public disconnectedCallback(): void {
		this._disposeTemplate();
		this.disconnected();
	}

	public dispose(): void {
		if (this._hasDisposed) {
			return;
		}

		this._hasDisposed = true;

		if (this.isConnected) {
			this.remove();
		} else {
			this._disposeTemplate();
		}

		this._disposeTemplate();

		for (const resource of this.ownedResources) {
			resource.dispose();
		}

		this.ownedResources.clear();
		this.disposed();
	}

	public afterUpdate(): Promise<void> {
		return Promise.resolve();
	}

	public created(): void {}

	public connected(): void {}

	public updated(): void {}

	public disconnected(): void {}

	public disposed(): void {}

	public debugEnabled(): boolean {
		const componentClass = this.constructor as typeof ReactiveElement;
		return Boolean(componentClass.debugRender);
	}

	public debugLabel(): string {
		return this.localName || this.constructor.name || 'component';
	}

	public resolveStyles(): StyleEntry[] {
		const componentClass = this.constructor as typeof ReactiveElement;
		const staticStyles = componentClass.styles ?? null;
		const instanceStyles = typeof this.styles === 'function' ? this.styles() : null;
		const styleValues = [staticStyles, instanceStyles].flatMap(styleValue => {
			if (!styleValue) {
				return [];
			}

			return Array.isArray(styleValue) ? styleValue : [styleValue];
		});

		return styleValues as StyleEntry[];
	}

	public getDebugPath(): string | undefined {
		return this._debugPath;
	}

	public setDebugPath(path: string | undefined): void {
		this._debugPath = path;
	}

	public getLightSlotTemplates(): Map<string, Node[]> | null {
		return this._lightSlotTemplates;
	}

	public ensureLightSlotTemplates(): Map<string, Node[]> {
		if (!this._lightSlotTemplates) {
			this._lightSlotTemplates = new Map<string, Node[]>();
		}

		return this._lightSlotTemplates;
	}

	public hasCapturedLightSlotTemplates(): boolean {
		return this._hasCapturedLightSlotTemplates;
	}

	public markLightSlotTemplatesCaptured(): void {
		this._hasCapturedLightSlotTemplates = true;
	}

	public recordSchedule(label: string): void {
		this._debugStats.scheduleRequests += 1;
		this._debugStats.labelSchedules.set(
			label,
			(this._debugStats.labelSchedules.get(label) ?? 0) + 1,
		);

		if (this.debugEnabled()) {
			console.log(
				`[revia debug] update scheduled for <${this.debugLabel()}> (#${this._debugStats.scheduleRequests})`,
				{
					label,
					updateExecutions: this._debugStats.renderExecutions,
					labelCount: this._debugStats.labelSchedules.get(label),
				},
			);
		}
	}

	public recordExecution(label: string): void {
		this._debugStats.renderExecutions += 1;
		this._debugStats.labelExecutions.set(
			label,
			(this._debugStats.labelExecutions.get(label) ?? 0) + 1,
		);

		if (this.debugEnabled()) {
			console.log(
				`[revia debug] update executed for <${this.debugLabel()}> (#${this._debugStats.renderExecutions})`,
				{
					label,
					scheduleRequests: this._debugStats.scheduleRequests,
					labelCount: this._debugStats.labelExecutions.get(label),
				},
			);
		}
	}

	public notifyUpdated(ignoreLabel: string): void {
		void ignoreLabel;

		if (this._hasDisposed || !this._hasCreated || !this.isConnected || this._updatedHookScheduled) {
			return;
		}

		this._updatedHookScheduled = true;

		queueMicrotask(() => {
			this._updatedHookScheduled = false;

			if (this._hasDisposed || !this.isConnected) {
				return;
			}

			this.updated();
		});
	}

	protected _disposeTemplate(): void {
		for (const cleanup of this._templateCleanups) {
			cleanup();
		}

		this._templateCleanups.length = 0;
	}

	protected _mount(): void {
		this._disposeTemplate();
		this.renderRoot.replaceChildren();
		this.setDebugPath(this.debugLabel());

		const componentStyles = buildComponentStyles(this);
		if (componentStyles) {
			this.renderRoot.appendChild(componentStyles);
		}

		const instance = renderTemplate(this.render(), this);
		this.renderRoot.appendChild(instance.fragment);

		if (this.domMode === 'light') {
			projectLightDomSlots(this);
		}

		this._templateCleanups.push(() => instance.dispose());
	}

	protected _ensureCreated(): void {
		if (this._hasCreated || this._hasDisposed) {
			return;
		}

		this._hasCreated = true;
		this.created();
	}

	public abstract render(): ITemplateResult;
}
