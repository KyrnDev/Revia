import { getCurrentReactiveOwner, signal, type ISignal } from './reactivity';
import type { IReactiveOwner } from './internal';

/** A constructor accepted by a prop's `type` option. */
export type PropConstructor<TValue = unknown> = StringConstructor
	| NumberConstructor
	| BooleanConstructor
	| ObjectConstructor
	| ArrayConstructor
	| (abstract new (...args: never[]) => TValue);

/** One accepted prop constructor, or a list of accepted constructors. */
export type PropType<TValue = unknown> = PropConstructor<TValue> | readonly PropConstructor<TValue>[];

/** A prop default value. Factories create a fresh value for every component instance. */
export type PropDefaultValue<TValue> = TValue | (() => TValue);

type BivariantCallback<TArgs extends readonly unknown[], TResult> = {
	bivarianceHack: (...args: TArgs) => TResult,
}['bivarianceHack'];

/** Validates a prop or model value. Return `true` or nothing for success, otherwise `false` or an error message. */
export type PropValidator<TValue = unknown> = BivariantCallback<
	[value: TValue, host: HTMLElement, propName: string],
	boolean | string
>;

/** Converts a reflected prop value to an attribute value. */
export type PropSerializer<TValue = unknown> = BivariantCallback<
	[value: TValue, host: HTMLElement, propName: string],
	string | null
>;

/** Converts an attribute value to a prop value. */
export type PropDeserializer<TValue = unknown> = BivariantCallback<
	[value: string | null, host: HTMLElement, propName: string],
	TValue
>;

/**
 * Declares how a component prop is typed, validated, exposed as an attribute, and optionally used as a model.
 */
export type IPropDefinition<TValue = unknown> = {
	/** Accepted JavaScript constructor or constructors. Defaults to `String`. */
	type?: PropType<TValue>,
	/** Initial value when no property or attribute is supplied. Use a factory for arrays and objects. */
	default?: PropDefaultValue<TValue>,
	/** Enables attribute input, disables it, or chooses a custom attribute name. */
	attribute?: boolean | string,
	/** Fails component creation when no value is supplied. */
	required?: boolean,
	/** Mirrors property writes back to the associated attribute. */
	reflect?: boolean,
	/** Documents the prop's immutable component-side contract. Declared props are readonly internally by default. */
	readonly?: boolean,
	/** Additional application-level validation. */
	validator?: PropValidator<TValue>,
	/** Custom reflected-attribute serializer. */
	serialize?: PropSerializer<TValue>,
	/** Custom attribute deserializer. */
	deserialize?: PropDeserializer<TValue>,
	/** Enables `update:<prop>` model events. The prop named `value` is also a default model. */
	model?: boolean | string,
};

/** A class `static props` declaration. String-array shorthand declares string props. */
export type IPropsDefinition = Record<string, IPropDefinition<any>> | readonly string[];

/** Object-only prop schema used by {@link defineProps} and {@link PropsFromDefinition}. */
export type IPropsSchema = Record<string, IPropDefinition<any>>;

type ValueFromConstructor<TConstructor> = TConstructor extends StringConstructor
	? string
	: TConstructor extends NumberConstructor
		? number
		: TConstructor extends BooleanConstructor
			? boolean
			: TConstructor extends ArrayConstructor
				? unknown[]
				: TConstructor extends ObjectConstructor
					? Record<PropertyKey, unknown>
					: TConstructor extends abstract new (...args: never[]) => infer TValue
						? TValue
						: unknown;

type ValueFromPropType<TType> = TType extends readonly unknown[]
	? ValueFromConstructor<TType[number]>
	: ValueFromConstructor<TType>;

type ValueFromDefault<TDefault> = TDefault extends () => infer TFactoryValue
	? TFactoryValue
	: TDefault;

type ValueFromDefinition<TDefinition> = TDefinition extends { default: () => infer TFactoryValue }
	? TFactoryValue
	: TDefinition extends {
		type: ArrayConstructor | ObjectConstructor,
		default: infer TDefault,
	}
		? ValueFromDefault<TDefault>
		: TDefinition extends { type: infer TType }
			? ValueFromPropType<TType>
			: TDefinition extends { default: infer TValue }
				? ValueFromDefault<TValue>
				: unknown;

/** Derives the readonly component prop type from a schema created with {@link defineProps}. */
export type PropsFromDefinition<TDefinition extends IPropsSchema> = {
	readonly [TKey in keyof TDefinition]: ValueFromDefinition<TDefinition[TKey]>;
};

/**
 * Preserves a prop schema's literal types so it can power both `static props` and `ReactiveElement` generics.
 */
export function defineProps<const TDefinition extends IPropsSchema>(definition: TDefinition): TDefinition {
	return definition;
}

type NormalizedPropDefinition = Omit<IPropDefinition, 'type'> & {
	attributeName: string | null,
	propertyName: string,
	typeSet: readonly PropConstructor[],
};

type PropHostClass = {
	prototype: HTMLElement,
	props?: IPropsDefinition,
};

type PropHost = HTMLElement & {
	readonly constructor: PropHostClass,
	propChanged?: (propName: string, oldValue: unknown, newValue: unknown) => void,
	handleError?: (error: unknown) => void,
};

type PropSignalHost = PropHost & {
	[propSignalsKey]?: Map<string, ISignal<unknown>>,
	[propReflectingAttributesKey]?: Set<string>,
	[propReadonlyProxyCacheKey]?: WeakMap<object, object>,
};

const propSignalsKey = Symbol('revia.propSignals');
const propReflectingAttributesKey = Symbol('revia.reflectingAttributes');
const propReadonlyProxyCacheKey = Symbol('revia.readonlyPropProxyCache');
const installedConstructors = new WeakSet<object>();
const normalizedPropsCache = new WeakMap<object, Map<string, NormalizedPropDefinition>>();
const attributeMapCache = new WeakMap<object, Map<string, string>>();

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === 'object' && value !== null;
}

function cloneDefaultValue<TValue>(value: TValue): TValue {
	if (!isObjectLike(value)) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map(entry => cloneDefaultValue(entry)) as TValue;
	}

	const clone: Record<PropertyKey, unknown> = {};

	for (const key of Reflect.ownKeys(value)) {
		clone[key] = cloneDefaultValue(value[key as keyof typeof value]);
	}

	return clone as TValue;
}

function kebabCase(value: string): string {
	return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function normalizeTypeSet(type: PropType | undefined): readonly PropConstructor[] {
	if (!type) {
		return [String];
	}

	if (Array.isArray(type)) {
		return [...type];
	}

	return [type as PropConstructor];
}

function getDefaultValue(definition: NormalizedPropDefinition): unknown {
	if (typeof definition.default === 'function') {
		return (definition.default as () => unknown)();
	}

	if (definition.default === undefined) {
		if (definition.typeSet.includes(Boolean)) {
			return false;
		}

		return undefined;
	}

	return cloneDefaultValue(definition.default);
}

function shouldUseAttribute(definition: IPropDefinition, typeSet: readonly PropConstructor[]): boolean {
	if (typeof definition.attribute === 'boolean') {
		return definition.attribute;
	}

	if (typeof definition.attribute === 'string') {
		return true;
	}

	return typeSet.includes(String)
		|| typeSet.includes(Number)
		|| typeSet.includes(Boolean);
}

function normalizePropDefinition(propName: string, definition: IPropDefinition = {}): NormalizedPropDefinition {
	const typeSet = normalizeTypeSet(definition.type);
	const attributeName = shouldUseAttribute(definition, typeSet)
		? typeof definition.attribute === 'string'
			? definition.attribute
			: kebabCase(propName)
		: null;

	if (definition.reflect && !attributeName) {
		throw new TypeError(`[revia] Prop "${propName}" cannot reflect because attribute input is disabled.`);
	}

	if (definition.model && typeof definition.model !== 'boolean' && typeof definition.model !== 'string') {
		throw new TypeError(`[revia] Prop "${propName}" has an invalid model declaration.`);
	}

	return {
		...definition,
		propertyName: propName,
		typeSet,
		required: Boolean(definition.required),
		reflect: Boolean(definition.reflect),
		readonly: definition.readonly !== false,
		attributeName,
	};
}

function getOwnPropEntries(props: IPropsDefinition | undefined): Array<[string, IPropDefinition]> {
	if (!props) {
		return [];
	}

	if (Array.isArray(props)) {
		return props.map(propName => [propName, { type: String }] satisfies [string, IPropDefinition]);
	}

	return Object.entries(props);
}

function getClassHierarchy(componentClass: PropHostClass): PropHostClass[] {
	const hierarchy: PropHostClass[] = [];
	let currentClass: object | null = componentClass;

	while (currentClass && currentClass !== HTMLElement) {
		hierarchy.unshift(currentClass as PropHostClass);
		currentClass = Reflect.getPrototypeOf(currentClass);
	}

	return hierarchy;
}

function getNormalizedProps(componentClass: PropHostClass): Map<string, NormalizedPropDefinition> {
	const cached = normalizedPropsCache.get(componentClass);
	if (cached) {
		return cached;
	}

	const normalizedProps = new Map<string, NormalizedPropDefinition>();

	for (const currentClass of getClassHierarchy(componentClass)) {
		for (const [propName, definition] of getOwnPropEntries(currentClass.props)) {
			if (!propName || /\s/.test(propName)) {
				throw new TypeError('[revia] Prop names must be non-empty and cannot contain whitespace.');
			}

			normalizedProps.set(propName, normalizePropDefinition(propName, definition));
		}
	}

	normalizedPropsCache.set(componentClass, normalizedProps);
	return normalizedProps;
}

function getAttributeToPropMap(componentClass: PropHostClass): Map<string, string> {
	const cached = attributeMapCache.get(componentClass);
	if (cached) {
		return cached;
	}

	const attributeMap = new Map<string, string>();

	for (const [propName, definition] of getNormalizedProps(componentClass)) {
		if (definition.attributeName) {
			const existingProp = attributeMap.get(definition.attributeName);
			if (existingProp && existingProp !== propName) {
				throw new TypeError(
					`[revia] Props "${existingProp}" and "${propName}" both use the "${definition.attributeName}" attribute.`,
				);
			}

			attributeMap.set(definition.attributeName, propName);
		}
	}

	attributeMapCache.set(componentClass, attributeMap);
	return attributeMap;
}

function getPropSignals(host: PropHost): Map<string, ISignal<unknown>> {
	const signalStore = (host as PropSignalHost)[propSignalsKey];

	if (signalStore) {
		return signalStore;
	}

	const nextStore = new Map<string, ISignal<unknown>>();
	Object.defineProperty(host, propSignalsKey, {
		value: nextStore,
		enumerable: false,
		configurable: false,
		writable: false,
	});
	return nextStore;
}

function getReflectingAttributes(host: PropHost): Set<string> {
	const reflectingAttributes = (host as PropSignalHost)[propReflectingAttributesKey];

	if (reflectingAttributes) {
		return reflectingAttributes;
	}

	const nextSet = new Set<string>();
	Object.defineProperty(host, propReflectingAttributesKey, {
		value: nextSet,
		enumerable: false,
		configurable: false,
		writable: false,
	});
	return nextSet;
}

function getReadonlyProxyCache(host: PropHost): WeakMap<object, object> {
	const cache = (host as PropSignalHost)[propReadonlyProxyCacheKey];
	if (cache) {
		return cache;
	}

	const nextCache = new WeakMap<object, object>();
	Object.defineProperty(host, propReadonlyProxyCacheKey, {
		value: nextCache,
		enumerable: false,
		configurable: false,
		writable: false,
	});
	return nextCache;
}

function readonlyPropValue<TValue>(host: PropHost, propName: string, value: TValue): TValue {
	if (!isObjectLike(value)) {
		return value;
	}

	const cache = getReadonlyProxyCache(host);
	const cached = cache.get(value);
	if (cached) {
		return cached as TValue;
	}

	const reject = () => {
		reportPropError(host, new TypeError(`[revia] Cannot mutate readonly prop "${propName}" from inside its component.`));
	};
	const proxy = new Proxy(value, {
		get(target, key, receiver) {
			if (target instanceof Map || target instanceof Set) {
				if (key === 'set' || key === 'add') {
					return () => {
						reject();
						return receiver;
					};
				}

				if (key === 'delete') {
					return () => {
						reject();
						return false;
					};
				}

				if (key === 'clear') {
					return () => reject();
				}

				if (target instanceof Map && key === 'get') {
					return (entryKey: unknown) => readonlyPropValue(host, propName, target.get(entryKey));
				}

				if (key === 'forEach') {
					return (callback: (entryValue: unknown, entryKey: unknown, collection: unknown) => void, thisArg?: unknown) => {
						target.forEach((entryValue, entryKey) => {
							callback.call(
								thisArg,
								readonlyPropValue(host, propName, entryValue),
								readonlyPropValue(host, propName, entryKey),
								receiver,
							);
						});
					};
				}

				if (key === 'keys' || key === 'values' || key === 'entries' || key === Symbol.iterator) {
					return function* readonlyCollectionIterator(): IterableIterator<unknown> {
						const iterator = key === 'keys'
							? target.keys()
							: key === 'values'
								? target.values()
								: target.entries();

						for (const entry of iterator) {
							if (target instanceof Map && Array.isArray(entry)) {
								yield [
									readonlyPropValue(host, propName, entry[0]),
									readonlyPropValue(host, propName, entry[1]),
								];
								continue;
							}

							yield readonlyPropValue(host, propName, entry);
						}
					};
				}
			}

			return readonlyPropValue(host, propName, Reflect.get(target, key, target));
		},
		set() {
			reject();
			return true;
		},
		deleteProperty() {
			reject();
			return true;
		},
	});

	cache.set(value, proxy);
	return proxy as TValue;
}

function matchesSingleType(type: PropConstructor, value: unknown): boolean {
	if (type === String) {
		return typeof value === 'string';
	}

	if (type === Number) {
		return typeof value === 'number' && Number.isFinite(value);
	}

	if (type === Boolean) {
		return typeof value === 'boolean';
	}

	if (type === Object) {
		return isObjectLike(value) && !Array.isArray(value);
	}

	if (type === Array) {
		return Array.isArray(value);
	}

	return value instanceof type;
}

function validatePropValue(
	host: PropHost,
	propName: string,
	definition: NormalizedPropDefinition,
	value: unknown,
): void {
	if (value === undefined) {
		if (definition.required) {
			throw new TypeError(`[revia] Required prop "${propName}" is missing.`);
		}

		return;
	}

	if (!definition.typeSet.some(type => matchesSingleType(type, value))) {
		const expectedTypes = definition.typeSet.map(type => type.name || 'Unknown').join(' | ');
		throw new TypeError(`[revia] Prop "${propName}" expected ${expectedTypes}.`);
	}

	if (definition.validator) {
		const result = definition.validator(value, host, propName);

		if (result !== true && result !== undefined) {
			throw new TypeError(
				typeof result === 'string'
					? `[revia] ${result}`
					: `[revia] Custom validator failed for prop "${propName}".`,
			);
		}
	}
}

function reportPropError(host: PropHost, error: unknown): void {
	if (typeof host.handleError === 'function') {
		host.handleError(error);
		return;
	}

	throw error;
}

function serializePropValue(
	host: PropHost,
	propName: string,
	definition: NormalizedPropDefinition,
	value: unknown,
): string | null {
	if (definition.serialize) {
		return definition.serialize(value, host, propName);
	}

	if (value === undefined || value === null) {
		return null;
	}

	if (definition.typeSet.includes(Boolean)) {
		return value ? '' : null;
	}

	if (definition.typeSet.includes(Object) || definition.typeSet.includes(Array)) {
		try {
			return JSON.stringify(value);
		} catch {
			throw new TypeError(`[revia] Prop "${propName}" cannot be reflected because it is not JSON serializable.`);
		}
	}

	return String(value);
}

function deserializePropValue(
	host: PropHost,
	propName: string,
	definition: NormalizedPropDefinition,
	value: string | null,
): unknown {
	if (definition.deserialize) {
		return definition.deserialize(value, host, propName);
	}

	if (value === null) {
		return getDefaultValue(definition);
	}

	if (definition.typeSet.includes(Boolean)) {
		if (value === '' || value === 'true') {
			return true;
		}

		if (value === 'false') {
			return false;
		}

		throw new TypeError(
			`[revia] Prop "${propName}" expected a boolean attribute: use an empty attribute, "true", or "false".`,
		);
	}

	if (definition.typeSet.includes(Number)) {
		if (!value.trim()) {
			throw new TypeError(`[revia] Prop "${propName}" expected a non-empty number attribute.`);
		}

		const parsedValue = Number(value);

		if (!Number.isFinite(parsedValue)) {
			throw new TypeError(`[revia] Prop "${propName}" expected a valid number attribute.`);
		}

		return parsedValue;
	}

	if (definition.typeSet.includes(Object) || definition.typeSet.includes(Array)) {
		try {
			return JSON.parse(value);
		} catch {
			throw new TypeError(`[revia] Prop "${propName}" expected valid JSON in its attribute.`);
		}
	}

	return value;
}

function reflectPropValue(
	host: PropHost,
	definition: NormalizedPropDefinition,
	value: unknown,
): void {
	if (!definition.reflect || !definition.attributeName) {
		return;
	}

	const nextAttributeValue = serializePropValue(host, definition.propertyName, definition, value);
	const reflectingAttributes = getReflectingAttributes(host);

	reflectingAttributes.add(definition.attributeName);

	try {
		if (nextAttributeValue === null) {
			host.removeAttribute(definition.attributeName);
			return;
		}

		host.setAttribute(definition.attributeName, nextAttributeValue);
	} finally {
		reflectingAttributes.delete(definition.attributeName);
	}
}

function getInitialPropValue(host: PropHost, definition: NormalizedPropDefinition): unknown {
	if (definition.attributeName && host.hasAttribute(definition.attributeName)) {
		return deserializePropValue(
			host,
			definition.propertyName,
			definition,
			host.getAttribute(definition.attributeName),
		);
	}

	return getDefaultValue(definition);
}

function assignPropValue(
	host: PropHost,
	propName: string,
	definition: NormalizedPropDefinition,
	nextValue: unknown,
	options: {
		initializing?: boolean,
		fromAttribute?: boolean,
	},
): void {
	if (!options.initializing && getCurrentReactiveOwner() === (host as unknown as IReactiveOwner)) {
		reportPropError(
			host,
			new TypeError(`[revia] Cannot assign to readonly prop "${propName}" from inside its component. Use updateModel("${propName}", value) instead.`),
		);
		return;
	}

	const signalStore = getPropSignals(host);
	const resolvedValue = nextValue === undefined
		? getDefaultValue(definition)
		: nextValue;

	try {
		validatePropValue(host, propName, definition, resolvedValue);
	} catch (error) {
		reportPropError(host, error);
		return;
	}

	const propSignal = signalStore.get(propName);
	const previousValue = propSignal?.peek();

	if (!propSignal) {
		signalStore.set(propName, signal(resolvedValue));
	} else if (!Object.is(previousValue, resolvedValue)) {
		propSignal.value = resolvedValue;
	}

	try {
		if (!options.fromAttribute) {
			reflectPropValue(host, definition, resolvedValue);
		}

		if (!options.initializing && !Object.is(previousValue, resolvedValue)) {
			host.propChanged?.(propName, previousValue, resolvedValue);
		}
	} catch (error) {
		reportPropError(host, error);
	}
}

function installPropAccessors(componentClass: PropHostClass): void {
	if (installedConstructors.has(componentClass)) {
		return;
	}

	installedConstructors.add(componentClass);

	for (const [propName, definition] of getNormalizedProps(componentClass)) {
		Object.defineProperty(componentClass.prototype, propName, {
			get(this: PropHost) {
				const value = getPropSignals(this).get(propName)?.value;
				return getCurrentReactiveOwner() === (this as unknown as IReactiveOwner)
					? readonlyPropValue(this, propName, value)
					: value;
			},
			set(this: PropHost, nextValue: unknown) {
				assignPropValue(this, propName, definition, nextValue, {});
			},
			enumerable: true,
			configurable: true,
		});
	}
}

export function getObservedAttributes(componentClass: PropHostClass): string[] {
	return [...getAttributeToPropMap(componentClass).keys()];
}

/** Returns inherited declared prop names for component cloning. */
export function getPropNames(componentClass: PropHostClass): string[] {
	return [...getNormalizedProps(componentClass).keys()];
}

/** Returns a deeply readonly prop value for a component's public `props` view. */
export function getReadonlyProp(host: PropHost, propName: string): unknown {
	return readonlyPropValue(host, propName, getPropSignals(host).get(propName)?.value);
}

export function initializeProps(host: PropHost): void {
	const componentClass = host.constructor;
	installPropAccessors(componentClass);
	const dynamicHost = host as unknown as Record<string, unknown>;
	const ownValues = new Map<string, unknown>();

	for (const propName of getNormalizedProps(componentClass).keys()) {
		if (!Object.hasOwn(host, propName)) {
			continue;
		}

		ownValues.set(propName, dynamicHost[propName]);
		delete dynamicHost[propName];
	}

	for (const [propName, definition] of getNormalizedProps(componentClass)) {
		try {
			assignPropValue(host, propName, definition, getInitialPropValue(host, definition), {
				initializing: true,
				fromAttribute: definition.attributeName !== null && host.hasAttribute(definition.attributeName),
			});
		} catch (error) {
			reportPropError(host, error);
		}
	}

	for (const [propName, ownValue] of ownValues) {
		assignPropValue(host, propName, getNormalizedProps(componentClass).get(propName)!, ownValue, {
			initializing: true,
		});
	}
}

export function shouldIgnoreAttributeSync(host: PropHost, attributeName: string): boolean {
	return getReflectingAttributes(host).has(attributeName);
}

export function syncAttributeToProp(
	host: PropHost,
	attributeName: string,
	value: string | null,
): void {
	const componentClass = host.constructor;
	const propName = getAttributeToPropMap(componentClass).get(attributeName);

	if (!propName) {
		return;
	}

	const definition = getNormalizedProps(componentClass).get(propName);

	if (!definition) {
		return;
	}

	try {
		assignPropValue(
			host,
			propName,
			definition,
			deserializePropValue(host, propName, definition, value),
			{ fromAttribute: true },
		);
	} catch (error) {
		reportPropError(host, error);
	}
}

export function validateModelUpdate(host: PropHost, propName: string, value: unknown): boolean {
	const definition = getNormalizedProps(host.constructor).get(propName);

	if (!definition || (!definition.model && propName !== 'value')) {
		reportPropError(host, new TypeError(`[revia] Prop "${propName}" is not declared as a model.`));
		return false;
	}

	try {
		validatePropValue(host, propName, definition, value);
		return true;
	} catch (error) {
		reportPropError(host, error);
		return false;
	}
}
