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
  assert.match(html, /시즌 시작/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("starter preview assets are removed and card data stays separated", async () => {
  const [page, packageJson, cards, expansions] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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
  assert.equal(expansions.length, 15);
  assert.ok(expansions.every((card) => card.set === "big_fly" && card.id.startsWith("BF-") && card.abilityTextKo));
});
