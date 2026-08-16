import {
	derive,
	forEach,
	html,
	ReactiveElement,
	signal,
	when,
} from '@revia/core';

const appStyles = `
	:host {
		display: block;
		min-height: 0;
		color-scheme: dark;
		font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
		background:
			radial-gradient(circle at top left, rgba(255, 120, 84, 0.18), transparent 28%),
			radial-gradient(circle at top right, rgba(86, 176, 156, 0.16), transparent 30%),
			linear-gradient(180deg, #0f1418 0%, #0a0f13 100%);
		color: #edf3f8;
	}

	* {
		box-sizing: border-box;
	}

	.shell {
		width: min(980px, calc(100vw - 32px));
		margin: 0 auto;
		padding: 48px 0 72px;
	}

	.hero,
	.card {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 28px;
		background: rgba(16, 22, 28, 0.84);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
		backdrop-filter: blur(12px);
	}

	.hero {
		padding: 32px;
		margin-bottom: 24px;
	}

	.card {
		padding: 24px;
	}

	.stack {
		display: grid;
		gap: 24px;
	}

	.kicker {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		margin-bottom: 16px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #9bc7ff;
		font-size: 0.88rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		font-size: clamp(2.2rem, 4vw, 3.6rem);
		line-height: 1;
		margin-bottom: 14px;
	}

	.hero p,
	.note,
	.summary,
	ul {
		color: #b9c6d2;
		line-height: 1.6;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 14px;
		margin-top: 24px;
	}

	.metric {
		padding: 16px 18px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.metric strong {
		display: block;
		font-size: 1.7rem;
		color: #ffffff;
	}

	.panel-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 20px;
	}

	.panel {
		padding: 18px;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.panel h3 {
		margin: 0 0 10px;
		font-size: 1.05rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 18px;
	}

	button,
	input {
		font: inherit;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 12px 18px;
		cursor: pointer;
		background: #edf3f8;
		color: #10161b;
	}

	button.secondary {
		background: rgba(255, 255, 255, 0.08);
		color: #edf3f8;
	}

	label {
		display: grid;
		gap: 8px;
		margin-top: 12px;
		font-size: 0.95rem;
		color: #d7e1ea;
	}

	input[type='text'] {
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		padding: 12px 14px;
		background: rgba(8, 12, 16, 0.55);
		color: #edf3f8;
	}

	.tag-list {
		display: grid;
		gap: 10px;
		padding: 0;
		margin: 16px 0 0;
		list-style: none;
	}

	.tag {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 12px 14px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.05);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 7px 10px;
		border-radius: 999px;
		background: rgba(86, 176, 156, 0.15);
		color: #9ce1d0;
		font-size: 0.82rem;
	}

	.badge.warn {
		background: rgba(255, 120, 84, 0.16);
		color: #ffc3ae;
	}

	.counter-layout {
		display: grid;
		gap: 18px;
	}

	.counter {
		padding: 18px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.counter-value {
		font-size: 3.2rem;
		font-weight: 700;
		line-height: 1;
		margin: 12px 0;
	}

	.footer-note {
		margin-top: 18px;
		color: #8fa2b4;
		font-size: 0.92rem;
	}

	@media (max-width: 720px) {
		.shell {
			width: min(100vw - 20px, 980px);
			padding: 24px 0 40px;
		}

		.hero,
		.card {
			border-radius: 22px;
			padding: 20px;
		}
	}
`;

type CounterTag = {
	id: number,
	label: string,
};

class IntegrationCounter extends ReactiveElement {
	public static override styles = [appStyles];

	public readonly countSignal = signal(0);

	public readonly detailsVisible = signal(true);

	public get count(): number {
		return this.countSignal.value;
	}

	public set count(value: number) {
		if (Object.is(this.countSignal.peek(), value)) {
			return;
		}

		this.countSignal.value = value;
	}

	public emitCount(nextValue: number): void {
		this.dispatchEvent(new CustomEvent<number>('update:count', {
			bubbles: true,
			composed: true,
			detail: nextValue,
		}));
	}

	public increment(): void {
		this.emitCount(this.count + 1);
	}

	public reset(): void {
		this.emitCount(0);
	}

	public toggleDetails(): void {
		this.detailsVisible.value = !this.detailsVisible.peek();
	}

	public override render() {
		return html`
			<section class="counter">
				<slot name="eyebrow">
					<div class="kicker">Integration Child</div>
				</slot>
				<h2>
					<slot name="title">Counter</slot>
				</h2>
				<p class="note">
					<slot>
						This child component is mounted from a separate integration package and imports its
						base class plus reactivity utilities from <code>@revia/core</code>. The count itself
						is owned by the parent and synced down through a property binding.
					</slot>
				</p>
				<div class="counter-value">${() => this.countSignal.value}</div>
				<div class="controls">
					<button @click=${() => this.increment()}>Increment</button>
					<button class="secondary" @click=${() => this.reset()}>Reset</button>
					<button class="secondary" @click=${() => this.toggleDetails()}>
						${() => (this.detailsVisible.value ? 'Hide details' : 'Show details')}
					</button>
				</div>
				${when(
					() => this.detailsVisible.value,
					html`
						<p class="footer-note">
							Fine-grained bindings should keep this count text in sync:
							<strong>${() => this.countSignal.value}</strong>.
						</p>
					`,
					html`<p class="footer-note">Details hidden.</p>`,
				)}
			</section>
		`;
	}
}

class IntegrationApp extends ReactiveElement {
	public static override dom = 'light' as const;

	public static override styles = [appStyles];

	public readonly name = signal('Revia');

	public readonly count = signal(3);

	public readonly tags = signal<CounterTag[]>([
		{ id: 1, label: 'signals' },
		{ id: 2, label: 'fine-grained' },
		{ id: 3, label: 'custom-elements' },
	]);

	public readonly online = signal(true);

	public readonly nextTagId = signal(4);

	public readonly summary = derive(() => {
		return `${this.name.value} currently tracks ${this.tags.value.length} tags, the shared count is ${this.count.value}, and the app is ${this.online.value ? 'online' : 'offline'}.`;
	}, { label: 'derive:integration-summary' });

	public addTag(): void {
		const id = this.nextTagId.peek();
		this.nextTagId.value = id + 1;
		this.tags.value = [
			...this.tags.peek(),
			{ id, label: `tag-${id}` },
		];
	}

	public renameFirstTag(): void {
		if (this.tags.peek().length === 0) {
			return;
		}

		const nextTags = [...this.tags.peek()];
		const firstTag = nextTags[0];
		if (!firstTag) {
			return;
		}

		nextTags[0] = {
			...firstTag,
			label: `${firstTag.label}!`,
		};
		this.tags.value = nextTags;
	}

	public removeLastTag(): void {
		this.tags.value = this.tags.peek().slice(0, -1);
	}

	public toggleStatus(): void {
		this.online.value = !this.online.peek();
	}

	public updateName(event: Event): void {
		const target = event.target as HTMLInputElement | null;
		this.name.value = target?.value ?? '';
	}

	public incrementCount(): void {
		this.count.value = this.count.peek() + 1;
	}

	public resetCount(): void {
		this.count.value = 0;
	}

	public override render() {
		return html`
			<div class="shell">
				<section class="hero">
					<div class="kicker">Workspace integration test</div>
					<h1>@revia/core running through a real consumer package</h1>
					<p>
						This page lives in <code>packages/integration</code>, imports <code>@revia/core</code>
						through the workspace package boundary, and mounts a small app plus a child component.
						If this renders and updates correctly, the new monorepo layout is behaving.
					</p>

					<div class="metrics">
						<div class="metric">
							<strong>${() => this.tags.value.length}</strong>
							<span>Tracked tags</span>
						</div>
						<div class="metric">
							<strong>${() => this.name.value}</strong>
							<span>Current name signal</span>
						</div>
						<div class="metric">
							<strong>${() => this.count.value}</strong>
							<span>Shared counter state</span>
						</div>
						<div class="metric">
							<strong>${() => (this.online.value ? 'Live' : 'Paused')}</strong>
							<span>Boolean signal state</span>
						</div>
					</div>
				</section>

				<div class="stack">
					<section class="card">
						<h2>Reactive state</h2>
						<p class="summary">${() => this.summary.value}</p>

						<div class="panel-grid">
							<div class="panel">
								<h3>String + boolean signals</h3>
								<label>
									<span>Project name</span>
									<input
										type="text"
										:value=${() => this.name.value}
										@input=${(event: Event) => this.updateName(event)}
									>
								</label>
								<div class="controls">
									<button @click=${() => this.toggleStatus()}>
										${() => (this.online.value ? 'Go offline' : 'Go online')}
									</button>
								</div>
								<p class="footer-note">
									Status:
									<span class=${() => (this.online.value ? 'badge' : 'badge warn')}>
										${() => (this.online.value ? 'Online' : 'Offline')}
									</span>
								</p>
							</div>

							<div class="panel">
								<h3>Parent-owned shared count</h3>
								<p class="note">
									This signal lives in the parent component. The child counter receives it through
									<code>*count</code> and emits <code>update:count</code> events back up.
								</p>
								<div class="counter-value">${() => this.count.value}</div>
								<div class="controls">
									<button @click=${() => this.incrementCount()}>Increment from parent</button>
									<button class="secondary" @click=${() => this.resetCount()}>Reset from parent</button>
								</div>
							</div>

							<div class="panel">
								<h3>Array + keyed loop</h3>
								<p class="note">
									This list uses <code>forEach(..., keyBy)</code> so the consumer app is
									exercising the keyed reconciliation path from the packaged runtime.
								</p>
								<ul class="tag-list">
									${forEach(
										() => this.tags.value,
										tag => tag.id,
										tag => html`
											<li class="tag">
												<span>${() => tag.label}</span>
												<span class="badge">id ${tag.id}</span>
											</li>
										`,
									)}
								</ul>
								<div class="controls">
									<button @click=${() => this.addTag()}>Add tag</button>
									<button class="secondary" @click=${() => this.renameFirstTag()}>
										Rename first
									</button>
									<button class="secondary" @click=${() => this.removeLastTag()}>
										Remove last
									</button>
								</div>
							</div>
						</div>
					</section>

					<section class="card counter-layout">
						<integration-counter *count=${this.count}>
							<div slot="eyebrow" class="kicker">Child component slot test</div>
							<span slot="title">Counter mounted from the integration package</span>
							<p>
								This default slot content is projected into a child that extends
								<code>ReactiveElement</code> from <code>@revia/core</code>. Mutations in the
								child travel up through <code>update:count</code>, and parent mutations flow back
								down through the same property binding.
							</p>
						</integration-counter>
					</section>
				</div>
			</div>
		`;
	}
}

customElements.define('integration-counter', IntegrationCounter);
customElements.define('integration-app', IntegrationApp);
