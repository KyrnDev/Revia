import { html, ReactiveElement, signal } from '@revia/core';

import { defineElement } from './define-element.js';

const buttonStyles = `
	:host {
		display: inline-flex;
	}

	button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		min-height: 48px;
		padding: 0 18px;
		border: 0;
		border-radius: 999px;
		font: inherit;
		font-weight: 600;
		letter-spacing: 0.01em;
		cursor: pointer;
		transition:
			transform 180ms ease,
			opacity 180ms ease,
			background 180ms ease,
			box-shadow 180ms ease;
	}

	button:hover {
		transform: translateY(-1px);
	}

	button:active {
		transform: translateY(0);
	}

	button:disabled {
		opacity: 0.48;
		cursor: not-allowed;
		transform: none;
	}

	button[data-variant='primary'] {
		background:
			linear-gradient(135deg, rgba(255, 139, 92, 1), rgba(255, 210, 122, 0.96));
		color: #170e0b;
		box-shadow: 0 16px 30px rgba(255, 139, 92, 0.22);
	}

	button[data-variant='secondary'] {
		background: rgba(255, 255, 255, 0.08);
		color: #edf3f8;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}

	button[data-variant='ghost'] {
		background: transparent;
		color: #9ccaff;
		box-shadow: inset 0 0 0 1px rgba(156, 202, 255, 0.18);
	}

	:host([full-width]),
	button[data-full-width='true'] {
		width: 100%;
	}
`;

export class ReviaButton extends ReactiveElement {
	public static override styles = [buttonStyles];

	public readonly disabledSignal = signal(false);

	public readonly fullWidthSignal = signal(false);

	public readonly variantSignal = signal('primary');

	public get disabled(): boolean {
		return this.disabledSignal.value;
	}

	public set disabled(value: boolean) {
		this.disabledSignal.value = Boolean(value);
	}

	public get fullWidth(): boolean {
		return this.fullWidthSignal.value;
	}

	public set fullWidth(value: boolean) {
		this.fullWidthSignal.value = Boolean(value);
	}

	public get variant(): string {
		return this.variantSignal.value;
	}

	public set variant(value: string) {
		this.variantSignal.value = value || 'primary';
	}

	public override render() {
		return html`
			<button
				type="button"
				:disabled=${() => this.disabledSignal.value}
				data-variant="${() => this.variantSignal.value}"
				data-full-width="${() => String(this.fullWidthSignal.value)}"
			>
				<slot></slot>
			</button>
		`;
	}
}

defineElement('revia-button', ReviaButton);
