import { InvalidCorrectionsError } from "@proofmarks/dom";
import {
  createElement,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  createProofmarks,
  type Correction,
  type NotationPack,
  type ProofmarksInstance,
  type ProofmarksAppearance,
  type ProofmarksIssue,
  type ProofmarksMarkStyle,
  type ProofmarksRenderInfo,
} from "./index";

export type ProofmarksElement =
  | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  | "pre" | "code" | "td" | "th" | "label"
  | "article"
  | "aside"
  | "blockquote"
  | "div"
  | "figcaption"
  | "figure"
  | "footer"
  | "header"
  | "li"
  | "main"
  | "nav"
  | "p"
  | "section"
  | "span";

export type ProofmarksProps = {
  notation: NotationPack;
  corrections: readonly Correction[];
  appearance?: ProofmarksAppearance;
  animate?: boolean;
  showProofmarks?: boolean;
  markStyle?: ProofmarksMarkStyle;
  children: ReactNode;
  as?: ProofmarksElement;
  className?: string;
  style?: CSSProperties;
  id?: string;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  role?: string;
  title?: string;
  "aria-label"?: string;
  onIssue?: (issue: ProofmarksIssue) => void;
  onRender?: (info: ProofmarksRenderInfo) => void;
};

/** Declaratively render proofreading notation over normal React children. */
export function Proofmarks({
  notation,
  corrections,
  appearance = "technical",
  animate = true,
  showProofmarks = true,
  markStyle,
  children,
  as = "div",
  className,
  style,
  id,
  lang,
  dir,
  role,
  title,
  "aria-label": ariaLabel,
  onIssue,
  onRender,
}: ProofmarksProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const instanceRef = useRef<ProofmarksInstance | null>(null);

  const callbacks = useRef({ onIssue, onRender });
  const lastInvalid = useRef<string | undefined>(undefined);
  const handlers = useRef({
    onIssue(issue: ProofmarksIssue): void {
      if (issue.code === "invalid-corrections") {
        if (lastInvalid.current === issue.message) return;
        lastInvalid.current = issue.message;
      }
      callbacks.current.onIssue?.(issue);
    },
    onRender(info: ProofmarksRenderInfo): void {
      lastInvalid.current = undefined;
      callbacks.current.onRender?.(info);
    },
  });

  useEffect(() => {
    callbacks.current = { onIssue, onRender };
  });

  useEffect(() => () => {
    instanceRef.current?.destroy();
    instanceRef.current = null;
    lastInvalid.current = undefined;
  }, [as]);

  // The DOM adapter compares option values; inline objects and callbacks are safe.
  // Running after each commit also retries initially invalid data when text arrives.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const options = {
      notation, corrections, appearance, animate, showProofmarks,
      ...(markStyle ? { markStyle } : {}),
      ...handlers.current,
    };
    try {
      if (instanceRef.current) instanceRef.current.update(options);
      else instanceRef.current = createProofmarks(element, options);
      lastInvalid.current = undefined;
    } catch (error) {
      if (!(error instanceof InvalidCorrectionsError)) throw error;
      if (!instanceRef.current) {
        instanceRef.current = createProofmarks(element, { ...options, corrections: [] });
      }
      handlers.current.onIssue(error.issue);
    }
  });

  return createElement(
    as,
    {
      ref: rootRef,
      className,
      style,
      id,
      lang,
      dir,
      role,
      title,
      "aria-label": ariaLabel,
    },
    children,
  );
}
