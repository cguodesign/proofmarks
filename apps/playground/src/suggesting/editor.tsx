import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import { baseKeymap } from "prosemirror-commands";
import { Schema, type Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, type Transaction } from "prosemirror-state";
import { keymap } from "prosemirror-keymap";
import { EditorView } from "prosemirror-view";
import { diffDrafts, type DraftEdit } from "./model";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph" },
    paragraph: {
      content: "inline*",
      toDOM: () => ["p", 0],
      parseDOM: [{ tag: "p" }],
    },
    text: { group: "inline" },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      toDOM: () => ["br"],
      parseDOM: [{ tag: "br" }],
    },
  },
});

function docFromText(text: string): ProseMirrorNode {
  const children: ProseMirrorNode[] = [];
  text.split("\n").forEach((part, index) => {
    if (index > 0) children.push(schema.nodes.hard_break!.create());
    if (part) children.push(schema.text(part));
  });
  return schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null, children));
}

function textFromDoc(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n", "\n");
}

function transactionEdit(
  transaction: Transaction,
  before: string,
  after: string,
): DraftEdit | null {
  if (transaction.steps.length === 1) {
    const json = transaction.steps[0]!.toJSON() as {
      stepType?: string;
      from?: number;
      to?: number;
    };
    if (
      json.stepType === "replace" &&
      typeof json.from === "number" &&
      typeof json.to === "number"
    ) {
      const from = Math.max(0, json.from - 1);
      const to = Math.max(from, json.to - 1);
      const insertedLength = after.length - (before.length - (to - from));
      return {
        from,
        to,
        inserted: after.slice(from, from + Math.max(0, insertedLength)),
        inputType: transaction.getMeta("uiEvent") ?? undefined,
      };
    }
  }
  return diffDrafts(before, after);
}

export type SuggestingEditorHandle = {
  focus(): void;
  selection(): { from: number; to: number };
};

type SuggestingEditorProps = {
  value: string;
  mode: "editing" | "suggesting";
  language: string;
  ariaDescribedBy?: string;
  onSuggest(edit: DraftEdit): boolean;
  onDirectEdit(value: string): void;
};

function SuggestingEditorImpl(
  {
    value,
    mode,
    language,
    ariaDescribedBy,
    onSuggest,
    onDirectEdit,
  }: SuggestingEditorProps,
  forwardedRef: Ref<SuggestingEditorHandle>,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const modeRef = useRef(mode);
  const languageRef = useRef(language);
  const onSuggestRef = useRef(onSuggest);
  const onDirectEditRef = useRef(onDirectEdit);
  const compositionBaseRef = useRef<string | null>(null);

  valueRef.current = value;
  modeRef.current = mode;
  languageRef.current = language;
  onSuggestRef.current = onSuggest;
  onDirectEditRef.current = onDirectEdit;

  useImperativeHandle(forwardedRef, () => ({
    focus: () => viewRef.current?.focus(),
    selection: () => {
      const view = viewRef.current;
      const domSelection = window.getSelection();
      if (view && domSelection?.anchorNode && domSelection.focusNode) {
        try {
          const anchor = view.posAtDOM(domSelection.anchorNode, domSelection.anchorOffset) - 1;
          const focus = view.posAtDOM(domSelection.focusNode, domSelection.focusOffset) - 1;
          return { from: Math.max(0, Math.min(anchor, focus)), to: Math.max(0, Math.max(anchor, focus)) };
        } catch {
          // Fall back to ProseMirror's normalized selection below.
        }
      }
      const selection = view?.state.selection;
      return selection
        ? { from: Math.max(0, selection.from - 1), to: Math.max(0, selection.to - 1) }
        : { from: 0, to: 0 };
    },
  }));

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const enterKeymap = keymap({
      Enter: (state, dispatch) => {
        dispatch?.(state.tr.replaceSelectionWith(schema.nodes.hard_break!.create()));
        return true;
      },
    });
    let view: EditorView;
    view = new EditorView(mount, {
      state: EditorState.create({
        doc: docFromText(valueRef.current),
        plugins: [enterKeymap, keymap(baseKeymap)],
      }),
      attributes: {
        "aria-label": "Editable working draft",
        "aria-multiline": "true",
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        role: "textbox",
        lang: languageRef.current,
        spellcheck: "false",
        "data-suggesting-editor": "true",
      },
      dispatchTransaction(transaction) {
        const before = textFromDoc(view.state.doc);
        const nextState = view.state.apply(transaction);
        const after = textFromDoc(nextState.doc);
        if (!transaction.docChanged) {
          view.updateState(nextState);
          return;
        }
        if (compositionBaseRef.current !== null || view.composing) {
          view.updateState(nextState);
          return;
        }
        if (modeRef.current === "editing") {
          view.updateState(nextState);
          onDirectEditRef.current(after);
          return;
        }
        const edit = transactionEdit(transaction, before, after);
        if (edit && onSuggestRef.current(edit)) {
          view.updateState(nextState);
        }
      },
      handleDOMEvents: {
        compositionstart(currentView) {
          compositionBaseRef.current = textFromDoc(currentView.state.doc);
          return false;
        },
        compositionend(currentView) {
          const base = compositionBaseRef.current;
          if (base === null) return false;
          if (modeRef.current !== "suggesting") {
            compositionBaseRef.current = null;
            return false;
          }
          requestAnimationFrame(() => {
            const preview = textFromDoc(currentView.state.doc);
            compositionBaseRef.current = null;
            const edit = diffDrafts(base, preview);
            if (edit && !onSuggestRef.current({ ...edit, inputType: "insertCompositionText" })) {
              currentView.updateState(
                EditorState.create({
                  doc: docFromText(valueRef.current),
                  plugins: [enterKeymap, keymap(baseKeymap)],
                }),
              );
            }
          });
          return false;
        },
      },
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      if (viewRef.current === view) viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || compositionBaseRef.current !== null) return;
    const current = textFromDoc(view.state.doc);
    if (current === value) return;
    const next = EditorState.create({
      doc: docFromText(value),
      plugins: view.state.plugins,
    });
    view.updateState(next);
  }, [value]);

  useEffect(() => {
    viewRef.current?.setProps({
      attributes: {
        "aria-label": "Editable working draft",
        "aria-multiline": "true",
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        role: "textbox",
        lang: language,
        spellcheck: "false",
        "data-suggesting-editor": "true",
      },
    });
  }, [language, ariaDescribedBy]);

  return <div className="suggest-editor-mount" ref={mountRef} />;
}

export const SuggestingEditor = forwardRef(SuggestingEditorImpl);
