import { describe, expect, test } from 'bun:test';
import { cssFile } from './styles';
import { css } from './template';

describe('styles', () => {
	test('preserves ESM-safe external stylesheet URLs', () => {
		const href = new URL('./card.css', 'https://example.test/components/card.ts');
		expect(cssFile(href)).toEqual({
			reviaKind: 'css-file',
			href: 'https://example.test/components/card.css',
		});
	});

	test('joins nested CSS template values', () => {
		const shared = css`:host { display: block; }`;
		const styles = css`${shared} button { color: tomato; }`;
		expect(styles.cssText).toBe(':host { display: block; } button { color: tomato; }');
	});
});
