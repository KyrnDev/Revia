import { html, ReactiveElement, signal } from '@revia/core';

import { defineElement } from './define-element.js';

const passwordStyles = `
	:host {
		display: block;
	}

	.field {
		display: grid;
		gap: 10px;
	}

	.label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.label {
		color: #ebf1f8;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.hint {
		color: #8fa5b6;
		font-size: 0.82rem;
	}

	.shell {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		padding: 8px;
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 18px;
		background: rgba(10, 14, 19, 0.8);
		transition:
			border-color 160ms ease,
			box-shadow 160ms ease,
			background 160ms ease;
	}

	.shell:focus-within {
		border-color: rgba(145, 204, 255, 0.72);
		box-shadow: 0 0 0 4px rgba(145, 204, 255, 0.12);
		background: rgba(14, 19, 25, 0.94);
	}

	input {
		width: 100%;
		min-height: 38px;
		padding: 0 8px;
		border: 0;
		background: transparent;
		color: #edf3f8;
		font: inherit;
		outline: none;
	}

	input::placeholder {
		color: #667a89;
	}

	button {
		min-width: 92px;
		border: 0;
		border-radius: 999px;
		padding: 10px 14px;
		background: rgba(255, 255, 255, 0.08);
		color: #edf3f8;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}
`;

export class ReviaPassword extends ReactiveElement {
	public static override styles = [passwordStyles];

	public readonly autocompleteSignal = signal('current-password');

	public readonly hintSignal = signal('');

	public readonly labelSignal = signal('');

	public readonly placeholderSignal = signal('');

	public readonly revealSignal = signal(false);

	public readonly valueSignal = signal('');

	public get autocomplete(): string {
		return this.autocompleteSignal.value;
	}

	public set autocomplete(value: string) {
		this.autocompleteSignal.value = value || 'current-password';
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

	public get placeholder(): string {
		return this.placeholderSignal.value;
	}

	public set placeholder(value: string) {
		this.placeholderSignal.value = value ?? '';
	}

	public get value(): string {
		return this.valueSignal.value;
	}

	public set value(value: string) {
		this.valueSignal.value = value ?? '';
	}

	public emitValue(nextValue: string): void {
		this.dispatchEvent(new CustomEvent<string>('update:value', {
			bubbles: true,
			composed: true,
			detail: nextValue,
		}));
	}

	public handleInput(event: Event): void {
		const target = event.target as HTMLInputElement | null;
		this.emitValue(target?.value ?? '');
	}

	public toggleReveal(): void {
		this.revealSignal.value = !this.revealSignal.peek();
	}

	public override render() {
		return html`
			<label class="field">
				<div class="label-row">
					<span class="label">${() => this.labelSignal.value}</span>
					<span class="hint">${() => this.hintSignal.value}</span>
				</div>
				<div class="shell">
					<input
						:autocomplete=${() => this.autocompleteSignal.value}
						:type=${() => (this.revealSignal.value ? 'text' : 'password')}
						:placeholder=${() => this.placeholderSignal.value}
						:value=${() => this.valueSignal.value}
						@input=${(event: Event) => this.handleInput(event)}
					>
					<button type="button" @click=${() => this.toggleReveal()}>
						${() => (this.revealSignal.value ? 'Hide' : 'Show')}
					</button>
				</div>
			</label>
		`;
	}
}

defineElement('revia-password', ReviaPassword);
