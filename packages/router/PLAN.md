# @revia/router Plan

## Goal

Build a first-party router package that gives Revia applications real framework glue without bloating `@revia/core`.

This package should make multi-page and app-shell style experiences feel native to Revia:

- top-level navigation
- nested route trees
- sub-navigation and child outlets
- aliases
- redirects
- regex-driven matching and fallbacks
- route-aware lazy loading
- signal-first route state

## Positioning

`@revia/router` should be:

- separate from `@revia/core`
- officially maintained
- designed to feel like part of the same framework
- usable with plain custom elements and class-based Revia components

It should not feel like a generic router bolted on later.

## Core Principles

### Signal First

Route state should be exposed through Revia primitives:

- current route
- matched records
- params
- query
- hash
- navigation status

This keeps routing aligned with the rest of the framework.

### Platform Honest

The router should use real browser primitives:

- History API
- `popstate`
- real `a[href]` semantics where possible

Links should degrade gracefully and avoid inventing fake navigation models.

### Nested By Design

Nested routes are not an add-on. They are part of the primary model:

- layout routes
- child views
- sub-navigation
- deeply nested app areas

### Explicit Configuration

Routes should be declared with structured route records, not inferred from magic file naming in V1.

File-based routing can come later as an optional layer.

## Package Scope

### V1 In Scope

- router instance creation
- history mode
- route records
- route matching
- nested routes
- aliases
- redirects
- regex path support
- not found / catch-all support
- `<revia-router-link>`
- `<revia-router-view>`
- programmatic navigation
- route params/query/hash parsing
- signal-based route access
- lazy route component loading

### V1 Out Of Scope

- SSR integration
- file-based routing
- transitions/animations built into the router
- scroll restoration beyond a minimal strategy
- full data loaders unless the core API already supports them cleanly

## Naming Direction

Public package:

- `@revia/router`

Preferred element names:

- `<revia-router-link>`
- `<revia-router-view>`

Discussion shorthand can still be:

- `router-link`
- `router-view`

But implementation should stay namespaced to avoid collisions.

## Public API Direction

### Router Creation

Possible shape:

```ts
import { createRouter, createWebHistory } from '@revia/router';

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: '/',
			component: () => import('./pages/home.js'),
		},
	],
});
```

Router config should feel concise but explicit.

### Route Records

Route records should support:

- `path`
- `name`
- `component`
- `components`
- `children`
- `redirect`
- `alias`
- `meta`
- `beforeEnter`
- `props`

Example:

```ts
{
	path: '/settings',
	component: SettingsShell,
	children: [
		{
			path: 'profile',
			name: 'settings-profile',
			component: ProfilePage,
		},
		{
			path: 'security',
			name: 'settings-security',
			component: SecurityPage,
		},
	],
}
```

### Link Component

Base usage:

```html
<revia-router-link to="/about">About</revia-router-link>
```

Potential props:

- `to`
- `replace`
- `active-class`
- `exact-active-class`
- `aria-current-value`

Potential behavior:

- renders a real `<a>`
- intercepts same-origin navigation
- preserves modifier-click/new-tab behavior
- applies active state based on the current match

### View Component

Base usage:

```html
<revia-router-view></revia-router-view>
```

Named views later or in V1 if complexity stays acceptable:

```html
<revia-router-view name="default"></revia-router-view>
<revia-router-view name="sidebar"></revia-router-view>
```

Responsibilities:

- render the matched route component for its depth
- support nested route trees
- support lazy-loaded components
- pass route props when configured

## Matching Model

### Path Features

The matcher should support:

- static segments
- dynamic params: `/users/:id`
- optional params if worthwhile in V1
- regex params: `/orders/:id(\\d+)`
- catch-all segments
- route ranking by specificity

### Regex Support

Regex support is important and should be first-class, not hacked in later.

Examples:

```ts
{ path: '/docs/:slug([a-z0-9-]+)' }
{ path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage }
```

### Fallbacks

Need a strong not-found story:

- wildcard routes
- regex catch-alls
- optional redirect-to-not-found patterns

## Aliases And Redirects

### Alias

Alias should preserve the target route identity while allowing alternate URLs.

Example:

```ts
{
	path: '/start',
	alias: ['/home', '/welcome'],
	component: LandingPage,
}
```

### Redirect

Redirects should support:

- string redirects
- named-route redirects
- function redirects

Example:

```ts
{
	path: '/login',
	redirect: '/auth/sign-in',
}
```

And:

```ts
{
	path: '/u/:id',
	redirect: to => `/users/${to.params.id}`,
}
```

## Nested Navigation

This is one of the biggest reasons to build the router.

We need strong support for:

- app layouts
- section shells
- child pages within parent pages
- sub-navigation bars driven by the active child route

Example route tree:

```ts
[
	{
		path: '/',
		component: AppShell,
		children: [
			{
				path: '',
				component: DashboardPage,
			},
			{
				path: 'settings',
				component: SettingsLayout,
				children: [
					{
						path: 'profile',
						component: ProfilePage,
					},
					{
						path: 'billing',
						component: BillingPage,
					},
				],
			},
		],
	},
]
```

`<revia-router-view>` should resolve route depth automatically.

## Route State Access

Need a composable or signal API that can be used inside Revia components.

Possible direction:

```ts
const route = useRoute();
const router = useRouter();
```

Where `route` exposes signals or signal-backed fields for:

- `path`
- `name`
- `params`
- `query`
- `hash`
- `meta`
- `matched`

Possible shape:

```ts
route.path.value
route.params.value.id
route.query.value.tab
```

The exact API can be refined, but it should feel consistent with Revia signals.

## Programmatic Navigation

Need router methods for:

- `push(...)`
- `replace(...)`
- `back()`
- `forward()`
- `go(delta)`

Example:

```ts
router.push('/settings/profile');
router.replace({ name: 'dashboard' });
```

## Guards

V1 can support a minimal but useful guard system.

Candidate layers:

- global before guards
- per-route `beforeEnter`
- component-level integration later

Possible methods:

- `router.beforeEach(...)`
- `router.afterEach(...)`

Guard outcomes should support:

- allow
- cancel
- redirect

## Lazy Loading

This should work out of the box:

```ts
{
	path: '/reports',
	component: () => import('./pages/reports.js'),
}
```

The router view should:

- resolve the loader
- instantiate/register the component if needed
- render once ready

Future enhancement:

- loading placeholders
- error boundaries
- prefetching

## Props Into Route Components

Need a route-level option to pass params/query/meta into a component as props.

Support likely modeled after:

- `props: true`
- `props: route => ({ ... })`

This is important for keeping route-aware components testable and explicit.

## Lifecycle Integration

Router navigation should work cleanly with Revia lifecycle hooks:

- `created()`
- `connected()`
- `updated()`
- `disconnected()`
- `disposed()`

Questions to settle:

- should route changes recreate route components by default?
- when do cached route components get `disconnected()` vs `disposed()`?
- what should a future keep-alive story look like?

V1 default should be simple:

- navigated-away route components get removed normally
- no keep-alive abstraction until designed properly

## Keep-Alive Compatibility

Not required in V1, but the router should not block it architecturally.

Need future room for:

- route view caching
- tabbed interfaces
- preserved component state

This is especially relevant because `disposed()` should only fire on true teardown.

## Scroll And Navigation UX

Minimal V1 support:

- preserve browser default behavior where possible
- optional `scrollToTop` on navigation

Later:

- configurable scroll restoration
- per-route scroll behavior

## Error Handling

Need a clear story for:

- unmatched routes
- failed lazy imports
- guard failures
- redirect loops

At minimum:

- meaningful console warnings in development
- stable fallback behavior

## Internal Architecture Direction

Likely building blocks:

1. history adapter
2. route matcher
3. reactive route store
4. navigation pipeline
5. view renderer
6. link component

Suggested separation:

- `history.ts`
- `matcher.ts`
- `router.ts`
- `route-state.ts`
- `components/router-link.ts`
- `components/router-view.ts`

## Suggested Phases

### Phase 0: API Lock

- finalize package boundary
- finalize route record format
- finalize link/view public API
- finalize route signal access model

### Phase 1: Matching And History

- route ranking
- params/query parsing
- regex support
- History API integration

### Phase 2: Router Core

- router instance
- navigation state
- push/replace/back APIs
- redirects and aliases

### Phase 3: Rendering Layer

- `<revia-router-view>`
- nested view depth handling
- lazy component resolution

### Phase 4: Navigation Components

- `<revia-router-link>`
- active state logic
- accessibility behavior

### Phase 5: Guarding And Hardening

- navigation guards
- redirect loop handling
- error handling
- docs and examples

## Testing Priorities

Must-test areas:

- route ranking
- nested route resolution
- alias behavior
- redirect behavior
- regex params
- catch-all fallbacks
- link interception behavior
- browser back/forward handling
- lazy-loaded route rendering
- route signal reactivity
- lifecycle behavior during navigation

## Initial Recommendation

Build `@revia/router` as a first-party package, not part of `@revia/core`.

The package should aim to deliver the “framework glue” layer for Revia:

- application structure
- navigation
- nested rendering
- route-aware composition

Done well, this becomes the missing layer that makes Revia feel like a complete framework rather than a loose component runtime.
