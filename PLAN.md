# RWC Plan

## Vision

Build a TypeScript-first reactive web component library that feels modern, fast, and native to the platform:

- class-first custom elements
- fine-grained proxy-based reactivity
- precise DOM updates without a VDOM
- first-class props and explicit model bindings
- strong support for both shadow and light DOM
- an ESM-first styling story without a required compile step

Target positioning:

- lighter than a full framework
- more ergonomic than bare custom elements
- closer to Vue in reactive feel
- distinct from Vue and React in public API shape

## Product Goals

1. Make class-authored custom elements pleasant enough that helpers feel optional, not necessary.
2. Preserve platform primitives instead of hiding them behind a fake component model.
3. Keep updates fine-grained so common interactions stay fast.
4. Ship excellent TypeScript ergonomics from day one.
5. Be modern by default and avoid legacy baggage.

## Non-Goals For V1

- virtual DOM
- SSR or hydration
- router or app framework
- JSX-first authoring
- compile-only core features
- global state library beyond local reactive primitives

## Core Principles

### TypeScript First

- Public APIs should infer types well.
- Props, models, events, and reactive primitives should be strongly typed.
- Internal architecture should stay contributor-friendly.

### Web Components First

- `HTMLElement` remains the foundation.
- Shadow DOM is the default.
- Light DOM is a first-class opt-in.
- Attributes, properties, slots, and events stay honest to the platform.

### Fine-Grained Reactivity

- Only the DOM parts that depend on changed data should update.
- Effects should be batched and deduplicated.
- Nested object and array access should track at property level.

### Low Ceremony

- Simple components should stay readable.
- Authoring should remain HTML-like.
- The public model should be explicit, not magical.

## Current High-Level Architecture

### Runtime Direction

Preferred architecture:

- reactive engine behind an internal adapter
- template part binding system
- batched scheduler
- base component class
- optional helpers layered on top

Initial reactivity implementation:

- start with `@vue/reactivity` behind an adapter
- do not leak Vue-specific APIs as the only public surface
- keep the option to replace the engine later

### Rendering Direction

Preferred rendering model:

- tagged HTML templates
- stable DOM creation
- dynamic bindings tracked per part
- no full component rerun model
- no VDOM diffing

This is a runtime-first, compile-free core. A compiler or TSX adapter can come later, but must not be required.

## Authoring Model

### Primary Authoring Style

The canonical authoring style is:

```ts
class MyElement extends ReactiveElement {}
```

This is class-first, not function-component-first.

### Layering Strategy

Authoring layers should be:

1. `ReactiveElement` and core primitives
2. `defineComponent(...)`
3. builder/fluent helpers on top of `defineComponent(...)`
4. optional decorators later

The helper layer should build on the class model, not replace it.

### Registration

Support:

1. `customElements.define(...)`
2. a library registration helper
3. optional decorator-based registration later

## Template System

### Primary API

Use tagged HTML templates:

```ts
render() {
  return html`<p>${() => this.count.value}</p>`;
}
```

### Reactive Binding Rule

Lazy function bindings are the recommended reactive path:

- `${() => this.count.value}` is reactive
- `${this.label}` is eager/plain

Direct values are allowed, but should be treated as eager interpolation. In development, direct reactive-looking values may warn.

### Binding Syntax

Current syntax direction:

- text/content: `${...}`
- property/data binding: `:prop=${...}`
- event binding: `@event=${...}`
- model binding: `*prop=${signal}`

### Binding Resolution

For `:prop`:

- if the target declares it as a component prop, treat it as a property/data binding
- otherwise treat it as an attribute binding

### Control Flow

Support both:

1. normal JavaScript/template expressions
2. helpers for common patterns

Helpers currently in scope:

- `when(...)`
- `forEach(...)`

### Iteration

`forEach(...)` should support a built-in key selector:

```ts
forEach(
  () => this.items.value,
  (item) => item.id,
  (item) => html`...`,
)
```

Rules:

- keyed iteration is the intended performant path
- if the user omits a key selector, the library may fall back to full rerendering for that list
- in development, unkeyed iteration should warn

### JSX / TSX

- not part of the V1 core
- possible later adapter
- should target the same internal template representation

## Reactive Primitives

### Signal API

The core mutable primitive is a signal.

Current direction:

- one signal API should support primitives, objects, and arrays
- `.value` is the main access path
- nested object and array mutation should work naturally

Example:

```ts
const count = signal(0);
const profile = signal({ name: "Avery", active: true });

count.value = 1;
profile.value.active = false;
```

### Required Signal Features

- `.value`
- `.peek()` for non-tracking reads
- `.subscribe(...)`
- `.dispose()`
- `.clone()`
- `isSignal(...)`

### Nested Reactivity

Signals must support:

- nested object reads
- nested object writes
- arrays and array mutations
- property-level dependency tracking

The runtime should invalidate only the property dependencies actually touched where possible.

### Derived Values And Effects

Current public direction:

- `derive(...)` for computed values
- `effect(...)` for imperative reactions

Mental model:

- `derive(...)` returns a value
- `effect(...)` performs work

### Signal Ownership

Signals and effects created during component setup should become owned by that component automatically.

When a component is disposed:

- owned effects should stop
- owned signals/resources should be cleaned up

## Props

### Declaration Style

The foundational class API should use a static schema:

```ts
static props = {
  name: { type: String, default: "Bob" },
};
```

Decorators may be added later, but static schema is the base.

### Prop Rules

- props are readonly inside the component by default
- parent-owned data stays parent-owned
- local mutable state should live in signals, not props

### DOM Visibility

Current direction:

- declared props should be treated as JS-first
- they should not automatically clutter the DOM
- reflection should be opt-in per prop

### Coercion

Primitive prop coercion should support:

- booleans
- numbers
- strings

Boolean examples that should resolve to `true`:

- `<my-el hello>`
- `<my-el hello="true">`

Unset or explicit false-like values should resolve to `false`.

### Invalid Input Handling

We should not silently coerce bad data into something surprising.

Current direction:

- in development: show a clear error
- in production: fail quietly and do not render the component

### Defaults

Support defaults in prop schema.

For object and array defaults:

- allow literal defaults
- also allow factory defaults

Example:

```ts
items: {
  type: Array,
  default: () => [],
}
```

Factory defaults should remain the recommended safer pattern.

## Models And Two-Way Binding

### Framing

A model is effectively:

- a prop-like input
- plus a standard update event contract

But it is still worth treating as a distinct declared capability because it changes author intent and parent-child data flow.

### Model Direction

Current direction:

- one default model
- optional named models
- default model is usually `value`
- named models are explicit per prop

### Event Naming

Use:

- `update:value`
- `update:<name>`

This avoids collisions with native events and stays readable.

### Template Syntax

Use:

- `*value=${signal}`
- `*open=${signal}`
- `*checked=${signal}`

### Recommended API Shape

Models should be declared where props are declared, not in a separate unrelated system.

Example direction:

```ts
static props = {
  value: { type: String, model: true, readonly: true },
};
```

### Reflection And Models

Reflection is separate from model updates.

Current direction:

- model updates should be event-driven
- reflection should be opt-in and not the main model mechanism

## State Placement

Inside classes:

- props are external inputs
- signals are internal mutable state
- derived values come from `derive(...)`
- side effects come from `effect(...)`

This is the core mental split.

## Lifecycle

### Public Lifecycle Hooks

Preferred public hooks:

- `created()`
- `connected()`
- `updated()`
- `disconnected()`
- `disposed()`

### Lifecycle Semantics

`created()`

- should run as soon as the component instance is fully created in memory
- should run after local state is ready
- should run before connected

`connected()`

- should run after the DOM has been committed

`disconnected()`

- should run when the element is removed

`updated()`

- should correspond to committed updates
- ideally once per batch, not once per individual mutation

`disposed()`

- should run when the component is being fully disposed
- should remain separate from ordinary disconnect/reconnect flows

### Update Utility

We need a next-tick-like utility.

Current preferred naming:

- `afterUpdate()`

Purpose:

- await DOM update completion in a modern, clear way

## Scheduling

### Default Behavior

- microtask-based batching by default
- deduplicate repeated work in the same tick
- only commit final values for a batch

Example:

```ts
count.value += 1;
count.value += 2;
count.value += 3;
```

Should result in:

- many writes
- one scheduled flush
- one committed DOM update per dependent part

### Future Scheduling

Frame-based scheduling can remain a later option, but microtasks are the default.

## Component Control APIs

### Confirmed Direction

Components should support formal cleanup:

- `component.dispose()`

Expected behavior:

- clean up owned resources
- stop effects
- remove the element from the DOM

### Candidate Future APIs

These are worth keeping in mind, but are not yet committed as V1 guarantees:

- `freeze()`
- `clone()`
- `move(target)`

### Teleport Direction

Teleport should be thought of as movement of the same component instance, not creation of a second instance.

Current architectural lean:

- `move(target)` is the core capability
- a declarative Teleport helper can be layered on top later

## DOM Modes

### Supported Modes

Use a simple static class configuration:

```ts
static dom = "shadow" | "light";
```

### Product Position

- `shadow` should remain the default
- `light` should remain first-class but opt-in

### Honest Framing

`shadow`

- isolation by default
- stronger internal style protection

`light`

- integration by default
- participates in the outer page cascade

If authors choose light DOM, external styling affecting the component is usually a feature, not a bug.

## Slots

### Slot Foundation

Use native platform slots:

- `<slot>`
- `<slot name="...">`

Do not invent a fake slot API unless a real platform limitation forces it.

### Required Support

- default slots
- named slots
- fallback content

### Composition Model

- child components own slot outlets
- parent components own projected content

### Important Documentation Point

Shadow DOM may isolate internal child styles, but slotted content is still parent-owned content. Slot styling and child internal styling are not the same problem.

## Styling

### Core Styling Direction

Styling should be ESM-first and compile-free by default.

Authors should be able to:

1. define styles internally
2. import styles externally
3. still use `<style>` in templates when desired

### Primary Styling API

Use `static styles` as the main styling surface.

Example:

```ts
class MyCard extends ReactiveElement {
  static styles = css`...`;
}
```

or:

```ts
import styles from "./my-card.css";

class MyCard extends ReactiveElement {
  static styles = [styles];
}
```

### Supported Style Inputs

The plan should support:

- `static styles = css\`\``
- `static styles = [importedStyle]`
- CSS Modules where the surrounding toolchain supports them
- inline `<style>` inside templates

### Optional Future Escape Hatch

`styles() {}` may be useful later for advanced composition, but it should not be the primary recommendation.

### Dynamic Styling Guidance

Prefer:

- static authored CSS
- dynamic values through CSS custom properties

Avoid making dynamic stylesheet regeneration the default pattern.

### Shadow vs Light Styling Guarantee

The library should aim for:

- shared authoring ergonomics
- minimal surprises

It should not promise:

- identical cascade behavior
- identical isolation guarantees

## Events

We should provide a pleasant event helper:

- `emit(name, detail, options?)`

Goals:

- typed payloads
- easy custom event dispatch
- ergonomic model update emission

## Browser Support Policy

Target:

- modern evergreen browsers
- latest few major versions

Working policy:

- avoid making weakly supported features core dependencies
- if a feature is meaningfully below roughly 80% of target support, do not build the core around it

We should bias toward modern APIs when they are broadly available.

## Packaging

- ESM-first
- type declarations included
- good tree shaking
- no hard dependency on a compile transform for core usability

## Confirmed Demo Learnings

The demo has already validated several important architectural claims.

### Fine-Grained Updates

Confirmed:

- text bindings update narrowly
- inputs and checkboxes update narrowly
- keyed list updates touch only affected items
- nested object mutation can be property-level
- batched signal writes collapse correctly

### Component Boundary Isolation

Confirmed:

- child-owned reactive updates stay local to the child
- parent components do not rerender during child-internal updates

### Native Slot Composition

Confirmed:

- simple component composition with native slots feels natural
- fallback content works
- named slots work
- no fake slot API is needed for the class-first base story

### Shadow vs Light

Confirmed:

- one authoring surface can serve both modes
- shadow protects internals from hostile page CSS
- light allows outer page CSS to affect internals
- this difference is expected and should be documented honestly

## Open Questions

These are still genuinely open and should remain visible:

1. What exact runtime style value format should `static styles` accept long-term?
2. What exact public shape should `defineComponent(...)` take?
3. What exact public shape should the builder layer take?
4. Do we expose a library-native reactive API only, or partially re-export wrapped Vue-style primitives?
5. How far do we go in V1 on light DOM slot/runtime normalization versus documented caveats?
6. What exact API should a future signal-part extraction helper use?
7. Which candidate control APIs belong in V1 versus later?

## Recommended V1 Scope

V1 should include:

1. `ReactiveElement`
2. signals, derived values, and effects
3. tagged HTML templates
4. fine-grained part binding
5. prop schema system
6. model binding support
7. `emit(...)`
8. shadow/light DOM mode selection
9. `static styles`
10. native slot composition
11. lifecycle hooks: `created()`, `connected()`, `updated()`, `disconnected()`, `disposed()`
12. batching scheduler

V1 should not require:

- JSX
- decorators
- compiler transforms
- SSR
- Teleport
- advanced global state

## Suggested Implementation Phases

### Phase 0: Spec Lock

- finalize naming
- finalize prop/model schema
- finalize base class public surface
- finalize `static styles` accepted forms

### Phase 1: Runtime Core

- reactive adapter
- scheduler
- template/binding engine
- fine-grained DOM updates

### Phase 2: Component System

- `ReactiveElement`
- props
- models
- lifecycle hooks
- `emit(...)`
- DOM mode selection
- `static styles`

### Phase 3: Composition Hardening

- slots
- cross-component bindings
- style behavior in shadow and light DOM
- disposal/ownership behavior

### Phase 4: Public API Layering

- `defineComponent(...)`
- optional builder layer
- optional decorators if still worthwhile

### Phase 5: Hardening And Docs

- tests
- benchmarks
- docs
- examples
- final naming cleanup

## Testing Priorities

Must-test areas:

- fine-grained text updates
- prop coercion and validation
- model update flow
- keyed and unkeyed iteration behavior
- nested object and array mutation
- component boundary isolation
- slot behavior
- shadow vs light style behavior
- ownership and disposal
- lifecycle ordering

## Minimal Example Direction

```ts
import cardStyles from "./my-card.css";

class MyCounter extends ReactiveElement {
  static dom = "shadow";

  static styles = [cardStyles];

  static props = {
    value: { type: Number, readonly: true, model: true },
    label: { type: String, default: "Counter" },
  };

  count = signal(0);
  doubled = derive(() => this.count.value * 2);

  created() {}

  connected() {}

  increment() {
    this.count.value++;
    this.emit("update:value", this.count.value);
  }

  render() {
    return html`
      <button @click=${() => this.increment()}>
        ${() => this.label}: ${() => this.doubled.value}
      </button>
      <slot></slot>
    `;
  }
}
```

## Current Summary

The project is now firmly pointed at:

- class-first custom elements
- fine-grained reactive rendering
- native slots
- shadow default, light opt-in
- ESM-first `static styles`
- explicit models via `*prop` and `update:<prop>`
- modern browser support
- no required compile step for the core experience
