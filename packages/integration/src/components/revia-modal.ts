import { html, ReactiveElement, signal, when } from '@revia/core';

import { defineElement } from './define-element.js';

const modalStyles = `
	:host {
		display: contents;
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: 24px;
		background: rgba(4, 8, 12, 0.68);
		backdrop-filter: blur(14px);
	}

	.dialog {
		width: min(720px, calc(100vw - 32px));
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 28px;
		background:
			radial-gradient(circle at top right, rgba(100, 191, 255, 0.1), transparent 28%),
			linear-gradient(180deg, rgba(15, 20, 26, 0.98), rgba(10, 13, 18, 0.98));
		color: #edf3f8;
		box-shadow: 0 36px 120px rgba(0, 0, 0, 0.42);
		overflow: hidden;
	}

	.header,
	.content,
	.footer {
		padding: 22px 24px;
	}

	.header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1.45rem;
		line-height: 1.1;
	}

	.description {
		margin-top: 10px;
		color: #9eb0bf;
		line-height: 1.55;
	}

	.close {
		flex: none;
		width: 42px;
		height: 42px;
		border: 0;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: #edf3f8;
		font: inherit;
		font-size: 1.05rem;
		cursor: pointer;
	}

	.content {
		color: #c4d0db;
		line-height: 1.6;
	}

	.footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
`;

export class ReviaModal extends ReactiveElement {
	public static override styles = [modalStyles];

	public readonly descriptionSignal = signal('');

	public readonly openSignal = signal(false);

	public readonly titleSignal = signal('');

	public get description(): string {
		return this.descriptionSignal.value;
	}

	public set description(value: string) {
		this.descriptionSignal.value = value ?? '';
	}

	public get open(): boolean {
		return this.openSignal.value;
	}

	public set open(value: boolean) {
		this.openSignal.value = Boolean(value);
	}

	public override get title(): string {
		return this.titleSignal.value;
	}

	public override set title(value: string) {
		this.titleSignal.value = value ?? '';
	}

	public emitOpen(nextValue: boolean): void {
		this.dispatchEvent(new CustomEvent<boolean>('update:open', {
			bubbles: true,
			composed: true,
			detail: nextValue,
		}));
	}

	public close(): void {
		this.emitOpen(false);
	}

	public handleBackdropClick(event: Event): void {
		if (event.target === event.currentTarget) {
			this.close();
		}
	}

	public override render() {
		return html`
			${when(
				() => this.openSignal.value,
				html`
					<div class="overlay" @click=${(event: Event) => this.handleBackdropClick(event)}>
						<section class="dialog" aria-modal="true" role="dialog">
							<header class="header">
								<div>
									<h2>${() => this.titleSignal.value}</h2>
									${when(
										() => Boolean(this.descriptionSignal.value),
										html`<p class="description">${() => this.descriptionSignal.value}</p>`,
									)}
								</div>
								<button class="close" type="button" @click=${() => this.close()}>Close</button>
							</header>
							<div class="content">
								<slot></slot>
							</div>
							<footer class="footer">
								<slot name="footer"></slot>
							</footer>
						</section>
					</div>
				`,
			)}
		`;
	}
}

defineElement('revia-modal', ReviaModal);
