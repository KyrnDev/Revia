import { html, ReactiveElement, signal, when } from '@revia/core';

import { defineElement } from './define-element.js';

const textareaStyles = `
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

	textarea {
		width: 100%;
		min-height: 168px;
		padding: 14px 16px;
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 18px;
		background: rgba(10, 14, 19, 0.8);
		color: #edf3f8;
		font: inherit;
		line-height: 1.55;
		resize: vertical;
		outline: none;
		transition:
			border-color 160ms ease,
			box-shadow 160ms ease,
			background 160ms ease;
	}

	textarea::placeholder {
		color: #667a89;
	}

	textarea:focus {
		border-color: rgba(145, 204, 255, 0.72);
		box-shadow: 0 0 0 4px rgba(145, 204, 255, 0.12);
		background: rgba(14, 19, 25, 0.94);
	}

	textarea[data-invalid='true'] {
		border-color: rgba(255, 116, 95, 0.82);
		box-shadow: 0 0 0 4px rgba(255, 116, 95, 0.1);
	}
`;

export class ReviaTextarea extends ReactiveElement {
	public static override styles = [textareaStyles];

	public readonly hintSignal = signal('');

	public readonly invalidSignal = signal(false);

	public readonly labelSignal = signal('');

	public readonly placeholderSignal = signal('');

	public readonly valueSignal = signal('');

	public get hint(): string {
		return this.hintSignal.value;
	}

	public set hint(value: string) {
		this.hintSignal.value = value ?? '';
	}

	public get invalid(): boolean {
		return this.invalidSignal.value;
	}

	public set invalid(value: boolean) {
		this.invalidSignal.value = Boolean(value);
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
		const target = event.target as HTMLTextAreaElement | null;
		this.emitValue(target?.value ?? '');
	}

	public override render() {
		return html`
			<label class="field">
				<div class="label-row">
					<span class="label">${() => this.labelSignal.value}</span>
					${when(
						() => Boolean(this.hintSignal.value),
						html`<span class="hint">${() => this.hintSignal.value}</span>`,
					)}
				</div>
				<textarea
					:placeholder=${() => this.placeholderSignal.value}
					:value=${() => this.valueSignal.value}
					data-invalid="${() => String(this.invalidSignal.value)}"
					@input=${(event: Event) => this.handleInput(event)}
				></textarea>
			</label>
		`;
	}
}

defineElement('revia-textarea', ReviaTextarea);
