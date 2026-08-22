import { type DomMode, ReactiveElement } from './component';
import { defineElement } from './custom-element';
import type { StyleEntry } from './internal';
import type { IPropDefinition, IPropsDefinition, PropDefaultValue, PropType } from './props';
import { withOwner } from './reactivity';
import type { ITemplateResult } from './template';

/** Readonly prop accessor exposed by {@link createElement} setup functions. */
export type IElementProp<TValue> = {
	readonly value: TValue,
};

/** Declares or accesses a prop from a {@link createElement} setup function. */
export type CreateElementProp = {
	<TValue>(name: string, definition: IPropDefinition<TValue>): IElementProp<TValue>,
	<TValue>(name: string, type?: PropType<TValue>, defaultValue?: PropDefaultValue<TValue>): IElementProp<TValue>,
};

/** Context passed to a {@link createElement} setup function. */
export type CreateElementContext = {
	prop: CreateElementProp,
};

/** Static options for a function-authored custom element. */
export type CreateElementOptions = {
	dom?: DomMode,
	styles?: StyleEntry | StyleEntry[],
	debugRender?: boolean,
	props?: IPropsDefinition,
};

/** A template, or a function that returns one, produced by `createElement` setup. */
export type CreateElementRender = ITemplateResult | (() => ITemplateResult);

type SetupResult = CreateElementRender;
type SetupFunction = (context: CreateElementContext) => SetupResult;

type RuntimePropHost = ReactiveElement & Record<string, unknown>;

type PropRegistry = Map<string, IPropDefinition<any>>;

function normalizePropDefinition<TValue>(
	typeOrDefinition?: IPropDefinition<TValue> | PropType<TValue>,
	defaultValue?: PropDefaultValue<TValue>,
): IPropDefinition<TValue> {
	if (
		typeOrDefinition
		&& typeof typeOrDefinition === 'object'
		&& !Array.isArray(typeOrDefinition)
		&& (
			'type' in typeOrDefinition
			|| 'default' in typeOrDefinition
			|| 'attribute' in typeOrDefinition
			|| 'required' in typeOrDefinition
			|| 'reflect' in typeOrDefinition
			|| 'readonly' in typeOrDefinition
			|| 'validator' in typeOrDefinition
			|| 'serialize' in typeOrDefinition
			|| 'deserialize' in typeOrDefinition
			|| 'model' in typeOrDefinition
		)
	) {
		return { ...typeOrDefinition };
	}

	return {
		type: typeOrDefinition as PropType<TValue> | undefined,
		default: defaultValue,
	};
}

function createPlaceholderProp<TValue>(value: TValue): IElementProp<TValue> {
	return {
		get value() {
			return value;
		},
	};
}

function createPropCollector(registry: PropRegistry): CreateElementProp {
	function prop<TValue>(name: string, definition: IPropDefinition<TValue>): IElementProp<TValue>;
	function prop<TValue>(name: string, type?: PropType<TValue>, defaultValue?: PropDefaultValue<TValue>): IElementProp<TValue>;
	function prop<TValue>(
		name: string,
		typeOrDefinition?: IPropDefinition<TValue> | PropType<TValue>,
		defaultValue?: PropDefaultValue<TValue>,
	): IElementProp<TValue> {
		registry.set(name, normalizePropDefinition(typeOrDefinition, defaultValue));
		return createPlaceholderProp(defaultValue as TValue);
	}

	return prop;
}

function createRuntimePropAccessor(host: RuntimePropHost, registry: PropRegistry): CreateElementProp {
	function prop<TValue>(name: string, definition: IPropDefinition<TValue>): IElementProp<TValue>;
	function prop<TValue>(name: string, type?: PropType<TValue>, defaultValue?: PropDefaultValue<TValue>): IElementProp<TValue>;
	function prop<TValue>(
		name: string,
		typeOrDefinition?: IPropDefinition<TValue> | PropType<TValue>,
		defaultValue?: PropDefaultValue<TValue>,
	): IElementProp<TValue> {
		if (!registry.has(name)) {
			registry.set(name, normalizePropDefinition(typeOrDefinition, defaultValue));
		}

		return {
			get value() {
				return host[name] as TValue;
			},
		};
	}

	return prop;
}

function registryToPropsDefinition(registry: PropRegistry): IPropsDefinition {
	return Object.fromEntries(registry.entries());
}

/**
 * Defines and registers a custom element from a setup function while using `ReactiveElement` underneath.
 * Provide `options.props` to avoid the metadata-only setup pass when setup has side effects.
 */
export function createElement(
	tagName: string,
	setup: SetupFunction,
	options: CreateElementOptions = {},
): typeof ReactiveElement<Record<string, unknown>> {
	const propRegistry: PropRegistry = new Map();

	if (!options.props) {
		// Compatibility path for inline prop declarations. Supplying options.props
		// avoids this metadata-only run, which keeps setup safe for side effects.
		setup({
			prop: createPropCollector(propRegistry),
		});
	}

	class GeneratedElement extends ReactiveElement {
		public static override dom = options.dom ?? 'shadow';

		public static override styles = options.styles;

		public static override debugRender = options.debugRender ?? false;

		public static override props = options.props ?? registryToPropsDefinition(propRegistry);

		protected readonly _renderTemplate: () => ITemplateResult;

		public constructor() {
			super();
			const renderValue = withOwner(this, () => setup({
				prop: createRuntimePropAccessor(this as RuntimePropHost, propRegistry),
			}));

			this._renderTemplate = typeof renderValue === 'function'
				? renderValue
				: () => renderValue;
		}

		public render(): ITemplateResult {
			return this._renderTemplate();
		}
	}

	Object.defineProperty(GeneratedElement, 'name', {
		value: pascalCaseTag(tagName),
	});

	return defineElement(tagName, GeneratedElement);
}

function pascalCaseTag(tagName: string): string {
	return tagName
		.split('-')
		.filter(Boolean)
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}
