import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Korean season title and settings", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /하이라이트/);
  assert.match(html, /리그 2045/);
  assert.match(html, /리그 설정/);
  assert.match(html, /스타터 덱/);
  assert.match(html, /Big Fly/);
  assert.match(html, /Rally Cap/);
  assert.match(html, /Errors!/);
  assert.match(html, /Double Trouble/);
  assert.match(html, /AI 난이도/);
  assert.match(html, /어려움/);
  assert.match(html, /매우 어려움/);
  assert.match(html, /CPU 스타터 5장을 무작위 FA로 교체/);
  assert.match(html, /시즌 시작/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("starter preview assets are removed and card data stays separated", async () => {
  const [page, prototype, packageJson, cards, expansions] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-prototype.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../data/base-cards.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../data/expansion-cards.json", import.meta.url), "utf8").then(JSON.parse),
  ]);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.equal(cards.length, 120);

  const starters = cards.filter((card) => card.category === "starter");
  const freeAgents = cards.filter((card) => card.category === "free_agent");
  assert.equal(starters.length, 60);
  assert.equal(freeAgents.length, 60);
  assert.ok(starters.every((card) => card.id.startsWith("ST-")));
  assert.ok(freeAgents.every((card) => card.id.startsWith("FA-")));
  assert.ok(cards.every((card) => !card.abilityText || card.abilityTextKo));
  assert.equal(expansions.length, 105);
  const expectedExpansionCounts = {
    rally_cap: 15,
    magna_glove: 10,
    robot_hitters: 10,
    cyborg_pitchers: 10,
    errors: 15,
    big_fly: 15,
    home_cookin: 15,
    double_trouble: 15,
  };
  for (const [set, count] of Object.entries(expectedExpansionCounts)) {
    assert.equal(expansions.filter((card) => card.set === set).length, count);
  }
  assert.equal(new Set(expansions.map((card) => card.id)).size, expansions.length);
  assert.ok(expansions.every((card) => !card.abilityText || card.abilityTextKo));
  assert.match(prototype, /function drawCheck\(context: AbilityContext\)/);
  assert.match(prototype, /function replaceWithMinor\(side: Side, card: Card\)/);
  assert.match(prototype, /text\.includes\("cloning"\)/);
  assert.match(prototype, /hard: \{ label: "어려움", count: 3/);
  assert.match(prototype, /very_hard: \{ label: "매우 어려움", count: 5/);
  assert.match(prototype, /const recruits = freeAgents\.slice\(0, count\)/);
  assert.match(prototype, /freeAgents: freeAgents\.slice\(count\)/);
});

test("coaches and ball parks ship as complete expansion sets", async () => {
  const [coaches, ballparks, prototype] = await Promise.all([
    readFile(new URL("../data/coaches.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../data/ballparks.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/game-prototype.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(coaches.length, 15);
  assert.equal(ballparks.length, 10);
  assert.equal(new Set(coaches.map((card) => card.id)).size, coaches.length);
  assert.equal(new Set(ballparks.map((card) => card.id)).size, ballparks.length);
  assert.ok(coaches.every((card) => card.nameKo && card.abilityTextKo));
  assert.ok(ballparks.every((card) => card.nameKo && card.abilityTextKo));
  assert.match(prototype, /game\.phase === "coach_draft"/);
  assert.match(prototype, /game\.phase === "choosing_ballpark"/);
  assert.match(prototype, /function applyCoachBeforePlay/);
  assert.match(prototype, /function applyBallpark/);
  assert.match(prototype, /hitsIgnored=\{visitorSaveReveal\}/);
  assert.match(prototype, /CPU가 남긴 위협 안타 확정/);
  assert.match(prototype, /focusTeam: "cpu"/);
});

test("ships an installable PWA shell", async () => {
  const [manifest, worker, registration, layout] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/pwa-register.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
  await Promise.all([
    access(new URL("../public/icons/icon-192.png", import.meta.url)),
    access(new URL("../public/icons/icon-512.png", import.meta.url)),
    access(new URL("../public/icons/icon-maskable-512.png", import.meta.url)),
    access(new URL("../public/icons/apple-touch-icon.png", import.meta.url)),
  ]);
  assert.match(worker, /self\.addEventListener\("install"/);
  assert.match(worker, /self\.addEventListener\("fetch"/);
  assert.match(registration, /navigator\.serviceWorker\.register\("\/sw\.js"/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
});
