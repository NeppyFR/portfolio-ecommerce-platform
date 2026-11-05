import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/desk/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

import { EnterScreen } from "@/desk/enter/EnterScreen";
import { StepInChips } from "@/desk/enter/StepInChips";
import { DeskShell } from "@/desk/shell/DeskShell";
import { PageHead } from "@/desk/shell/PageHead";
import { JumpBox } from "@/ui/JumpBox";

const shell = (path: string) => {
  nav.path = path;
  return renderToString(
    <DeskShell>
      <p data-child="yes">child</p>
    </DeskShell>,
  );
};
const count = (html: string, needle: string) => html.split(needle).length - 1;

/** What the static export prints: Owner, before any stored profile can be read. */
describe("shell in static HTML", () => {
  beforeEach(() => {
    nav.path = "/desk/";
  });

  it("puts the skip link first, then the rail, then main", () => {
    const html = shell("/desk/orders/");
    expect(html.indexOf('class="dk-skip"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="dk-skip"')).toBeLessThan(html.indexOf('class="dk-top"'));
    expect(html.indexOf('class="dk-top"')).toBeLessThan(html.indexOf('id="main"'));
    expect(html).toContain('data-profile="owner"');
  });

  it("draws the sidebar's groups in order and keeps the parent lit on a sub-screen", () => {
    const html = shell("/desk/orders/returns/");
    expect(count(html, 'class="dk-side-label"')).toBe(3);
    expect(html.indexOf(">Growth<")).toBeLessThan(html.indexOf(">Workspace<"));
    expect(html.indexOf(">Workspace<")).toBeLessThan(html.indexOf(">System<"));
    expect(html).toMatch(/href="\/desk\/customers\/?"/);
    expect(html).toMatch(/aria-current="true"[^>]*href="\/desk\/orders\/?"/);
  });

  it("puts the shop link under the brand, before the list, so a short window still shows it", () => {
    const html = shell("/desk/");
    const side = html.indexOf('class="dk-side-brand"');
    const link = html.indexOf('class="dk-side-shop"');
    expect(side).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(side);
    expect(link).toBeLessThan(html.indexOf('class="dk-side-nav"'));
    expect(html).toMatch(/<a(?=[^>]*class="dk-side-shop")(?=[^>]*href="\/shop\/?")[^>]*>/);
  });

  it("lights Finances and IT for every screen under them, and hides superUser from the owner", () => {
    expect(shell("/desk/finance/costs/")).toMatch(/aria-current="true"[^>]*href="\/desk\/finance\/?"/);
    const itScreen = shell("/desk/system/health/");
    expect(itScreen).toMatch(/aria-current="true"[^>]*href="\/desk\/system\/?"/);
    expect(itScreen).not.toMatch(/href="\/desk\/su\/?"/);
  });

  it("names /desk/ Dashboard and marks it as the current page", () => {
    const html = shell("/desk/");
    expect(html).toContain(">Dashboard<");
    expect(html).toMatch(/aria-current="page"[^>]*href="\/desk\/?"/);
  });

  it("renders the screen for the owner and the locked state on a superUser route", () => {
    expect(shell("/desk/finance/")).toContain('data-child="yes"');
    const locked = shell("/desk/su/access/");
    expect(locked).toContain("data-screen-locked");
    expect(locked).not.toContain('data-child="yes"');
    expect(locked).not.toMatch(/href="\/desk\/su\/?"/);
  });

  it("keeps the profile choice apart from the rail", () => {
    const html = shell("/desk/enter/");
    expect(html).toContain('data-child="yes"');
    expect(html).not.toContain("dk-regions");
    expect(html).not.toContain("dk-dock");
  });

  it("carries Bell, Live pill and dock in the markup", () => {
    const html = shell("/desk/orders/");
    expect(html).toContain("dk-live");
    expect(html).toContain("dk-dock");
    expect(count(html, "popover=")).toBeGreaterThanOrEqual(2);
  });
});

describe("profile choice", () => {
  it("offers four people plus superUser and no password field", () => {
    const html = renderToString(<EnterScreen />);
    for (const name of ["Mara Keller", "Jonas Aebi", "Lea Brunner", "Nico Steiner", "superUser"]) expect(html).toContain(name);
    expect(html).toContain("scrypt");
    expect(html).not.toContain("password\"");
    expect(html.match(/<input/g)).toBeNull();
  });
  it("gives the landing three chips with a scope tooltip", () => {
    const html = renderToString(<StepInChips />);
    expect(count(html, "<button")).toBe(3);
    expect(count(html, "title=")).toBe(3);
  });
});

describe("page head", () => {
  it("prints the plain name, the sentence, touches and the second level", () => {
    const html = renderToString(<PageHead id="orders" title="14 to pack" />);
    expect(html).toContain("<h1");
    expect(html).toContain("14 to pack");
    expect(html).toContain("dk-head-touches");
    expect(html).toMatch(/href="\/desk\/orders\/returns\/?"/);
    expect(html).toContain('aria-current="page"');
  });
  it("prints no pills on a screen without a second level", () => {
    expect(renderToString(<PageHead id="customers" title="t" />)).not.toContain("dk-pills");
  });
  it("marks the sub screen as current, not its parent", () => {
    const html = renderToString(<PageHead id="returns" title="t" />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/desk\/orders\/returns\/?"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/desk\/orders\/?"/);
  });
});

describe("jump box", () => {
  it("is closed and empty until asked", () => {
    const html = renderToString(<JumpBox />);
    expect(html).toContain("<dialog");
    expect(html).not.toContain(" open");
    expect(html).not.toContain("<input");
  });
});
