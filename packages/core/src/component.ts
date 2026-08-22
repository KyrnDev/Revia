import {
	captureLightDomSlotTemplates,
	buildComponentStyles,
	projectLightDomSlots,
	renderTemplate,
} from './renderer';
import { isReviaDevelopment } from './config';
import type { Disposable, DomMode, IReactiveRenderHost, StyleEntry } from './internal';
import { afterReactiveFlush, createEffect, withoutOwner, withOwner } from './reactivity';
import {
	getObservedAttributes,
	getPropNames,
	getReadonlyProp,
	initializeProps,
	shouldIgnoreAttributeSync,
	type IPropsDefinition,
	syncAttributeToProp,
	validateModelUpdate,
} from './props';
import type { ITemplateResult } from './template';

export type { DomMode } from './internal';

/**
 * Base class for Revia custom elements.
 *
 * Use `setup()` for component-owned reactive state, `render()` for an {@link html} template,
 * and lifecycle hooks for platform connection events.
 */
export abstract class ReactiveElement<
	TProps extends Record<string, unknown> = Record<string, unknown>,
	TModelNames extends keyof TProps & string = Extract<'value', keyof TProps & string>,
	TEvents extends Record<string, unknown> = Record<string, unknown>,
> extends HTMLElement implements IReactiveRenderHost {
	/** Selects `shadow` DOM (default) or `light` DOM for every instance of this component. */
	public static dom: DomMode = 'shadow';

	/** Static CSS entries applied to every instance. Supports `css\`...\`` strings and `cssFile(...)`. */
	public static styles?: StyleEntry | StyleEntry[];

	/** Enables per-binding scheduling and execution logs for this component class. */
	public static debugRender = false;

	/** Declares props accepted by this component and the attributes it observes. */
	public static props?: IPropsDefinition;

	public static get observedAttributes(): string[] {
		return getObservedAttributes(this as unknown as { prototype: HTMLElement, props?: IPropsDefinition });
	}

	/** Optional instance styles. Reactive reads made here update generated style nodes. */
	public styles?: () => StyleEntry | StyleEntry[] | null;

	/** Typed, readonly view of the component's incoming props. */
	public readonly props: Readonly<TProps>;

	/** The shadow root by default, or the element itself when `static dom = 'light'`. */
	public readonly renderRoot: ShadowRoot | this;

	public readonly ownedResources: Set<{ dispose: () => void }>;

	protected readonly _templateCleanups: Array<() => void>;

	protected _styleNodes: Node[];

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

	protected _hasFailed: boolean;

	protected _isFrozen: boolean;

	protected readonly _deferredReactiveWork: Set<() => void>;

	protected readonly _afterUpdateWaiters: Set<() => void>;

	public constructor() {
		super();
		const componentClass = this.constructor as typeof ReactiveElement;
		this.ownedResources = new Set();
		this._templateCleanups = [];
		this._styleNodes = [];
		this._deferredReactiveWork = new Set();
		this._afterUpdateWaiters = new Set();
		this._debugStats = {
			scheduleRequests: 0,
			renderExecutions: 0,
			labelSchedules: new Map(),
			labelExecutions: new Map(),
		};
		this.domMode = componentClass.dom === 'light' ? 'light' : 'shadow';
		this._hasCreated = false;
		this._hasDisposed = false;
		this._hasFailed = false;
		this._isFrozen = false;
		this._hasCapturedLightSlotTemplates = false;
		this._lightSlotTemplates = null;
		this._updatedHookScheduled = false;
		this.renderRoot = this.domMode === 'light'
			? this
			: this.attachShadow({ mode: 'open' });
		initializeProps(this as unknown as HTMLElement & {
			readonly constructor: { prototype: HTMLElement, props?: IPropsDefinition },
		});
		this.props = new Proxy({}, {
			get: (target, propName) => {
				void target;
				return typeof propName === 'string'
					? getReadonlyProp(this as unknown as HTMLElement & {
						readonly constructor: { prototype: HTMLElement, props?: IPropsDefinition },
					}, propName)
					: undefined;
			},
			set: () => false,
		}) as Readonly<TProps>;
		queueMicrotask(() => {
			this._ensureCreated();
		});
	}

	public connectedCallback(): void {
		if (this._hasDisposed) {
			return;
		}

		this._ensureCreated();
		if (this._hasFailed) {
			return;
		}

		if (this.domMode === 'light') {
			captureLightDomSlotTemplates(this);
		}

		this._mount();
		if (!this._hasFailed) {
			this._runOwned(() => this.connected());
		}
	}

	public disconnectedCallback(): void {
		this._disposeTemplate();
		this._runOwned(() => this.disconnected());
	}

	public attributeChangedCallback(attributeName: string, oldValue: string | null, newValue: string | null): void {
		if (oldValue === newValue) {
			return;
		}

		if (shouldIgnoreAttributeSync(this as unknown as HTMLElement & {
			readonly constructor: { prototype: HTMLElement, props?: IPropsDefinition },
			propChanged?: (propName: string, oldValue: unknown, newValue: unknown) => void,
		}, attributeName)) {
			return;
		}

		syncAttributeToProp(this as unknown as HTMLElement & {
			readonly constructor: { prototype: HTMLElement, props?: IPropsDefinition },
			propChanged?: (propName: string, oldValue: unknown, newValue: unknown) => void,
		}, attributeName, newValue);
	}

	/** Stops owned reactive resources, removes the element from the DOM, and permanently disposes it. */
	public dispose(): void {
		if (this._hasDisposed) {
			return;
		}

		this._ensureCreated();
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
		this._deferredReactiveWork.clear();
		this._resolveAfterUpdateWaiters();
		this._runOwned(() => this.disposed());
	}

	/** Resolves after pending reactive DOM work for the current microtask batch has completed. */
	public afterUpdate(): Promise<void> {
		return new Promise(resolve => {
			const settle = () => {
				if (this._updatedHookScheduled) {
					queueMicrotask(settle);
					return;
				}

				resolve();
			};

			this._afterUpdateWaiters.add(settle);
			void afterReactiveFlush().then(() => {
				if (!this._updatedHookScheduled) {
					this._resolveAfterUpdateWaiters();
				}
			});
		});
	}

	/**
	 * Registers a disposable resource for cleanup with this component.
	 * Use this for resources created in class field initializers; resources created in `setup()` are owned automatically.
	 */
	public own<TResource extends Disposable>(resource: TResource): TResource {
		this.ownedResources.add(resource);
		return resource;
	}

	/** Runs delayed work with this component as its owner, so created resources are disposed automatically. */
	public scope<TValue>(callback: () => TValue): TValue {
		if (this._hasDisposed) {
			throw new Error(`[revia] Cannot create owned work for disposed <${this.debugLabel()}>.`);
		}

		return withOwner(this, callback);
	}

	/** Pauses component-owned reactive effects and subscriptions without stopping timers or other external work. */
	public freeze(): void {
		this._isFrozen = true;
	}

	/** Resumes a frozen component and schedules any reactive work deferred while frozen. */
	public resume(): void {
		if (!this._isFrozen) {
			return;
		}

		this._isFrozen = false;
		const deferredWork = [...this._deferredReactiveWork];
		this._deferredReactiveWork.clear();

		for (const work of deferredWork) {
			work();
		}
	}

	/** Moves this existing component instance into `target`. Useful as the primitive beneath Teleport-style APIs. */
	public move(target: Node): this {
		if (this._hasDisposed) {
			throw new Error(`[revia] Cannot move disposed <${this.debugLabel()}>.`);
		}

		if (!(target instanceof Node) || target === this) {
			throw new TypeError('[revia] move(target) requires a different DOM node target.');
		}

		target.appendChild(this);
		return this;
	}

	/**
	 * Creates a fresh component instance with the same declared props and slotted children.
	 * Component-local signals are deliberately recreated by `setup()` rather than shared.
	 */
	public clone(deep = true): this {
		if (this._hasDisposed) {
			throw new Error(`[revia] Cannot clone disposed <${this.debugLabel()}>.`);
		}

		const componentClass = this.constructor as { new(): ReactiveElement };
		const clone = Reflect.construct(componentClass, []) as this;

		for (const attribute of Array.from(this.attributes)) {
			clone.setAttribute(attribute.name, attribute.value);
		}

		for (const propName of getPropNames(this.constructor as unknown as {
			prototype: HTMLElement,
			props?: IPropsDefinition,
		})) {
			(clone as unknown as Record<string, unknown>)[propName] = (this as unknown as Record<string, unknown>)[propName];
		}

		if (!deep) {
			return clone;
		}

		if (this.domMode === 'shadow') {
			for (const child of Array.from(this.childNodes)) {
				clone.appendChild(child.cloneNode(true));
			}
			return clone;
		}

		for (const nodes of this._lightSlotTemplates?.values() ?? []) {
			for (const node of nodes) {
				clone.appendChild(node.cloneNode(true));
			}
		}

		return clone;
	}

	/** Emits a typed bubbling, composed custom event for ordinary component communication. */
	public emit<TEventName extends keyof TEvents & string>(eventName: TEventName, detail: TEvents[TEventName]): boolean {
		return withoutOwner(() => this.dispatchEvent(new CustomEvent(eventName, {
			detail,
			bubbles: true,
			composed: true,
		})));
	}

	/** Clears a recoverable render failure and mounts the current valid component state again. */
	public recover(): boolean {
		if (this._hasDisposed || !this._hasFailed) {
			return false;
		}

		this._hasFailed = false;
		this.renderRoot.replaceChildren();

		if (!this._hasCreated) {
			this._ensureCreated();
		} else if (this.isConnected) {
			this._mount();
		}

		return !this._hasFailed;
	}

	/**
	 * Validates and emits a bubbling, composed `update:<prop>` event without mutating the incoming prop.
	 * Returns `false` when validation fails.
	 */
	public updateModel<TPropName extends TModelNames>(propName: TPropName, value: TProps[TPropName]): boolean {
		if (!validateModelUpdate(this, propName, value)) {
			return false;
		}

		withoutOwner(() => {
			this.dispatchEvent(new CustomEvent(`update:${propName}`, {
				detail: value,
				bubbles: true,
				composed: true,
			}));
		});
		return true;
	}

	/** Runs once after props and `setup()` are ready, before the first connection. */
	public created(): void {}

	/** Runs after the component template has been committed to the DOM. */
	public connected(): void {}

	/** Runs once after a batch of component-owned reactive updates commits. */
	public updated(): void {}

	/** Runs when the element is removed from the DOM and may still reconnect later. */
	public disconnected(): void {}

	/** Runs once when `dispose()` permanently retires the component. */
	public disposed(): void {}

	/**
	 * Initializes component-local state. Signals, derives, effects, and subscriptions created here are owned automatically.
	 */
	protected setup(): void {}

	/** Runs after a declared prop changes, receiving its previous and next values. */
	public propChanged(ignorePropName: string, ignoreOldValue: unknown, ignoreNewValue: unknown): void {
		void ignorePropName;
		void ignoreOldValue;
		void ignoreNewValue;
	}

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

			this._runOwned(() => this.updated());
			this._resolveAfterUpdateWaiters();
		});
	}

	public isFrozen(): boolean {
		return this._isFrozen;
	}

	public deferReactiveWork(work: () => void): void {
		if (this._hasDisposed) {
			return;
		}

		this._deferredReactiveWork.add(work);
	}

	public handleError(error: unknown): void {
		if (this._hasFailed || this._hasDisposed) {
			return;
		}

		this._hasFailed = true;
		this._disposeTemplate();
		this.renderRoot.replaceChildren();

		if (isReviaDevelopment()) {
			console.error(`[revia] Failed to render <${this.debugLabel()}>.`, error);
			const warning = document.createElement('pre');
			warning.setAttribute('data-revia-error', '');
			warning.textContent = error instanceof Error ? error.message : String(error);
			this.renderRoot.appendChild(warning);
		}
	}

	protected _disposeTemplate(): void {
		for (const cleanup of this._templateCleanups) {
			cleanup();
		}

		this._templateCleanups.length = 0;
		this._styleNodes = [];
	}

	protected _resolveAfterUpdateWaiters(): void {
		for (const resolve of this._afterUpdateWaiters) {
			resolve();
		}

		this._afterUpdateWaiters.clear();
	}

	protected _mount(): void {
		if (this._hasFailed || this._hasDisposed) {
			return;
		}

		this._disposeTemplate();
		this.renderRoot.replaceChildren();
		this.setDebugPath(this.debugLabel());

		try {
			createEffect(() => this._updateStyles(), {
				owner: this,
				cleanupBag: this._templateCleanups,
				label: 'styles',
			});

			const instance = renderTemplate(this.render(), this);
			this.renderRoot.appendChild(instance.fragment);

			if (this.domMode === 'light') {
				projectLightDomSlots(this);
			}

			this._templateCleanups.push(() => instance.dispose());
		} catch (error) {
			this.handleError(error);
		}
	}

	protected _ensureCreated(): void {
		if (this._hasCreated || this._hasDisposed || this._hasFailed) {
			return;
		}

		this._hasCreated = true;
		this._runOwned(() => {
			this.setup();
			this.created();
		});
	}

	protected _updateStyles(): void {
		for (const styleNode of this._styleNodes) {
			styleNode.parentNode?.removeChild(styleNode);
		}

		this._styleNodes = buildComponentStyles(this);
		const firstContentNode = this.renderRoot.firstChild;

		for (const styleNode of this._styleNodes) {
			this.renderRoot.insertBefore(styleNode, firstContentNode);
		}
	}

	protected _runOwned(callback: () => void): void {
		try {
			withOwner(this, callback);
		} catch (error) {
			this.handleError(error);
		}
	}

	/** Returns the component's tagged HTML template. Use lazy functions for reactive reads. */
	public abstract render(): ITemplateResult;
}
