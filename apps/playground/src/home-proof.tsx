import { useEffect, useRef, useState } from "react";
import type { Correction, NotationPack } from "proofmarks";
import { Proofmarks } from "proofmarks/react";
import { cns3927, enUS, gb, jis, ks } from "proofmarks/notations";
import { useSiteText } from "./i18n/site-i18n";

type ProofScene = {
  id: string;
  label: string;
  lang: string;
  text: string;
  notation: NotationPack;
  corrections: readonly Correction[];
};

function scene(
  id: string, label: string, lang: string, notation: NotationPack,
  text: string, edits: readonly (readonly [string, string])[],
): ProofScene {
  return {
    id, label, lang, notation, text,
    corrections: edits.map(([before, after], index) => {
      const start = text.indexOf(before);
      if (start < 0 || text.indexOf(before, start + 1) !== -1) throw new Error(`Ambiguous hero edit: ${before}`);
      return {
        id: `hero-${id}-${index}`, type: "replace",
        target: { kind: "text-range", start, end: start + before.length }, replacement: after,
      };
    }),
  };
}

const scenes = [
  scene("en", "English · US", "en", enUS,
    "Small marks.\nQuiet changes.\nA different world.", [["Quiet", "Brave"], ["world", "voice"]]),
  scene("ja", "日本 · JIS", "ja", jis,
    "小さな印。\n静かな変化。\n言葉が動き出す。", [["静かな", "確かな"], ["動き出す", "息づく"]]),
  scene("zh", "中文 · GB", "zh-Hans", gb,
    "小小的记号。\n轻轻的修改。\n让文字被看见。", [["轻轻", "精准"], ["看见", "听见"]]),
  scene("tw", "臺灣 · CNS 3927", "zh-Hant-TW", cns3927,
    "小小的記號。\n輕輕的修改。\n讓文字被看見。", [["輕輕", "精準"], ["看見", "聽見"]]),
  scene("ko", "한국 · KS", "ko", ks,
    "작은 표시.\n조용한 변화.\n글이 달라집니다.", [["조용한", "섬세한"], ["달라집니다", "살아납니다"]]),
] as const;

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// The decorative ASCII impression follows the actual DOM glyph positions. The
// underlying proof stays selectable and remains the only accessible text.
function ProofSceneView({ sample, motion }: { sample: ProofScene; motion: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stage = root.current?.querySelector<HTMLElement>(".hero-proof-sheet");
    const surface = canvas.current;
    if (!stage || !surface) return;
    let live = true;
    const draw = () => {
      if (!live) return;
      const text = stage.firstChild;
      if (text?.nodeType !== Node.TEXT_NODE) return;
      const bounds = stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const style = getComputedStyle(stage);
      const raster = document.createElement("canvas");
      raster.lang = sample.lang;
      const scale = 2;
      raster.width = Math.ceil(bounds.width * scale);
      raster.height = Math.ceil(bounds.height * scale);
      const ink = raster.getContext("2d", { willReadFrequently: true });
      const ascii = surface.getContext("2d");
      if (!ink || !ascii) return;
      ink.scale(scale, scale);
      ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const range = document.createRange();
      let offset = 0;
      for (const char of sample.text) {
        range.setStart(text, offset);
        offset += char.length;
        range.setEnd(text, offset);
        if (/\s/u.test(char)) continue;
        const rect = range.getBoundingClientRect();
        const metrics = ink.measureText(char);
        const ascent = metrics.fontBoundingBoxAscent;
        const descent = metrics.fontBoundingBoxDescent;
        const baseline = rect.top - bounds.top + (rect.height - ascent - descent) / 2 + ascent;
        ink.fillText(char, rect.left - bounds.left, baseline);
      }
      const pixels = ink.getImageData(0, 0, raster.width, raster.height).data;
      const density = window.devicePixelRatio || 1;
      surface.width = Math.ceil(bounds.width * density);
      surface.height = Math.ceil(bounds.height * density);
      ascii.scale(density, density);
      const cellHeight = Math.max(2.8, parseFloat(style.fontSize) / 9);
      const cellWidth = cellHeight * 0.62;
      ascii.font = `600 ${cellHeight}px monospace`;
      ascii.textBaseline = "middle";
      ascii.textAlign = "center";
      ascii.fillStyle = style.color;
      for (let row = 0, y = 0; y < bounds.height; row++, y += cellHeight) {
        for (let col = 0, x = 0; x < bounds.width; col++, x += cellWidth) {
          let coverage = 0;
          let count = 0;
          for (let dy = Math.floor(y * scale); dy < Math.min((y + cellHeight) * scale, raster.height); dy++) {
            for (let dx = Math.floor(x * scale); dx < Math.min((x + cellWidth) * scale, raster.width); dx++) {
              coverage += pixels[(dy * raster.width + dx) * 4 + 3]!;
              count++;
            }
          }
          coverage /= count * 255;
          const threshold = (bayer[(row % 4) * 4 + col % 4]! + 0.5) / 16;
          if (coverage < 0.06 + threshold * 0.18) continue;
          ascii.fillText(coverage > 0.7 ? "#" : coverage > 0.4 ? "+" : coverage > 0.2 ? ":" : ".",
            x + cellWidth / 2, y + cellHeight / 2);
        }
      }
      setReady(true);
    };
    const observer = new ResizeObserver(draw);
    // Loading is scoped to this passage, including CJK glyphs absent from Latin
    // fonts. Never start the dissolve with a previous passage or fallback face.
    const style = getComputedStyle(stage);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    void document.fonts.load(font, sample.text).then(() => document.fonts.ready).then(() => {
      if (!live) return;
      draw();
      observer.observe(stage);
    }).catch(() => { if (live) draw(); });
    return () => { live = false; observer.disconnect(); };
  }, [sample]);

  return <div className="proof-performance-scene" ref={root} lang={sample.lang} data-motion={motion} data-ready={ready}>
    <canvas ref={canvas} className="proof-ascii" lang={sample.lang} aria-hidden="true" />
    <Proofmarks as="article" id="proof-stage" className="hero-proof-sheet"
      notation={sample.notation} corrections={sample.corrections} appearance="editorial"
      animate={false} lang={sample.lang} markStyle={{ strokeScale: 0.75 }}>
      {sample.text}
    </Proofmarks>
  </div>;
}

export function HeroProof() {
  const { t } = useSiteText();
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [replay, setReplay] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [still, setStill] = useState(false);
  const sample = scenes[index]!;
  const running = playing && inView && pageVisible && !reducedMotion;
  const motion = inView && pageVisible && !still && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); };
    media.addEventListener("change", change);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), { threshold: 0.35 });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % scenes.length), 8000);
    return () => window.clearTimeout(timer);
  }, [running, index, replay]);

  const select = (next: number) => {
    setPlaying(false);
    setStill(false);
    setIndex(next);
    setReplay((value) => value + 1);
  };
  const pause = () => { setPlaying(false); setStill(true); };

  return (
    <div className="hero-proof-wrap" ref={root} data-playing={running}>
      <div className="proof-performance" onPointerDown={pause}>
        <ProofSceneView key={`${sample.id}-${replay}`} sample={sample} motion={motion} />
      </div>
      <div className="proof-controls">
        <button className="proof-play-toggle" type="button"
          aria-label={reducedMotion ? t.home.nextProof : playing ? t.home.pause : t.home.play}
          onClick={() => {
            if (reducedMotion) select((index + 1) % scenes.length);
            else if (playing) pause();
            else { setStill(false); setPlaying(true); setReplay((value) => value + 1); }
          }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
            {playing ? <path d="M5 3v10M11 3v10" /> : <path d="m5 3 8 5-8 5Z" />}
          </svg>
        </button>
        <div className="proof-timeline" role="group" aria-label={t.home.proofNotation}>
          {scenes.map((item, next) => <button key={`${item.id}-${replay}`} type="button"
            aria-label={item.label} aria-pressed={index === next}
            data-running={index === next && running} onClick={() => select(next)}>
            <span aria-hidden="true" />
          </button>)}
        </div>
      </div>
    </div>
  );
}
