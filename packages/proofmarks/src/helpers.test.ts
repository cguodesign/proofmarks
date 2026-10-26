// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyCorrections, correctionsFromDiff, findRange, getSourceText, offsetsFromSelection } from "./helpers";
import type { Correction } from "./schema";

describe("source helpers", () => {
  it("reads nested source and whole-root selections without overlay text", () => {
    const root = document.createElement("div");
    root.innerHTML = 'A <em>😡猫</em><svg data-proofmarks-overlay><text>extra</text></svg> B';
    expect(getSourceText(root)).toBe("A 😡猫 B");
    const range = document.createRange();
    range.selectNodeContents(root);
    expect(offsetsFromSelection(root, range)).toEqual({ kind: "text-range", start: 0, end: 7 });
    range.setStart(root.querySelector("em")!.firstChild!, 2);
    range.collapse(true);
    expect(offsetsFromSelection(root, range)).toEqual({ kind: "text-point", offset: 4 });
    range.selectNodeContents(root.querySelector("text")!);
    expect(() => offsetsFromSelection(root, range)).toThrow(/source text/);
  });
  it("finds literal occurrences with UTF-16 offsets", () => {
    expect(findRange("😡猫猫", "猫", 1)).toEqual({ kind: "text-range", start: 3, end: 4 });
    expect(findRange("cat", "dog")).toBeNull();
    expect(() => findRange("cat", "")).toThrow();
  });
});

describe("correction helpers", () => {
  it.each(["word", "character", "code"] as const)("round-trips %s diffs including CJK and emoji", (granularity) => {
    for (const [before, after] of [
      ["", "hello"], ["hello", ""], ["same", "same"],
      ["The quick brown fox.", "A quick red fox!"],
      ["吾輩は猫である。", "吾輩は犬だった。"],
      ["😡hello 👨‍👩‍👧", "👋hello 👨‍👩‍👧!"],
      ["one one two", "one two one"],
      ["a b c ".repeat(300), "x y z ".repeat(300)],
      ["if (items.lenght == 0) return;", "if (items.length === 0) return;"],
      ["total += item.price * item.qty;", "total += item.qty * item.price;"],
      ["return {  total };", "return { total };"],
      ["a  b", "a b"], ["a b", "a  b"], ["catdog", "cat dog"], ["cat dog", "catdog"],
      ["\tx", " \tx"], ["x \n y", "x\ny"],
      ["// 获取用户信息并计算总价", "// 获取用户资料并计算总价"],
    ]) {
      const corrections = correctionsFromDiff(before!, after!, { granularity });
      expect(applyCorrections(before!, corrections)).toBe(after);
    }
  });
  it("targets code tokens and emits spacing, transposition and prefixed ids", () => {
    const code = "if (items.lenght == 0) return;";
    expect(correctionsFromDiff(code, "if (items.length == 0) return;", { granularity: "code", idPrefix: "line-3-" })).toEqual([
      { id: "line-3-1", type: "replace", target: { kind: "text-range", start: 10, end: 16 }, replacement: "length" },
    ]);
    expect(correctionsFromDiff(code, "if (items.length == 0) return;")[0]).toMatchObject({ id: "diff-1", replacement: "items.length" });
    const swap = "total += item.price * item.qty;";
    expect(correctionsFromDiff(swap, "total += item.qty * item.price;", { granularity: "code" })).toEqual([
      { id: "diff-1", type: "transpose", targets: [{ kind: "text-range", start: 14, end: 19 }, { kind: "text-range", start: 27, end: 30 }] },
    ]);
    expect(correctionsFromDiff("f(a, b)", "f(b, a)").map((correction) => correction.type)).toEqual(["transpose"]);
    expect(correctionsFromDiff("return {  total };", "return { total };", { granularity: "code" })).toEqual([
      { id: "diff-1", type: "decrease-spacing", target: { kind: "text-range", start: 9, end: 10 } },
    ]);
    expect(correctionsFromDiff("cat dog", "catdog", { granularity: "character" })).toEqual([
      { id: "diff-1", type: "decrease-spacing", target: { kind: "text-range", start: 3, end: 4 } },
    ]);
    expect(correctionsFromDiff("catdog", "cat dog", { granularity: "character" })).toEqual([
      { id: "diff-1", type: "increase-spacing", target: { kind: "text-point", offset: 3 } },
    ]);
    expect(correctionsFromDiff("a b", "a\t b", { granularity: "character" }).map((correction) => correction.type)).toEqual(["insert"]);
  });

  it("applies relations, cancellations and spacing against original offsets", () => {
    const transpose: Correction = { id: "swap", type: "transpose", targets: [{ kind: "text-range", start: 0, end: 3 }, { kind: "text-range", start: 4, end: 7 }] };
    expect(applyCorrections("cat dog", [transpose])).toBe("dog cat");
    const cancel: Correction = { id: "cancel", type: "cancel-correction", target: { kind: "correction", correctionId: "swap" } };
    expect(applyCorrections("cat dog", [cancel, transpose])).toBe("cat dog");
    expect(applyCorrections("cat dog", [cancel, transpose, { id: "undo-cancel", type: "cancel-correction", target: { kind: "correction", correctionId: "cancel" } }])).toBe("dog cat");
    expect(applyCorrections("cat dog", [{ id: "move", type: "move", source: { kind: "text-range", start: 0, end: 3 }, destination: { kind: "text-point", offset: 7 } }])).toBe(" dogcat");
    expect(applyCorrections("cat  dog", [{ id: "close", type: "decrease-spacing", target: { kind: "text-range", start: 3, end: 5 } }])).toBe("catdog");
    expect(applyCorrections("catdog", [{ id: "open", type: "increase-spacing", target: { kind: "text-point", offset: 3 } }])).toBe("cat dog");
  });
  it("rejects ambiguous edits but keeps same-point insertion order", () => {
    expect(() => applyCorrections("cat", [
      { id: "replace", type: "replace", target: { kind: "text-range", start: 0, end: 3 }, replacement: "dog" },
      { id: "insert", type: "insert", target: { kind: "text-point", offset: 1 }, content: "x" },
    ])).toThrow(/replace.*insert/);
    expect(applyCorrections("cat", [
      { id: "a", type: "insert", target: { kind: "text-point", offset: 0 }, content: "A" },
      { id: "b", type: "insert", target: { kind: "text-point", offset: 0 }, content: "B" },
    ])).toBe("ABcat");
  });
});
