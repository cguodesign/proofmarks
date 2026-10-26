# 真话机

Paste a paragraph and a "red-pen teacher" marks it up: translate corporate jargon
into plain speech, dress plain speech up as jargon, or calm down an angry message.
Then export the card as a PNG to share.

- `src/dict.ts` holds each mode's word-level rules. `src/engine.ts` turns rule
  matches into `Correction[]` (longest phrase wins, no overlaps).
- The card renders `<Proofmarks>` with a choice of GB, CNS 3927, JIS, KS and en-US
  notation, pen color and `strokeScale` through `markStyle`, and the editorial or
  technical appearance.
- Select text on the card to add your own delete, replace or insert marks.
  `offsetsFromSelection` maps the selection to source offsets, and
  `applyCorrections` produces the "改完" line and reports invalid data.
- "导出截图" sets `animate={false}` and commits before `html-to-image` copies the
  card, so the export shows the final ink.
- `markStyle` and `onIssue` are memoized, and the proof root reserves
  `padding-block: 44px` for labels.

```bash
pnpm demo:zhenhua
```
