import {
	css,
	defineElement,
	defineProps,
	html,
	type PropsFromDefinition,
	ReactiveElement,
} from '@revia/core';

const counterProps = defineProps({
	value: { type: Number, default: 0, model: true },
	step: { type: Number, default: 1 },
	label: { type: String, default: 'Counter' },
});

type ICounterProps = PropsFromDefinition<typeof counterProps>;

type ICounterEvents = {
	counted: { value: number, delta: number },
};

export class RCounter extends ReactiveElement<ICounterProps, 'value', ICounterEvents> {
	public static override props = counterProps;

	public static override styles = css`
		:host { display: block; }
		.counter { display: grid; gap: 0.7rem; padding: 1rem; border: 1px solid #284655; border-radius: 0.8rem; background: #0b1922; }
		.header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: #9ec7df; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }
		.value { color: #f3f8fa; font: 500 2.75rem/1 Georgia, serif; }
		.actions { display: flex; gap: 0.5rem; }
		button { border: 0; border-radius: 0.5rem; padding: 0.55rem 0.75rem; background: #d6edf9; color: #10222c; font: inherit; cursor: pointer; }
		button:last-child { background: #263b47; color: #d9e9f0; }
	`;

	public render() {
		return html`
			<section class="counter">
				<div class="header"><slot name="label">${() => this.props.label}</slot><span>step ${() => this.props.step}</span></div>
				<div class="value">${() => this.props.value}</div>
				<div class="actions">
					<button @click=${() => this.change(this.props.step)}>Increase</button>
					<button @click=${() => this.change(-this.props.step)}>Decrease</button>
				</div>
			</section>
		`;
	}

	private change(delta: number): void {
		const value = this.props.value + delta;
		this.updateModel('value', value);
		this.emit('counted', { value, delta });
	}
}

defineElement('r-counter', RCounter);
