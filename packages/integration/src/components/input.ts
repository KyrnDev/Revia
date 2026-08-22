import {
	css,
	defineElement,
	defineProps,
	derive,
	type DomMode,
	forEach,
	html,
	type ISignal,
	type PropsFromDefinition,
	ReactiveElement,
	signal,
	when,
} from '@revia/core';

type IMessage = {
	id: string,
	text: string,
};

const inputProps = defineProps({
	value: {
		type: String,
		default: '',
		model: true,
		readonly: true,
	},
	name: {
		type: String,
		default: 'field',
		reflect: true,
	},
	label: {
		type: String,
		default: 'Example input',
	},
	disabled: {
		type: Boolean,
		default: false,
		reflect: true,
	},
	messages: {
		type: Array,
		default: () => [] as IMessage[],
	},
});

type IInputProps = PropsFromDefinition<typeof inputProps>;

export class RInput extends ReactiveElement<IInputProps, 'value'> {
	public static override dom: DomMode = 'shadow';

	public static override props = inputProps;

	public focused!: ISignal<boolean>;

	public inputLength!: ISignal<number>;

	public summary!: ISignal<string>;

	public override styles = () => css`
		:host {
			display: block;
			--input-accent: ${this.focused.value ? '#8cc8ff' : '#778899'};
		}

		.r-input {
			display: grid;
			gap: 0.45rem;
			color: #dfe8ef;
		}

		input {
			border: 1px solid var(--input-accent);
			border-radius: 0.5rem;
			padding: 0.7rem 0.8rem;
			background: #10171d;
			color: inherit;
		}

		.messages {
			margin: 0;
			padding-left: 1.25rem;
			color: #ffb4a8;
		}
	`;

	protected override setup(): void {
		// Signals made here are automatically disposed with the component.
		this.focused = signal(false);
		this.inputLength = derive(() => this.props.value.length);
		this.summary = derive(() => `${this.inputLength.value} characters`);
	}

	public override created(): void {
		// Props and setup state are ready here, before the first connection.
	}

	public override connected(): void {
		// The template has been committed to renderRoot here.
	}

	public override updated(): void {
		// Reactive DOM bindings have committed for the current microtask batch.
	}

	public override disconnected(): void {
		// The element was removed but may be connected again later.
	}

	public override disposed(): void {
		// dispose() has made this instance permanently unavailable.
	}

	public async focusInput(): Promise<void> {
		this.focused.value = true;
		await this.afterUpdate();
		this.renderRoot.querySelector('input')?.focus();
	}

	public render() {
		return html`
			<label class="r-input r-input--${() => this.focused.value ? 'focused' : 'idle'}">
				<slot name="label">
					<span>${() => this.props.label}</span>
				</slot>

				<input
					name=${() => this.props.name}
					value=${() => this.props.value}
					disabled=${() => this.props.disabled}
					aria-label="${() => this.props.label} (${() => this.summary.value})"
					@focus=${() => { this.focused.value = true; }}
					@blur=${() => { this.focused.value = false; }}
					@input=${this.handleInput}
				/>

				<slot name="help">
					<small>${() => this.summary.value}</small>
				</slot>

				${when(
					() => this.props.messages.length > 0,
					html`
						<ul class="messages">
							${forEach(
								() => this.props.messages,
								message => message.id,
								message => html`<li>${message.text}</li>`,
							)}
						</ul>
					`,
				)}
			</label>
		`;
	}

	private handleInput = (event: Event): void => {
		const input = event.currentTarget as HTMLInputElement;
		this.updateModel('value', input.value);
	};
}

defineElement('r-input', RInput);

/*
Parent model binding:

html`<r-input *value=${this.name}></r-input>`;

Class-field resources are created after the base constructor, so own them explicitly:

public timerState = this.own(signal(0));

Useful component controls:

component.freeze();
component.resume();
component.move(document.querySelector('#portal')!);
const copy = component.clone();
component.dispose();
*/
