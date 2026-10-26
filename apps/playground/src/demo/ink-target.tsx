import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { Correction, TextPointTarget, TextRangeTarget } from "proofmarks";
import { createTextPointRange, createTextRange } from "@proofmarks/dom";

type Box = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };

/** A small drawing lane next to the actual text; the text itself remains selectable. */
export function InkTarget({
  paperRef, correction, vertical, label, onMark,
}: {
  paperRef: RefObject<HTMLDivElement | null>;
  correction: Correction;
  vertical: boolean;
  label: string;
  onMark: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [stroke, setStroke] = useState<Point[]>([]);
  const pointer = useRef<number | null>(null);

  useEffect(() => {
    const paper = paperRef.current;
    const proof = paper?.querySelector<HTMLElement>(".story-proof");
    if (!paper || !proof) return;
    let frame = 0;
    let stopped = false;
    function measure() {
      if (stopped || !paper || !proof) return;
      const target: TextRangeTarget | TextPointTarget | undefined =
        correction.type === "transpose" ? correction.targets[0]
          : correction.type === "move" ? correction.source
          : correction.target.kind === "correction" ? undefined : correction.target;
      if (!target) return;
      const range = target.kind === "text-point"
        ? createTextPointRange(proof, target) : createTextRange(proof, target);
      const rect = [...range.getClientRects()].find((rect) => vertical ? rect.height > 0 : rect.width > 0)
        ?? range.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      const origin = paper.getBoundingClientRect();
      const width = vertical ? 24 : Math.max(36, Math.min(rect.width, 100));
      const height = vertical ? Math.max(36, Math.min(rect.height, 220)) : 24;
      setBox({
        left: Math.max(4, Math.min(origin.width - width - 4, rect.left - origin.left + (vertical ? -27 : 0))),
        top: Math.max(4, Math.min(origin.height - height - 4, rect.top - origin.top + (vertical ? 0 : rect.height + 2))),
        width, height,
      });
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(proof);
    observer.observe(paper);
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(schedule);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [paperRef, correction, vertical]);

  function point(event: PointerEvent<HTMLButtonElement>): Point {
    const rect = paperRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function cancel() {
    pointer.current = null;
    setStroke([]);
  }

  if (!box) return null;
  return <>
    <button
      type="button"
      className={`story-ink-target${vertical ? " is-vertical-target" : ""}`}
      data-ink-target={correction.id}
      style={box}
      aria-label={label}
      title={label}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        setStroke([point(event)]);
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) {
          const next = point(event);
          setStroke((points) => [...points.slice(-150), next]);
        }
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        cancel();
        onMark();
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onKeyDown={(event) => { if (event.key === "Escape") cancel(); }}
      onClick={(event) => { if (event.detail === 0) onMark(); }}
    ><span aria-hidden="true" /></button>
    {stroke.length > 1 && <svg className="story-pen-stroke" aria-hidden="true"><polyline points={stroke.map(({ x, y }) => `${x},${y}`).join(" ")} /></svg>}
  </>;
}
