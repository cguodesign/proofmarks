type RenderJob = {
  element: HTMLElement;
  prepare: () => (() => void) | undefined;
  size: () => { width: number; height: number; vertical: boolean };
  /** Box or text extent differs from the last render (cheap reads only). */
  layoutChanged: () => boolean;
};

function sizeChanged(previous: { width: number; height: number }, width: number, height: number): boolean {
  return Math.abs(width - previous.width) > 0.5 || Math.abs(height - previous.height) > 0.5;
}

/** One shared ResizeObserver and frame per document; measurements precede writes. */
class RenderScheduler {
  private jobs = new Map<Element, RenderJob>();
  private pending = new Set<RenderJob>();
  private effects = new Set<() => void>();
  private frame = 0;
  private observer: ResizeObserver;
  private view: Window & typeof globalThis;

  constructor(private document: Document) {
    this.view = document.defaultView!;
    this.observer = new this.view.ResizeObserver((entries) => {
      for (const entry of entries) {
        const job = this.jobs.get(entry.target);
        if (!job) continue;
        const size = entry.borderBoxSize?.[0];
        const previous = job.size();
        const width = size ? (previous.vertical ? size.blockSize : size.inlineSize) : entry.contentRect.width;
        const height = size ? (previous.vertical ? size.inlineSize : size.blockSize) : entry.contentRect.height;
        if (sizeChanged(previous, width, height)) this.schedule(job);
      }
    });
    this.view.addEventListener("resize", this.resize);
    document.fonts?.addEventListener("loadingdone", this.fontsLoaded);
  }

  // ResizeObserver reports box changes; the window event also catches viewport-relative
  // type that moves glyphs inside an unchanged box. Read every job before scheduling.
  private resize = (): void => {
    const changed = [...this.jobs.values()].filter((job) => job.layoutChanged());
    changed.forEach((job) => this.schedule(job));
  };

  private fontsLoaded = (event: Event): void => {
    const faces = (event as FontFaceSetLoadEvent).fontfaces;
    if (!faces?.length) return;
    const normalize = (family: string): string => family.replace(/["']/g, "").trim().toLowerCase();
    const changed = new Set(faces.map((face) => normalize(face.family)));
    for (const job of this.jobs.values()) {
      const nodes = [job.element, ...job.element.querySelectorAll("*")];
      if (nodes.some((node) => !node.closest("[data-proofmarks-overlay]") &&
          this.view.getComputedStyle(node).fontFamily.split(",").some((family) => changed.has(normalize(family))))) {
        this.schedule(job);
      }
    }
  };

  register(job: RenderJob): () => void {
    this.jobs.set(job.element, job);
    this.observer.observe(job.element, { box: "border-box" });
    if (this.document.fonts?.status === "loading") {
      void this.document.fonts.ready.then(() => {
        if (this.jobs.get(job.element) === job) this.schedule(job);
      });
    }
    return () => {
      this.pending.delete(job);
      this.jobs.delete(job.element);
      this.observer.unobserve(job.element);
      if (this.jobs.size) return;
      this.observer.disconnect();
      this.view.removeEventListener("resize", this.resize);
      this.document.fonts?.removeEventListener("loadingdone", this.fontsLoaded);
      if (this.frame) this.view.cancelAnimationFrame(this.frame);
      this.effects.clear();
      schedulers.delete(this.document);
    };
  }

  schedule(job: RenderJob): void {
    this.pending.add(job);
    this.requestFrame();
  }

  cancel(job: RenderJob): void {
    this.pending.delete(job);
  }

  effect(effect: () => void): void {
    this.effects.add(effect);
    this.requestFrame();
  }

  private requestFrame(): void {
    if (this.frame) return;
    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = 0;
      const jobs = [...this.pending];
      this.pending.clear();
      const commits = jobs.map((job) => job.prepare());
      commits.forEach((commit) => commit?.());
      const effects = [...this.effects];
      this.effects.clear();
      effects.forEach((effect) => effect());
    });
  }
}

const schedulers = new WeakMap<Document, RenderScheduler>();
export function getRenderScheduler(document: Document): RenderScheduler {
  let scheduler = schedulers.get(document);
  if (!scheduler) {
    scheduler = new RenderScheduler(document);
    schedulers.set(document, scheduler);
  }
  return scheduler;
}
