import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline } from "./richText";

describe("richText", () => {
  it("turns **bold** into a token instead of leaving asterisks", () => {
    expect(parseInline("the **release** is ready")).toEqual([
      { kind: "text", text: "the " },
      { kind: "bold", text: "release" },
      { kind: "text", text: " is ready" },
    ]);
  });

  it("leaves plain prose as a single span - the common case", () => {
    expect(parseInline("nothing to mark up")).toEqual([
      { kind: "text", text: "nothing to mark up" },
    ]);
  });

  it("does not read markup inside code", () => {
    expect(parseInline("`a ** b`")).toEqual([{ kind: "code", text: "a ** b" }]);
  });

  it("collects dash lines into one list", () => {
    expect(parseBlocks("intro\n- one\n- two")).toEqual([
      { kind: "p", spans: [{ kind: "text", text: "intro" }] },
      {
        kind: "ul",
        items: [
          [{ kind: "text", text: "one" }],
          [{ kind: "text", text: "two" }],
        ],
      },
    ]);
  });

  it("keeps markup inside list items", () => {
    const [list] = parseBlocks("- a **b**") as [{ kind: "ul"; items: unknown[] }];
    expect(list.items[0]).toEqual([
      { kind: "text", text: "a " },
      { kind: "bold", text: "b" },
    ]);
  });

  it("never invents markup from a lone asterisk", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ kind: "text", text: "2 * 3 = 6" }]);
  });

  it("survives empty text", () => {
    expect(parseBlocks("")).toEqual([]);
  });
});
