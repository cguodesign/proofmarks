# Demos

These apps live in the public repository as runnable source examples. Both are
private workspace packages and are excluded from the `proofmarks` npm package.

Small, self-contained apps built on Proofmarks the way an outside developer would
use it. Each one depends on `proofmarks` from this workspace and imports only its
public entry points (`proofmarks`, `proofmarks/react`, `proofmarks/notations`,
`proofmarks/helpers`, `proofmarks/styles.css`). Nothing reaches into
`@proofmarks/core` or `@proofmarks/dom`.

| Demo | Stack | Language | What it shows |
|---|---|---|---|
| [`zhenhua`](zhenhua) — 真话机 | React | Chinese (Simplified): UI and sample text | Rule-based word rewrites as red-pen marks, manual marks from a text selection, five notation packs, pen color and stroke, `onIssue`, and PNG export with `animate={false}` |
| [`diff-ink`](diff-ink) | Vanilla TS | Chinese (Simplified) UI; the sample diff is JavaScript with English strings and one Chinese comment | A plain side-by-side diff viewer with a plug-in that redraws the old column as hand corrections, one `createProofmarks` instance per changed line |

Code, comments and READMEs are in English. In 真话机, the rewrite rules only
match Chinese text. diff-ink tokenizes CJK characters individually, so it also
marks Chinese, Japanese and Korean edits inside code.

```bash
pnpm install
pnpm build            # builds the library packages first
pnpm demo:zhenhua     # http://localhost:5181
pnpm demo:diff-ink    # http://localhost:5182
```

`pnpm typecheck` and `pnpm build` at the root cover the demos too.
