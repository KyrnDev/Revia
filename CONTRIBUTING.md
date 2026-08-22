# Contributing to Revia

Contributions are welcome, whether that is a bug report, a documentation improvement, a test case, a design discussion, or a pull request. Revia is early enough that thoughtful feedback can genuinely shape the framework.

## Before you start

- Check existing issues and pull requests before opening a duplicate.
- For larger changes, open an issue or discussion first so the direction can be agreed before significant work begins.
- Keep pull requests focused. Small, understandable changes are much easier to review and maintain.

## Development

This repository uses Bun and a small monorepo structure.

```bash
bun install
bun run lint
bun run typecheck
bun run build
```

If a change affects runtime behaviour, please include an integration example or test coverage where it makes sense. The core runtime is intentionally careful about platform behaviour, reactivity, and DOM updates, so regressions should be easy for a reviewer to understand and reproduce.

## AI-assisted contributions

AI-assisted work is welcome. It can be useful for exploring ideas, reducing repetitive work, and helping contributors get unstuck.

The contributor is still responsible for every submitted change. If AI was used to generate or materially change code, a human reviewer must review that code before it is merged. The reviewer should be able to understand the behaviour, assess the trade-offs, and request changes where needed. Generated code is not treated as correct simply because it builds or passes automated checks.

Please mention meaningful AI assistance in the pull request description, especially where it influenced implementation or design decisions. A short note is enough.

## Pull requests

- Explain what changed and why.
- Call out any API, browser-behaviour, or performance implications.
- Run linting, type checking, and a build before requesting review.
- Avoid unrelated formatting or refactors in the same pull request.
- Be kind and direct in review conversations. We are building this together.

## Code of conduct

Assume good intent, be respectful, and make room for people who are learning. Harassment, discrimination, or hostile behaviour is not welcome.
