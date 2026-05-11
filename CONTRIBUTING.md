# Contributing to SwarAI

Thank you for helping improve SwarAI. This document explains how we work and what we expect from contributions.

## Code of conduct

All contributors must follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Be respectful, constructive, and professional.

## How to contribute

1. **Issues first (usually)** — For bugs or feature ideas, open an [issue](https://github.com/ashokmotiji/SwarAI/issues) so we can align before you invest heavy time. Small fixes (typos, obvious bugs) can go straight to a PR.
2. **Fork & branch** — Create a branch from `main` with a short descriptive name, e.g. `fix/health-redis-timeout`.
3. **Keep PRs focused** — One logical change per pull request makes review and rollback easier.
4. **Describe the PR** — What changed, why, and how to verify (commands, screenshots for UI).

## Development setup

- **Node:** 20+
- **Package manager:** `pnpm` 9+ (see `packageManager` in root `package.json`)
- **Install:** `pnpm install`
- **Web app:** `pnpm --filter @swarai/web dev`
- **Lint:** `pnpm lint`
- **Build:** `pnpm build`
- **Tests:** `pnpm test` (placeholder suite today; extend with real tests in `apps/web` or packages as we grow)
- **Voice worker:** Python 3.11+, see `apps/voice-worker/README.md`
- **Database:** Supabase — see `supabase/SETUP.md`

## Style and quality

- **TypeScript / React** — Match existing patterns in `apps/web` (imports, component structure, server vs client boundaries).
- **Linting** — ESLint must pass (`pnpm lint`). Fix warnings you introduce.
- **Formatting** — Run `pnpm format` before pushing if you touch many files, or match existing Prettier style manually.
- **No secrets** — Never commit `.env`, API keys, or tokens. Use `.env.example` for documented placeholders only.
- **Minimal diffs** — Avoid drive-by refactors unrelated to your change.

## Licensing

By contributing, you agree that your contributions will be licensed under the same terms as the project — see [LICENSE](./LICENSE). If you need to contribute code under different terms, discuss it in an issue before opening a PR.

## Security

Please do **not** open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md).

## Questions

Open a [GitHub Discussion](https://github.com/ashokmotiji/SwarAI/discussions) if enabled, or an issue with the `question` label, and maintainers or the community can help.
