import type { IExternalStyleSheet, IReactiveRenderHost, StyleEntry } from './internal';
import { isReviaDevelopment } from './config';
import { createEffect, isSignal, withOwner } from './reactivity';
import {
	keyed,
	type ICssTemplate,
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

type AttributeTarget = {
	element: Element,
	name: string,
	parts: Array<string | number>,
	isExactBinding: boolean,
};

type CompiledAttributeTarget = {
	name: string,
	parts: Array<string | number>,
};

const templateCache = new WeakMap<TemplateStringsArray, HTMLTemplateElement>();
const warnedDirectSignals = new WeakSet<object>();
const attributeMarkerPattern = /__revia_attr_(\d+)__/g;

type TemplateParseState = {
	insideTag: boolean,
	insideComment: boolean,
	quote: '"' | '\'' | null,
	rawTextTag: string | null,
	tagName: string,
	readingTagName: boolean,
	isClosingTag: boolean,
};

function updateTagState(
	chunk: string,
	state: TemplateParseState,
): void {
	for (let index = 0; index < chunk.length; index += 1) {
		const char = chunk[index]!;

		if (state.insideComment) {
			if (chunk.startsWith('-->', index)) {
				state.insideComment = false;
				index += 2;
			}

			continue;
		}

		if (state.rawTextTag) {
			const closingTag = `</${state.rawTextTag}`;
			if (chunk.slice(index).toLowerCase().startsWith(closingTag)) {
				state.rawTextTag = null;
				state.insideTag = true;
				state.isClosingTag = true;
				state.tagName = closingTag.slice(2);
				state.readingTagName = false;
				index += closingTag.length - 1;
			}

			continue;
		}

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

		if (chunk.startsWith('<!--', index)) {
			state.insideComment = true;
			index += 3;
			continue;
		}

		if (char === '<') {
			state.insideTag = true;
			state.tagName = '';
			state.readingTagName = true;
			state.isClosingTag = chunk[index + 1] === '/';
			continue;
		}

		if (char === '>') {
			const tagName = state.tagName.toLowerCase();
			if (!state.isClosingTag && ['script', 'style', 'textarea', 'title'].includes(tagName)) {
				state.rawTextTag = tagName;
			}

			state.insideTag = false;
			state.tagName = '';
			state.readingTagName = false;
			state.isClosingTag = false;
			continue;
		}

		if (state.insideTag && state.readingTagName) {
			if (!state.tagName && (char === '/' || /\s/.test(char))) {
				continue;
			}

			if (/[A-Za-z0-9:-]/.test(char)) {
				state.tagName += char;
				continue;
			}

			if (state.tagName) {
				state.readingTagName = false;
			}
		}
	}
}

function prepareAttributeBindings(template: HTMLTemplateElement): void {
	const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);

	while (walker.nextNode()) {
		const element = walker.currentNode as Element;

		for (const attribute of Array.from(element.attributes)) {
			attributeMarkerPattern.lastIndex = 0;
			const parts: Array<string | number> = [];
			let lastIndex = 0;
			let match = attributeMarkerPattern.exec(attribute.value);

			while (match) {
				parts.push(attribute.value.slice(lastIndex, match.index));
				parts.push(Number(match[1]));
				lastIndex = match.index + match[0].length;
				match = attributeMarkerPattern.exec(attribute.value);
			}

			if (parts.length === 0) {
				continue;
			}

			parts.push(attribute.value.slice(lastIndex));
			const firstBinding = parts.find(part => typeof part === 'number');
			if (typeof firstBinding !== 'number') {
				continue;
			}

			element.removeAttribute(attribute.name);
			element.setAttribute(`data-revia-attr-${firstBinding}`, JSON.stringify({
				name: attribute.name,
				parts,
			}));
		}
	}
}

function compileAttributeDescriptor(name: string, value: string): { firstBinding: number, descriptor: string } | null {
	attributeMarkerPattern.lastIndex = 0;
	const parts: Array<string | number> = [];
	let lastIndex = 0;
	let match = attributeMarkerPattern.exec(value);

	while (match) {
		parts.push(value.slice(lastIndex, match.index));
		parts.push(Number(match[1]));
		lastIndex = match.index + match[0].length;
		match = attributeMarkerPattern.exec(value);
	}

	if (parts.length === 0) {
		return null;
	}

	parts.push(value.slice(lastIndex));
	const firstBinding = parts.find(part => typeof part === 'number');
	if (typeof firstBinding !== 'number') {
		return null;
	}

	return {
		firstBinding,
		descriptor: encodeURIComponent(JSON.stringify({ name, parts })),
	};
}

function sanitizeDynamicAttributes(markup: string): string {
	let result = '';
	let cursor = 0;

	while (cursor < markup.length) {
		const tagStart = markup.indexOf('<', cursor);
		if (tagStart < 0) {
			return result + markup.slice(cursor);
		}

		result += markup.slice(cursor, tagStart);

		if (markup.startsWith('<!--', tagStart)) {
			const commentEnd = markup.indexOf('-->', tagStart + 4);
			if (commentEnd < 0) {
				return result + markup.slice(tagStart);
			}

			result += markup.slice(tagStart, commentEnd + 3);
			cursor = commentEnd + 3;
			continue;
		}

		let tagEnd = tagStart + 1;
		let quote: '"' | '\'' | null = null;
		for (; tagEnd < markup.length; tagEnd += 1) {
			const char = markup[tagEnd]!;
			if (quote) {
				if (char === quote) {
					quote = null;
				}
				continue;
			}

			if (char === '"' || char === '\'') {
				quote = char;
				continue;
			}

			if (char === '>') {
				break;
			}
		}

		if (tagEnd === markup.length) {
			return result + markup.slice(tagStart);
		}

		const source = markup.slice(tagStart, tagEnd + 1);
		if (/^<\s*\//.test(source)) {
			result += source;
			cursor = tagEnd + 1;
			continue;
		}

		const sanitized = source.replace(
			/([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
			(attributeSource, attributeName: string, doubleQuoted: string | undefined, singleQuoted: string | undefined, unquoted: string | undefined) => {
				const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
				const compiled = compileAttributeDescriptor(attributeName, value);
				return compiled
					? `data-revia-attr-${compiled.firstBinding}="${compiled.descriptor}"`
					: attributeSource;
			},
		);

		result += sanitized;
		cursor = tagEnd + 1;
	}

	return result;
}

function compileTemplate(strings: TemplateStringsArray): HTMLTemplateElement {
	const cached = templateCache.get(strings);
	if (cached) {
		return cached;
	}

	let markup = '';
	const state = {
		insideTag: false,
		insideComment: false,
		quote: null as '"' | '\'' | null,
		rawTextTag: null as string | null,
		tagName: '',
		readingTagName: false,
		isClosingTag: false,
	};

	let pendingClosingQuote: '"' | '\'' | null = null;

	for (let index = 0; index < strings.length; index += 1) {
		let chunk = strings[index] ?? '';
		if (pendingClosingQuote && chunk.startsWith(pendingClosingQuote)) {
			chunk = chunk.slice(1);
			pendingClosingQuote = null;
		}
		markup += chunk;
		updateTagState(chunk, state);

		if (index === strings.length - 1) {
			continue;
		}

		if (!state.insideTag && !state.insideComment && !state.rawTextTag) {
			markup += `<!--revia_part_${index}-->`;
			continue;
		}

		const quotedExactAttribute = markup.match(/([^\s"'<>/=]+)\s*=\s*(["'])$/);
		const nextChunk = strings[index + 1] ?? '';
		if (state.insideTag && quotedExactAttribute && nextChunk.startsWith(quotedExactAttribute[3]!)) {
			const [attributeSource, attributeName, quote] = quotedExactAttribute;
			const descriptor = encodeURIComponent(JSON.stringify({
				name: attributeName,
				parts: ['', index, ''],
			}));
			markup = `${markup.slice(0, -attributeSource.length)}data-revia-attr-${index}="${descriptor}"`;
			state.quote = null;
			pendingClosingQuote = quote as '"' | '\'';
			continue;
		}

		const exactAttribute = markup.match(/([^\s"'<>/=]+)\s*=\s*$/);
		if (state.insideTag && exactAttribute) {
			const [attributeSource, attributeName] = exactAttribute;
			const descriptor = encodeURIComponent(JSON.stringify({
				name: attributeName,
				parts: ['', index, ''],
			}));
			markup = `${markup.slice(0, -attributeSource.length)}data-revia-attr-${index}="${descriptor}"`;
			continue;
		}

		const startsAttributeValue = /[^\s"'<>/=]+\s*=\s*(["'])?$/.test(chunk);
		if (state.insideTag && (state.quote || startsAttributeValue)) {
			markup += `__revia_attr_${index}__`;
			continue;
		}

		throw new SyntaxError(
			'[revia] Template expressions are supported only in text content or attribute values. '
			+ 'Dynamic tag names, comments, and raw-text elements are not supported.',
		);
	}

	const template = document.createElement('template');
	template.innerHTML = sanitizeDynamicAttributes(markup);
	prepareAttributeBindings(template);
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

function isExternalStyleSheet(styleEntry: StyleEntry): styleEntry is IExternalStyleSheet {
	return typeof styleEntry === 'object'
		&& styleEntry !== null
		&& 'reviaKind' in styleEntry
		&& styleEntry.reviaKind === 'css-file';
}

function isInlineStyleEntry(styleEntry: StyleEntry): styleEntry is string | ICssTemplate {
	return !isExternalStyleSheet(styleEntry);
}

function styleEntryToCssText(styleEntry: string | ICssTemplate): string {
	return typeof styleEntry === 'string' ? styleEntry : styleEntry.cssText;
}

function adaptCssForLightDom(cssText: string, tagName: string): string {
	return cssText
		.replace(/:host\b/g, tagName)
		.replace(/slot::slotted\(([^)]+)\)/g, `${tagName} [data-revia-slot] > $1`);
}

export function buildComponentStyles(owner: IReactiveRenderHost): Node[] {
	const entries = normalizeStyleEntries(owner.resolveStyles());
	const inlineEntries = entries.filter(isInlineStyleEntry);
	const externalEntries = entries.filter(isExternalStyleSheet);
	const styleNodes: Node[] = [];
	const cssText = inlineEntries
		.map(styleEntryToCssText)
		.filter(Boolean)
		.join('\n');

	for (const entry of externalEntries) {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = entry.href;
		styleNodes.push(link);
	}

	if (!cssText) {
		return styleNodes;
	}

	const styleElement = document.createElement('style');
	styleElement.textContent = owner.domMode === 'light'
		? adaptCssForLightDom(cssText, owner.localName)
		: cssText;
	styleNodes.push(styleElement);
	return styleNodes;
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
	const nextKeys = new Set<unknown>();

	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];
		const rendered = renderItem(item, index);
		const normalized = normalizeKeyedRenderable(rendered);
		const key = normalized.key;

		if (key !== null && key !== undefined) {
			if (nextKeys.has(key)) {
				console.warn(
					`[revia warn] Duplicate key "${String(key)}" on <${owner.debugLabel()}>. Keys must be unique within a list.`,
				);
			}

			nextKeys.add(key);
		}

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

		// A stable key and item identity means this range can move without remounting.
		// Recreating it on an index-only change defeats keyed DOM preservation.
		const shouldUpdate = !Object.is(itemState.identity, normalized.identity);

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
	warnDirectSignalBinding(binding, owner, label);

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
			const listener: EventListener = event => {
				withOwner(owner, () => eventHandler.call(element, event));
			};
			element.addEventListener(eventName, listener);
			cleanupBag.push(() => {
				element.removeEventListener(eventName, listener);
			});
		}

		return;
	}

	if (!name.startsWith('*')) {
		warnDirectSignalBinding(binding, owner, label);
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

	const applyBinding = () => {
		setBoundValue(element, name, resolveRenderable(binding));
	};

	element.removeAttribute(name);

	if (typeof binding === 'function') {
		createEffect(applyBinding, { owner, cleanupBag, label });
	} else {
		applyBinding();
	}
}

function mountCompoundAttributeBinding(
	target: AttributeTarget,
	values: readonly unknown[],
	owner: IReactiveRenderHost,
	cleanupBag: CleanupBag,
	label: string,
): void {
	if (target.name.startsWith('@') || target.name.startsWith(':') || target.name.startsWith('*')) {
		console.warn(
			`[revia warn] ${target.name} on <${owner.debugLabel()}> must contain exactly one binding.`,
		);
		return;
	}

	target.element.removeAttribute(target.name);
	const applyBinding = () => {
		const value = target.parts.map(part => {
			if (typeof part === 'string') {
				return part;
			}

			const binding = values[part];
			warnDirectSignalBinding(binding, owner, label);
			return String(resolveRenderable(binding) ?? '');
		}).join('');
		setBoundValue(target.element, target.name, value);
	};

	createEffect(applyBinding, { owner, cleanupBag, label });
}

function warnDirectSignalBinding(binding: unknown, owner: IReactiveRenderHost, label: string): void {
	if (!isReviaDevelopment() || !isSignal(binding) || warnedDirectSignals.has(binding)) {
		return;
	}

	warnedDirectSignals.add(binding);

	console.warn(
		`[revia warn] Direct signal binding at "${label}" on <${owner.debugLabel()}> is not reactive. Wrap the read in a function.`,
	);
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
	const attrTargets: AttributeTarget[] = [];

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
			const exactBinding = attribute.name.match(/^data-revia-attr-(\d+)$/);
			if (exactBinding) {
				let compiled: CompiledAttributeTarget | null = null;

				try {
					compiled = JSON.parse(attribute.value) as CompiledAttributeTarget;
				} catch {
					try {
						compiled = JSON.parse(decodeURIComponent(attribute.value)) as CompiledAttributeTarget;
					} catch {
						// Ignore user-authored attributes that happen to use Revia's reserved name.
					}
				}

				if (!compiled || typeof compiled.name !== 'string' || !Array.isArray(compiled.parts)) {
					continue;
				}

				attrTargets.push({
					element,
					name: compiled.name,
					parts: compiled.parts,
					isExactBinding: compiled.parts.length === 3
						&& compiled.parts[0] === ''
						&& typeof compiled.parts[1] === 'number'
						&& compiled.parts[2] === '',
				});
				continue;
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

	}

	for (const target of attrTargets) {
		const label = `${debugPath}:attr:${target.name}@${formatElementLabel(target.element)}`;
		const bindingIndex = target.parts.find(part => typeof part === 'number');

		if (typeof bindingIndex !== 'number') {
			continue;
		}

		if (target.isExactBinding) {
			target.element.removeAttribute(`data-revia-attr-${bindingIndex}`);
			mountAttributeBinding(target.element, target.name, values[bindingIndex], owner, cleanupBag, label);
			continue;
		}

		mountCompoundAttributeBinding(target, values, owner, cleanupBag, label);
	}
}

export function renderTemplate(
	result: ITemplateResult,
	owner: IReactiveRenderHost,
): { fragment: DocumentFragment, dispose: () => void } {
	return withOwner(owner, () => instantiateTemplate(result, owner));
}
