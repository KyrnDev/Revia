export type CssValue = string | number | boolean | null | undefined | ICssTemplate;

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

export type RenderableFactory = () => RenderableValue;

export type ICssTemplate = {
	readonly reviaKind: 'css',
	readonly cssText: string,
};

export type ITemplateResult = {
	readonly strings: TemplateStringsArray,
	readonly values: readonly unknown[],
};

export type IWhenBinding = {
	readonly reviaKind: 'when',
	readonly getter: RenderableFactory,
	readonly truthy: RenderableValue,
	readonly falsy: RenderableValue,
};

export type IForEachBinding<TItem = unknown> = {
	readonly reviaKind: 'forEach',
	readonly getter: () => readonly TItem[],
	readonly keyBy: ((item: TItem, index: number) => unknown) | null,
	readonly renderItem: (item: TItem, index: number) => RenderableValue,
};

export type IKeyedRenderable = {
	readonly reviaKind: 'keyed',
	readonly key: unknown,
	readonly value: RenderableValue,
	readonly identity: unknown,
};

export function html(strings: TemplateStringsArray, ...values: readonly unknown[]): ITemplateResult {
	return { strings, values };
}

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

export function when(getter: RenderableFactory, truthy: RenderableValue, falsy: RenderableValue = null): IWhenBinding {
	return {
		reviaKind: 'when',
		getter,
		truthy,
		falsy,
	};
}

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

export function keyed(key: unknown, value: RenderableValue, identity: unknown = key): IKeyedRenderable {
	return {
		reviaKind: 'keyed',
		key,
		value,
		identity,
	};
}
