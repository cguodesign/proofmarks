# diff-ink

A plain side-by-side unified-diff viewer, plus a small plug-in that adds a
"✍️ 批改模式" button to each file. Turning it on redraws the old column as a
teacher's hand corrections of the new code. Lines that change too much are skipped
("老师懒得批").

- `src/diff.ts` parses `git diff` output into side-by-side rows.
- `src/ink.ts` tokenizes a line pair (identifiers, whitespace runs, and single CJK
  characters), runs an LCS diff, and emits `replace`, `insert`, `delete`,
  `transpose` (swapped arguments) and spacing corrections. It gives up past a
  per-line edit budget.
- `src/main.ts` mounts one `createProofmarks` instance per changed line and calls
  `destroy()` when the mode is turned off or the settings change.
- The inked cell reserves vertical padding inside the scrolling code cell so
  labels have room.

Paste your own `git diff` output under "粘贴自己的 diff".

```bash
pnpm demo:diff-ink
```
