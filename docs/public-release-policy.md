# Public release contents

Public source is published at `https://github.com/cguodesign/proofmarks`.
The development repository retains its own history and standalone demo apps.

The npm package is `proofmarks`. Its file allowlist contains the bundled
`dist/` output, `src/styles.css`, `README.md`, and `AGENT_GUIDE.md`, plus npm's
required package metadata and license. Standalone demo applications are not
part of the package; `pnpm audit:package` checks the packed archive.

The owner confirmed on 2026-10-25 that the root `demos/` directory stays only
in the development repository. Exclude it from the public source snapshot as
well as from npm. The snapshot also omits its workspace glob, package scripts,
lockfile importers, and relative README link.

The public source snapshot uses an explicit allowlist for package source,
the website, consumer fixtures and tests, build and verification scripts,
public documentation, project configuration, and the license. It starts with
one new root commit, without development-repository history, task records,
product briefs, local agent instructions, or generated verification artifacts.

The website's existing `/demo` proofreading showcase belongs to the website
source under `apps/playground/`; it is separate from the standalone apps in
the root `demos/` directory.
