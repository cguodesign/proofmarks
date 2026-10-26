import { renderToString } from "react-dom/server";
import type { Correction } from "proofmarks";
import { jis } from "proofmarks/notations";
import { Proofmarks } from "proofmarks/react";

const corrections = [
  {
    id: "delete-name",
    type: "delete",
    target: { kind: "text-range", start: 8, end: 10 },
  },
] as const satisfies readonly Correction[];

const html = renderToString(
  <Proofmarks
    as="p"
    notation={jis}
    corrections={corrections}
    appearance="editorial"
    lang="ja"
  >
    吾輩は猫である。名前はまだ無い。
  </Proofmarks>,
);

if (!html.includes("吾輩は猫である。名前はまだ無い。")) {
  throw new Error("SSR output lost the source content.");
}
if (html.includes("data-proofmarks-overlay")) {
  throw new Error("SSR output must not contain a measured browser overlay.");
}

console.log(html);
