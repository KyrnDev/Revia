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
	_depMap: Map<object, Map<PropertyKey, EffectDependencyStore>>,
	_rootDep: EffectDependencyStore,
	_disposed: boolean,
	_notify: () => void,
};

export type ISignal<TValue> = Disposable & EffectDependency & {
	value: TValue,
	peek: () => TValue,
	subscribe: (callback: (value: TValue) => void) => () => void,
	clone: () => ISignal<TValue>,
};

export type IEffectOptions = {
	cleanupBag?: Array<() => void>,
	owner?: IReactiveOwner | null,
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

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === 'object' && value !== null;
}

function cloneValue<TValue>(value: TValue): TValue {
	if (!isObjectLike(value)) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map(entry => cloneValue(entry)) as TValue;
	}

	const clone: Record<PropertyKey, unknown> = {};

	for (const key of Reflect.ownKeys(value)) {
		clone[key] = cloneValue(value[key as keyof typeof value]);
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
	depMap: Map<object, Map<PropertyKey, EffectDependencyStore>>,
	target: object,
	key: PropertyKey,
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
	depMap: Map<object, Map<PropertyKey, EffectDependencyStore>>,
	target: object,
	key: PropertyKey,
): void {
	depMap.get(target)?.get(key)?._notify();
}

function notifyArrayLengthDependency(
	depMap: Map<object, Map<PropertyKey, EffectDependencyStore>>,
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
	depMap: Map<object, Map<PropertyKey, EffectDependencyStore>>,
): void {
	for (const targetDependencies of depMap.values()) {
		for (const dependency of targetDependencies.values()) {
			dependency._notify();
		}
	}
}

function createDeepProxy<TValue extends object>(signalRef: SignalRef<TValue>, target: TValue): TValue {
	const cached = signalRef._proxyCache.get(target);
	if (cached) {
		return cached as TValue;
	}

	const proxy = new Proxy(target, {
		get(innerTarget, key, receiver) {
			trackDependency(getPropertyDependency(signalRef._depMap, innerTarget, key));
			const nextValue = Reflect.get(innerTarget, key, receiver);
			return isObjectLike(nextValue)
				? createDeepProxy(signalRef as SignalRef<object>, nextValue as object)
				: nextValue;
		},
		set(innerTarget, key, value, receiver) {
			const previousLength = Array.isArray(innerTarget) ? innerTarget.length : 0;
			const previousValue = Reflect.get(innerTarget, key, receiver);
			const result = Reflect.set(innerTarget, key, value, receiver);

			if (!Object.is(previousValue, value)) {
				notifyPropertyDependency(signalRef._depMap, innerTarget, key);
				notifyArrayLengthDependency(signalRef._depMap, innerTarget, previousLength);
			}

			return result;
		},
		deleteProperty(innerTarget, key) {
			const previousLength = Array.isArray(innerTarget) ? innerTarget.length : 0;
			const hadKey = Reflect.has(innerTarget, key);
			const result = Reflect.deleteProperty(innerTarget, key);

			if (hadKey) {
				notifyPropertyDependency(signalRef._depMap, innerTarget, key);
				notifyArrayLengthDependency(signalRef._depMap, innerTarget, previousLength);
			}

			return result;
		},
	});

	signalRef._proxyCache.set(target, proxy);
	return proxy;
}

function wrapSignalValue<TValue>(signalRef: SignalRef<TValue>, value: TValue): TValue {
	signalRef._proxyCache = new WeakMap<object, object>();
	return isObjectLike(value)
		? createDeepProxy(signalRef as SignalRef<object>, value as object) as TValue
		: value;
}

export function signal<TValue>(initialValue: TValue): ISignal<TValue> {
	const subscribers = new Set<{ schedule: () => void }>();

	const signalRef: SignalRef<TValue> = {
		_rawValue: initialValue,
		_value: initialValue,
		_proxyCache: new WeakMap<object, object>(),
		_depMap: new Map<object, Map<PropertyKey, EffectDependencyStore>>(),
		_rootDep: createEffectDependencyStore(),
		_disposed: false,
		_notify: () => {
			if (signalRef._disposed) {
				return;
			}

			for (const subscriber of subscribers) {
				subscriber.schedule();
			}

			signalRef._rootDep._notify();
			notifyAllPropertyDependencies(signalRef._depMap);
		},
	};

	const signalApi: ISignal<TValue> = {
		get value() {
			if (!isObjectLike(signalRef._rawValue)) {
				trackDependency(signalRef._rootDep);
			}

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
			const subscription = {
				schedule: () => callback(signalRef._value),
			};

			subscribers.add(subscription);

			return () => {
				subscribers.delete(subscription);
			};
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

export function isSignal<TValue>(value: unknown): value is ISignal<TValue> {
	return Boolean(
		value
		&& typeof value === 'object'
		&& 'peek' in value
		&& 'subscribe' in value
		&& 'value' in value,
	);
}

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

export function effect(fn: () => void | (() => void)): () => void {
	return createEffect(fn);
}

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
