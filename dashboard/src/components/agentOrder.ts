/** ONE ordering rule for conversations, shared by the tabs and the widget.
 *
 * The dashboard grouped by liveness and honoured drag-and-drop; the widget
 * sorted by arrival time alone. Same conversations, different order, in two
 * surfaces the user sees at once - so the third tab and the third avatar
 * were not the same agent, which is exactly the kind of mismatch that makes
 * someone click the wrong one.
 *
 * The rule: online conversations first (in arrival order), then offline
 * (most recently ended first). Within each group, tabs the user has dragged
 * into place come first, in the order they were dragged.
 */
export interface AgentMetaLike {
  online?: boolean;
  activated_at?: number;
  offline_since?: number | null;
  manual_pos?: number | null;
}

export function orderAgents(
  names: string[],
  meta: Record<string, AgentMetaLike> = {},
): string[] {
  const of = (n: string) => meta[n] ?? {};
  const manual = (n: string) => of(n).manual_pos ?? null;

  const group = (subset: string[], natural: (a: string, b: string) => number) =>
    [...subset].sort((a, b) => {
      const [ma, mb] = [manual(a), manual(b)];
      if (ma != null && mb != null) return ma - mb;
      if (ma != null) return -1;
      if (mb != null) return 1;
      return natural(a, b);
    });

  // A daemon without agents_meta yields the legacy flat list: all online.
  const online = names.filter((n) => of(n).online ?? true);
  const offline = names.filter((n) => !(of(n).online ?? true));

  return [
    ...group(online, (a, b) => (of(a).activated_at ?? 0) - (of(b).activated_at ?? 0)),
    ...group(offline, (a, b) => (of(b).offline_since ?? 0) - (of(a).offline_since ?? 0)),
  ];
}
