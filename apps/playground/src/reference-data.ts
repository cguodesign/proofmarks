/**
 * Notation sources. Official system and standard names stay as published;
 * the translatable coverage, confidence, notes and link labels live under
 * `docs.references.<id>` in the site dictionaries.
 */
export const standards = [
  {
    id: "jis",
    system: "日本 · JIS",
    source: "JIS Z 8208:2007",
    links: [
      ["table", "https://kikakurui.com/z8/Z8208-2007-01.html"],
      ["chart", "https://www.print.or.jp/printinghokkaido/no611/no611_image/p16.jpg"],
    ],
  },
  {
    id: "gb",
    system: "中文 · GB",
    source: "GB/T 14706—93",
    links: [
      ["record", "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=654F6E33383AD2645F3AB15623E43E06"],
      ["table", "https://www.slarc.org.cn/dwyx/attached/file/20240521/20240521153325_825.pdf"],
    ],
  },
  {
    id: "cns",
    system: "臺灣 · CNS 3927",
    source: "CNS 3927 / Z7050 · 1996-09-26",
    links: [
      ["record", "https://www.cnsonline.com.tw/?node=result&generalno=3927&locale=zh_TW"],
      ["catalog", "https://www.bsmi.gov.tw/wSite/lp?BaseDSD=7&CtUnit=4197&ctNode=9837"],
      ["research", "https://github.com/cguodesign/proofmarks/blob/main/docs/taiwan-cns3927-research.md"],
    ],
  },
  {
    id: "ks",
    system: "한국 · KS",
    source: "KS A 0104",
    links: [
      ["record", "https://www.kssn.net/search/stddetail.do?itemNo=K001010133619"],
      ["terminology", "https://help.hancom.com/hoffice/multi/ko_kr/hwp/insert/proofreadmark/proofreadmark(insert).htm"],
    ],
  },
  {
    id: "en",
    system: "English · US",
    /** Not a standard; the localized label is `docs.references.en.source`. */
    source: null,
    links: [
      ["oregon", "https://www.courts.oregon.gov/publications/Documents/UpdatedStyleManual2002.pdf"],
      ["caltech", "https://gradoffice.caltech.edu/documents/28130/phd-thesis_guidelines_rev_04-2024.pdf"],
    ],
  },
] as const;
