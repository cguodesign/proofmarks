# Proofmarks V0.1 support matrix

Statuses: `SUPPORTED`, `PARTIAL`, `UNVERIFIED`, `UNSUPPORTED`.

## Browser and framework support tested for this RC

| Surface | Status | Evidence |
| --- | --- | --- |
| Chromium | SUPPORTED | Chrome for Testing 151.0.7922.34; full 78-test Chromium suite including release matrix |
| Firefox | SUPPORTED | Firefox 153 through Playwright; 14-case release matrix |
| WebKit | SUPPORTED | WebKit 26.5 through Playwright; 14-case release matrix |
| Real Safari | UNVERIFIED | Safari 26.3.1 is installed, but no real Safari manual session was performed |
| React 19 | SUPPORTED | packed consumer with React 19.2.8; strict types, SSR, build, runtime |
| React 18 | SUPPORTED | packed consumer with React 18.2.0; strict types, SSR, build, runtime |
| SSR | SUPPORTED | import and production render emit source content and no overlay; hydration lifecycle covered in package tests |
| Vanilla DOM | SUPPORTED | packed consumer with no React installation; create/update/destroy runtime passed |
| Mobile/responsive | SUPPORTED | 390, 768, 1024, and 1440 CSS viewport coverage; 200% reflow and DPR 2 checks |
| Real mobile hardware | UNVERIFIED | no hardware session in Task 010A |
| Right-to-left text (`direction: rtl`) | UNVERIFIED | marks land on the measured words, but no pack mirrors strokes or labels; the renderer reports `unverified-direction` once per instance |

Playwright WebKit is not claimed as Safari.

## Writing modes

| Notation | Horizontal | Vertical `vertical-rl` |
| --- | --- | --- |
| JIS | SUPPORTED | PARTIAL — direct delete/insert/replace/transpose/cancel; generic move/spacing fallbacks |
| GB | SUPPORTED | PARTIAL — generic fallback |
| 臺灣 · CNS 3927 | PARTIAL — direct delete, insert, wrong-character replacement, and delete retention | PARTIAL — direct insertion; other geometry remains unverified and uses generic fallback |
| KS | PARTIAL — source-backed with documented KS evidence limits | PARTIAL — generic fallback |
| English · US | SUPPORTED | UNSUPPORTED — source remains visible and no imitation is drawn |

Canonical status is operation- and scale-specific. [The notation capability matrix](notation-capability-matrix.md) and [canonical fidelity matrix](canonical-fidelity-matrix.md) are authoritative.

Taiwan support is documented separately in the [CNS 3927 research and implementation note](taiwan-cns3927-research.md). It is not a GB alias; unaudited operations remain explicit fallbacks.
