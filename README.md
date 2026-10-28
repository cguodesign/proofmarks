# proofmarks

Traditional proofreading marks over real, selectable browser text.

Proofmarks renders plain correction data as SVG annotations using Japanese,
Mainland Chinese, Taiwanese, Korean, or American notation. It works with React
and vanilla JavaScript; your application owns the text and editing state.

## Install

```bash
npm install proofmarks
```

## React example

```tsx
import type { Correction } from "proofmarks";
import { jis } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";
import "proofmarks/styles.css";

const corrections = [
  {
    id: "delete-name",
    type: "delete",
    target: { kind: "text-range", start: 8, end: 10 },
  },
] as const satisfies readonly Correction[];

export function Example() {
  return (
    <Proofmarks
      as="p"
      notation={jis}
      corrections={corrections}
      lang="ja"
      style={{ padding: "44px 20px", lineHeight: 1.8 }}
    >
      吾輩は猫である。名前はまだ無い。
    </Proofmarks>
  );
}
```

Choose `jis`, `gb`, `cns3927`, `ks`, or `enUS` for the notation you need.
Support varies by operation and writing direction; see the
[support matrix](docs/support-matrix.md). Correction offsets use UTF-16 code units.

For vanilla JavaScript, use `createProofmarks` from `proofmarks`.
The [quickstart](docs/quickstart.md) covers both APIs, layout space, and updates.
The stylesheet above is optional and supplies default styling tokens.

## Demos

| Demo | Stack | What it shows |
| --- | --- | --- |
| [真话机 · zhenhua](demos/zhenhua) | React | Chinese text rewrites, selection-based marks, notation switching, and PNG export |
| [diff-ink](demos/diff-ink) | Vanilla TypeScript | Code diffs rendered as proofreading marks |

Run from a clone with Node 22+ and pnpm:

```bash
pnpm install
pnpm build
pnpm demo:zhenhua     # http://localhost:5181
pnpm demo:diff-ink    # http://localhost:5182
```

Demos are runnable source examples in this repository. They are private workspace
packages and are excluded from the published `proofmarks` npm package.
See the [demo guide](demos/README.md) and [release policy](docs/public-release-policy.md).

## Documentation

- [Quickstart](docs/quickstart.md) — React and vanilla integration.
- [Public API](docs/public-api-v1.md) — corrections, helpers, styling, and lifecycle.
- [Support matrix](docs/support-matrix.md) and [known limitations](docs/known-limitations-v0.1.md).
- [Agent guide](docs/agent-guide.md) — also shipped as `node_modules/proofmarks/AGENT_GUIDE.md`.

## Development

After installing and building, run `pnpm dev` for the website and playground.
Run `pnpm verify:release` for the complete release checks, including package,
consumer, browser, and built-site verification.

## License

[MIT](LICENSE).
