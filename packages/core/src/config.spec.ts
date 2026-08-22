import { afterEach, describe, expect, test } from 'bun:test';
import { configureRevia, isReviaDevelopment } from './config';

afterEach(() => {
	configureRevia({ development: true });
});

describe('runtime configuration', () => {
	test('switches development diagnostics on and off explicitly', () => {
		expect(isReviaDevelopment()).toBeTrue();
		configureRevia({ development: false });
		expect(isReviaDevelopment()).toBeFalse();
		configureRevia({ development: true });
		expect(isReviaDevelopment()).toBeTrue();
	});
});
