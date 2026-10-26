# Contributing to Proofmarks

## Local setup

Use Node 22+ and pnpm 11.19.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm verify:release
```

## Architecture boundaries

- `packages/core` owns notation-neutral semantic correction data and validation.
- `packages/dom` owns browser measurement, layout, scene rendering, and lifecycle.
- `packages/notations` owns tradition-specific visual grammar.
- `packages/proofmarks` is the only public npm package boundary.
- `apps/playground` owns the website and internal Suggesting adapter; editor code must not leak into the package.
- `demos/*` are standalone consumer apps; they import only public `proofmarks` entry points, never `@proofmarks/core` or `@proofmarks/dom`.

## Tests and fixtures

Add the smallest fixture that proves the behavior at the owning layer. Semantic validation belongs in core tests, geometry in DOM tests, notation grammar in its pack tests, public contracts in packed consumers, and browser invariants in Playwright. Prefer attachment, ordering, finite geometry, and lifecycle assertions over pixel-identical cross-browser screenshots.

## Notation research

Every canonical claim needs a cited source and an explicit evidence boundary. Record title/edition, provenance, access limits, writing mode, operation, scale, and confidence. Do not invent symmetry between JIS, GB, KS, and US traditions, and do not promote a generic fallback because it looks plausible.

Feature proposals outside the frozen contract belong in [the post-V0.1 roadmap](docs/post-v0.1-roadmap.md).
