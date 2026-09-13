type Analytics = {
  readonly enabled: boolean;
  trackScroll(): void;
  trackDepth(depth: number): void;
};

// Depth means the bottom of the viewport as a percentage of document height.
// Sample only on scrolling: initial visibility and resizing are not engagement.
export function createScrollTracker(analytics: Analytics) {
  const reached = new Set<number>();
  let scrolled = false;
  return (top: number, viewport: number, height: number) => {
    if (!analytics.enabled || top <= 0 || height <= viewport) return;
    if (!scrolled) { analytics.trackScroll(); scrolled = true; }
    const depth = Math.min(100, (top + viewport) / height * 100);
    for (const threshold of [25, 50, 75, 90, 100]) {
      if (depth + 0.1 >= threshold && !reached.has(threshold)) {
        analytics.trackDepth(threshold);
        reached.add(threshold);
      }
    }
  };
}

export function observePageScroll(view: Window, page: Document, analytics: Analytics) {
  const track = createScrollTracker(analytics);
  let pending = 0;
  const scroll = () => {
    if (pending || !analytics.enabled) return;
    pending = view.requestAnimationFrame(() => {
      pending = 0;
      track(view.scrollY, view.innerHeight, page.documentElement.scrollHeight);
    });
  };
  view.addEventListener('scroll', scroll, { passive: true });
  return () => { view.removeEventListener('scroll', scroll); view.cancelAnimationFrame(pending); };
}
