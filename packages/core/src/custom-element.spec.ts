import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

const happyWindow = new Window({ url: 'http://localhost/' });

Object.assign(globalThis, {
	window: happyWindow,
	document: happyWindow.document,
	customElements: happyWindow.customElements,
	Element: happyWindow.Element,
	HTMLElement: happyWindow.HTMLElement,
});

const { customElement, defineElement, register } = await import('./custom-element');

let elementCount = 0;

function createTagName(): string {
	elementCount += 1;
	return `revia-registration-test-${elementCount}`;
}

describe('custom element registration', () => {
	test('registers a class once and rejects a conflicting class', () => {
		class FirstElement extends HTMLElement {}
		class SecondElement extends HTMLElement {}
		const tagName = createTagName();

		expect(defineElement(tagName, FirstElement)).toBe(FirstElement);
		expect(defineElement(tagName, FirstElement)).toBe(FirstElement);
		expect(customElements.get(tagName)).toBe(FirstElement);
		expect(() => defineElement(tagName, SecondElement)).toThrow(`Cannot define "${tagName}"`);
	});

	test('supports direct register() usage', () => {
		class RegisteredElement extends HTMLElement {}
		const tagName = createTagName();

		expect(register(tagName, RegisteredElement)).toBe(RegisteredElement);
		expect(customElements.get(tagName)).toBe(RegisteredElement);
	});

	test('supports decorator registration and the customElement alias', () => {
		class DecoratedElement extends HTMLElement {}
		class AliasedElement extends HTMLElement {}
		const decoratorTag = createTagName();
		const aliasTag = createTagName();

		const decorator = register(decoratorTag);
		expect(decorator(DecoratedElement, { kind: 'class' } as ClassDecoratorContext<typeof DecoratedElement>)).toBe(DecoratedElement);
		expect(customElements.get(decoratorTag)).toBe(DecoratedElement);
		expect(customElement(aliasTag, AliasedElement)).toBe(AliasedElement);
		expect(customElements.get(aliasTag)).toBe(AliasedElement);
	});
});
