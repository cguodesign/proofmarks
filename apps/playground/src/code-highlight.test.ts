import { describe, expect, it } from "vitest";
import { escapeHighlightMarkers, formatLineRanges, hl, parseHighlightedSource } from "./code-highlight";
import { exampleCode, languageIds } from "./public-content";

describe("code sample highlight markers", () => {
  it("strips markers and reports whole highlighted lines", () => {
    const parsed = parseHighlightedSource(`.proof {\n  ${hl("padding: 44px 20px;\n  line-height: 1.8;")}\n}`);
    expect(parsed.source).toBe(".proof {\n  padding: 44px 20px;\n  line-height: 1.8;\n}");
    expect(parsed.highlightedLines).toEqual([2, 3]);
    expect(parsed.lines[1]!.segments).toEqual([{ text: "  padding: 44px 20px;", token: false }]);
    expect(parsed.lines[0]!.highlighted).toBe(false);
  });

  it("emphasizes a partial span as a token within its highlighted line", () => {
    const parsed = parseHighlightedSource(`style={{ ${hl('writingMode: "vertical-rl"')}, lineHeight: 1.8 }}`);
    expect(parsed.highlightedLines).toEqual([1]);
    expect(parsed.lines[0]!.segments).toEqual([
      { text: "style={{ ", token: false },
      { text: 'writingMode: "vertical-rl"', token: true },
      { text: ", lineHeight: 1.8 }}", token: false },
    ]);
  });

  it("keeps blank lines inside a multi-line span highlighted", () => {
    expect(parseHighlightedSource(`a\n${hl("b\n\nc")}\nd`).highlightedLines).toEqual([2, 3, 4]);
  });

  it("rejects unbalanced or nested markers", () => {
    expect(() => parseHighlightedSource("⟦a")).toThrow();
    expect(() => parseHighlightedSource("a⟧")).toThrow();
    expect(() => parseHighlightedSource("⟦a⟦b⟧⟧")).toThrow();
  });

  it("escapes markers typed into generated string literals", () => {
    const literal = escapeHighlightMarkers(JSON.stringify("⟦x⟧"));
    expect(literal).toBe('"\\u27E6x\\u27E7"');
    expect(JSON.parse(literal)).toBe("⟦x⟧");
  });

  it("formats line ranges compactly", () => {
    expect(formatLineRanges([3, 4, 7, 9, 10, 11])).toBe("3–4, 7, 9–11");
  });

  it("highlights the target and payload of every Get started example", () => {
    for (const language of languageIds) {
      for (const [type, payload] of [["replace", "replacement:"], ["insert", "content:"]] as const) {
        const parsed = parseHighlightedSource(exampleCode(language, type, "⟦typed⟧ "));
        const highlighted = parsed.highlightedLines.map((line) => parsed.lines[line - 1]!.text.trim());
        expect(highlighted).toHaveLength(2);
        expect(highlighted[0]).toMatch(/^target: \{ kind: "text-(range|point)"/);
        expect(highlighted[1]).toMatch(new RegExp(`^${payload} "\\\\u27E6typed\\\\u27E7 ",$`));
        expect(parsed.source).not.toMatch(/[⟦⟧]/u);
      }
    }
  });
});
