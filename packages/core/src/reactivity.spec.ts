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
});
