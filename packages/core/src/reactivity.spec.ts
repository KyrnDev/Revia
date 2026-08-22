import { describe, expect, test } from 'bun:test';
import { afterReactiveFlush, effect, signal, withOwner } from './reactivity';

describe('signals', () => {
	test('tracks nested properties independently', async () => {
		const profile = signal({ name: 'Avery', active: true });
		let runs = 0;
		const stop = effect(() => {
			profile.value.name;
			runs += 1;
		});

		profile.value.active = false;
		await afterReactiveFlush();
		expect(runs).toBe(1);

		profile.value.name = 'Taylor';
		await afterReactiveFlush();
		expect(runs).toBe(2);
		stop();
	});

	test('batches repeated writes into one effect execution', async () => {
		const count = signal(0);
		let runs = 0;
		const stop = effect(() => {
			count.value;
			runs += 1;
		});

		count.value += 1;
		count.value += 1;
		count.value += 1;
		await afterReactiveFlush();
		expect(runs).toBe(2);
		stop();
	});

	test('clones circular data while retaining symbols and functions', () => {
		const token = Symbol('token');
		const handler = () => 'ok';
		const source: {
			name: string,
			self?: unknown,
			[token]: () => string,
		} = {
			name: 'source',
			[token]: handler,
		};
		source.self = source;

		const cloned = signal(source).clone().value;
		expect(cloned).not.toBe(source);
		expect(cloned.self).toBe(cloned);
		expect(cloned[token]).toBe(handler);
	});

	test('defers owned reactive work while frozen', async () => {
		const deferredWork = new Set<() => void>();
		let frozen = true;
		const owner = {
			ownedResources: new Set<{ dispose: () => void }>(),
			isFrozen: () => frozen,
			deferReactiveWork: (work: () => void) => deferredWork.add(work),
		};
		const count = signal(0);
		let runs = 0;

		const stop = withOwner(owner, () => effect(() => {
			count.value;
			runs += 1;
		}));

		expect(runs).toBe(0);
		frozen = false;
		for (const work of deferredWork) {
			work();
		}
		await afterReactiveFlush();
		expect(runs).toBe(1);

		count.value += 1;
		await afterReactiveFlush();
		expect(runs).toBe(2);
		stop();
	});

	test('tracks object iteration and collection dependencies precisely', async () => {
		const state = signal<{
			profile: { name: string, active?: boolean },
			lookup: Map<string, number>,
			selected: Set<string>,
		}>({
			profile: { name: 'Avery' },
			lookup: new Map([['first', 1]]),
			selected: new Set(['a']),
		});
		let profileKeysRuns = 0;
		let firstValueRuns = 0;
		let lookupSizeRuns = 0;
		let selectedRuns = 0;

		const stops = [
			effect(() => {
				Object.keys(state.value.profile);
				profileKeysRuns += 1;
			}),
			effect(() => {
				state.value.lookup.get('first');
				firstValueRuns += 1;
			}),
			effect(() => {
				state.value.lookup.size;
				lookupSizeRuns += 1;
			}),
			effect(() => {
				state.value.selected.has('a');
				selectedRuns += 1;
			}),
		];

		state.value.profile.active = true;
		state.value.lookup.set('second', 2);
		state.value.selected.add('b');
		await afterReactiveFlush();

		expect(profileKeysRuns).toBe(2);
		expect(firstValueRuns).toBe(1);
		expect(lookupSizeRuns).toBe(2);
		expect(selectedRuns).toBe(1);

		state.value.lookup.set('first', 3);
		state.value.selected.delete('a');
		await afterReactiveFlush();

		expect(firstValueRuns).toBe(2);
		expect(lookupSizeRuns).toBe(3);
		expect(selectedRuns).toBe(2);
		stops.forEach(stop => stop());
	});

	test('tracks map key iteration separately from values and handles clear', async () => {
		const state = signal({ lookup: new Map([['first', 1]]) });
		let keyRuns = 0;
		let valueRuns = 0;

		const stopKeys = effect(() => {
			[...state.value.lookup.keys()];
			keyRuns += 1;
		});
		const stopValues = effect(() => {
			[...state.value.lookup.values()];
			valueRuns += 1;
		});

		state.value.lookup.set('first', 2);
		await afterReactiveFlush();
		expect(keyRuns).toBe(1);
		expect(valueRuns).toBe(2);

		state.value.lookup.clear();
		await afterReactiveFlush();
		expect(keyRuns).toBe(2);
		expect(valueRuns).toBe(3);
		stopKeys();
		stopValues();
	});

	test('notifies subscribers for nested writes and stops after disposal', () => {
		const profile = signal({ name: 'Avery' });
		const values: string[] = [];
		const unsubscribe = profile.subscribe(value => values.push(value.name));

		profile.value.name = 'Taylor';
		unsubscribe();
		profile.value.name = 'Morgan';
		profile.dispose();
		profile.value = { name: 'Ignored' };

		expect(values).toEqual(['Taylor']);
	});

	test('treats mutable built-ins and class instances as assignment-reactive values', async () => {
		class Counter {
			public value = 0;
		}

		const date = new Date('2026-01-01T00:00:00.000Z');
		const counter = new Counter();
		const state = signal({ date, counter });
		let runs = 0;
		const stop = effect(() => {
			state.value.date;
			state.value.counter;
			runs += 1;
		});

		expect(state.value.date.getUTCFullYear()).toBe(2026);
		expect(state.value.counter).toBe(counter);
		state.value.date.setUTCFullYear(2027);
		state.value.counter.value = 1;
		await afterReactiveFlush();
		expect(runs).toBe(1);

		state.value = { date: new Date('2028-01-01T00:00:00.000Z'), counter: new Counter() };
		await afterReactiveFlush();
		expect(runs).toBe(2);
		stop();
	});
});
