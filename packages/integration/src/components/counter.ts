import { ReactiveElement, html, signal } from '@revia/core';
import styles from './counter.css';

export class Counter extends ReactiveElement {
	public static override dom = 'light' as const;
	public static override styles = [styles];
	public readonly count = signal(0);

	public increment() {
		this.count.value++;
	}

	public decrement() {
		this.count.value--;
	}

	public override created() {
		console.log('Counter created');
	}

	public override connected() {
		console.log('Counter connected');
	}

	public override disconnected() {
		console.log('Counter disconnected');
	}

	public override updated() {
		console.log('Counter updated');
	}

	public override disposed() {
		console.log('Counter disposed');
	}

	public render() {
		return html`
			<div>
				<button @click=${() => this.decrement()}>Decrement</button>
				<span>${() => this.count.value}</span>
				<button @click=${() => this.increment()}>Increment</button>
			</div>
		`;
	}
};

customElements.define('my-counter', Counter);
