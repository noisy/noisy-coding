import { onBeforeUnmount, ref, type Ref } from "vue";

/** Document Picture-in-Picture: a real always-on-top window holding real DOM.
 *
 * The element is MOVED into the floating window, not re-rendered, so there is
 * one component with one state - and it goes back where it came from when the
 * window closes.
 *
 * Chrome only, and only from a click: browsers refuse to spawn a floating
 * window without a user gesture.
 */
export function useDocumentPip(
  host: Ref<HTMLElement | null>,
  anchor: Ref<HTMLElement | null>,
  // 3:2 - the widget's own proportion. Chrome remembers the last size a
  // user dragged, so this only decides the FIRST open on a fresh profile.
  size: { width: number; height: number } = { width: 420, height: 280 },
) {
  const supported = "documentPictureInPicture" in window;
  const open = ref(false);

  /** Styles do NOT follow the DOM into the PiP window - copy every sheet or
   *  the widget arrives completely unstyled. */
  function copyStyles(target: Document) {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("");
        const style = target.createElement("style");
        style.textContent = css;
        target.head.appendChild(style);
      } catch {
        // A cross-origin sheet refuses .cssRules - re-link it instead.
        if (sheet.href) {
          const link = target.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href;
          target.head.appendChild(link);
        }
      }
    }
  }

  async function popOut() {
    if (!supported || !host.value || open.value) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pip = await (window as any).documentPictureInPicture.requestWindow(size);
    copyStyles(pip.document);
    /* The floating window has to lay the widget out itself.
     *
     * Only the widget is moved - the box that positioned it stays behind in
     * the page, so without this the widget lands top-left and every pixel of
     * unused height piles up underneath it. That is the gap that grew as the
     * window got taller. Pin it to the bottom, where a conversation belongs:
     * newest line closest to the edge. */
    const doc = pip.document;
    doc.documentElement.style.height = "100%";
    Object.assign(doc.body.style, {
      margin: "0",
      height: "100%",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      padding: "6px",
      boxSizing: "border-box",
      overflow: "hidden",
    });
    doc.body.classList.add(...document.body.classList);
    doc.body.append(host.value);
    /* A floor for the floating window: below 280px the widget's content
     * cannot shrink further (its own min-width) and starts CLIPPING, which
     * reads as "part of the widget is hidden". PiP windows have no
     * min-size API, so bounce back after the drag ends; if the browser
     * refuses programmatic resize, scrolling is still prevented and the
     * user simply sees the clamp not happen - never an error. */
    const MIN_W = 280;
    const MIN_H = 160;
    let bounce: ReturnType<typeof setTimeout> | undefined;
    pip.addEventListener("resize", () => {
      clearTimeout(bounce);
      bounce = setTimeout(() => {
        if (pip.innerWidth >= MIN_W && pip.innerHeight >= MIN_H) return;
        try {
          pip.resizeTo(
            Math.max(pip.outerWidth, MIN_W),
            Math.max(pip.outerHeight, MIN_H),
          );
        } catch {
          /* browser said no - nothing to do */
        }
      }, 150);
    });
    open.value = true;
    pip.addEventListener("pagehide", () => {
      anchor.value?.append(host.value!);
      open.value = false;
    });
  }

  /* The floating window holds a node owned by THIS page. Reload the page and
   * that node dies with it, leaving a window that still looks right and has
   * stopped updating - the worst possible failure, because it lies. Close it
   * on the way out; `pagehide` fires on reload and navigation, where
   * onBeforeUnmount does not always run. */
  function closePip() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).documentPictureInPicture?.window?.close?.();
  }
  window.addEventListener("pagehide", closePip);
  onBeforeUnmount(() => {
    window.removeEventListener("pagehide", closePip);
    closePip();
  });

  return { supported, open, popOut };
}
