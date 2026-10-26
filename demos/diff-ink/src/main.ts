import { createProofmarks, type ProofmarksInstance } from "proofmarks";
import { enUS, jis, gb } from "proofmarks/notations";
import "proofmarks/styles.css";
import "./styles.css";
import { parseUnifiedDiff, type FileDiff } from "./diff";
import { inkLine } from "./ink";
import sample from "./sample.diff?raw";

// ---------------------------------------------------------------------------
// Base software: a plain side-by-side diff viewer.
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderDiff(container: HTMLElement, files: FileDiff[]) {
  container.replaceChildren();
  for (const file of files) {
    const section = el("section", "file");
    const head = el("header", "file-head");
    head.append(el("span", "path", file.path));
    const table = el("table", "diff");
    const thead = el("thead");
    const hr = el("tr");
    const oldTh = el("th", "col-old");
    oldTh.colSpan = 2;
    oldTh.append(el("span", "", "旧"));
    const newTh = el("th", "col-new");
    newTh.colSpan = 2;
    newTh.append(el("span", "", "新"));
    hr.append(oldTh, newTh);
    thead.append(hr);
    const tbody = el("tbody");

    for (const row of file.rows) {
      const tr = el("tr");
      if (row.kind === "hunk") {
        const td = el("td", "hunk", row.header);
        td.colSpan = 4;
        tr.append(td);
      } else {
        const oldText = row.kind === "context" ? row.text : row.oldText;
        const newText = row.kind === "context" ? row.text : row.newText;
        const oldCls = row.kind === "context" ? "" : oldText !== undefined ? "del" : "empty";
        const newCls = row.kind === "context" ? "" : newText !== undefined ? "add" : "empty";
        tr.append(
          el("td", `num ${oldCls}`, row.oldNo?.toString() ?? ""),
          codeCell(oldCls, oldText),
          el("td", `num ${newCls}`, row.newNo?.toString() ?? ""),
          codeCell(newCls, newText),
        );
        if (row.kind === "change" && oldText !== undefined && newText !== undefined) {
          tr.dataset.pair = "";
        }
      }
      tbody.append(tr);
    }
    table.append(thead, tbody);
    section.append(head, table);
    container.append(section);
  }
}

function codeCell(cls: string, text: string | undefined) {
  const td = el("td", `code ${cls}`);
  const div = el("div", "src", text ?? "");
  td.append(div);
  return td;
}

// ---------------------------------------------------------------------------
// The prank plugin: flip the old column into "hand-corrected" mode.
// ---------------------------------------------------------------------------

const NOTATIONS = { enUS, jis, gb } as const;
type Settings = { notation: keyof typeof NOTATIONS; maxEdits: number; editorial: boolean };

export function installDiffInk(viewer: HTMLElement, settings: () => Settings) {
  const instances = new Map<HTMLElement, ProofmarksInstance>();
  const log: string[] = [];

  const enable = (table: HTMLTableElement) => {
    const s = settings();
    table.classList.add("inked");
    table.querySelectorAll<HTMLTableRowElement>("tr[data-pair]").forEach((tr, i) => {
      const src = tr.cells[1]!.querySelector<HTMLElement>(".src")!;
      const oldText = src.textContent ?? "";
      const newText = tr.cells[3]!.querySelector(".src")!.textContent ?? "";
      const res = inkLine(oldText, newText, { maxEdits: s.maxEdits, maxChangedRatio: 0.5 }, `l${i}`);
      if (!res.ok) {
        tr.dataset.inkSkip = res.reason;
        tr.title = `老师懒得批：${res.reason}`;
        return;
      }
      tr.dataset.inked = "";
      try {
        instances.set(
          src,
          createProofmarks(src, {
            notation: NOTATIONS[s.notation],
            corrections: res.corrections,
            appearance: s.editorial ? "editorial" : "technical",
            onIssue: (issue) => log.push(`${issue.code}: ${issue.message}`),
          }),
        );
      } catch (e) {
        tr.dataset.inkError = (e as Error).message;
        delete tr.dataset.inked;
        log.push(`line ${i}: ${(e as Error).message}`);
      }
    });
  };

  const disable = (table: HTMLTableElement) => {
    table.classList.remove("inked");
    table.querySelectorAll<HTMLTableRowElement>("tr[data-pair]").forEach((tr) => {
      const src = tr.cells[1]!.querySelector<HTMLElement>(".src")!;
      instances.get(src)?.destroy();
      instances.delete(src);
      delete tr.dataset.inked;
      delete tr.dataset.inkSkip;
      delete tr.dataset.inkError;
      tr.removeAttribute("title");
    });
  };

  const attach = () => {
    viewer.querySelectorAll<HTMLTableElement>("table.diff").forEach((table) => {
      const th = table.querySelector<HTMLElement>("th.col-old")!;
      if (th.querySelector(".ink-toggle")) return;
      const btn = el("button", "ink-toggle", "✍️ 批改模式");
      btn.onclick = () => {
        const on = !table.classList.contains("inked");
        if (on) enable(table);
        else disable(table);
        btn.textContent = on ? "↩︎ 回到 diff" : "✍️ 批改模式";
      };
      th.append(btn);
    });
  };

  return {
    attach,
    /** Re-run every inked table with current settings. */
    refresh() {
      viewer.querySelectorAll<HTMLTableElement>("table.diff.inked").forEach((t) => {
        disable(t);
        enable(t);
      });
    },
    detachAll() {
      viewer.querySelectorAll<HTMLTableElement>("table.diff.inked").forEach(disable);
    },
    stats: () => ({ instances: instances.size, log: [...log] }),
  };
}

// ---------------------------------------------------------------------------
// Page wiring
// ---------------------------------------------------------------------------

const viewer = document.getElementById("viewer")!;
const input = document.getElementById("input") as HTMLTextAreaElement;
const notationSel = document.getElementById("notation") as HTMLSelectElement;
const maxEdits = document.getElementById("max-edits") as HTMLInputElement;
const maxEditsOut = document.getElementById("max-edits-out")!;
const editorial = document.getElementById("editorial") as HTMLInputElement;

const ink = installDiffInk(viewer, () => ({
  notation: notationSel.value as Settings["notation"],
  maxEdits: +maxEdits.value,
  editorial: editorial.checked,
}));

function load(text: string) {
  ink.detachAll();
  input.value = text;
  renderDiff(viewer, parseUnifiedDiff(text));
  ink.attach();
}

document.getElementById("render")!.onclick = () => load(input.value);
document.getElementById("sample")!.onclick = () => load(sample);
for (const c of [notationSel, editorial]) c.onchange = () => ink.refresh();
maxEdits.oninput = () => {
  maxEditsOut.textContent = maxEdits.value;
  ink.refresh();
};

load(sample);
