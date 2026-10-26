// Minimal unified-diff parser producing side-by-side rows.

export type Row =
  | { kind: "context"; oldNo: number; newNo: number; text: string }
  | { kind: "change"; oldNo?: number | undefined; newNo?: number | undefined; oldText?: string | undefined; newText?: string | undefined }
  | { kind: "hunk"; header: string };

export type FileDiff = { path: string; rows: Row[] };

export function parseUnifiedDiff(input: string): FileDiff[] {
  const files: FileDiff[] = [];
  let file: FileDiff | null = null;
  let oldNo = 0;
  let newNo = 0;
  let dels: { no: number; text: string }[] = [];
  let adds: { no: number; text: string }[] = [];

  // Pair the i-th removed line with the i-th added line of a change block.
  const flush = () => {
    if (!file) return;
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) {
      file.rows.push({
        kind: "change",
        oldNo: dels[i]?.no,
        oldText: dels[i]?.text,
        newNo: adds[i]?.no,
        newText: adds[i]?.text,
      });
    }
    dels = [];
    adds = [];
  };

  for (const line of input.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flush();
      file = { path: line.split(" b/")[1] ?? line, rows: [] };
      files.push(file);
    } else if (!file || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      continue;
    } else if (line.startsWith("@@")) {
      flush();
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
      oldNo = m ? Number(m[1]) : 1;
      newNo = m ? Number(m[2]) : 1;
      file.rows.push({ kind: "hunk", header: line });
    } else if (line.startsWith("-")) {
      if (adds.length) flush();
      dels.push({ no: oldNo++, text: line.slice(1) });
    } else if (line.startsWith("+")) {
      adds.push({ no: newNo++, text: line.slice(1) });
    } else if (line.startsWith(" ") || line === "") {
      flush();
      if (line === "" ) continue;
      file.rows.push({ kind: "context", oldNo: oldNo++, newNo: newNo++, text: line.slice(1) });
    } else if (line.startsWith("\\")) {
      continue; // "\ No newline at end of file"
    }
  }
  flush();
  return files;
}
