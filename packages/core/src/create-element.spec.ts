import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

const happyWindow = new Window({ url: 'http://localhost/' });

Object.assign(globalThis, {
	window: happyWindow,
	document: happyWindow.document,
	customElements: happyWindow.customElements,
	Element: happyWindow.Element,
	HTMLElement: happyWindow.HTMLElement,
	Node: happyWindow.Node,
	NodeFilter: happyWindow.NodeFilter,
	ShadowRoot: happyWindow.ShadowRoot,
	Event: happyWindow.Event,
	CustomEvent: happyWindow.CustomEvent,
});

const { createElement } = await import('./create-element');
const { html } = await import('./template');
const { signal } = await import('./reactivity');

let elementCount = 0;

function createTagName(): string {
	elementCount += 1;
	return `revia-function-test-${elementCount}`;
}

describe('createElement', () => {
	test('defines a function-authored component with reactive local state and inline props', async () => {
		const tagName = createTagName();
		let setupCalls = 0;
		const ElementClass = createElement(tagName, ({ prop }) => {
			setupCalls += 1;
			const label = prop('label', String, 'Ready');
			const count = signal(0);
			const increment = () => {
				count.value += 1;
			};

			return html`<button @click=${increment}>${() => label.value}: ${() => count.value}</button>`;
		});

		const element = new (ElementClass as unknown as CustomElementConstructor)() as HTMLElement & {
			afterUpdate: () => Promise<void>,
		};
		element.setAttribute('label', 'Start');
		document.body.append(element);
		const shadowRoot = element.shadowRoot;
		expect(shadowRoot).not.toBeNull();
		const button = shadowRoot!.querySelector('button')!;

		expect(setupCalls).toBe(2);
		expect(button.textContent).toBe('Start: 0');
		button.click();
		await element.afterUpdate();
		expect(button.textContent).toBe('Start: 1');
	});

	test('uses explicit props without a metadata-only setup run', () => {
		const tagName = createTagName();
		let setupCalls = 0;
		const ElementClass = createElement(tagName, ({ prop }) => {
			setupCalls += 1;
			const label = prop('label', String, 'Ignored metadata default');
			return html`<p>${() => label.value}</p>`;
		}, {
			props: {
				label: { type: String, default: 'Configured' },
			},
		});

		const element = new (ElementClass as unknown as CustomElementConstructor)();
		document.body.append(element);

		expect(setupCalls).toBe(1);
		expect(element.shadowRoot?.textContent).toContain('Configured');
	});
});
