import type { Disposable, IReactiveOwner } from './internal';

type EffectDependency = {
	_subscribeEffect: (effectRef: EffectRef) => void,
	_unsubscribeEffect: (effectRef: EffectRef) => void,
};

type EffectDependencyStore = EffectDependency & {
	_notify: () => void,
	_clear: () => void,
};

type EffectRef = {
	_deps: Set<EffectDependency>,
	_hasRun: boolean,
	_scheduled: boolean,
	_disposed: boolean,
	_cleanup: (() => void) | null,
	_label: string,
	track: (dep: EffectDependency) => void,
	schedule: () => void,
	run: () => void,
	dispose: () => void,
};

type SignalRef<TValue> = {
	_rawValue: TValue,
	_value: TValue,
	_proxyCache: WeakMap<object, object>,
	_proxyToRaw: WeakMap<object, object>,
	_depMap: Map<object, Map<unknown, EffectDependencyStore>>,
	_rootDep: EffectDependencyStore,
	_disposed: boolean,
	_notify: () => void,
	_notifySubscribers: () => void,
};

const iterateKey = Symbol('revia.iterate');
const mapKeyIterateKey = Symbol('revia.map-key-iterate');

/**
 * Mutable reactive state. Objects and arrays are deeply proxied, so nested reads and writes
 * participate in fine-grained tracking through `.value`.
 */
export type ISignal<TValue> = Disposable & EffectDependency & {
	/** Reads or replaces the current value. Nested objects and arrays are reactive proxies. */
	value: TValue,
	/** Reads the current value without registering a reactive dependency. */
	peek: () => TValue,
	/** Runs `callback` after each change and returns an unsubscribe function. */
	subscribe: (callback: (value: TValue) => void) => () => void,
	/** Creates an independent signal from a deep clone of the current value. */
	clone: () => ISignal<TValue>,
};

/** Optional ownership and diagnostic settings for {@link createEffect} and {@link derive}. */
export type IEffectOptions = {
	/** Internal cleanup collection used by the renderer. Most component code should omit this. */
	cleanupBag?: Array<() => void>,
	/** Explicit reactive owner. Component `setup()` supplies this automatically. */
	owner?: IReactiveOwner | null,
	/** Label included in component debug-render output. */
	label?: string,
};

let currentEffect: EffectRef | null = null;
let currentOwner: IReactiveOwner | null = null;

const effectQueue = new Set<EffectRef>();
let effectFlushScheduled = false;

function scheduleEffectFlush(): void {
	if (effectFlushScheduled) {
		return;
	}

	effectFlushScheduled = true;

	queueMicrotask(() => {
		effectFlushScheduled = false;
		const queue = [...effectQueue];
		effectQueue.clear();

		for (const effectRef of queue) {
			effectRef._scheduled = false;
			effectRef.run();
		}
	});
}

/** Resolves once the currently queued reactive effects have finished running. */
export function afterReactiveFlush(): Promise<void> {
	return new Promise(resolve => {
		const waitForIdle = () => {
			if (effectFlushScheduled || effectQueue.size > 0) {
				queueMicrotask(waitForIdle);
				return;
			}

			resolve();
		};

		queueMicrotask(waitForIdle);
	});
}

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === 'object' && value !== null;
}

function isProxyable(value: object): boolean {
	if (Array.isArray(value) || value instanceof Map || value instanceof Set) {
		return true;
	}

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function cloneValue<TValue>(value: TValue, seen = new WeakMap<object, object>()): TValue {
	if (!isObjectLike(value)) {
		return value;
	}

	const existingClone = seen.get(value);
	if (existingClone) {
		return existingClone as TValue;
	}

	if (value instanceof Date) {
		return new Date(value) as TValue;
	}

	if (value instanceof RegExp) {
		return new RegExp(value.source, value.flags) as TValue;
	}

	if (value instanceof Map) {
		const clone = new Map();
		seen.set(value, clone);

		for (const [key, entry] of value) {
			clone.set(cloneValue(key, seen), cloneValue(entry, seen));
		}

		return clone as TValue;
	}

	if (value instanceof Set) {
		const clone = new Set();
		seen.set(value, clone);

		for (const entry of value) {
			clone.add(cloneValue(entry, seen));
		}

		return clone as TValue;
	}

	if (!Array.isArray(value) && !isProxyable(value)) {
		return value;
	}

	const clone = Array.isArray(value)
		? []
		: Object.create(Object.getPrototypeOf(value)) as object;
	seen.set(value, clone);

	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);

		if (!descriptor) {
			continue;
		}

		if ('value' in descriptor) {
			descriptor.value = cloneValue(descriptor.value, seen);
		}

		Object.defineProperty(clone, key, descriptor);
	}

	return clone as TValue;
}

function createEffectDependencyStore(): EffectDependencyStore {
	const subscribers = new Set<EffectRef>();

	return {
		_subscribeEffect: effectRef => subscribers.add(effectRef),
		_unsubscribeEffect: effectRef => subscribers.delete(effectRef),
		_notify: () => {
			for (const effectRef of subscribers) {
				effectRef.schedule();
			}
		},
		_clear: () => {
			subscribers.clear();
		},
	};
}

function trackDependency(dep: EffectDependency): void {
	currentEffect?.track(dep);
}

function registerOwnedResource(resource: Disposable): void {
	currentOwner?.ownedResources.add(resource);
}

function getPropertyDependency(
	depMap: Map<object, Map<unknown, EffectDependencyStore>>,
	target: object,
	key: unknown,
): EffectDependencyStore {
	let targetDependencies = depMap.get(target);

	if (!targetDependencies) {
		targetDependencies = new Map();
		depMap.set(target, targetDependencies);
	}

	let dependency = targetDependencies.get(key);

	if (!dependency) {
		dependency = createEffectDependencyStore();
		targetDependencies.set(key, dependency);
	}

	return dependency;
}

function notifyPropertyDependency(
	depMap: Map<object, Map<unknown, EffectDependencyStore>>,
	target: object,
	key: unknown,
): void {
	depMap.get(target)?.get(key)?._notify();
}

function notifyArrayLengthDependency(
	depMap: Map<object, Map<unknown, EffectDependencyStore>>,
	target: object,
	previousLength: number,
): void {
	if (!Array.isArray(target)) {
		return;
	}

	if (target.length !== previousLength) {
		notifyPropertyDependency(depMap, target, 'length');
	}
}

function notifyAllPropertyDependencies(
	depMap: Map<object, Map<unknown, EffectDependencyStore>>,
): void {
	for (const targetDependencies of depMap.values()) {
		for (const dependency of targetDependencies.values()) {
			dependency._notify();
		}
	}
}

function unwrapReactiveValue<TValue>(signalRef: SignalRef<unknown>, value: TValue): TValue {
	return typeof value === 'object' && value !== null
		? (signalRef._proxyToRaw.get(value) ?? value) as TValue
		: value;
}

function wrapReactiveValue<TValue>(signalRef: SignalRef<unknown>, value: TValue): TValue {
	return isObjectLike(value) && isProxyable(value)
		? createDeepProxy(signalRef as SignalRef<object>, value as object) as TValue
		: value;
}

function notifyCollectionMutation(
	signalRef: SignalRef<unknown>,
	target: object,
	key: unknown,
	operation: 'add' | 'set' | 'delete' | 'clear',
): void {
	signalRef._notifySubscribers();

	if (operation === 'clear') {
		notifyAllPropertyDependencies(signalRef._depMap);
		return;
	}

	notifyPropertyDependency(signalRef._depMap, target, key);

	if (operation === 'set') {
		notifyPropertyDependency(signalRef._depMap, target, iterateKey);
		return;
	}

	notifyPropertyDependency(signalRef._depMap, target, iterateKey);
	if (target instanceof Map) {
		notifyPropertyDependency(signalRef._depMap, target, mapKeyIterateKey);
	}
}

function createCollectionProxy<TValue extends Map<unknown, unknown> | Set<unknown>>(
	signalRef: SignalRef<unknown>,
	target: TValue,
): TValue {
	const cached = signalRef._proxyCache.get(target);
	if (cached) {
		return cached as TValue;
	}

	const proxy = new Proxy(target, {
		get(innerTarget, key, receiver) {
			if (key === 'size') {
				trackDependency(getPropertyDependency(signalRef._depMap, innerTarget, iterateKey));
				return Reflect.get(innerTarget, key, innerTarget);
			}

			if (innerTarget instanceof Map) {
				if (key === 'get') {
					return (entryKey: unknown) => {
						const rawKey = unwrapReactiveValue(signalRef, entryKey);
						trackDependency(getPropertyDependency(signalRef._depMap, innerTarget, rawKey));
						return wrapReactiveValue(signalRef, innerTarget.get(rawKey));
					};
				}

				if (key === 'set') {
					return (entryKey: unknown, entryValue: unknown) => {
						const rawKey = unwrapReactiveValue(signalRef, entryKey);
						const rawValue = unwrapReactiveValue(signalRef, entryValue);
						const hadKey = innerTarget.has(rawKey);
						const previousValue = innerTarget.get(rawKey);
						innerTarget.set(rawKey, rawValue);

						if (!hadKey) {
							notifyCollectionMutation(signalRef, innerTarget, rawKey, 'add');
						} else if (!Object.is(previousValue, rawValue)) {
							notifyCollectionMutation(signalRef, innerTarget, rawKey, 'set');
						}

						return receiver;
					};
				}
			}

			if (innerTarget instanceof Set && key === 'add') {
				return (entryValue: unknown) => {
					const rawValue = unwrapReactiveValue(signalRef, entryValue);
					const hadValue = innerTarget.has(rawValue);
					innerTarget.add(rawValue);
					if (!hadValue) {
						notifyCollectionMutation(signalRef, innerTarget, rawValue, 'add');
					}

					return receiver;
				};
			}

			if (key === 'has') {
				return (entryKey: unknown) => {
					const rawKey = unwrapReactiveValue(signalRef, entryKey);
					trackDependency(getPropertyDependency(signalRef._depMap, innerTarget, rawKey));
					return innerTarget.has(rawKey);
				};
			}

			if (key === 'delete') {
				return (entryKey: unknown) => {
					const rawKey = unwrapReactiveValue(signalRef, entryKey);
					const hadKey = innerTarget.has(rawKey);
					const deleted = innerTarget.delete(rawKey);
					if (hadKey && deleted) {
						notifyCollectionMutation(signalRef, innerTarget, rawKey, 'delete');
					}

					return deleted;
				};
			}

			if (key === 'clear') {
				return () => {
					if (innerTarget.size === 0) {
						return undefined;
					}

					innerTarget.clear();
					notifyCollectionMutation(signalRef, innerTarget, undefined, 'clear');
					return undefined;
				};
			}

			if (key === 'forEach') {
				return (callback: (value: unknown, entryKey: unknown, collection: TValue) => void, thisArg?: unknown) => {
					trackDependency(getPropertyDependency(signalRef._depMap, innerTarget, iterateKey));
					innerTarget.forEach((entryValue, entryKey) => {
						callback.call(thisArg, wrapReactiveValue(signalRef, entryValue), wrapReactiveValue(signalRef, entryKey), receiver as TValue);
					});
				};
			}

			if (key === 'keys' || key === 'values' || key === 'entries' || key === Symbol.iterator) {
				return function* collectionIterator(): IterableIterator<unknown> {
					const tracksKeys = innerTarget instanceof Map && key === 'keys';
					trackDependency(getPropertyDependency(
						signalRef._depMap,
						innerTarget,
						tracksKeys ? mapKeyIterateKey : iterateKey,
					));

					const iterator = key === 'keys'
						? innerTarget.keys()
						: key === 'values'
							? innerTarget.values()
							: innerTarget.entries();

					for (const entry of iterator) {
						if (innerTarget instanceof Map && Array.isArray(entry)) {
							yield [
								wrapReactiveValue(signalRef, entry[0]),
								wrapReactiveValue(signalRef, entry[1]),
							];
							continue;
						}

						yield wrapReactiveValue(signalRef, entry);
					}
				};
			}

			return Reflect.get(innerTarget, key, innerTarget);
		},
	});

	signalRef._proxyCache.set(target, proxy);
	signalRef._proxyToRaw.set(proxy, target);
	return proxy as TValue;
}

function createDeepProxy<TValue extends object>(signalRef: SignalRef<TValue>, target: TValue): TValue {
	if (target instanceof Map || target instanceof Set) {
		return createCollectionProxy(signalRef as SignalRef<unknown>, target) as TValue;
	}

	const cached = signalRef._proxyCache.get(target);
	if (cached) {
		return cached as TValue;
	}

	const proxy = new Proxy(target, {
		get(innerTarget, key, receiver) {
			trackDependency(getPropertyDependency(signalRef._depMap, innerTarget, key));
			const nextValue = Reflect.get(innerTarget, key, receiver);
			return wrapReactiveValue(signalRef as SignalRef<unknown>, nextValue);
		},
		set(innerTarget, key, value, receiver) {
			const previousLength = Array.isArray(innerTarget) ? innerTarget.length : 0;
			const hadKey = Reflect.has(innerTarget, key);
			const previousValue = Reflect.get(innerTarget, key, receiver);
			const result = Reflect.set(innerTarget, key, unwrapReactiveValue(signalRef as SignalRef<unknown>, value), receiver);

			if (!Object.is(previousValue, value)) {
				signalRef._notifySubscribers();
				notifyPropertyDependency(signalRef._depMap, innerTarget, key);
				notifyArrayLengthDependency(signalRef._depMap, innerTarget, previousLength);
				if (!hadKey && !Array.isArray(innerTarget)) {
					notifyPropertyDependency(signalRef._depMap, innerTarget, iterateKey);
				}
			}

			return result;
		},
		deleteProperty(innerTarget, key) {
			const previousLength = Array.isArray(innerTarget) ? innerTarget.length : 0;
			const hadKey = Reflect.has(innerTarget, key);
			const result = Reflect.deleteProperty(innerTarget, key);

			if (hadKey) {
				signalRef._notifySubscribers();
				notifyPropertyDependency(signalRef._depMap, innerTarget, key);
				notifyArrayLengthDependency(signalRef._depMap, innerTarget, previousLength);
				if (!Array.isArray(innerTarget)) {
					notifyPropertyDependency(signalRef._depMap, innerTarget, iterateKey);
				}
			}

			return result;
		},
		has(innerTarget, key) {
			trackDependency(getPropertyDependency(signalRef._depMap, innerTarget, key));
			return Reflect.has(innerTarget, key);
		},
		ownKeys(innerTarget) {
			trackDependency(getPropertyDependency(signalRef._depMap, innerTarget, Array.isArray(innerTarget) ? 'length' : iterateKey));
			return Reflect.ownKeys(innerTarget);
		},
	});

	signalRef._proxyCache.set(target, proxy);
	signalRef._proxyToRaw.set(proxy, target);
	return proxy;
}

function wrapSignalValue<TValue>(signalRef: SignalRef<TValue>, value: TValue): TValue {
	signalRef._proxyCache = new WeakMap<object, object>();
	signalRef._proxyToRaw = new WeakMap<object, object>();
	return isObjectLike(value) && isProxyable(value)
		? createDeepProxy(signalRef as SignalRef<object>, value as object) as TValue
		: value;
}

/**
 * Creates mutable reactive state.
 *
 * @example
 * const count = signal(0);
 * count.value += 1;
 */
export function signal<TValue>(initialValue: TValue): ISignal<TValue> {
	const subscribers = new Set<{ schedule: () => void }>();

	const signalRef: SignalRef<TValue> = {
		_rawValue: initialValue,
		_value: initialValue,
		_proxyCache: new WeakMap<object, object>(),
		_proxyToRaw: new WeakMap<object, object>(),
		_depMap: new Map<object, Map<unknown, EffectDependencyStore>>(),
		_rootDep: createEffectDependencyStore(),
		_disposed: false,
		_notifySubscribers: () => {
			if (signalRef._disposed) {
				return;
			}

			for (const subscriber of subscribers) {
				subscriber.schedule();
			}
		},
		_notify: () => {
			if (signalRef._disposed) {
				return;
			}

			signalRef._notifySubscribers();
			signalRef._rootDep._notify();
			notifyAllPropertyDependencies(signalRef._depMap);
		},
	};

	const signalApi: ISignal<TValue> = {
		get value() {
			trackDependency(signalRef._rootDep);

			return signalRef._value;
		},
		set value(nextValue: TValue) {
			if (Object.is(signalRef._rawValue, nextValue)) {
				return;
			}

			signalRef._rawValue = nextValue;
			signalRef._value = wrapSignalValue(signalRef, nextValue);
			signalRef._notify();
		},
		peek: () => signalRef._value,
		subscribe: callback => {
			const owner = currentOwner;
			const subscription = {
				schedule: () => {
					if (owner?.isFrozen?.()) {
						owner.deferReactiveWork?.(subscription.schedule);
						return;
					}

					callback(signalRef._value);
				},
			};

			subscribers.add(subscription);

			const dispose = () => {
				subscribers.delete(subscription);
			};
			registerOwnedResource({ dispose });
			return dispose;
		},
		_subscribeEffect: effectRef => signalRef._rootDep._subscribeEffect(effectRef),
		_unsubscribeEffect: effectRef => signalRef._rootDep._unsubscribeEffect(effectRef),
		dispose: () => {
			subscribers.clear();
			signalRef._rootDep._clear();
			signalRef._depMap.clear();
			signalRef._disposed = true;
		},
		clone: () => signal(cloneValue(signalRef._rawValue)),
	};

	signalRef._value = wrapSignalValue(signalRef, initialValue);
	registerOwnedResource(signalApi);
	return signalApi;
}

/** Returns `true` when `value` is a Revia signal. */
export function isSignal<TValue>(value: unknown): value is ISignal<TValue> {
	return Boolean(
		value
		&& typeof value === 'object'
		&& 'peek' in value
		&& 'subscribe' in value
		&& 'value' in value,
	);
}

/**
 * Runs reactive work immediately and again whenever its dependencies change.
 * Return a cleanup function, or call the returned disposer to stop the effect.
 */
export function createEffect(fn: () => void | (() => void), options: IEffectOptions = {}): () => void {
	const cleanupBag = options.cleanupBag ?? null;
	const owner = options.owner ?? currentOwner;
	const label = options.label ?? 'effect';

	const effectRef: EffectRef = {
		_deps: new Set<EffectDependency>(),
		_hasRun: false,
		_scheduled: false,
		_disposed: false,
		_cleanup: null,
		_label: label,
		track: dep => {
			if (effectRef._deps.has(dep)) {
				return;
			}

			effectRef._deps.add(dep);
			dep._subscribeEffect(effectRef);
		},
		schedule: () => {
			if (effectRef._disposed) {
				return;
			}

			owner?.recordSchedule?.(effectRef._label);

			if (owner?.isFrozen?.()) {
				owner.deferReactiveWork?.(effectRef.schedule);
				return;
			}

			if (effectRef._scheduled) {
				return;
			}

			effectRef._scheduled = true;
			effectQueue.add(effectRef);
			scheduleEffectFlush();
		},
		run: () => {
			if (effectRef._disposed) {
				return;
			}

			if (owner?.isFrozen?.()) {
				owner.deferReactiveWork?.(effectRef.schedule);
				return;
			}

			for (const dep of effectRef._deps) {
				dep._unsubscribeEffect(effectRef);
			}

			effectRef._deps.clear();

			if (typeof effectRef._cleanup === 'function') {
				effectRef._cleanup();
				effectRef._cleanup = null;
			}

			const previousEffect = currentEffect;
			currentEffect = effectRef;

			try {
				owner?.recordExecution?.(effectRef._label);
				const cleanup = fn();
				effectRef._cleanup = typeof cleanup === 'function' ? cleanup : null;
				if (effectRef._hasRun) {
					owner?.notifyUpdated?.(effectRef._label);
				}

				effectRef._hasRun = true;
			} catch (error) {
				owner?.handleError?.(error);
				if (!owner) {
					throw error;
				}
			} finally {
				currentEffect = previousEffect;
			}
		},
		dispose: () => {
			if (effectRef._disposed) {
				return;
			}

			effectRef._disposed = true;
			effectQueue.delete(effectRef);

			for (const dep of effectRef._deps) {
				dep._unsubscribeEffect(effectRef);
			}

			effectRef._deps.clear();

			if (typeof effectRef._cleanup === 'function') {
				effectRef._cleanup();
				effectRef._cleanup = null;
			}
		},
	};

	effectRef.run();

	const disposer = () => effectRef.dispose();

	if (cleanupBag) {
		cleanupBag.push(disposer);
	} else {
		registerOwnedResource({ dispose: disposer });
	}

	return disposer;
}

/** Convenience form of {@link createEffect} for an ordinary component-owned effect. */
export function effect(fn: () => void | (() => void)): () => void {
	return createEffect(fn);
}

/**
 * Creates a read-through signal whose value is recomputed from the reactive reads in `compute`.
 */
export function derive<TValue>(compute: () => TValue, options: IEffectOptions = {}): ISignal<TValue> {
	const label = options.label ?? 'derive';
	const derived = signal(compute());
	const stop = createEffect(() => {
		derived.value = compute();
	}, { label });
	const originalDispose = derived.dispose.bind(derived);

	derived.dispose = () => {
		stop();
		originalDispose();
	};

	return derived;
}

export function withOwner<TValue>(owner: IReactiveOwner | null, fn: () => TValue): TValue {
	const previousOwner = currentOwner;
	currentOwner = owner;

	try {
		return fn();
	} finally {
		currentOwner = previousOwner;
	}
}

export function withoutOwner<TValue>(fn: () => TValue): TValue {
	return withOwner(null, fn);
}

export function getCurrentReactiveOwner(): IReactiveOwner | null {
	return currentOwner;
}
