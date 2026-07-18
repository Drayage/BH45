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

test("server-renders the Korean game prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /2045 하이라이트 리그/);
  assert.match(html, /플레이 처리 중계/);
  assert.match(html, /카드 공개/);
  assert.match(html, /즉시 능력/);
  assert.match(html, /내 스타터 덱/);
  assert.match(html, /ST-\d{3}/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("starter preview assets are removed and card data stays separated", async () => {
  const [page, packageJson, cards] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../data/base-cards.json", import.meta.url), "utf8").then(JSON.parse),
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
});
