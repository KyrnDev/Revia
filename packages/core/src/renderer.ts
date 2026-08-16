import type { IReactiveRenderHost, StyleEntry } from './internal';
import { createEffect, isSignal, withOwner } from './reactivity';
import {
	keyed,
	type IForEachBinding,
	type IKeyedRenderable,
	type ITemplateResult,
	type IWhenBinding,
	type RenderableValue,
} from './template';

type CleanupBag = Array<() => void>;

type ItemState = {
	item: unknown,
	identity: unknown,
	index: number,
	key: unknown,
	start: Comment,
	end: Comment,
	cleanups: CleanupBag,
};

type MaterializedRenderable = {
	nodes: Node[],
	cleanupBag: CleanupBag,
};

type NormalizedKeyedRenderable = {
	keyed: boolean,
	key: unknown,
	identity: unknown,
	value: RenderableValue,
};

const templateCache = new WeakMap<TemplateStringsArray, HTMLTemplateElement>();

function updateTagState(
	chunk: string,
	state: {
		insideTag: boolean,
		quote: '"' | '\'' | null,
	},
): void {
	for (const char of chunk) {
		if (state.quote) {
			if (char === state.quote) {
				state.quote = null;
			}

			continue;
		}

		if (state.insideTag && (char === '"' || char === '\'')) {
			state.quote = char;
			continue;
		}

		if (char === '<') {
			state.insideTag = true;
			continue;
		}

		if (char === '>') {
			state.insideTag = false;
		}
	}
}

function compileTemplate(strings: TemplateStringsArray): HTMLTemplateElement {
	const cached = templateCache.get(strings);
	if (cached) {
		return cached;
	}

	let markup = '';
	const state = {
		insideTag: false,
		quote: null as '"' | '\'' | null,
	};

	for (let index = 0; index < strings.length; index += 1) {
		const chunk = strings[index] ?? '';
		markup += chunk;
		updateTagState(chunk, state);

		if (index === strings.length - 1) {
			continue;
		}

		markup += state.insideTag
			? `__revia_attr_${index}__`
			: `<!--revia_part_${index}-->`;
	}

	const template = document.createElement('template');
	template.innerHTML = markup;
	templateCache.set(strings, template);
	return template;
}

function normalizeStyleEntries(stylesValue: StyleEntry | StyleEntry[] | null | undefined | false): StyleEntry[] {
	if (!stylesValue) {
		return [];
	}

	return Array.isArray(stylesValue)
		? stylesValue.flatMap(entry => normalizeStyleEntries(entry))
		: [stylesValue];
}

function styleEntryToCssText(styleEntry: StyleEntry): string {
	return typeof styleEntry === 'string' ? styleEntry : styleEntry.cssText;
}

function adaptCssForLightDom(cssText: string, tagName: string): string {
	return cssText
		.replace(/:host\b/g, tagName)
		.replace(/slot::slotted\(([^)]+)\)/g, `${tagName} [data-revia-slot] > $1`);
}

export function buildComponentStyles(owner: IReactiveRenderHost): HTMLStyleElement | null {
	const entries = normalizeStyleEntries(owner.resolveStyles());
	const cssText = entries
		.map(styleEntryToCssText)
		.filter(Boolean)
		.join('\n');

	if (!cssText) {
		return null;
	}

	const styleElement = document.createElement('style');
	styleElement.textContent = owner.domMode === 'light'
		? adaptCssForLightDom(cssText, owner.localName)
		: cssText;
	return styleElement;
}

export function captureLightDomSlotTemplates(owner: IReactiveRenderHost): void {
	if (owner.hasCapturedLightSlotTemplates()) {
		return;
	}

	owner.markLightSlotTemplatesCaptured();
	const slotTemplates = owner.ensureLightSlotTemplates();

	for (const node of Array.from(owner.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
			continue;
		}

		const slotName = node.nodeType === Node.ELEMENT_NODE
			? (node as Element).getAttribute('slot') ?? ''
			: '';
		const slotBucket = slotTemplates.get(slotName) ?? [];
		slotBucket.push(node.cloneNode(true));
		slotTemplates.set(slotName, slotBucket);
	}
}

export function projectLightDomSlots(owner: IReactiveRenderHost): void {
	const slots = Array.from(owner.renderRoot.querySelectorAll('slot'));

	for (const slotElement of slots) {
		const slotName = slotElement.getAttribute('name') ?? '';
		const templates = owner.getLightSlotTemplates()?.get(slotName) ?? [];

		if (templates.length > 0) {
			const fragment = document.createDocumentFragment();

			for (const template of templates) {
				const clone = template.cloneNode(true);

				if (clone.nodeType === Node.ELEMENT_NODE) {
					(clone as Element).removeAttribute('slot');
					(clone as Element).setAttribute('data-revia-slot', slotName || 'default');
				}

				fragment.appendChild(clone);
			}

			slotElement.replaceWith(fragment);
			continue;
		}

		slotElement.replaceWith(...Array.from(slotElement.childNodes));
	}
}

function resolveRenderable(value: unknown): RenderableValue {
	const resolved = typeof value === 'function'
		? (value as () => RenderableValue)()
		: value as RenderableValue;

	if (resolved && typeof resolved === 'object' && 'reviaKind' in resolved) {
		if (resolved.reviaKind === 'when') {
			const whenBinding = resolved as IWhenBinding;
			return whenBinding.getter() ? whenBinding.truthy : whenBinding.falsy;
		}

		if (resolved.reviaKind === 'forEach') {
			const forEachBinding = resolved as IForEachBinding;
			return forEachBinding.getter().map((entry, index) => forEachBinding.renderItem(entry, index));
		}
	}

	return resolved;
}

function normalizeKeyedRenderable(value: RenderableValue): NormalizedKeyedRenderable {
	if (value && typeof value === 'object' && 'reviaKind' in value && value.reviaKind === 'keyed') {
		const keyedValue = value as IKeyedRenderable;
		return {
			keyed: true,
			key: keyedValue.key,
			identity: keyedValue.identity,
			value: keyedValue.value,
		};
	}

	return {
		keyed: false,
		key: null,
		identity: value,
		value,
	};
}

export function instantiateTemplate(
	result: ITemplateResult,
	owner: IReactiveRenderHost,
	debugPathOverride: string | null = null,
): { fragment: DocumentFragment, dispose: () => void } {
	const template = compileTemplate(result.strings);
	const fragment = template.content.cloneNode(true) as DocumentFragment;
	const cleanupBag: CleanupBag = [];
	const debugPath = debugPathOverride ?? owner.getDebugPath() ?? owner.debugLabel();

	bindTemplateParts(fragment, result.values, owner, cleanupBag, debugPath);

	return {
		fragment,
		dispose: () => {
			for (const cleanup of cleanupBag) {
				cleanup();
			}
		},
	};
}

function materializeRenderable(
	value: RenderableValue,
	owner: IReactiveRenderHost,
	debugPathOverride: string | null = null,
): MaterializedRenderable {
	const normalized = normalizeKeyedRenderable(resolveRenderable(value));
	const resolved = normalized.value;

	if (resolved === null || resolved === undefined || resolved === false) {
		return { nodes: [], cleanupBag: [] };
	}

	if (Array.isArray(resolved)) {
		const nodes: Node[] = [];
		const cleanupBag: CleanupBag = [];

		for (const entry of resolved) {
			const materialized = materializeRenderable(entry, owner, debugPathOverride);
			nodes.push(...materialized.nodes);
			cleanupBag.push(...materialized.cleanupBag);
		}

		return { nodes, cleanupBag };
	}

	if (resolved instanceof Node) {
		return { nodes: [resolved], cleanupBag: [] };
	}

	if (resolved && typeof resolved === 'object' && 'strings' in resolved && 'values' in resolved) {
		const nested = instantiateTemplate(resolved as ITemplateResult, owner, debugPathOverride);
		return {
			nodes: Array.from(nested.fragment.childNodes),
			cleanupBag: [() => nested.dispose()],
		};
	}

	return {
		nodes: [document.createTextNode(String(resolved))],
		cleanupBag: [],
	};
}

function clearRegion(start: Node, end: Node): void {
	let current = start.nextSibling;

	while (current && current !== end) {
		const next = current.nextSibling;
		current.remove();
		current = next;
	}
}

function clearBetween(start: Comment, end: Comment): void {
	let current = start.nextSibling;

	while (current && current !== end) {
		const next = current.nextSibling;
		current.remove();
		current = next;
	}
}

function insertNodesBefore(end: Node, nodes: Node[]): void {
	const fragment = document.createDocumentFragment();

	for (const node of nodes) {
		fragment.appendChild(node);
	}

	end.parentNode?.insertBefore(fragment, end);
}

function createMarkerPair(parent: Node, beforeNode: Node): { start: Comment, end: Comment } {
	const start = document.createComment('revia_item');
	const end = document.createComment('/revia_item');
	parent.insertBefore(start, beforeNode);
	parent.insertBefore(end, beforeNode);
	return { start, end };
}

function moveRange(start: Comment, end: Comment, beforeNode: Node): void {
	const fragment = document.createDocumentFragment();
	let current: Node | null = start;

	while (current) {
		const next: Node | null = current.nextSibling;
		fragment.appendChild(current);

		if (current === end) {
			break;
		}

		current = next;
	}

	beforeNode.parentNode?.insertBefore(fragment, beforeNode);
}

function createItemDebugPath(owner: IReactiveRenderHost, key: unknown, index: number): string {
	const base = owner.getDebugPath() ?? owner.debugLabel();
	return key === null || key === undefined
		? `${base}[index=${index}]`
		: `${base}[key=${String(key)}]`;
}

function renderIntoMarkerRange(
	start: Comment,
	end: Comment,
	value: RenderableValue,
	owner: IReactiveRenderHost,
	debugPathOverride: string | null = null,
): CleanupBag {
	const materialized = materializeRenderable(value, owner, debugPathOverride);
	clearBetween(start, end);
	insertNodesBefore(end, materialized.nodes);
	return materialized.cleanupBag;
}

function disposeItemState(itemState: ItemState): void {
	for (const cleanup of itemState.cleanups) {
		cleanup();
	}

	clearBetween(itemState.start, itemState.end);
	itemState.start.remove();
	itemState.end.remove();
}

function reconcileItemStates(
	parent: Node,
	end: Comment,
	itemStates: ItemState[],
	items: readonly unknown[],
	owner: IReactiveRenderHost,
	renderItem: (item: unknown, index: number) => RenderableValue,
): void {
	const keyedStates = new Map<unknown, ItemState>();
	const unkeyedStates: ItemState[] = [];
	const nextStates = Array.from({ length: items.length }) as ItemState[];

	for (const itemState of itemStates) {
		if (itemState.key === null || itemState.key === undefined) {
			unkeyedStates.push(itemState);
		} else {
			keyedStates.set(itemState.key, itemState);
		}
	}

	let beforeNode: Node = end;

	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];
		const rendered = renderItem(item, index);
		const normalized = normalizeKeyedRenderable(rendered);
		const key = normalized.key;
		let itemState: ItemState | null = null;

		if (key !== null && key !== undefined && keyedStates.has(key)) {
			itemState = keyedStates.get(key) ?? null;
			keyedStates.delete(key);
		} else if (key === null || key === undefined) {
			itemState = unkeyedStates.pop() ?? null;
		}

		const itemDebugPath = createItemDebugPath(owner, key, index);

		if (!itemState) {
			const markers = createMarkerPair(parent, beforeNode);
			itemState = {
				item,
				identity: normalized.identity,
				index,
				key,
				start: markers.start,
				end: markers.end,
				cleanups: renderIntoMarkerRange(
					markers.start,
					markers.end,
					normalized.value,
					owner,
					itemDebugPath,
				),
			};
			nextStates[index] = itemState;
			beforeNode = itemState.start;
			continue;
		}

		moveRange(itemState.start, itemState.end, beforeNode);

		const shouldUpdate = !Object.is(itemState.identity, normalized.identity)
			|| itemState.index !== index;

		if (shouldUpdate) {
			for (const cleanup of itemState.cleanups) {
				cleanup();
			}

			itemState.cleanups = renderIntoMarkerRange(
				itemState.start,
				itemState.end,
				normalized.value,
				owner,
				itemDebugPath,
			);
		}

		itemState.item = item;
		itemState.identity = normalized.identity;
		itemState.index = index;
		itemState.key = key;
		nextStates[index] = itemState;
		beforeNode = itemState.start;
	}

	for (const leftover of keyedStates.values()) {
		disposeItemState(leftover);
	}

	for (const leftover of unkeyedStates) {
		disposeItemState(leftover);
	}

	itemStates.splice(0, itemStates.length, ...nextStates);
}

function mountForEachBinding(
	anchor: Comment,
	binding: IForEachBinding,
	owner: IReactiveRenderHost,
	cleanupBag: CleanupBag,
	label: string,
): void {
	const parent = anchor.parentNode as Node;
	const end = document.createComment('/revia_part');
	parent.insertBefore(end, anchor.nextSibling);

	const itemStates: ItemState[] = [];
	let warnedAboutMissingKey = false;

	const applyList = () => {
		const items = binding.getter();

		if (typeof binding.keyBy !== 'function') {
			if (!warnedAboutMissingKey) {
				warnedAboutMissingKey = true;
				console.warn(
					`[revia warn] Unkeyed forEach on <${owner.debugLabel()}> at "${label}" will fully rerender its list. Provide a key selector as the second argument to forEach(...).`,
				);
			}

			while (itemStates.length > 0) {
				const itemState = itemStates.pop();
				if (itemState) {
					disposeItemState(itemState);
				}
			}

			for (let index = 0; index < items.length; index += 1) {
				const item = items[index];
				const markers = createMarkerPair(parent, end);
				itemStates.push({
					item,
					identity: item,
					index,
					key: null,
					start: markers.start,
					end: markers.end,
					cleanups: renderIntoMarkerRange(
						markers.start,
						markers.end,
						binding.renderItem(item, index),
						owner,
						createItemDebugPath(owner, null, index),
					),
				});
			}

			return;
		}

		reconcileItemStates(parent, end, itemStates, items, owner, (item, index) => {
			return keyed(
				binding.keyBy!(item, index),
				binding.renderItem(item, index),
				item,
			);
		});
	};

	createEffect(applyList, { owner, cleanupBag, label });
	cleanupBag.push(() => {
		for (const itemState of itemStates) {
			disposeItemState(itemState);
		}
	});
}

function mountNodeBinding(
	anchor: Comment,
	binding: unknown,
	owner: IReactiveRenderHost,
	cleanupBag: CleanupBag,
	label: string,
): void {
	if (binding && typeof binding === 'object' && 'reviaKind' in binding && binding.reviaKind === 'forEach') {
		mountForEachBinding(anchor, binding as IForEachBinding, owner, cleanupBag, label);
		return;
	}

	const end = document.createComment('/revia_part');
	anchor.parentNode?.insertBefore(end, anchor.nextSibling);

	let childCleanups: CleanupBag = [];
	let arrayItemStates: ItemState[] = [];
	let lastArrayMode = false;

	const applyValue = () => {
		const resolved = resolveRenderable(binding);

		if (Array.isArray(resolved)) {
			if (!lastArrayMode) {
				for (const cleanup of childCleanups) {
					cleanup();
				}

				childCleanups = [];
				clearRegion(anchor, end);
				lastArrayMode = true;
			}

			reconcileItemStates(anchor.parentNode as Node, end, arrayItemStates, resolved, owner, item => item as RenderableValue);
			return;
		}

		if (lastArrayMode) {
			for (const itemState of arrayItemStates) {
				disposeItemState(itemState);
			}

			arrayItemStates = [];
			lastArrayMode = false;
		}

		for (const cleanup of childCleanups) {
			cleanup();
		}

		childCleanups = [];
		clearRegion(anchor, end);

		const materialized = materializeRenderable(resolved, owner);
		childCleanups = materialized.cleanupBag;
		insertNodesBefore(end, materialized.nodes);
	};

	createEffect(applyValue, { owner, cleanupBag, label });
	cleanupBag.push(() => {
		for (const itemState of arrayItemStates) {
			disposeItemState(itemState);
		}

		for (const cleanup of childCleanups) {
			cleanup();
		}
	});
}

function setBoundValue(target: Element, key: string, value: unknown): void {
	if (key in target) {
		const propertyTarget = target as Element & Record<string, unknown>;

		if (!Object.is(propertyTarget[key], value)) {
			propertyTarget[key] = value;
		}

		return;
	}

	if (value === false || value === null || value === undefined) {
		target.removeAttribute(key);
		return;
	}

	const nextValue = String(value);
	if (target.getAttribute(key) !== nextValue) {
		target.setAttribute(key, nextValue);
	}
}

function mountAttributeBinding(
	element: Element,
	name: string,
	binding: unknown,
	owner: IReactiveRenderHost,
	cleanupBag: CleanupBag,
	label: string,
): void {
	if (name.startsWith('@')) {
		const eventName = name.slice(1);
		element.removeAttribute(name);

		if (typeof binding === 'function') {
			const eventHandler = binding as EventListener;
			element.addEventListener(eventName, eventHandler);
			cleanupBag.push(() => {
				element.removeEventListener(eventName, eventHandler);
			});
		}

		return;
	}

	if (name.startsWith(':')) {
		const propName = name.slice(1);
		element.removeAttribute(name);

		const applyBinding = () => {
			setBoundValue(element, propName, resolveRenderable(binding));
		};

		if (typeof binding === 'function') {
			createEffect(applyBinding, { owner, cleanupBag, label });
		} else {
			applyBinding();
		}

		return;
	}

	if (name.startsWith('*')) {
		const propName = name.slice(1);
		element.removeAttribute(name);

		if (!isSignal(binding)) {
			console.warn(`Expected signal for *${propName} binding.`);
			return;
		}

		createEffect(() => {
			setBoundValue(element, propName, binding.value);
		}, { owner, cleanupBag, label });

		const listener = (event: Event) => {
			const customEvent = event as CustomEvent;
			binding.value = customEvent.detail;
		};

		element.addEventListener(`update:${propName}`, listener);
		cleanupBag.push(() => {
			element.removeEventListener(`update:${propName}`, listener);
		});
		return;
	}

	const applyAttribute = () => {
		const nextValue = resolveRenderable(binding);

		if (nextValue === false || nextValue === null || nextValue === undefined) {
			element.removeAttribute(name);
			return;
		}

		const stringValue = String(nextValue);
		if (element.getAttribute(name) !== stringValue) {
			element.setAttribute(name, stringValue);
		}
	};

	element.removeAttribute(name);

	if (typeof binding === 'function') {
		createEffect(applyAttribute, { owner, cleanupBag, label });
	} else {
		applyAttribute();
	}
}

function formatElementLabel(element: Element | ParentNode | null): string {
	const resolvedElement = element as Element | null;
	const tag = resolvedElement?.localName ?? 'node';
	const debugName = resolvedElement?.getAttribute?.('data-debug');

	if (debugName) {
		return `${tag}[${debugName}]`;
	}

	const id = resolvedElement?.id ? `#${resolvedElement.id}` : '';
	const className = typeof resolvedElement?.className === 'string' && resolvedElement.className.trim()
		? `.${resolvedElement.className.trim().split(/\s+/).join('.')}`
		: '';

	return `${tag}${id}${className}`;
}

function describeRenderableBinding(binding: unknown, fallbackLabel: string): string {
	if (binding && typeof binding === 'object' && 'reviaKind' in binding) {
		if (binding.reviaKind === 'when') {
			return `${fallbackLabel}:when`;
		}

		if (binding.reviaKind === 'forEach') {
			return `${fallbackLabel}:forEach`;
		}
	}

	return fallbackLabel;
}

function bindTemplateParts(
	root: ParentNode,
	values: readonly unknown[],
	owner: IReactiveRenderHost,
	cleanupBag: CleanupBag,
	debugPath: string,
): void {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
	const nodeTargets = new Map<number, Comment>();
	const attrTargets = new Map<number, { element: Element, name: string }>();

	while (walker.nextNode()) {
		const node = walker.currentNode;

		if (node.nodeType === Node.COMMENT_NODE) {
			const match = node.textContent?.match(/^revia_part_(\d+)$/);
			if (match) {
				nodeTargets.set(Number(match[1]), node as Comment);
			}

			continue;
		}

		const element = node as Element;

		for (const attribute of Array.from(element.attributes)) {
			const match = attribute.value.match(/^__revia_attr_(\d+)__$/);
			if (match) {
				attrTargets.set(Number(match[1]), {
					element,
					name: attribute.name,
				});
			}
		}
	}

	for (let index = 0; index < values.length; index += 1) {
		if (nodeTargets.has(index)) {
			const anchor = nodeTargets.get(index)!;
			const contextNode = anchor.previousSibling instanceof Element
				? anchor.previousSibling
				: anchor.parentNode;
			const baseLabel = `${debugPath}:part:${index}@${formatElementLabel(contextNode)}`;
			const label = describeRenderableBinding(values[index], baseLabel);
			mountNodeBinding(anchor, values[index], owner, cleanupBag, label);
			continue;
		}

		if (attrTargets.has(index)) {
			const target = attrTargets.get(index)!;
			const label = `${debugPath}:attr:${target.name}@${formatElementLabel(target.element)}`;
			mountAttributeBinding(target.element, target.name, values[index], owner, cleanupBag, label);
		}
	}
}

export function renderTemplate(
	result: ITemplateResult,
	owner: IReactiveRenderHost,
): { fragment: DocumentFragment, dispose: () => void } {
	return withOwner(owner, () => instantiateTemplate(result, owner));
}
