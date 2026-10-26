import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { jis } from "./notations";
import { Proofmarks } from "./react";

describe("Proofmarks SSR", () => {
  it("imports and renders children without touching browser geometry", () => {
    const html = renderToString(
      <Proofmarks
        as="p"
        lang="ja"
        notation={jis}
        corrections={[
          {
            id: "delete-name",
            type: "delete",
            target: { kind: "text-range", start: 8, end: 10 },
          },
        ]}
      >
        吾輩は猫である。名前はまだ無い。
      </Proofmarks>,
    );

    expect(html).toContain("<p");
    expect(html).toContain('lang="ja"');
    expect(html).toContain("吾輩は猫である。名前はまだ無い。");
    expect(html).not.toContain("data-proofmarks-overlay");
  });
});
