/** A value accepted inside a {@link css} template. */
export type CssValue = string | number | boolean | null | undefined | ICssTemplate;

/** A value that can be rendered inside an {@link html} template. */
export type RenderableValue = string
	| number
	| boolean
	| null
	| undefined
	| Node
	| ITemplateResult
	| IWhenBinding
	| IForEachBinding
	| IKeyedRenderable
	| RenderableValue[];

/** A lazy render callback. Reads made inside it are tracked reactively. */
export type RenderableFactory = () => RenderableValue;

/** The result of a {@link css} tagged template. Use it in `static styles` or `styles()`. */
export type ICssTemplate = {
	readonly reviaKind: 'css',
	readonly cssText: string,
};

/** The result of an {@link html} tagged template. Return this from `render()`. */
export type ITemplateResult = {
	readonly strings: TemplateStringsArray,
	readonly values: readonly unknown[],
};

/** Internal render instruction returned by {@link when}. */
export type IWhenBinding = {
	readonly reviaKind: 'when',
	readonly getter: RenderableFactory,
	readonly truthy: RenderableValue,
	readonly falsy: RenderableValue,
};

/** Internal render instruction returned by {@link forEach}. */
export type IForEachBinding<TItem = unknown> = {
	readonly reviaKind: 'forEach',
	readonly getter: () => readonly TItem[],
	readonly keyBy: ((item: TItem, index: number) => unknown) | null,
	readonly renderItem: (item: TItem, index: number) => RenderableValue,
};

/** Internal render instruction returned by {@link keyed}. */
export type IKeyedRenderable = {
	readonly reviaKind: 'keyed',
	readonly key: unknown,
	readonly value: RenderableValue,
	readonly identity: unknown,
};

/**
 * Creates an HTML template for a component render method.
 *
 * Wrap reactive reads in a function so Revia can track and update just that part:
 * `html`\`<p>${() => count.value}</p>\``.
 */
export function html(strings: TemplateStringsArray, ...values: readonly unknown[]): ITemplateResult {
	return { strings, values };
}

/**
 * Creates CSS for `static styles` or an instance `styles` function.
 * Reactive reads inside `styles()` update the generated style element.
 */
export function css(strings: TemplateStringsArray, ...values: readonly CssValue[]): ICssTemplate {
	let cssText = '';

	for (let index = 0; index < strings.length; index += 1) {
		cssText += strings[index] ?? '';

		if (index >= values.length) {
			continue;
		}

		const value = values[index];
		cssText += value && typeof value === 'object' && 'cssText' in value
			? value.cssText
			: String(value ?? '');
	}

	return {
		reviaKind: 'css',
		cssText,
	};
}

/**
 * Renders one branch while `getter()` is truthy and another when it is falsy.
 * The condition is tracked independently from surrounding template parts.
 */
export function when(getter: RenderableFactory, truthy: RenderableValue, falsy: RenderableValue = null): IWhenBinding {
	return {
		reviaKind: 'when',
		getter,
		truthy,
		falsy,
	};
}

/**
 * Renders a reactive list. Pass a key selector for stable DOM identity and efficient updates.
 * Without a key selector, Revia rerenders that list and emits a development warning.
 */
export function forEach<TItem>(
	getter: () => readonly TItem[],
	renderItem: (item: TItem, index: number) => RenderableValue,
): IForEachBinding<TItem>;
export function forEach<TItem>(
	getter: () => readonly TItem[],
	keyBy: (item: TItem, index: number) => unknown,
	renderItem: (item: TItem, index: number) => RenderableValue,
): IForEachBinding<TItem>;
export function forEach<TItem>(
	getter: () => readonly TItem[],
	keyByOrRenderItem: ((item: TItem, index: number) => unknown) | ((item: TItem, index: number) => RenderableValue),
	maybeRenderItem?: (item: TItem, index: number) => RenderableValue,
): IForEachBinding<TItem> {
	const hasKeySelector = typeof maybeRenderItem === 'function';

	return {
		reviaKind: 'forEach',
		getter,
		keyBy: hasKeySelector
			? keyByOrRenderItem as (item: TItem, index: number) => unknown
			: null,
		renderItem: hasKeySelector
			? maybeRenderItem
			: keyByOrRenderItem as (item: TItem, index: number) => RenderableValue,
	};
}

/**
 * Assigns explicit identity to a renderable value in an array expression.
 * Prefer the keyed `forEach` overload for normal collection rendering.
 */
export function keyed(key: unknown, value: RenderableValue, identity: unknown = key): IKeyedRenderable {
	return {
		reviaKind: 'keyed',
		key,
		value,
		identity,
	};
}
