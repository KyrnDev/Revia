import {
	derive,
	forEach,
	html,
	ReactiveElement,
	signal,
	when,
} from '@revia/core';

import { defineElement } from './components/define-element.js';

interface IChecklistItem {
	id: string,
	label: string,
}

const checklistItems: IChecklistItem[] = [
	{ id: 'signals', label: 'Signal-backed fields flowing through custom elements' },
	{ id: 'events', label: 'update:value / update:checked events moving data back up' },
	{ id: 'modal', label: 'A modal component driven by parent-owned state' },
	{ id: 'compose', label: 'Multiple components assembled into one polished page' },
];

const contactStyles = `
	:host {
		--page-bg: #091015;
		--panel-bg: rgba(13, 18, 24, 0.88);
		--panel-line: rgba(255, 255, 255, 0.08);
		--muted: #95a7b7;
		--copy: #edf3f8;
		--warm: #ff9f6c;
		--cool: #7bc7ff;
		display: block;
		min-height: 100vh;
		color-scheme: dark;
		font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
		background:
			radial-gradient(circle at top left, rgba(255, 159, 108, 0.2), transparent 28%),
			radial-gradient(circle at 80% 10%, rgba(123, 199, 255, 0.14), transparent 26%),
			radial-gradient(circle at bottom right, rgba(85, 204, 173, 0.12), transparent 24%),
			linear-gradient(180deg, #0b1015 0%, #070b0f 100%);
		color: var(--copy);
	}

	* {
		box-sizing: border-box;
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	.page {
		width: min(1160px, calc(100vw - 28px));
		margin: 0 auto;
		padding: 28px 0 56px;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 22px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.06);
		color: #dce8f3;
		font-size: 0.88rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
		gap: 22px;
		margin-bottom: 22px;
	}

	.hero-panel,
	.form-panel,
	.side-panel {
		border: 1px solid var(--panel-line);
		border-radius: 30px;
		background: var(--panel-bg);
		box-shadow: 0 34px 90px rgba(0, 0, 0, 0.28);
		backdrop-filter: blur(18px);
	}

	.hero-panel {
		padding: 30px;
		background:
			radial-gradient(circle at top right, rgba(123, 199, 255, 0.12), transparent 28%),
			radial-gradient(circle at left center, rgba(255, 159, 108, 0.12), transparent 26%),
			var(--panel-bg);
	}

	.kicker {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border-radius: 999px;
		margin-bottom: 18px;
		background: rgba(255, 255, 255, 0.06);
		color: #9ccaff;
		font-size: 0.84rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	h1 {
		font-size: clamp(2.4rem, 4vw, 4.5rem);
		line-height: 0.95;
		max-width: 10ch;
		margin-bottom: 16px;
	}

	.hero-copy {
		max-width: 60ch;
		color: #c1ced9;
		line-height: 1.7;
		font-size: 1rem;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
		margin-top: 22px;
	}

	.metric {
		padding: 16px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.metric strong {
		display: block;
		font-size: 1.8rem;
		line-height: 1;
		margin-bottom: 8px;
	}

	.metric span {
		color: var(--muted);
		font-size: 0.92rem;
	}

	.side-panel {
		padding: 22px;
		display: grid;
		gap: 18px;
	}

	.side-panel h2 {
		font-size: 1.1rem;
	}

	.side-copy,
	.support-copy,
	.banner {
		color: #b7c5d1;
		line-height: 1.65;
	}

	.progress-shell {
		display: grid;
		gap: 10px;
	}

	.progress-bar {
		height: 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(135deg, var(--warm), #ffd277 58%, #a2dcff 100%);
	}

	.checklist {
		display: grid;
		gap: 10px;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.checklist li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 10px;
		padding: 12px 0;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		color: #dbe6ef;
	}

	.checklist li:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.checkmark {
		display: inline-grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 999px;
		background: rgba(123, 199, 255, 0.16);
		color: #a9dcff;
		font-size: 0.85rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
		gap: 22px;
		align-items: start;
	}

	.form-panel {
		padding: 28px;
	}

	.section-head {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 22px;
	}

	.section-head p {
		color: var(--muted);
		max-width: 46ch;
		line-height: 1.6;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px;
	}

	.full {
		grid-column: 1 / -1;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 22px;
	}

	.note-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		color: var(--muted);
		font-size: 0.84rem;
	}

	.side-card {
		padding: 22px;
		border-radius: 28px;
		border: 1px solid var(--panel-line);
		background: rgba(12, 18, 24, 0.9);
		box-shadow: 0 26px 60px rgba(0, 0, 0, 0.24);
	}

	.side-card + .side-card {
		margin-top: 18px;
	}

	.field-stack {
		display: grid;
		gap: 14px;
	}

	.summary-grid {
		display: grid;
		gap: 10px;
		margin-top: 14px;
	}

	.summary-row {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 14px;
		padding: 12px 0;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.summary-row:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.summary-row strong {
		color: #eef5fb;
		font-size: 0.94rem;
	}

	.summary-row span {
		max-width: 60%;
		color: #9eb0bf;
		text-align: right;
		line-height: 1.55;
	}

	.banner {
		padding: 14px 16px;
		border-radius: 20px;
		background: rgba(86, 204, 173, 0.1);
		border: 1px solid rgba(86, 204, 173, 0.18);
	}

	.review-copy {
		display: grid;
		gap: 14px;
	}

	.review-box {
		padding: 14px 16px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.05);
		color: #c3d0db;
		white-space: pre-wrap;
	}

	.modal-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		width: 100%;
		justify-content: flex-end;
	}

	@media (max-width: 980px) {
		.hero,
		.layout {
			grid-template-columns: 1fr;
		}

		.metric-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.page {
			width: min(100vw - 18px, 1160px);
			padding: 18px 0 28px;
		}

		.hero-panel,
		.form-panel,
		.side-panel,
		.side-card {
			border-radius: 24px;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.section-head {
			flex-direction: column;
			align-items: start;
		}
	}
`;

export class ContactFormApp extends ReactiveElement {
	public static override styles = [contactStyles];

	public readonly accessCode = signal('');

	public readonly company = signal('');

	public readonly consent = signal(false);

	public readonly email = signal('');

	public readonly fullName = signal('');

	public readonly message = signal('');

	public readonly modalOpen = signal(false);

	public readonly sent = signal(false);

	public readonly showErrors = signal(false);

	public readonly summary = derive(() => {
		return `${this.fullName.value || 'Unnamed contact'} from ${this.company.value || 'an undisclosed team'} is preparing a ${this.message.value.trim().length > 140 ? 'detailed' : 'concise'} request.`;
	}, { label: 'derive:contact-summary' });

	public readonly validAccessCode = derive(() => this.accessCode.value.trim().length >= 8, { label: 'derive:valid-access-code' });

	public readonly validEmail = derive(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.value.trim()), { label: 'derive:valid-email' });

	public readonly validFullName = derive(() => this.fullName.value.trim().length >= 2, { label: 'derive:valid-full-name' });

	public readonly validMessage = derive(() => this.message.value.trim().length >= 24, { label: 'derive:valid-message' });

	public readonly completedFields = derive(() => {
		const states = [
			this.validFullName.value,
			this.validEmail.value,
			Boolean(this.company.value.trim()),
			this.validAccessCode.value,
			this.validMessage.value,
			this.consent.value,
		];

		return states.filter(Boolean).length;
	}, { label: 'derive:completed-fields' });

	public readonly completionPercent = derive(() => {
		return Math.round((this.completedFields.value / 6) * 100);
	}, { label: 'derive:completion-percent' });

	public readonly canSubmit = derive(() => {
		return this.validFullName.value
			&& this.validEmail.value
			&& Boolean(this.company.value.trim())
			&& this.validAccessCode.value
			&& this.validMessage.value
			&& this.consent.value;
	}, { label: 'derive:can-submit' });

	public openReview(): void {
		this.showErrors.value = true;
		if (!this.canSubmit.value) {
			return;
		}

		this.modalOpen.value = true;
	}

	public submit(): void {
		this.modalOpen.value = false;
		this.sent.value = true;
	}

	public reset(): void {
		this.accessCode.value = '';
		this.company.value = '';
		this.consent.value = false;
		this.email.value = '';
		this.fullName.value = '';
		this.message.value = '';
		this.modalOpen.value = false;
		this.sent.value = false;
		this.showErrors.value = false;
	}

	public override render() {
		return html`
			<div class="page">
				<div class="topbar">
					<a class="brand" href="/">
						<span>Revia</span>
						<span>Integration</span>
					</a>
					<span class="note-chip">Route: /contact-form.html</span>
				</div>

				<section class="hero">
					<div class="hero-panel">
						<div class="kicker">Single-page contact funnel</div>
						<h1>Dark, reactive, and split into real components.</h1>
						<p class="hero-copy">
							This page exists to pressure-test <code>@revia/core</code> inside a realistic form
							flow. Every custom field below is its own component file, with state pushed down
							through bindings and changes surfaced back up through events.
						</p>

						<div class="metric-grid">
							<div class="metric">
								<strong>${() => `${this.completionPercent.value}%`}</strong>
								<span>Completion progress</span>
							</div>
							<div class="metric">
								<strong>${() => `${this.message.value.trim().length}`}</strong>
								<span>Message characters</span>
							</div>
							<div class="metric">
								<strong>${() => (this.canSubmit.value ? 'Ready' : 'Draft')}</strong>
								<span>Submission status</span>
							</div>
						</div>
					</div>

					<aside class="side-panel">
						<div>
							<h2>What this page is testing</h2>
							<p class="side-copy">
								Reusable custom elements, parent-owned signals, event-driven updates, and a modal
								confirmation step without needing a separate sandbox app.
							</p>
						</div>

						<div class="progress-shell">
							<div class="label-row">
								<strong>Field readiness</strong>
								<span class="side-copy">${() => `${this.completedFields.value} / 6 complete`}</span>
							</div>
							<div class="progress-bar">
								<div class="progress-fill" style="width: ${() => `${this.completionPercent.value}%`}"></div>
							</div>
						</div>

						<ul class="checklist">
							${forEach(
								() => checklistItems,
								item => item.id,
								item => html`
									<li>
										<span class="checkmark">+</span>
										<span>${item.label}</span>
									</li>
								`,
							)}
						</ul>
					</aside>
				</section>

				<div class="layout">
					<section class="form-panel">
						<div class="section-head">
							<div>
								<h2>Tell us what you want to build</h2>
								<p>
									Make the input components do the work. The parent owns the state, validation,
									review flow, and success state.
								</p>
							</div>
							<span class="note-chip">${() => this.summary.value}</span>
						</div>

						${when(
							() => this.sent.value,
							html`
								<div class="banner">
									Message staged successfully. The modal flow completed and the parent state stayed
									in sync across every custom field.
								</div>
							`,
						)}

						<div class="form-grid">
							<div>
								<revia-input
									:label=${'Full name'}
									:placeholder=${'Morgan Ellis'}
									:hint=${'At least 2 characters'}
									:invalid=${() => this.showErrors.value && !this.validFullName.value}
									*value=${this.fullName}
								></revia-input>
							</div>

							<div>
								<revia-input
									:label=${'Email'}
									:placeholder=${'morgan@studio.dev'}
									:inputType=${'email'}
									:autocomplete=${'email'}
									:hint=${'We use this for the reply thread'}
									:invalid=${() => this.showErrors.value && !this.validEmail.value}
									*value=${this.email}
								></revia-input>
							</div>

							<div>
								<revia-input
									:label=${'Company'}
									:placeholder=${'Northline Labs'}
									:hint=${'Who is this project for?'}
									:invalid=${() => this.showErrors.value && !this.company.value.trim()}
									*value=${this.company}
								></revia-input>
							</div>

							<div>
								<revia-password
									:label=${'Workspace key'}
									:placeholder=${'Eight characters or more'}
									:hint=${'Used here as a password-field integration test'}
									:autocomplete=${'new-password'}
									*value=${this.accessCode}
								></revia-password>
							</div>

							<div class="full">
								<revia-textarea
									:label=${'Project brief'}
									:placeholder=${'Describe the problem, the user experience, and what success looks like.'}
									:hint=${() => `${this.message.value.trim().length} chars written`}
									:invalid=${() => this.showErrors.value && !this.validMessage.value}
									*value=${this.message}
								></revia-textarea>
							</div>

							<div class="full">
								<revia-checkbox
									:label=${'I am happy for this message to be reviewed inside the integration package'}
									:hint=${'This intentionally tests boolean state flowing through a custom checkbox component.'}
									*checked=${this.consent}
								></revia-checkbox>
							</div>
						</div>

						<div class="actions">
							<revia-button @click=${() => this.openReview()}>Review request</revia-button>
							<revia-button :variant=${'secondary'} @click=${() => this.reset()}>
								Clear everything
							</revia-button>
						</div>
					</section>

					<div>
						<section class="side-card">
							<h3>Live form snapshot</h3>
							<div class="summary-grid">
								<div class="summary-row">
									<strong>Name</strong>
									<span>${() => this.fullName.value || 'Waiting for input'}</span>
								</div>
								<div class="summary-row">
									<strong>Email</strong>
									<span>${() => this.email.value || 'No address yet'}</span>
								</div>
								<div class="summary-row">
									<strong>Company</strong>
									<span>${() => this.company.value || 'No company yet'}</span>
								</div>
								<div class="summary-row">
									<strong>Consent</strong>
									<span>${() => (this.consent.value ? 'Confirmed' : 'Still required')}</span>
								</div>
							</div>
						</section>

						<section class="side-card">
							<h3>Support note</h3>
							<p class="support-copy">
								If any field here stops updating, the issue is likely inside the runtime package,
								not the integration shell. That is the entire point of this page.
							</p>
						</section>
					</div>
				</div>

				<revia-modal
					:title=${'Review your request'}
					:description=${'This modal is another integration check: parent state drives visibility, and actions close it through event-based updates.'}
					*open=${this.modalOpen}
				>
					<div class="review-copy">
						<p>
							Everything below is reading directly from the same parent-owned signals that power the
							form fields.
						</p>
						<div class="summary-grid">
							<div class="summary-row">
								<strong>Contact</strong>
								<span>${() => `${this.fullName.value} · ${this.email.value}`}</span>
							</div>
							<div class="summary-row">
								<strong>Company</strong>
								<span>${() => this.company.value}</span>
							</div>
							<div class="summary-row">
								<strong>Access key</strong>
								<span>${() => `${this.accessCode.value.length} characters provided`}</span>
							</div>
						</div>
						<div class="review-box">${() => this.message.value}</div>
					</div>
					<div slot="footer" class="modal-actions">
						<revia-button :variant=${'secondary'} @click=${() => {
							this.modalOpen.value = false;
						}}>
							Keep editing
						</revia-button>
						<revia-button @click=${() => this.submit()}>Send request</revia-button>
					</div>
				</revia-modal>
			</div>
		`;
	}
}

defineElement('contact-form-app', ContactFormApp);
