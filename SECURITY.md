# Security policy

## Supported versions

We focus security fixes on the **default branch** of [SwarAI](https://github.com/ashokmotiji/SwarAI) (`main`). Older tags or forks may not receive patches.

## Reporting a vulnerability

**Please do not file public issues for security vulnerabilities.**

Instead:

1. Use [GitHub Security Advisories](https://github.com/ashokmotiji/SwarAI/security/advisories/new) to **privately** report a vulnerability, if the feature is enabled on the repository, **or**
2. Contact the maintainers through a **private channel** they have published (e.g. security email in the repo or org profile).

Include:

- Description of the issue and impact
- Steps to reproduce (proof-of-concept if possible)
- Affected versions or components (e.g. `apps/web`, specific API route)
- Any suggested fix (optional)

We aim to acknowledge reports within a few business days and coordinate disclosure once a fix is available.

## Scope (examples)

In scope for security reports:

- Authentication / authorization flaws in the web app or APIs
- Injection, SSRF, or unsafe deserialization in server routes
- Secrets exposure in the repository or build artifacts

Typically out of scope:

- Denial-of-service via large payloads without resource exhaustion bug
- Issues requiring physical access or compromised user machines
- Third-party services (Clerk, Supabase, LiveKit, etc.) — report those to the vendor

## Safe harbor

We support good-faith security research. Do not access data that is not yours, do not degrade production systems without permission, and follow coordinated disclosure when working with maintainers.
