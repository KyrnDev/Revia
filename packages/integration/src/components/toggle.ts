import {
	css,
	defineElement,
	defineProps,
	html,
	type PropsFromDefinition,
	ReactiveElement,
} from '@revia/core';

const toggleProps = defineProps({
	checked: { type: Boolean, default: false, model: true },
	label: { type: String, default: 'Enabled' },
});

type IToggleProps = PropsFromDefinition<typeof toggleProps>;
type IToggleEvents = { toggled: boolean };

export class RToggle extends ReactiveElement<IToggleProps, 'checked', IToggleEvents> {
	public static override props = toggleProps;

	public static override styles = css`
		:host { display: block; }
		button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid #284655; border-radius: 0.75rem; padding: 0.75rem; background: #0b1922; color: #dcebf0; font: inherit; cursor: pointer; text-align: left; }
		.label { display: grid; gap: 0.2rem; }
		.label strong { font-size: 0.88rem; font-weight: 600; }
		.label small { color: #8eabb9; font-size: 0.72rem; }
		.track { width: 2.5rem; height: 1.35rem; border-radius: 99rem; padding: 0.18rem; background: #314854; transition: background 160ms ease; }
		.thumb { display: block; width: 0.99rem; height: 0.99rem; border-radius: 50%; background: #cedce3; transition: transform 160ms ease; }
		button[aria-pressed="true"] .track { background: #5aaee0; }
		button[aria-pressed="true"] .thumb { transform: translateX(1.15rem); background: #f4fbff; }
	`;

	public render() {
		return html`
			<button aria-pressed=${() => this.props.checked} @click=${this.toggle}>
				<span class="label"><strong>${() => this.props.label}</strong><small>${() => this.props.checked ? 'Recording child activity' : 'Activity feed is paused'}</small></span>
				<span class="track"><span class="thumb"></span></span>
			</button>
		`;
	}

	private toggle = (): void => {
		const checked = !this.props.checked;
		this.updateModel('checked', checked);
		this.emit('toggled', checked);
	};
}

defineElement('r-toggle', RToggle);
