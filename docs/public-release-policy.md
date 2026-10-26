# Public release contents

Public source is published at `https://github.com/cguodesign/proofmarks`.
The development repository retains its own history. Standalone demo apps are
also included in the public repository as runnable examples.

The npm package is `proofmarks`. Its file allowlist contains the bundled
`dist/` output, `src/styles.css`, `README.md`, and `AGENT_GUIDE.md`, plus npm's
required package metadata and license. Standalone demo applications are not
part of the package; `pnpm audit:package` checks the packed archive.

On 2026-10-26 the owner requested that the root `demos/` directory also be
included in the public source repository, superseding the earlier source
exclusion. Include its source files, READMEs, workspace glob, startup scripts,
and lockfile importers. Both demo manifests remain `private: true`; neither
demo is published as an npm package or included in the `proofmarks` tarball.

The public source snapshot uses an explicit allowlist for package source,
the website, consumer fixtures and tests, build and verification scripts,
public documentation, project configuration, and the license. It starts with
one new root commit, without development-repository history, task records,
product briefs, local agent instructions, or generated verification artifacts.

The website's existing `/demo` proofreading showcase belongs to the website
source under `apps/playground/`; it is separate from the standalone apps in
the root `demos/` directory.
