import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { PropsFromDefinition } from './props';
import type { ISignal } from './reactivity';

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

const { ReactiveElement } = await import('./component');
const { defineElement } = await import('./custom-element');
const { defineProps } = await import('./props');
const { signal } = await import('./reactivity');
const { css, html } = await import('./template');

let elementCount = 0;

function defineTestElement<TElement extends CustomElementConstructor>(elementClass: TElement): TElement {
	elementCount += 1;
	return defineElement(`revia-test-${elementCount}`, elementClass);
}

describe('ReactiveElement', () => {
	test('runs lifecycle hooks in order and disposes owned state', () => {
		const lifecycle: string[] = [];

		class LifecycleElement extends ReactiveElement {
			public state!: ISignal<number>;

			protected override setup(): void {
				lifecycle.push('setup');
				this.state = signal(0);
			}

			public override created(): void {
				lifecycle.push('created');
			}

			public override connected(): void {
				lifecycle.push('connected');
			}

			public override disconnected(): void {
				lifecycle.push('disconnected');
			}

			public override disposed(): void {
				lifecycle.push('disposed');
			}

			public render() {
				return html`<p>${() => this.state.value}</p>`;
			}
		}

		const ElementClass = defineTestElement(LifecycleElement);
		const element = new ElementClass() as LifecycleElement;
		document.body.append(element);
		expect(lifecycle).toEqual(['setup', 'created', 'connected']);

		element.dispose();
		expect(lifecycle).toEqual(['setup', 'created', 'connected', 'disconnected', 'disposed']);
	});

	test('updates only the affected bindings and supports compound attributes', async () => {
		class BindingElement extends ReactiveElement {
			public count!: ISignal<number>;
			public label!: ISignal<string>;

			protected override setup(): void {
				this.count = signal(0);
				this.label = signal('ready');
			}

			public render() {
				return html`
					<p class="status-${() => this.count.value}-${() => this.label.value}">
						${() => this.count.value}
					</p>
					<span>${() => this.label.value}</span>
				`;
			}
		}

		const ElementClass = defineTestElement(BindingElement);
		const element = new ElementClass() as BindingElement;
		document.body.append(element);
		const paragraph = element.renderRoot.querySelector('p')!;
		const span = element.renderRoot.querySelector('span')!;

		element.count.value = 1;
		await element.afterUpdate();
		expect(paragraph.className).toBe('status-1-ready');
		expect(span.textContent?.trim()).toBe('ready');
		expect(element.renderRoot.querySelector('span')).toBe(span);

		element.label.value = 'done';
		await element.afterUpdate();
		expect(paragraph.className).toBe('status-1-done');
		expect(span.textContent?.trim()).toBe('done');
	});

	test('validates and emits model updates without mutating readonly props', async () => {
		const props = defineProps({
			value: {
				type: Number,
				default: 1,
				readonly: true,
				model: true,
				validator: value => value >= 0 || 'Value must be positive.',
			},
		});
		type ModelProps = PropsFromDefinition<typeof props>;

		class ModelElement extends ReactiveElement<ModelProps, 'value'> {
			public static override props = props;

			public declare value: number;

			public render() {
				return html`<button @click="${() => this.updateModel('value', this.props.value + 1)}">${() => this.props.value}</button>`;
			}
		}

		defineElement('revia-model-target', ModelElement);

		class ParentElement extends ReactiveElement {
			public value!: ISignal<number>;

			protected override setup(): void {
				this.value = signal(1);
			}

			public render() {
				return html`<revia-model-target *value="${this.value}"></revia-model-target>`;
			}
		}

		const ParentClass = defineTestElement(ParentElement);
		const parent = new ParentClass() as ParentElement;
		document.body.append(parent);
		const child = parent.renderRoot.querySelector('revia-model-target') as ModelElement;
		child.addEventListener('update:value', event => {
			child.value = (event as CustomEvent<number>).detail;
		});

		child.renderRoot.querySelector('button')!.click();
		await parent.afterUpdate();
		expect(parent.value.value).toBe(2);
		expect(child.props.value).toBe(2);

		const reportError = console.error;
		console.error = () => {};
		try {
			expect(child.updateModel('value', -1)).toBeFalse();
		} finally {
			console.error = reportError;
		}
	});

	test('renders a development warning instead of mounting with invalid props', () => {
		const reportError = console.error;
		console.error = () => {};

		class InvalidPropElement extends ReactiveElement {
			public static override props = {
				age: { type: Number },
			};

			public render() {
				return html`<p>Rendered</p>`;
			}
		}

		try {
			const ElementClass = defineTestElement(InvalidPropElement);
			const element = new ElementClass() as InvalidPropElement;
			element.setAttribute('age', 'not-a-number');
			document.body.append(element);
			expect(element.renderRoot.querySelector('[data-revia-error]')).not.toBeNull();
			expect(element.renderRoot.querySelector('p')).toBeNull();
		} finally {
			console.error = reportError;
		}
	});

	test('warns when a signal is interpolated without a reactive getter', () => {
		const reportWarning = console.warn;
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => warnings.push(args);

		class DirectSignalElement extends ReactiveElement {
			public value!: ISignal<number>;

			protected override setup(): void {
				this.value = signal(1);
			}

			public render() {
				return html`<p>${this.value}</p>`;
			}
		}

		try {
			const ElementClass = defineTestElement(DirectSignalElement);
			const element = new ElementClass() as DirectSignalElement;
			document.body.append(element);
			expect(warnings.some(([message]) => String(message).includes('Direct signal binding'))).toBeTrue();
		} finally {
			console.warn = reportWarning;
		}
	});

	test('updates styles reactively without remounting content', async () => {
		class StyleElement extends ReactiveElement {
			public colour!: ISignal<string>;

			protected override setup(): void {
				this.colour = signal('red');
			}

			public override styles = () => css`:host { color: ${this.colour.value}; }`;

			public render() {
				return html`<p>Styled</p>`;
			}
		}

		const ElementClass = defineTestElement(StyleElement);
		const element = new ElementClass() as StyleElement;
		document.body.append(element);
		const content = element.renderRoot.querySelector('p');
		element.colour.value = 'blue';
		await element.afterUpdate();

		expect(element.renderRoot.querySelector('style')?.textContent).toContain('blue');
		expect(element.renderRoot.querySelector('p')).toBe(content);
	});
});
