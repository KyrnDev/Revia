import type { ITheme, ISize } from '../types/theme';
import { createElement, cssFile, derive, html, signal } from '@revia/core';
import { validateTheme, validateSize } from '../validators/theme';

export const RButton = createElement('r-button', ({ prop }) => {
	const label = prop('label', String, '');
	const theme = prop<ITheme>('theme', {
		type: String,
		default: 'primary',
		reflect: true,
		validator: validateTheme,
	});
	const size = prop<ISize>('size', {
		type: String,
		default: 'md',
		reflect: true,
		validator: validateSize,
	});
	const pressCount = signal(0);
	const classes = derive(() => {
		return `r-button r-button--${theme.value} r-button--${size.value}`;
	});
	const increment = () => {
		pressCount.value += 1;
	};

	return html`
		<button
			type="button"
			class=${() => classes.value}
			@click=${increment}
		>
			<slot>
				${() => label.value}
			</slot>
		</button>
	`;
}, {
	props: {
		label: { type: String, default: '' },
		theme: {
			type: String,
			default: 'primary',
			reflect: true,
			validator: validateTheme,
		},
		size: {
			type: String,
			default: 'md',
			reflect: true,
			validator: validateSize,
		},
	},
	styles: [
		cssFile(new URL('./button.css', import.meta.url)),
	],
});
