import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AssistedExtraction } from "../../src/features/artwork-intake/components/AssistedExtraction";

const handlers = { onAccept: vi.fn(), onAdjust: vi.fn(), onReplace: vi.fn() };
const render = (candidates: Array<{ id: string; url: string }>) =>
  renderToStaticMarkup(createElement(AssistedExtraction, { candidates, ...handlers }));

describe("assisted extraction recovery", () => {
  it("shows tighter-selection recovery without an empty candidate section", () => {
    const html = render([]);
    expect(html).toContain("We need a tighter selection");
    expect(html).toContain("Adjust the box so it contains the logo with as little background as possible.");
    expect(html).not.toContain("Choose the best result");
    expect(html).not.toContain("candidate-previews");
  });

  it("shows cards only when at least one valid candidate exists", () => {
    const html = render([{ id: "one", url: "blob:one" }]);
    expect(html).toContain("Choose the best result");
    expect(html).toContain("candidate-previews");
    expect(html).toContain("Use this logo");
    expect(html).not.toContain("We need a tighter selection");
  });
});

