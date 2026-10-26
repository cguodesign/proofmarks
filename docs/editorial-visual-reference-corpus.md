# Editorial visual reference corpus

This is a small research index for Task 008 appearance calibration. It is not a
notation authority and is not loaded by the Proofmarks runtime.

## Evidence boundary

- **Canonical notation evidence** comes from the standards and references
  already audited for each notation pack. Nothing below changes mark meaning or
  cultural grammar.
- **Visual/aesthetic evidence** below informs paper tone, ink contrast, type
  impression, margin proportions, and restrained editorial intervention.
  A type specimen containing red print is not evidence that a proofmark itself
  is canonical.

## Archive infrastructure and rights

Source: [Ichigaya Letterpress Archive](https://archives.ichigaya-letterpress.jp/library/)

- [IIIF API guide](https://archives.ichigaya-letterpress.jp/library/api/):
  Presentation API 3, Image API 3, and Content State workflows.
- [Terms of use](https://archives.ichigaya-letterpress.jp/library/terms/):
  archive manifests declare [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Required institutional credit retained verbatim:
  **大日本印刷株式会社／市谷の杜 本と活字館**
  (Dai Nippon Printing Co., Ltd. / Ichigaya Letterpress Factory).

Only the precise IIIF crops below were inspected. They are linked remotely and
are not vendored into the package.

## Aesthetic reference 01 — restrained red intervention

| Field | Value |
| --- | --- |
| Title | 明朝五号活字摘要録 |
| Date | 大正二年八月改正 (August 1913 revision) |
| Item | <https://archives.ichigaya-letterpress.jp/library/items/4988f3f96748/> |
| Manifest | <https://archives.ichigaya-letterpress.jp/api/presentation/3/4988f3f96748/manifest.json> |
| Canvas | <https://archives.ichigaya-letterpress.jp/api/presentation/3/4988f3f96748/canvas/12> |
| Canvas size | 5436 × 4080 |
| Region | `xywh=1800,1200,1700,2100` |
| Image request | <https://archives.ichigaya-letterpress.jp/api/image/3/007_012.tif/1800,1200,1700,2100/800,/0/default.jpg> |
| Rights | CC BY 4.0 |
| Attribution | 大日本印刷株式会社／市谷の杜 本と活字館 |

Why relevant: warm red additions sit beside dense black type without becoming
fluorescent; the intervention is visually subordinate to readable content. The
crop also shows a light warm sheet and uneven letterpress density. Proofmarks
uses this only to calibrate editorial red, restrained secondary pressure, and
paper contrast. It is **not canonical proofmark evidence**.

Content State-ready target:

```json
{
  "type": "Annotation",
  "motivation": ["contentState"],
  "target": {
    "id": "https://archives.ichigaya-letterpress.jp/api/presentation/3/4988f3f96748/canvas/12#xywh=1800,1200,1700,2100",
    "type": "Canvas",
    "partOf": [{
      "id": "https://archives.ichigaya-letterpress.jp/api/presentation/3/4988f3f96748/manifest.json",
      "type": "Manifest"
    }]
  }
}
```

## Aesthetic reference 02 — vertical rhythm and margin proportion

| Field | Value |
| --- | --- |
| Title | 主要活字見本帳 |
| Date | 昭和23（1948）年10月印刷 |
| Item | <https://archives.ichigaya-letterpress.jp/library/items/084cef1f7ddc/> |
| Manifest | <https://archives.ichigaya-letterpress.jp/api/presentation/3/084cef1f7ddc/manifest.json> |
| Canvas | <https://archives.ichigaya-letterpress.jp/api/presentation/3/084cef1f7ddc/canvas/6> |
| Canvas size | 5436 × 4080 |
| Region | `xywh=726,703,2718,2718` |
| Image request | <https://archives.ichigaya-letterpress.jp/api/image/3/T3_006.tif/726,703,2718,2718/900,/0/default.jpg> |
| Rights | CC BY 4.0 |
| Attribution | 大日本印刷株式会社／市谷の杜 本と活字館 |

Why relevant: multiple vertical specimens remain readable through disciplined
column spacing, with a large quiet outer margin and a thin rule separating the
composition from annotation space. The varied impression of otherwise regular
type supports keeping editorial texture subtle. It informs paper presentation
and logical vertical lanes only; it is **not canonical proofmark evidence**.

Content State-ready target:

```json
{
  "type": "Annotation",
  "motivation": ["contentState"],
  "target": {
    "id": "https://archives.ichigaya-letterpress.jp/api/presentation/3/084cef1f7ddc/canvas/6#xywh=726,703,2718,2718",
    "type": "Canvas",
    "partOf": [{
      "id": "https://archives.ichigaya-letterpress.jp/api/presentation/3/084cef1f7ddc/manifest.json",
      "type": "Manifest"
    }]
  }
}
```

## Runtime boundary

These URLs and selectors are research provenance only. They are absent from
the package source and distribution. The playground paper surface uses local
CSS; a network failure or archive policy change cannot affect Proofmarks
rendering.
