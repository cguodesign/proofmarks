# Third-party notices

## Published `proofmarks` package

The packed V0.1 runtime bundles only code from this repository. React is an optional peer dependency and is not bundled. No fonts, icons, archival images, PDFs, textures, or reference corpus are shipped in the npm archive.

## Repository website

The local website build includes React, React DOM, and the ProseMirror model/state/view/commands/keymap packages. Their package metadata declares the MIT license. Build and test tooling remains development-only.

The dependency-license scan found only recognized permissive families across the lockfile: MIT, MIT-0, Apache-2.0, BSD-2-Clause, BSD-3-Clause, and ISC. Consumers must retain notices required by their own bundled dependencies.

## Archival imagery

The website links two remote IIIF crops from the Ichigaya Letterpress Archive under CC BY 4.0:

- `明朝五号活字摘要録`, canvas 12, region `1800,1200,1700,2100`;
- `主要活字見本帳`, canvas 6, region `726,703,2718,2718`.

Required credit is retained on the page: `大日本印刷株式会社／市谷の杜 本と活字館`. Titles, rights, regions, manifest/canvas provenance, and purpose are recorded in [the visual reference corpus](editorial-visual-reference-corpus.md). These images are visual evidence only, are remotely linked, and do not enter the runtime package.
