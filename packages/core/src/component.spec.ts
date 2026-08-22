import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { DomMode } from './internal';
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
const { configureRevia } = await import('./config');
const { defineElement } = await import('./custom-element');
const { defineProps } = await import('./props');
const { signal } = await import('./reactivity');
const { cssFile } = await import('./styles');
const { css, forEach, html, when } = await import('./template');

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

	test('runs connection lifecycle hooks across reconnects and moves', () => {
		const lifecycle: string[] = [];

		class ConnectionElement extends ReactiveElement {
			public override connected(): void {
				lifecycle.push('connected');
			}

			public override disconnected(): void {
				lifecycle.push('disconnected');
			}

			public render() {
				return html`<p>Connected</p>`;
			}
		}

		const ElementClass = defineTestElement(ConnectionElement);
		const element = new ElementClass() as ConnectionElement;
		const firstTarget = document.createElement('section');
		const secondTarget = document.createElement('section');
		document.body.append(firstTarget, secondTarget);
		firstTarget.append(element);
		element.remove();
		secondTarget.append(element);
		element.move(firstTarget);

		expect(lifecycle).toEqual([
			'connected',
			'disconnected',
			'connected',
			'disconnected',
			'connected',
		]);
	});

	test('batches updated hooks and resolves afterUpdate after the hook', async () => {
		const lifecycle: string[] = [];

		class UpdatedElement extends ReactiveElement {
			public count!: ISignal<number>;

			protected override setup(): void {
				this.count = signal(0);
			}

			public override updated(): void {
				lifecycle.push(`updated:${this.count.value}`);
			}

			public render() {
				return html`<p>${() => this.count.value}</p>`;
			}
		}

		const ElementClass = defineTestElement(UpdatedElement);
		const element = new ElementClass() as UpdatedElement;
		document.body.append(element);
		element.count.value = 1;
		element.count.value = 2;
		await element.afterUpdate();
		lifecycle.push('after-update');

		expect(lifecycle).toEqual(['updated:2', 'after-update']);
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

	test('parses attributes, reflects external writes, and honours custom prop serializers', () => {
		const props = defineProps({
			enabled: { type: Boolean, reflect: true },
			visits: { type: Number, reflect: true },
			status: {
				type: String,
				attribute: 'data-status',
				reflect: true,
				default: 'UNKNOWN',
				deserialize: value => value?.toUpperCase() ?? 'UNKNOWN',
				serialize: value => value.toLowerCase(),
			},
			internal: { type: String, attribute: false, default: 'private' },
		});
		type ParsedProps = PropsFromDefinition<typeof props>;

		class PropElement extends ReactiveElement<ParsedProps> {
			public static override props = props;

			public declare enabled: boolean;
			public declare visits: number;
			public declare status: string;
			public declare internal: string;

			public render() {
				return html`<p>${() => `${this.props.enabled}/${this.props.visits}/${this.props.status}`}</p>`;
			}
		}

		const ElementClass = defineTestElement(PropElement);
		const element = new ElementClass() as PropElement;
		element.setAttribute('enabled', '');
		element.setAttribute('visits', '4');
		element.setAttribute('data-status', 'ready');
		document.body.append(element);

		expect(element.props.enabled).toBeTrue();
		expect(element.props.visits).toBe(4);
		expect(element.props.status).toBe('READY');
		expect(element.props.internal).toBe('private');

		element.enabled = false;
		element.visits = 5;
		element.status = 'PENDING';
		element.internal = 'changed';
		expect(element.hasAttribute('enabled')).toBeFalse();
		expect(element.getAttribute('visits')).toBe('5');
		expect(element.getAttribute('data-status')).toBe('pending');
		expect(element.hasAttribute('internal')).toBeFalse();
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

	test('keeps failed components blank in production mode', () => {
		const reportError = console.error;
		console.error = () => {};
		configureRevia({ development: false });

		class InvalidProductionElement extends ReactiveElement {
			public static override props = { age: { type: Number } };

			public render() {
				return html`<p>Rendered</p>`;
			}
		}

		try {
			const ElementClass = defineTestElement(InvalidProductionElement);
			const element = new ElementClass() as InvalidProductionElement;
			element.setAttribute('age', 'not-a-number');
			document.body.append(element);
			expect(element.renderRoot.childNodes).toHaveLength(0);
		} finally {
			configureRevia({ development: true });
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

	test('applies static inline and external styles in shadow and light DOM', () => {
		class ShadowStyleElement extends ReactiveElement {
			public static override styles = [
				css`:host { color: tomato; }`,
				cssFile(new URL('./shadow.css', 'https://example.test/components/card.ts')),
			];

			public render() {
				return html`<p>Shadow</p>`;
			}
		}

		class LightStyleElement extends ReactiveElement {
			public static override dom: DomMode = 'light';
			public static override styles = css`:host { color: teal; }`;

			public render() {
				return html`<p>Light</p>`;
			}
		}

		const ShadowClass = defineTestElement(ShadowStyleElement);
		const LightClass = defineTestElement(LightStyleElement);
		const shadow = new ShadowClass() as ShadowStyleElement;
		const light = new LightClass() as LightStyleElement;
		document.body.append(shadow, light);

		expect(shadow.renderRoot.querySelector('style')?.textContent).toContain(':host');
		expect(shadow.renderRoot.querySelector('link')?.getAttribute('href')).toBe('https://example.test/components/shadow.css');
		expect(light.querySelector('style')?.textContent).toContain(light.localName);
	});

	test('binds native properties before falling back to attributes and rejects unsafe template contexts', async () => {
		const reportError = console.error;
		console.error = () => {};

		class BindingTargetElement extends ReactiveElement {
			public value!: ISignal<string>;

			protected override setup(): void {
				this.value = signal('ready');
			}

			public render() {
				return html`<input value=${() => this.value.value} data-state=${() => this.value.value}>`;
			}
		}

		class UnsafeTemplateElement extends ReactiveElement {
			public render() {
				return html`<${'section'}>Unsafe</${'section'}>`;
			}
		}

		try {
			const BindingClass = defineTestElement(BindingTargetElement);
			const bindingElement = new BindingClass() as BindingTargetElement;
			document.body.append(bindingElement);
			const input = bindingElement.renderRoot.querySelector('input')!;
			expect(input.value).toBe('ready');
			expect(input.getAttribute('data-state')).toBe('ready');

			bindingElement.value.value = 'done';
			await bindingElement.afterUpdate();
			expect(input.value).toBe('done');
			expect(input.getAttribute('data-state')).toBe('done');

			const UnsafeClass = defineTestElement(UnsafeTemplateElement);
			const unsafe = new UnsafeClass() as UnsafeTemplateElement;
			document.body.append(unsafe);
			expect(unsafe.renderRoot.querySelector('[data-revia-error]')?.textContent).toContain('Template expressions');
		} finally {
			console.error = reportError;
		}
	});

	test('keeps each nested prop collection readonly inside component-owned work', () => {
		const props = defineProps({
			settings: { type: Object, default: () => ({ theme: 'dark' }) },
			items: { type: Array, default: () => ['one'] },
			lookup: { type: Object, default: () => new Map([['theme', 'dark']]) },
			selected: { type: Object, default: () => new Set(['one']) },
		});
		type ReadonlyProps = PropsFromDefinition<typeof props>;

		class ReadonlyElement extends ReactiveElement<ReadonlyProps> {
			public static override props = props;
			public mutationKind: 'object' | 'array' | 'map' | 'set' = 'object';

			public render() {
				const mutations = {
					object: this.mutateObject,
					array: this.mutateArray,
					map: this.mutateMap,
					set: this.mutateSet,
				};
				return html`<button @click=${mutations[this.mutationKind]}>Mutate</button>`;
			}

			private mutateObject = (): void => {
				(this.props.settings as { theme: string }).theme = 'light';
			};

			private mutateArray = (): void => {
				(this.props.items as string[]).push('two');
			};

			private mutateMap = (): void => {
				(this.props.lookup as Map<string, string>).set('theme', 'light');
			};

			private mutateSet = (): void => {
				(this.props.selected as Set<string>).add('two');
			};
		}

		const reportError = console.error;
		console.error = () => {};
		try {
			const ElementClass = defineTestElement(ReadonlyElement);
			for (const mutationKind of ['object', 'array', 'map', 'set'] as const) {
				const element = new ElementClass() as ReadonlyElement;
				element.mutationKind = mutationKind;
				document.body.append(element);
				element.renderRoot.querySelector('button')!.click();

				expect(element.props.settings.theme).toBe('dark');
				expect(element.props.items).toEqual(['one']);
				expect((element.props.lookup as Map<string, string>).get('theme')).toBe('dark');
				expect((element.props.selected as Set<string>).has('two')).toBeFalse();
				expect(element.renderRoot.querySelector('[data-revia-error]')).not.toBeNull();
			}
		} finally {
			console.error = reportError;
		}
	});

	test('supports typed custom events, scoped ownership, and freeze/resume', async () => {
		type CounterEvents = { saved: { value: number } };

		class ControlledElement extends ReactiveElement<Record<string, never>, never, CounterEvents> {
			public value!: ISignal<number>;
			public scopedValue!: ISignal<number>;

			protected override setup(): void {
				this.value = signal(0);
			}

			public render() {
				return html`<button @click=${this.save}>${() => this.value.value}</button>`;
			}

			private save = (): void => {
				this.emit('saved', { value: this.value.value });
			};
		}

		const ElementClass = defineTestElement(ControlledElement);
		const element = new ElementClass() as ControlledElement;
		document.body.append(element);
		const events: number[] = [];
		const scopedValues: number[] = [];
		element.addEventListener('saved', event => events.push((event as CustomEvent<{ value: number }>).detail.value));

		element.scope(() => {
			element.scopedValue = signal(1);
			element.scopedValue.subscribe(value => scopedValues.push(value));
		});
		expect(element.ownedResources.size).toBeGreaterThan(1);

		element.renderRoot.querySelector('button')!.click();
		expect(events).toEqual([0]);

		element.freeze();
		element.value.value = 2;
		element.value.value = 3;
		await Promise.resolve();
		expect(element.renderRoot.querySelector('button')?.textContent).toBe('0');

		element.resume();
		await element.afterUpdate();
		expect(element.renderRoot.querySelector('button')?.textContent).toBe('3');

		element.dispose();
		element.scopedValue.value = 3;
		expect(scopedValues).toEqual([]);
		expect(element.ownedResources.size).toBe(0);
	});

	test('preserves keyed list nodes, cleans conditional listeners, and warns for unkeyed lists', async () => {
		const warnings: unknown[][] = [];
		const reportWarning = console.warn;
		console.warn = (...args: unknown[]) => warnings.push(args);

		class RendererElement extends ReactiveElement {
			public visible!: ISignal<boolean>;
			public items!: ISignal<Array<{ id: number, label: string }>>;
			public clicks = 0;

			protected override setup(): void {
				this.visible = signal(true);
				this.items = signal([
					{ id: 1, label: 'One' },
					{ id: 2, label: 'Two' },
				]);
			}

			public render() {
				return html`
					${when(
						() => this.visible.value,
						html`<button data-branch @click=${this.countClick}>Branch</button>`,
						html`<p data-hidden>Hidden</p>`,
					)}
					<ul>${forEach(
						() => this.items.value,
						item => item.id,
						item => html`<li data-id=${item.id}>${item.label}</li>`,
					)}</ul>
					<ol>${forEach(() => this.items.value, item => html`<li>${item.label}</li>`)}</ol>
				`;
			}

			private countClick = (): void => {
				this.clicks += 1;
			};
		}

		try {
			const ElementClass = defineTestElement(RendererElement);
			const element = new ElementClass() as RendererElement;
			document.body.append(element);
			const firstItem = element.renderRoot.querySelector('[data-id="1"]')!;
			const branch = element.renderRoot.querySelector('[data-branch]') as HTMLButtonElement;
			branch.click();
			element.visible.value = false;
			element.items.value.reverse();
			await element.afterUpdate();

			expect(element.renderRoot.querySelectorAll('ul [data-id]')[0]).toBe(element.renderRoot.querySelector('[data-id="2"]')!);
			expect(element.renderRoot.querySelector('[data-id="1"]')).toBe(firstItem);
			expect(element.renderRoot.querySelector('[data-hidden]')).not.toBeNull();
			branch.click();
			expect(element.clicks).toBe(1);
			element.items.value = [
				{ id: 1, label: 'First' },
				{ id: 1, label: 'Duplicate' },
			];
			await element.afterUpdate();
			expect(warnings.some(([message]) => String(message).includes('Unkeyed forEach'))).toBeTrue();
			expect(warnings.some(([message]) => String(message).includes('Duplicate key'))).toBeTrue();
		} finally {
			console.warn = reportWarning;
		}
	});

	test('clones props and slotted children without sharing local setup state', () => {
		const props = defineProps({ value: { type: Number, default: 1 } });
		type CloneProps = PropsFromDefinition<typeof props>;

		class CloneElement extends ReactiveElement<CloneProps> {
			public static override props = props;
			public local!: ISignal<number>;

			protected override setup(): void {
				this.local = signal(0);
			}

			public render() {
				return html`<p>${() => this.props.value}/${() => this.local.value}</p><slot></slot>`;
			}
		}

		const ElementClass = defineTestElement(CloneElement);
		const source = new ElementClass() as CloneElement;
		(source as unknown as { value: number }).value = 4;
		source.append(document.createTextNode('Projected'));
		document.body.append(source);
		source.local.value = 9;
		const clone = source.clone();
		document.body.append(clone);

		expect(clone).not.toBe(source);
		expect(clone.props.value).toBe(4);
		expect(clone.local.value).toBe(0);
		expect(clone.textContent).toContain('Projected');
	});

	test('recovers after invalid input is corrected and projects light-DOM named slots', () => {
		const reportError = console.error;
		console.error = () => {};

		class RecoverableElement extends ReactiveElement {
			public static override props = { age: { type: Number } };

			public render() {
				return html`<p>Age: ${() => this.props.age}</p>`;
			}
		}

		class LightSlotElement extends ReactiveElement {
			public static override dom: DomMode = 'light';

			public render() {
				return html`<article><header><slot name="title">Fallback title</slot></header><section><slot>Fallback body</slot></section></article>`;
			}
		}

		try {
			const RecoverableClass = defineTestElement(RecoverableElement);
			const recoverable = new RecoverableClass() as RecoverableElement;
			recoverable.setAttribute('age', 'invalid');
			document.body.append(recoverable);
			(recoverable as unknown as { age: number }).age = 42;
			expect(recoverable.recover()).toBeTrue();
			expect(recoverable.renderRoot.textContent).toContain('Age: 42');

			const LightSlotClass = defineTestElement(LightSlotElement);
			const light = new LightSlotClass() as LightSlotElement;
			const title = document.createElement('strong');
			title.slot = 'title';
			title.textContent = 'Projected title';
			light.append(title, document.createTextNode('Projected body'));
			document.body.append(light);

			expect(light.querySelector('header')?.textContent).toContain('Projected title');
			expect(light.querySelector('section')?.textContent).toContain('Projected body');
		} finally {
			console.error = reportError;
		}
	});
});
