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

Revia started from a fairly simple place. I spend a lot of time around reactive frameworks and web components, and it has always felt like there should be a cleaner overlap between the two than what we usually end up with. I wanted something class-first, TypeScript-first, reactive, and close to the platform, but without feeling bare or awkward once you move beyond a single component. A lot of that thinking comes from genuinely loving Vue.js and having a lot of respect for how good its flow feels in day to day work, and wanting to build a web component based framework that feels just as considered when you are actually using it.

The plan is to keep the core small, modern, and predictable, then build outward from there. Reactivity should feel natural. Templates should stay close to HTML. Shadow DOM and light DOM should both be practical options. Props, models, lifecycle hooks, styling, and rendering all need to feel like parts of the same system rather than separate ideas stitched together. Just as importantly, the project should stay as browser-native as it reasonably can. TypeScript compilation is expected when you author in TypeScript, but Revia itself should not depend on a custom framework compile step to work. It should feel like something you can use to build a full application, or something you can use to sprinkle reactive features into an existing platform without having to rebuild everything around it.

## What Revia is trying to do

- Fine-grained reactivity with signal-based primitives and dependency tracking.
- Class-first custom elements, with helpers layered on top instead of replacing the core model.
- TypeScript-first APIs that encourage strict, predictable flows, without making a framework compile step part of the deal.
- A template system that stays close to HTML rather than forcing JSX.
- First-class support for both shadow DOM and light DOM.
- A path toward a full framework experience, not just isolated components.

## Why this project exists

Revia is about bringing together the parts that make reactive frameworks productive with the web component model, in a way that feels current, approachable, and genuinely nice to build on.

## Packages

This repo is set up as a small monorepo so the framework can grow in layers.

- `@revia/core`
	The main runtime. Signals, effects, derived values, rendering, lifecycle hooks, styling support, and the base `ReactiveElement` class live here.
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

At a high level, Revia is built around a small signal system and a fine-grained renderer. Signals track reads and writes, object and array updates are handled through Proxy-based reactivity, and the renderer only updates the bindings that actually depend on the changed value rather than rebuilding an entire component tree. The component layer then wraps that up in a class-first custom element API, so the overall model stays close to the browser while still giving you the sort of reactive flow people usually associate with a larger framework.

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
