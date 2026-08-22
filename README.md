# Revia

<p align="center">
	<img src="./logo.png" alt="Revia logo" width="160" />
</p>

<p align="center">
	A reactive web component framework for modern browsers, TypeScript-first apps, and people who want real reactivity without a virtual DOM.
</p>

<p align="center">
	<a href="https://github.com/KyrnDev/Revia"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-KyrnDev%2FRevia-111827?style=for-the-badge&logo=github" /></a>
	<a href="https://npmjs.org/package/@revia/core"><img alt="npm" src="https://img.shields.io/npm/v/%40revia%2Fcore?style=for-the-badge&color=cb3837&logo=npm" /></a>
	<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-first-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
	<img alt="ESM only" src="https://img.shields.io/badge/ESM-only-0f172a?style=for-the-badge" />
</p>

Revia started from a fairly simple place. I spend a lot of time around reactive frameworks and web components, and it has always felt like there should be a cleaner overlap between the two than what we usually end up with. I wanted something TypeScript-first, reactive, and close to the platform, but without feeling bare or awkward once you move beyond a single component. A lot of that thinking comes from genuinely loving Vue.js and having a lot of respect for how good its flow feels in day to day work, and wanting to build a web component based framework that feels just as considered when you are actually using it.

The plan is to keep the core small, modern, and predictable, then build outward from there. Reactivity should feel natural. Templates should stay close to HTML. Shadow DOM and light DOM should both be practical options. Props, models, lifecycle hooks, styling, and rendering all need to feel like parts of the same system rather than separate ideas stitched together. Just as importantly, the project should stay as browser-native as it reasonably can. TypeScript compilation is expected when you author in TypeScript, but Revia itself should not depend on a custom framework compile step to work. It should feel like something you can use to build a full application, or something you can use to sprinkle reactive features into an existing platform without having to rebuild everything around it. The current direction is function-first authoring through `createElement(...)`, with a class-based runtime underneath for the moments where lower-level control is useful.

## What Revia is trying to do

- Fine-grained reactivity with signal-based primitives and dependency tracking.
- Function-first component authoring, backed by real custom elements under the hood.
- TypeScript-first APIs that encourage strict, predictable flows, without making a framework compile step part of the deal.
- A template system that stays close to HTML rather than forcing JSX.
- First-class support for both shadow DOM and light DOM.
- A lower-level class API for cases where direct control is the better fit.
- A path toward a full framework experience, not just isolated components.

## Why this project exists

Revia is about bringing together the parts that make reactive frameworks productive with the web component model, in a way that feels current, approachable, and genuinely nice to build on.

## Packages

This repo is set up as a small monorepo so the framework can grow in layers.

- `@revia/core`
	The main runtime. Signals, effects, derived values, rendering, lifecycle hooks, styling support, `createElement(...)`, and the base `ReactiveElement` class live here.
- `@revia/router`
	Planned router package. The goal is proper framework glue for navigation, nested routes, aliases, redirects, and route-aware rendering.
- `@revia/components`
	Planned first-party UI package. This will hold polished primitives like inputs, buttons, switches, modals, date pickers, and similar building blocks on top of the core runtime.
- `@revia/integration`
	Internal consumer package used to pressure-test the core package inside a more realistic app setup.

## Current focus

Right now the priority is getting the foundations right:

- reactive primitives that feel invisible in normal usage
- a rendering model that is fine-grained enough to matter
- lifecycle hooks that are predictable
- typed props and model-style event flows
- a styling story that works in both shadow DOM and light DOM

I would much rather make the base layer solid than pretend the project is finished early.

## Development

At a high level, Revia is built around a small signal system and a fine-grained renderer. Signals track reads and writes, object and array updates are handled through Proxy-based reactivity, and the renderer only updates the bindings that actually depend on the changed value rather than rebuilding an entire component tree. The component layer then wraps that up in a function-first custom element API, with a class runtime underneath, so the overall model stays close to the browser while still giving you the sort of reactive flow people usually associate with a larger framework.

```bash
bun install
bun run typecheck
bun run lint
bun run build
```

For local development:

```bash
bun run dev
```

## Links

- GitHub: https://github.com/KyrnDev/Revia
- npm: https://npmjs.org/package/@revia/core

## Status

Revia is still being shaped, but the direction is deliberate.

If this lands the way I want it to, it should feel less like “another web component library” and more like a serious reactive framework that happens to be built on the native-browser instead of fighting it.

## Roadmap

The roadmap is an intentional high-level outline of the priorities for the first release.

### v0.1.0

The v0.1.0 release is intended to be the first public release of the core runtime, with a focus on getting the foundations right and making sure the core reactive flow is solid. The goal is to have a usable runtime that can be used in a small app, with a clear path toward a more complete framework experience.

- [x] Signal-based reactivity with fine-grained bindings, batching, deep objects and arrays, plus `Map` and `Set` support.
- [x] Tagged HTML templates with property, attribute, event, model, conditional, and keyed-list bindings.
- [x] `ReactiveElement` and `createElement(...)` authoring layers on top of native custom elements.
- [x] Typed props, validation, readonly component-side props, model updates, and custom events.
- [x] Shadow DOM by default, light DOM as an opt-in, native slots, and component-local CSS support.
- [x] Lifecycle hooks, ownership/disposal, `afterUpdate()`, `freeze()`, `resume()`, `move()`, `clone()`, and recovery controls.
- [x] An integration playground with nested components, child models, custom events, derived state, and keyed rendering.
- [ ] Proper browser-level test coverage and regression checks for the runtime.
- [ ] Template grammar hardening and clearer diagnostics for unsupported HTML contexts.
- [ ] API documentation, focused examples, and a small migration/stability policy for early adopters.
- [ ] Production configuration defaults and a final pass over package exports, generated types, and publish metadata.
- [ ] Performance profiling and baseline benchmarks for common component and list-update workloads.

### v0.2.0

The v0.2.0 release focuses on the router package, but expanding the tests, and improving the diagnostics and template grammar are also priorities. We also want to release some kind of extension to help with debugging and inspecting reactive flows, since that is a common pain point in reactive frameworks.

- [ ] Router package with nested routes, route-aware rendering, and navigation controls.
- [ ] Route aliases, redirects, parameter matching, route guards, and regex fallbacks.
- [ ] Browser-history and hash-history modes, with navigation state that stays usable outside a full Revia application.
- [ ] Declarative `router-link` and `router-view` components built as normal web components.
- [ ] Keep-alive and Teleport-style composition APIs built on the existing component lifecycle controls.
- [ ] Improved event and prop TypeScript inference, including generated event detail types for class components.
- [ ] A small developer diagnostics layer (extension) for inspecting signals, bindings, component updates, and invalid prop input.
- [ ] More complete template support for SVG, accessibility-focused attributes, and additional native form controls.
- [ ] Published examples covering a multi-page application and progressively adding Revia to an existing site.

### v0.3.0

The v0.3.0 release is going to focus on functional programming. We know that web components are class-based by default, but it would be great to be able to almost entirely author components as functions, with a class-based runtime underneath. This release will focus on making that possible, while also improving the template grammar and diagnostics and expanding APIs for developers to build upon the framework.

- [ ] Functional component authoring with `createElement(...)` and a class-based runtime underneath.
- [ ] Improvements around the available APIs, including offering internal hooks for developers to build on top of the framework.
- [ ] Function-friendly lifecycle APIs for creation, connection, updates, disconnection, disposal, and component-owned cleanup.
- [ ] Composable prop and model helpers with strong inference for defaults, validators, attributes, and `update:<prop>` events.
- [ ] A clear function-component configuration surface for shadow/light DOM, styles, slots, debug settings, and component naming.
- [ ] Reusable composition helpers for packaging signals, derived state, effects, event handling, and cleanup into framework-agnostic utilities.
- [ ] Better component composition patterns for wrapping, extending, and sharing behaviour without falling back to inheritance.
- [ ] Focused function-first examples showing forms, nested models, slots, typed events, and external CSS without a framework-specific compile step.

### v0.4.0

The v0.4.0 release is intended to be a components framework release, this focuses on real-world example components, that follow a clean CSS token system, that are modern, accessible, and easily expandable. The goal for this is a demo for people interested in using Revia to build a full application, while also offering a functional component library that you can use to get started.

- [ ] First-party component package with inputs, buttons, switches, modals, date pickers, and similar primitives.
- [ ] Shared CSS token system for colour, spacing, typography, motion, elevation, and component sizing.
- [ ] Accessible form primitives: checkbox, radio group, combobox, select, textarea, password input, and validation messaging.
- [ ] Overlay primitives including dialogs, drawers, popovers, tooltips, menus, and focus management.
- [ ] More specialised controls such as date pickers, colour pickers, icon pickers, tabs, details, and data-display components.
- [ ] Shadow DOM and light DOM styling presets so components can be used in isolated apps or existing design systems without friction.
- [ ] Theme switching, CSS-variable overrides, and a clear path for consuming components without adopting a complete visual system.
- [ ] Component documentation and interactive examples that show props, slots, events, models, and accessibility behaviour.

### Future

The future of Revia is intentionally open-ended. The goal is to build a framework that is useful, approachable, and practical for real-world applications, while staying close to the platform and avoiding unnecessary complexity. The roadmap will evolve based on feedback from early adopters, and the project will continue to focus on making the core runtime solid, while expanding the ecosystem with useful tools and components, there is a lot of room for growth and improvement.
