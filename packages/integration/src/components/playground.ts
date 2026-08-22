import {
	css,
	defineElement,
	derive,
	forEach,
	html,
	keyed,
	ReactiveElement,
	signal,
	when,
	type ISignal,
} from '@revia/core';

type IActivity = { id: number, text: string };

export class RPlayground extends ReactiveElement {
	public count!: ISignal<number>;
	public enabled!: ISignal<boolean>;
	public name!: ISignal<string>;
	public activity!: ISignal<IActivity[]>;
	public summary!: ISignal<string>;

	public static override styles = css`
		:host { display: block; }
		.playground { display: grid; gap: 1rem; }
		.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
		.summary { margin: 0; color: #9ec7df; font-size: 0.86rem; line-height: 1.6; }
		.feed { display: grid; gap: 0.65rem; padding: 1rem; border: 1px solid #284655; border-radius: 0.8rem; background: linear-gradient(135deg, #0b1922, #0d202b); }
		.feed-header { display: flex; align-items: center; justify-content: space-between; color: #dcebf0; font-size: 0.76rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
		.status { border-radius: 99rem; padding: 0.2rem 0.45rem; background: #263b47; color: #9ec7df; font-size: 0.63rem; }
		.status--live { background: #194d42; color: #92e4c9; }
		.activity { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
		.activity li { padding: 0.6rem 0.7rem; border-left: 2px solid #5aaee0; background: rgb(6 15 21 / 62%); color: #cbdde5; font-size: 0.8rem; line-height: 1.45; }
		.empty { margin: 0; color: #8eabb9; font-size: 0.8rem; line-height: 1.5; }
		@media (max-width: 38rem) { .grid { grid-template-columns: 1fr; } }
	`;

	protected override setup(): void {
		this.count = signal(2);
		this.enabled = signal(false);
		this.name = signal('Revia playground');
		this.activity = signal([]);
		this.summary = derive(() => `${this.name.value || 'Untitled'} has a count of ${this.count.value} and is ${this.enabled.value ? 'enabled' : 'paused'}.`);
	}

	public render() {
		return html`
			<section class="playground">
				<div class="grid">
					<r-counter *value=${this.count} :step=${2} @counted=${this.recordCount}>
						<span slot="label">Nested model</span>
					</r-counter>
					<r-toggle *checked=${this.enabled} label="Activity feed" @toggled=${this.recordToggle}></r-toggle>
				</div>

				<r-input *value=${this.name} name="playground-name" @update:value=${this.recordName}>
					<span slot="label">Nested r-input model</span>
					<small slot="help">The parent signal owns this value while the child owns focus state.</small>
				</r-input>

				<p class="summary">${() => this.summary.value}</p>
				<section class="feed">
					<div class="feed-header">Child activity <span class="status ${() => this.enabled.value ? 'status--live' : ''}">${() => this.enabled.value ? 'Live' : 'Paused'}</span></div>
					${when(
						() => this.enabled.value && this.activity.value.length > 0,
						html`<ul class="activity">${forEach(() => this.activity.value, item => item.id, item => keyed(item.id, html`<li>${item.text}</li>`, item))}</ul>`,
						html`<p class="empty">${() => this.enabled.value ? 'Interact with the counter or input to see child events arrive here.' : 'Enable the feed to record child events.'}</p>`,
					)}
				</section>
			</section>
		`;
	}

	private recordCount = (event: Event): void => {
		const detail = (event as CustomEvent<{ value: number, delta: number }>).detail;
		this.addActivity(`Counter emitted ${detail.delta > 0 ? '+' : ''}${detail.delta}; value is now ${detail.value}.`);
	};

	private recordToggle = (event: Event): void => {
		this.addActivity(`Toggle emitted ${String((event as CustomEvent<boolean>).detail)}.`);
	};

	private recordName = (event: Event): void => {
		const value = (event as CustomEvent<string>).detail;
		this.addActivity(`Input model updated to "${value || 'empty'}".`);
	};

	private addActivity(text: string): void {
		const id = Date.now() + this.activity.value.length;
		this.activity.value = [{ id, text }, ...this.activity.value].slice(0, 4);
	}
}

defineElement('r-playground', RPlayground);
