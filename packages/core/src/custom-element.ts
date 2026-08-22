/** Native custom-element registration options, such as `extends`. */
export type DefineElementOptions = ElementDefinitionOptions;

/** A constructor accepted by the Custom Elements registry. */
export type CustomElementClass = CustomElementConstructor;

/**
 * Registers a component with `customElements.define()` and returns the original class.
 * Throws when another class already owns `tagName`.
 */
export function defineElement<TElement extends CustomElementClass>(
	tagName: string,
	elementClass: TElement,
	options?: DefineElementOptions,
): TElement {
	const existingDefinition = customElements.get(tagName);

	if (existingDefinition) {
		if (existingDefinition === elementClass) {
			return elementClass;
		}

		throw new Error(
			`[revia] Cannot define "${tagName}" because another custom element is already registered under that name.`,
		);
	}

	customElements.define(tagName, elementClass, options);
	return elementClass;
}

function createRegisterDecorator(
	tagName: string,
	options?: DefineElementOptions,
) {
	return function<TElement extends CustomElementClass>(
		elementClass: TElement,
		context: ClassDecoratorContext<TElement>,
	): TElement {
		if (context.kind !== 'class') {
			throw new Error('[revia] register(...) can only be used on classes.');
		}

		return defineElement(tagName, elementClass, options);
	};
}

/**
 * Registers a custom element directly or returns a standard class decorator.
 *
 * @example
 * register('my-card', MyCard);
 *
 * @example
 * @register('my-card')
 * class MyCard extends ReactiveElement {}
 */
export function register<TElement extends CustomElementClass>(
	tagName: string,
	elementClass: TElement,
	options?: DefineElementOptions,
): TElement;
export function register(
	tagName: string,
	options?: DefineElementOptions,
): <TElement extends CustomElementClass>(
	elementClass: TElement,
	context: ClassDecoratorContext<TElement>,
) => TElement;
export function register<TElement extends CustomElementClass>(
	tagName: string,
	elementClassOrOptions?: TElement | DefineElementOptions,
	maybeOptions?: DefineElementOptions,
) {
	if (typeof elementClassOrOptions === 'function') {
		return defineElement(tagName, elementClassOrOptions, maybeOptions);
	}

	return createRegisterDecorator(tagName, elementClassOrOptions);
}

/** Alias for {@link register}. */
export const customElement = register;
