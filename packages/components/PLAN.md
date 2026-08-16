# @revia/components Plan

## Goal

Build a first-party component package that ships polished, ready-to-use UI primitives on top of `@revia/core`.

This package should provide:

- pre-defined components out of the box
- strong default styling
- CSS token driven theming
- easy override and extension points
- compatibility with both shadow and light DOM strategies where practical

## Positioning

`@revia/components` should be:

- separate from `@revia/core`
- optional, not required for using Revia
- visually coherent by default
- practical for real apps, not just demos

It should feel like the official design-system layer for Revia.

## Core Principles

### Token First

Styling should be driven by CSS custom properties and design tokens, not hardcoded one-off values.

Token categories should include:

- color
- typography
- spacing
- radius
- border
- shadow
- motion
- z-index

### Good Defaults, Easy Escape

Components should look strong out of the box, but should not trap users inside rigid styling decisions.

Consumers should be able to:

- override tokens globally
- override tokens per component
- extend styles with component-level CSS
- swap between light and shadow DOM patterns when supported

### Component Primitives Before Big Widgets

Start with foundational building blocks:

- button
- input
- textarea
- checkbox
- radio
- switch
- select
- modal/dialog
- card
- badge
- alert

Only move into larger composed patterns after the primitive layer is solid.

### Accessibility By Default

Every built-in component should aim for:

- sensible keyboard behavior
- visible focus states
- semantic HTML
- accessible labeling patterns
- reasonable color contrast by default

## Package Scope

### V1 In Scope

- core design tokens
- theme contract
- primitive form controls
- layout primitives
- feedback components
- overlays
- navigation primitives if they do not belong in router

### V1 Out Of Scope

- huge data grids
- full WYSIWYG editors
- charts
- drag-and-drop builders
- deeply opinionated page templates

## Styling Strategy

### Primary Direction

Components should be pre-styled using CSS tokens.

Example direction:

```css
:host {
	--revia-button-bg: var(--revia-color-accent-500);
	--revia-button-fg: var(--revia-color-on-accent);
}
```

Then component styles consume tokens rather than fixed values.

### Token Layers

Recommended layering:

1. global system tokens
2. semantic theme tokens
3. component tokens

Example:

- `--revia-color-slate-900`
- `--revia-surface-panel`
- `--revia-button-bg`

### Override Model

Consumers should be able to:

1. override global tokens at app level
2. override semantic tokens at theme level
3. override component tokens for local customization

This keeps styling flexible without forcing users to rewrite components.

## DOM Strategy

### Preferred Default

Components can default to shadow DOM if that best protects their internal UI.

However, styling escape hatches must remain practical.

### Styling Requirements

Need a clear story for:

- token inheritance through shadow DOM
- host-level CSS hooks
- slotted content styling
- external light DOM overrides where allowed

For some components, light DOM variants may make sense if styling flexibility is more important than encapsulation.

## Theming

### Theme Direction

Support:

- a default theme
- easy custom themes
- runtime token overrides

Potential theme entry point:

```ts
import '@revia/components/theme/default.css';
```

Or token modules expressed through ESM/CSS exports.

### Dark Mode

Dark mode should be a first-class concern from the start, not a later retrofit.

Need:

- balanced neutral scales
- solid contrast
- usable overlays and form states

## Public API Direction

### Import Style

Likely usage:

```ts
import '@revia/components/button';
import '@revia/components/input';
```

Or grouped entry points:

```ts
import '@revia/components/all';
```

### Registration Model

Components should self-register cleanly, or offer an explicit registration helper if needed.

Need to decide:

- auto-define on import
- exported classes plus opt-in define helper

For app ergonomics, auto-definition may be reasonable for the component package.

## Component Categories

### Form Controls

Initial targets:

- button
- input
- password
- textarea
- checkbox
- radio
- switch
- select
- field wrapper
- label/help/error text helpers

### Layout

- card
- stack
- grid
- divider
- surface/panel

### Feedback

- badge
- alert
- toast later
- loading indicator
- empty state

### Overlay

- modal/dialog
- popover later
- dropdown later

## Slots And Composition

Components should support slot-based customization wherever it helps:

- icons
- prefix/suffix content
- footer actions
- header content

Examples:

- button icon slot
- input prefix/suffix
- modal header/footer slots

## Variant System

Need a clean variant story without turning the API into prop soup.

Likely support:

- `variant`
- `size`
- `tone`
- `disabled`

But styling should still be token-driven under the hood.

## State Styling

Every interactive component should define tokens and visuals for:

- default
- hover
- active
- focus
- disabled
- invalid
- success where relevant

## Integration With Core

`@revia/components` should lean on `@revia/core` for:

- `ReactiveElement`
- signals
- lifecycle hooks
- templating
- light/shadow DOM strategy

It should not reinvent those fundamentals.

## Integration With Router

Some components may integrate with `@revia/router` later:

- nav items
- tabs with route awareness
- breadcrumbs
- link/button hybrids

But router coupling should be optional.

## Documentation Needs

Each component should document:

- purpose
- basic usage
- props/properties
- events
- slots
- tokens
- accessibility notes
- styling override examples

## Suggested Internal Structure

Possible package layout:

- `tokens/`
- `themes/`
- `components/button/`
- `components/input/`
- `components/modal/`
- `utils/`

Each component folder may contain:

- class
- styles
- token contract
- tests

## Suggested Phases

### Phase 0: Token And Theme Spec

- define token naming
- define semantic theme layer
- define override strategy

### Phase 1: Foundations

- base tokens
- theme entry
- button
- input
- textarea

### Phase 2: Form System

- checkbox
- radio
- switch
- select
- field wrapper helpers

### Phase 3: Overlay And Feedback

- modal
- badge
- alert
- loading states

### Phase 4: Layout And Composition

- card
- stack
- panel
- divider

### Phase 5: Hardening

- docs
- accessibility review
- cross-browser polish
- examples

## Testing Priorities

Must-test areas:

- token overrides
- shadow/light DOM style behavior
- slot rendering
- keyboard interaction
- focus management
- invalid/disabled states
- dark theme rendering
- composition between primitives

## Initial Recommendation

Create `@revia/components` as the official UI layer on top of `@revia/core`.

Its identity should be:

- attractive defaults
- token-driven customization
- easy extension
- real app usefulness

Done well, this becomes the quickest way for developers to make Revia apps feel complete without having to design every primitive from scratch.
