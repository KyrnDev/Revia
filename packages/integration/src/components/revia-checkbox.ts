import { html, ReactiveElement, signal } from '@revia/core';

import { defineElement } from './define-element.js';

const checkboxStyles = `
	:host {
		display: block;
	}

	label {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 14px;
		padding: 14px 16px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.03);
		cursor: pointer;
	}

	input {
		width: 18px;
		height: 18px;
		margin: 4px 0 0;
		accent-color: #ff9f6c;
	}

	.copy {
		display: grid;
		gap: 6px;
	}

	.title {
		color: #ebf1f8;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.hint {
		color: #8fa5b6;
		font-size: 0.86rem;
		line-height: 1.5;
	}
`;

export class ReviaCheckbox extends ReactiveElement {
	public static override styles = [checkboxStyles];

	public readonly checkedSignal = signal(false);

	public readonly hintSignal = signal('');

	public readonly labelSignal = signal('');

	public get checked(): boolean {
		return this.checkedSignal.value;
	}

	public set checked(value: boolean) {
		this.checkedSignal.value = Boolean(value);
	}

	public get hint(): string {
		return this.hintSignal.value;
	}

	public set hint(value: string) {
		this.hintSignal.value = value ?? '';
	}

	public get label(): string {
		return this.labelSignal.value;
	}

	public set label(value: string) {
		this.labelSignal.value = value ?? '';
	}

	public emitChecked(nextValue: boolean): void {
		this.dispatchEvent(new CustomEvent<boolean>('update:checked', {
			bubbles: true,
			composed: true,
			detail: nextValue,
		}));
	}

	public handleChange(event: Event): void {
		const target = event.target as HTMLInputElement | null;
		this.emitChecked(Boolean(target?.checked));
	}

	public override render() {
		return html`
			<label>
				<input
					type="checkbox"
					:checked=${() => this.checkedSignal.value}
					@change=${(event: Event) => this.handleChange(event)}
				>
				<div class="copy">
					<span class="title">${() => this.labelSignal.value}</span>
					<span class="hint">${() => this.hintSignal.value}</span>
				</div>
			</label>
		`;
	}
}

defineElement('revia-checkbox', ReviaCheckbox);
