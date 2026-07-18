"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import cardData from "@/data/base-cards.json";
import expansionCardData from "@/data/expansion-cards.json";

type PlayerType = "natural" | "cyborg" | "robot";
type Speed = "slow" | "average" | "fast";
type Hit = "single" | "double" | "triple" | "home_run";
type ThreatHit = Hit | "walk";
type ExpansionSet = "big_fly";
type AiDifficulty = "normal" | "hard" | "very_hard";
type Screen = "title" | "game";

type Card = {
  id: string;
  set: "base" | ExpansionSet;
  category: "starter" | "free_agent";
  name: string;
  team: string;
  tier: "rookie" | "veteran" | null;
  type: PlayerType;
  cost: number | null;
  revenue: number;
  speed: Speed;
  pinchHitter: boolean;
  abilityText: string | null;
  abilityTextKo: string | null;
  hits: Hit[];
};

type Runner = { cardId: string; speed: Speed };
type RunnerMotion = {
  sequence: number;
  hit: ThreatHit | "ability";
  cardId: string;
  speed: Speed;
  from: 0 | 1 | 2 | 3;
  to: 1 | 2 | 3 | "score";
  batter?: boolean;
};
type Side = {
  team: string;
  deck: Card[];
  discard: Card[];
  minors: Card[];
  onDeck: Card | null;
  hand: Card[];
  played: Card[];
  bases: Array<Runner | null>;
  pending: ThreatHit[];
  pendingSpeed: Speed | null;
  pendingHitAndRun: boolean;
  score: number;
  revenue: number;
};

type ResolutionEvent = {
  kind: "reveal" | "ability" | "settle" | "threat" | "save" | "buy" | "next";
  actor: "player" | "cpu" | "system";
  title: string;
  detail: string;
  card?: Card;
  snapshot?: ResolutionSnapshot;
  runnerMotions?: RunnerMotion[];
  abilityTriggered?: boolean;
};

type MarketActivity = {
  buyer: "player" | "cpu";
  recruit: Card;
  demote: Card;
  replacement: Card | null;
};

type VisualSide = {
  pending: ThreatHit[];
  pendingSpeed: Speed | null;
  bases: Array<Runner | null>;
  score: number;
};

type ResolutionSnapshot = {
  player: VisualSide;
  cpu: VisualSide;
};

type MoveFrame = {
  acting: VisualSide;
  opposing: VisualSide;
};

type GameState = {
  player: Side;
  cpu: Side;
  round: number;
  phase: "setting_on_deck" | "playing" | "visitor_save" | "buying" | "series_finished";
  stage: "exhibition" | "world_series";
  gameNumber: number;
  exhibitionWins: { player: number; cpu: number };
  worldSeriesWins: { player: number; cpu: number };
  market: Card[];
  freeAgentDeck: Card[];
  playerBudget: number;
  cpuBudget: number;
  purchaseTurn: "player" | "cpu" | null;
  cpuBought: boolean;
  pendingPurchaseId: string | null;
  marketActivity: MarketActivity[];
  newMarketIds: string[];
  marketUpdateKey: number;
  selectedId: string | null;
  resolutionKey: number;
  lastResolution: ResolutionEvent[];
  log: string[];
  enabledExpansions: ExpansionSet[];
  aiDifficulty: AiDifficulty;
  cpuStartingFa: Card[];
};

const baseCards = cardData as Card[];
const expansionCards = expansionCardData as Card[];
const cards = [...baseCards, ...expansionCards];
const teams = ["San Francisco", "Los Angeles", "Boston", "New York"];
const teamLabel: Record<string, string> = {
  "San Francisco": "샌프란시스코",
  "Los Angeles": "로스앤젤레스",
  Boston: "보스턴",
  "New York": "뉴욕",
};
const teamCode: Record<string, string> = {
  "San Francisco": "SF",
  "Los Angeles": "LA",
  Boston: "BOS",
  "New York": "NY",
};
const typeLabel: Record<PlayerType, string> = { natural: "내추럴", cyborg: "사이보그", robot: "로봇" };
const speedLabel: Record<Speed, string> = { slow: "느림", average: "보통", fast: "빠름" };
const hitLabel: Record<ThreatHit, string> = {
  single: "1루타",
  double: "2루타",
  triple: "3루타",
  home_run: "홈런",
  walk: "볼넷",
};
const expansionLabel: Record<ExpansionSet, string> = { big_fly: "Big Fly" };
const aiDifficultyConfig: Record<AiDifficulty, { label: string; count: number; detail: string }> = {
  normal: { label: "보통", count: 0, detail: "CPU도 스타터 15장으로 시작" },
  hard: { label: "어려움", count: 3, detail: "CPU 스타터 3장을 무작위 FA로 교체" },
  very_hard: { label: "매우 어려움", count: 5, detail: "CPU 스타터 5장을 무작위 FA로 교체" },
};
const expansionCatalog = [
  { id: "big_fly" as ExpansionSet, code: "BF", name: "Big Fly", count: 15, ready: true },
  { code: "CO", name: "Coaches", count: 15, ready: false },
  { code: "RC", name: "Rally Cap", count: 15, ready: false },
  { code: "NM", name: "Naturals & Magna Glove", count: 10, ready: false },
  { code: "RH", name: "Robot Hitters", count: 10, ready: false },
  { code: "CP", name: "Cyborg Pitchers", count: 10, ready: false },
  { code: "ER", name: "Errors!", count: 15, ready: false },
  { code: "HC", name: "Home Cookin'", count: 15, ready: false },
  { code: "DT", name: "Double Trouble", count: 15, ready: false },
] as const;

function shuffle<T>(input: T[]) {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeSide(team: string): Side {
  const deck = shuffle(
    cards.filter(
      (card) =>
        card.category === "starter" &&
        card.id.startsWith("ST-") &&
        card.team === team,
    ),
  );
  return {
    team,
    deck: deck.slice(6),
    discard: [],
    minors: [],
    onDeck: null,
    hand: deck.slice(0, 6),
    played: [],
    bases: [null, null, null],
    pending: [],
    pendingSpeed: null,
    pendingHitAndRun: false,
    score: 0,
    revenue: 0,
  };
}

function boostCpuRoster(side: Side, freeAgents: Card[], count: number) {
  if (!count) return { side, freeAgents, recruits: [] as Card[] };
  const roster = shuffle([...side.hand, ...side.deck]);
  const recruits = freeAgents.slice(0, count);
  const demoted = roster.slice(0, count);
  const upgraded = shuffle([...recruits, ...roster.slice(count)]);
  return {
    side: { ...side, hand: upgraded.slice(0, 6), deck: upgraded.slice(6), minors: [...side.minors, ...demoted] },
    freeAgents: freeAgents.slice(count),
    recruits,
  };
}

function makeGame(playerTeam: string, enabledExpansions: ExpansionSet[] = [], aiDifficulty: AiDifficulty = "normal"): GameState {
  const rivals = teams.filter((team) => team !== playerTeam);
  const cpuTeam = rivals[Math.floor(Math.random() * rivals.length)];
  const freeAgents = shuffle(cards.filter((card) =>
    card.category === "free_agent" && (card.set === "base" || enabledExpansions.includes(card.set as ExpansionSet)),
  ));
  const cpuBoost = boostCpuRoster(makeSide(cpuTeam), freeAgents, aiDifficultyConfig[aiDifficulty].count);
  return {
    player: makeSide(playerTeam),
    cpu: cpuBoost.side,
    round: 1,
    phase: "setting_on_deck",
    stage: "exhibition",
    gameNumber: 1,
    exhibitionWins: { player: 0, cpu: 0 },
    worldSeriesWins: { player: 0, cpu: 0 },
    market: cpuBoost.freeAgents.slice(0, 6),
    freeAgentDeck: cpuBoost.freeAgents.slice(6),
    playerBudget: 0,
    cpuBudget: 0,
    purchaseTurn: null,
    cpuBought: false,
    pendingPurchaseId: null,
    marketActivity: [],
    newMarketIds: [],
    marketUpdateKey: 0,
    selectedId: null,
    resolutionKey: 0,
    lastResolution: [
      { kind: "reveal", actor: "player", title: "온덱 준비", detail: "손패 한 장을 온덱에 보관하거나 건너뛴 뒤 경기를 시작합니다." },
      { kind: "ability", actor: "system", title: "② 즉시 능력", detail: "수비 능력으로 상대 위협 안타를 먼저 막습니다." },
      { kind: "settle", actor: "system", title: "③ 안타 확정", detail: "남은 위협을 주루에 반영한 뒤 새 위협을 등록합니다." },
    ],
    log: [
      `${teamLabel[playerTeam]} vs ${teamLabel[cpuTeam]}`,
      `AI 난이도 ${aiDifficultyConfig[aiDifficulty].label}${cpuBoost.recruits.length ? ` · 시작 FA ${cpuBoost.recruits.map((card) => card.id).join(", ")}` : ""}`,
      "온덱 카드를 준비한 뒤 상대 위협 안타를 막고 내 카드를 냅니다.",
    ],
    enabledExpansions: [...enabledExpansions],
    aiDifficulty,
    cpuStartingFa: cpuBoost.recruits,
  };
}

function cloneSide(side: Side): Side {
  return {
    ...side,
    deck: [...side.deck],
    discard: [...side.discard],
    minors: [...side.minors],
    onDeck: side.onDeck,
    hand: [...side.hand],
    played: [...side.played],
    bases: [...side.bases],
    pending: [...side.pending],
  };
}

function visualSide(side: Side): VisualSide {
  return {
    pending: [...side.pending],
    pendingSpeed: side.pending.length ? side.pendingSpeed : null,
    bases: [...side.bases],
    score: side.score,
  };
}

function orientFrame(actor: "player" | "cpu", frame: MoveFrame): ResolutionSnapshot {
  return actor === "player"
    ? { player: frame.acting, cpu: frame.opposing }
    : { player: frame.opposing, cpu: frame.acting };
}

function snapshotSides(player: Side, cpu: Side): ResolutionSnapshot {
  return { player: visualSide(player), cpu: visualSide(cpu) };
}

function advanceHit(side: Side, hit: ThreatHit, source: Card | undefined, hitAndRun = false) {
  const motions: Omit<RunnerMotion, "sequence" | "hit">[] = [];
  if (hit === "walk") {
    const next = [...side.bases];
    if (next[0]) {
      if (next[1]) {
        if (next[2]) {
          side.score += 1;
          motions.push({ ...next[2], from: 3, to: "score" });
        }
        motions.push({ ...next[1], from: 2, to: 3 });
        next[2] = next[1];
      }
      motions.push({ ...next[0], from: 1, to: 2 });
      next[1] = next[0];
    }
    const batter = { cardId: source?.id ?? "walk", speed: source?.speed ?? "average" } as Runner;
    next[0] = batter;
    motions.push({ ...batter, from: 0, to: 1, batter: true });
    side.bases = next;
    return motions;
  }

  const hitDistance = hit === "single" ? 1 : hit === "double" ? 2 : hit === "triple" ? 3 : 4;
  if (hitDistance === 4) {
    side.bases.forEach((runner, base) => {
      if (runner) motions.push({ ...runner, from: (base + 1) as 1 | 2 | 3, to: "score" });
    });
    motions.push({ cardId: source?.id ?? "hit", speed: source?.speed ?? "average", from: 0, to: "score", batter: true });
    side.score += side.bases.filter(Boolean).length + 1;
    side.bases = [null, null, null];
    return motions;
  }

  const next: Array<Runner | null> = [null, null, null];
  for (let base = 2; base >= 0; base -= 1) {
    const runner = side.bases[base];
    if (!runner) continue;
    let distance = hitAndRun ? hitDistance + 1 : hitDistance;
    if (!hitAndRun && runner.speed === "fast") distance += 1;
    if (!hitAndRun && runner.speed === "average" && base === 1 && hit === "single") distance = 2;
    const ideal = base + distance;
    if (ideal >= 3) {
      side.score += 1;
      motions.push({ ...runner, from: (base + 1) as 1 | 2 | 3, to: "score" });
      continue;
    }

    const leadBase = next.findIndex((occupied, index) => index > base && Boolean(occupied));
    const destination = leadBase >= 0 ? Math.min(ideal, leadBase - 1) : ideal;
    const finalBase = Math.max(base, destination);
    next[finalBase] = runner;
    if (finalBase !== base) motions.push({ ...runner, from: (base + 1) as 1 | 2 | 3, to: (finalBase + 1) as 1 | 2 | 3 });
  }
  const batter = { cardId: source?.id ?? "hit", speed: source?.speed ?? "average" } as Runner;
  next[hitDistance - 1] = batter;
  motions.push({ ...batter, from: 0, to: hitDistance as 1 | 2 | 3, batter: true });
  side.bases = next;
  return motions;
}

function removeRunner(side: Side, count: number, allowFast = true) {
  let removed = 0;
  for (let base = 2; base >= 0 && count > 0; base -= 1) {
    const runner = side.bases[base];
    if (runner && (allowFast || runner.speed !== "fast")) {
      side.bases[base] = null;
      count -= 1;
      removed += 1;
    }
  }
  return removed;
}

function advanceStealRunners(side: Side) {
  const motions: RunnerMotion[] = [];
  const next = [...side.bases];
  let scored = 0;

  for (let base = 2; base >= 0; base -= 1) {
    const runner = next[base];
    if (!runner || runner.speed === "slow") continue;
    if (base === 2) {
      next[base] = null;
      side.score += 1;
      scored += 1;
      motions.push({ ...runner, sequence: motions.length, hit: "ability", from: 3, to: "score" });
      continue;
    }
    if (next[base + 1]) continue;
    next[base] = null;
    next[base + 1] = runner;
    motions.push({
      ...runner,
      sequence: motions.length,
      hit: "ability",
      from: (base + 1) as 1 | 2,
      to: (base + 2) as 2 | 3,
    });
  }

  side.bases = next;
  return { motions, scored };
}

function reduceHits(hits: ThreatHit[]) {
  return hits.flatMap<ThreatHit>((hit) => {
    if (hit === "walk") return ["walk"];
    if (hit === "home_run") return ["triple"];
    if (hit === "triple") return ["double"];
    if (hit === "double") return ["single"];
    return [];
  });
}

function parseGrantedHit(text: string): ThreatHit | null {
  const lower = text.toLowerCase();
  if (lower.includes("home run") || lower.includes("homerun")) return "home_run";
  if (lower.includes("triple")) return "triple";
  if (lower.includes("double")) return "double";
  if (lower.includes("single")) return "single";
  if (lower.includes("walk")) return "walk";
  return null;
}

function applyAbility(
  card: Card,
  acting: Side,
  opposing: Side,
  opposingLast: Card | undefined,
  playIndex: number,
) {
  const text = card.abilityText?.toLowerCase() ?? "";
  const events = applyDefensiveAbility(card, acting, opposing, opposingLast);
  const runnerMotions: RunnerMotion[] = [];
  if (!text) return { events, runnerMotions };

  const granted = parseGrantedHit(text);
  const onScoringBase = Boolean(acting.bases[1] || acting.bases[2]);
  const basesLoaded = acting.bases.every(Boolean);
  if (text.includes("quick eye") && opposingLast?.type === "cyborg" && granted) {
    acting.pending.push(granted);
    if (text.includes("2 walks")) acting.pending.push("walk");
    events.push(`퀵 아이가 ${hitLabel[granted]}를 추가했습니다.`);
  } else if (text.includes("clutch") && (text.includes("all 3 bases") ? basesLoaded : onScoringBase) && granted) {
    acting.pending.push(granted);
    events.push(`클러치가 ${hitLabel[granted]}를 추가했습니다.`);
  } else if (text.includes("leadoff") && playIndex === 0 && granted) {
    acting.pending.push(granted);
    events.push(`리드오프가 ${hitLabel[granted]}를 추가했습니다.`);
  } else if (text.includes("rally") && acting.score < opposing.score && granted) {
    acting.pending.push(granted);
    events.push(`랠리가 ${hitLabel[granted]}를 추가했습니다.`);
  }

  if (text.includes("stolen base")) {
    const steal = advanceStealRunners(acting);
    runnerMotions.push(...steal.motions);
    if (steal.motions.length) {
      events.push(`도루로 보통·빠른 주자 ${steal.motions.length}명이 1베이스 진루${steal.scored ? `, ${steal.scored}득점` : ""}했습니다.`);
    }
  }

  if (text.includes("pinch runner") && acting.bases.some((runner) => runner && runner.speed !== "fast")) {
    const changed = acting.bases.reduce((count, runner, index) => {
      if (!runner || runner.speed === "fast") return count;
      acting.bases[index] = { ...runner, speed: "fast" };
      return count + 1;
    }, 0);
    events.push(`대주자가 기존 주자 ${changed}명을 빠른 주자로 교체했습니다.`);
  }

  if (text.includes("hit & run") && card.hits.length) {
    acting.pendingHitAndRun = true;
    events.push("히트 앤드 런 준비 · 이 카드의 안타마다 기존 주자가 1베이스 더 진루합니다.");
  }

  return { events, runnerMotions };
}

function applyDefensiveAbility(card: Card, acting: Side, opposing: Side, opposingLast: Card | undefined) {
  const text = card.abilityText?.toLowerCase() ?? "";
  const events: string[] = [];
  if (!text) return events;

  if (text.includes("magna glove") && opposing.pending.length) {
    const removed = opposing.pending.splice(0, 2).length;
    events.push(`마그나 글러브로 위협 안타 ${removed}개를 지웠습니다.`);
  } else if (text.includes("glove") && opposing.pending.length) {
    opposing.pending.splice(0, 1);
    events.push("글러브로 위협 안타 1개를 지웠습니다.");
  }

  if (text.includes("pick off")) {
    const removed = removeRunner(opposing, text.includes("all") ? 3 : 1);
    if (removed) events.push(`견제로 주자 ${removed}명을 제거했습니다.`);
  }
  if (text.includes("double play")) {
    const removed = removeRunner(opposing, 2, false);
    if (removed) events.push(`병살로 빠르지 않은 주자 ${removed}명을 제거했습니다.`);
  }
  if (text.includes("fastball") && opposingLast?.type === "natural" && opposing.pending.length) {
    opposing.pending = [];
    events.push("패스트볼이 내추럴의 위협 안타를 모두 취소했습니다.");
  }
  if (text.includes("curve") && opposingLast?.type === "robot" && opposing.pending.length) {
    opposing.pending = [];
    events.push("커브가 로봇의 위협 안타를 모두 취소했습니다.");
  }
  if (text.includes("spit ball") && opposingLast?.type === "cyborg" && opposing.pending.length) {
    opposing.pending = [];
    events.push("스핏볼이 사이보그의 위협 안타를 모두 취소했습니다.");
  }
  if (text.includes("sinkerball") && opposing.pending.length && Boolean(opposing.bases[1] || opposing.bases[2])) {
    opposing.pending = [];
    events.push("싱커볼이 득점권 주자가 있는 상대의 위협 안타를 모두 취소했습니다.");
  }
  if (text.includes("knuckle ball") && opposing.pending.some((hit) => hit !== "walk")) {
    opposing.pending = reduceHits(opposing.pending);
    events.push("너클볼이 모든 위협 안타를 1베이스 줄였습니다.");
  }
  if (text.startsWith("walk:") && opposing.pending.some((hit) => hit !== "walk")) {
    opposing.pending = opposing.pending.map(() => "walk");
    events.push("위협 안타가 볼넷으로 바뀌었습니다.");
  }

  return events;
}

function settlePending(side: Side, source: Card | undefined) {
  const hits = [...side.pending];
  const hitAndRun = side.pendingHitAndRun;
  side.pending = [];
  side.pendingSpeed = null;
  side.pendingHitAndRun = false;
  const runnerMotions = hits.flatMap((hit, sequence) =>
    advanceHit(side, hit, source, hitAndRun).map((motion) => ({ ...motion, hit, sequence })),
  );
  return { hits, runnerMotions };
}

function playOne(card: Card, acting: Side, opposing: Side) {
  const opposingLast = opposing.played.at(-1);
  const revealFrame: MoveFrame = { acting: visualSide(acting), opposing: visualSide(opposing) };
  acting.pendingSpeed = card.speed;
  const ability = applyAbility(card, acting, opposing, opposingLast, acting.played.length);
  const abilityFrame: MoveFrame = { acting: visualSide(acting), opposing: visualSide(opposing) };
  const settlement = settlePending(opposing, opposingLast);
  const settled = settlement.hits;
  const settleFrame: MoveFrame = { acting: visualSide(acting), opposing: visualSide(opposing) };
  acting.hand = acting.hand.filter((item) => item.id !== card.id);
  acting.played.push(card);
  acting.revenue += card.revenue;
  acting.pending.push(...card.hits);
  if (card.hits.length && card.abilityText?.toLowerCase().includes("hit & run")) acting.pendingHitAndRun = true;
  if (acting.pending.length) acting.pendingSpeed = card.speed;
  const threatFrame: MoveFrame = { acting: visualSide(acting), opposing: visualSide(opposing) };
  return {
    events: ability.events,
    abilityMotions: ability.runnerMotions,
    settled,
    runnerMotions: settlement.runnerMotions,
    frames: { reveal: revealFrame, ability: abilityFrame, settle: settleFrame, threat: threatFrame },
    line: `${teamCode[acting.team]} · ${card.id} ${typeLabel[card.type]} / ${card.hits.map((hit) => hitLabel[hit]).join(" + ") || "안타 없음"}`,
  };
}

function chooseCpuCard(side: Side, opponent: Side) {
  const pendingCount = opponent.pending.length;
  const ranked = [...side.hand].sort((a, b) => {
    const aDefense = a.abilityText && /Glove|Fastball|Curve|Pick Off|Double Play|Knuckle|Sinkerball/.test(a.abilityText) ? 1 : 0;
    const bDefense = b.abilityText && /Glove|Fastball|Curve|Pick Off|Double Play|Knuckle|Sinkerball/.test(b.abilityText) ? 1 : 0;
    if (pendingCount) return bDefense - aDefense || b.revenue - a.revenue;
    return b.hits.length - a.hits.length || b.revenue - a.revenue;
  });
  return ranked[0];
}

function drawNextLineup(side: Side) {
  if (side.onDeck) {
    side.deck.unshift(side.onDeck);
    side.onDeck = null;
  }
  side.discard.push(...side.played);
  side.played = [];
  side.hand = [];
  while (side.hand.length < 6) {
    if (side.deck.length === 0) {
      side.deck = shuffle(side.discard);
      side.discard = [];
    }
    const next = side.deck.shift();
    if (!next) break;
    side.hand.push(next);
  }
  side.bases = [null, null, null];
  side.pending = [];
  side.pendingSpeed = null;
  side.pendingHitAndRun = false;
  side.score = 0;
  side.revenue = 0;
}

function drawExtraInnings(side: Side) {
  side.hand = [];
  while (side.hand.length < 3) {
    if (side.deck.length === 0) {
      side.deck = shuffle(side.discard);
      side.discard = [];
    }
    const next = side.deck.shift();
    if (!next) break;
    side.hand.push(next);
  }
}

function replenishMarket(market: Card[], freeAgentDeck: Card[], purchasedId: string) {
  const purchasedIndex = market.findIndex((card) => card.id === purchasedId);
  const nextMarket = market.filter((card) => card.id !== purchasedId);
  const nextDeck = [...freeAgentDeck];
  const replacement = nextDeck.shift();
  if (replacement) nextMarket.splice(Math.max(0, purchasedIndex), 0, replacement);
  return { market: nextMarket, freeAgentDeck: nextDeck, replacement: replacement ?? null };
}

function cardValue(card: Card) {
  return card.hits.reduce((total, hit) => total + (hit === "home_run" ? 5 : hit === "triple" ? 4 : hit === "double" ? 3 : 2), 0)
    + card.revenue
    + (card.abilityText ? 2 : 0)
    + (card.speed === "fast" ? 1 : 0);
}

function runCpuBuy(cpuInput: Side, marketInput: Card[], freeAgentDeckInput: Card[], budgetInput: number) {
  const cpu = cloneSide(cpuInput);
  let market = [...marketInput];
  let freeAgentDeck = [...freeAgentDeckInput];
  let budget = budgetInput;
  const purchases: string[] = [];
  const activities: MarketActivity[] = [];

  while (cpu.played.length && market.some((card) => (card.cost ?? 999) <= budget)) {
    const affordable = market
      .filter((card) => (card.cost ?? 999) <= budget)
      .sort((a, b) => cardValue(b) - cardValue(a) || (b.cost ?? 0) - (a.cost ?? 0));
    const recruit = affordable[0];
    const demote = [...cpu.played].sort((a, b) => cardValue(a) - cardValue(b))[0];
    budget -= recruit.cost ?? 0;
    cpu.deck.unshift(recruit);
    cpu.played = cpu.played.filter((card) => card.id !== demote.id);
    cpu.minors.push(demote);
    const replenished = replenishMarket(market, freeAgentDeck, recruit.id);
    market = replenished.market;
    freeAgentDeck = replenished.freeAgentDeck;
    purchases.push(`${recruit.id} 영입 / ${demote.id} 마이너`);
    activities.push({ buyer: "cpu", recruit, demote, replacement: replenished.replacement });
  }

  return { cpu, market, freeAgentDeck, budget, purchases, activities };
}

function miniGameWinner(player: Side, cpu: Side): "player" | "cpu" | "tie" {
  if (player.score > cpu.score) return "player";
  if (player.score < cpu.score) return "cpu";
  return "tie";
}

function activeRoster(side: Side) {
  return [...side.deck, ...side.discard, ...side.hand, ...side.played, ...(side.onDeck ? [side.onDeck] : [])];
}

function finishMiniGame(
  current: GameState,
  player: Side,
  cpu: Side,
  resolution: ResolutionEvent[],
  log: string[],
): GameState {
  if (player.score === cpu.score) {
    drawExtraInnings(player);
    drawExtraInnings(cpu);
    log.push("동점 · 양 팀이 3장씩 뽑아 연장전에 들어갑니다.");
    return {
      ...current,
      player,
      cpu,
      round: current.round + 1,
      phase: "playing",
      selectedId: null,
      resolutionKey: current.resolutionKey + 1,
      lastResolution: resolution,
      log,
    };
  }

  const winner = miniGameWinner(player, cpu);
  const exhibitionWins = { ...current.exhibitionWins };
  const worldSeriesWins = { ...current.worldSeriesWins };
  if (current.stage === "exhibition") exhibitionWins[winner as "player" | "cpu"] += 1;
  else worldSeriesWins[winner as "player" | "cpu"] += 1;

  if (current.stage === "world_series" && Math.max(worldSeriesWins.player, worldSeriesWins.cpu) >= 4) {
    log.push(`${worldSeriesWins.player > worldSeriesWins.cpu ? "월드 시리즈 우승!" : "월드 시리즈 준우승"} · ${worldSeriesWins.player}-${worldSeriesWins.cpu}`);
    return {
      ...current,
      player,
      cpu,
      phase: "series_finished",
      exhibitionWins,
      worldSeriesWins,
      playerBudget: player.revenue,
      cpuBudget: cpu.revenue,
      selectedId: null,
      resolutionKey: current.resolutionKey + 1,
      lastResolution: resolution,
      log,
    };
  }

  let market = [...current.market];
  let freeAgentDeck = [...current.freeAgentDeck];
  let nextCpu = cpu;
  let cpuBudget = cpu.revenue;
  let marketActivity: MarketActivity[] = [];
  const firstBuyer = player.revenue < cpu.revenue ? "player" : "cpu";

  if (firstBuyer === "cpu") {
    const cpuBuy = runCpuBuy(cpu, market, freeAgentDeck, cpuBudget);
    nextCpu = cpuBuy.cpu;
    market = cpuBuy.market;
    freeAgentDeck = cpuBuy.freeAgentDeck;
    cpuBudget = cpuBuy.budget;
    marketActivity = cpuBuy.activities;
    cpuBuy.purchases.forEach((purchase) => log.push(`CPU 구매 · ${purchase}`));
  }
  log.push(`구매 라운드 · 내 예산 ${player.revenue}, CPU 예산 ${cpu.revenue}`);

  return {
    ...current,
    player,
    cpu: nextCpu,
    phase: "buying",
    exhibitionWins,
    worldSeriesWins,
    market,
    freeAgentDeck,
    playerBudget: player.revenue,
    cpuBudget,
    purchaseTurn: "player",
    cpuBought: firstBuyer === "cpu",
    pendingPurchaseId: null,
    marketActivity,
    newMarketIds: marketActivity.flatMap((activity) => activity.replacement ? [activity.replacement.id] : []),
    marketUpdateKey: current.marketUpdateKey + 1,
    selectedId: null,
    resolutionKey: current.resolutionKey + 1,
    lastResolution: [
      ...resolution,
      {
        kind: "buy",
        actor: "system",
        title: "구매 라운드",
        detail: `내 예산 ${player.revenue} · CPU 예산 ${cpu.revenue}${marketActivity.length ? ` · CPU ${marketActivity.length}명 영입 완료` : ""}`,
      },
    ],
    log,
  };
}

function moveEvents(actor: "player" | "cpu", card: Card, move: ReturnType<typeof playOne>): ResolutionEvent[] {
  const who = actor === "player" ? "내 카드" : "CPU 카드";
  const threatened = card.hits.length ? card.hits.map((hit) => hitLabel[hit]).join(" + ") : "위협 안타 없음";
  return [
    { kind: "reveal", actor, title: `${who} 공개`, detail: `${card.id} · ${typeLabel[card.type]} · 수익 ${card.revenue}`, card, snapshot: orientFrame(actor, move.frames.reveal) },
    {
      kind: "ability",
      actor,
      title: "즉시 능력 처리",
      detail: move.events.length
        ? move.events.join(" ")
        : card.abilityText
          ? `조건이 맞지 않아 발동하지 않았습니다. · ${card.abilityTextKo}`
          : "발동할 즉시 능력이 없습니다.",
      card,
      snapshot: orientFrame(actor, move.frames.ability),
      runnerMotions: move.abilityMotions,
      abilityTriggered: move.events.length > 0,
    },
    {
      kind: "settle",
      actor,
      title: "상대 위협 확정",
      detail: move.settled.length ? `${move.settled.map((hit) => hitLabel[hit]).join(" + ")}를 베이스에 반영했습니다.` : "남은 위협 안타가 없습니다.",
      card,
      snapshot: orientFrame(actor, move.frames.settle),
      runnerMotions: move.runnerMotions,
    },
    { kind: "threat", actor, title: "새 위협 등록", detail: threatened, card, snapshot: orientFrame(actor, move.frames.threat) },
  ];
}

function ResolutionConsole({ game, activeIndex, running }: { game: GameState; activeIndex: number; running: boolean }) {
  const active = game.lastResolution[activeIndex] ?? game.lastResolution.at(-1);
  return (
    <section className={`resolution-console ${running ? "is-running" : ""}`} key={game.resolutionKey} aria-live="polite">
      <div className="resolution-header">
        <div><p>LIVE RESOLUTION</p><h2>플레이 처리 중계</h2></div>
        <div className="turn-order"><b>원정 YOU · 선공</b><span>→</span><b>홈 CPU · 후공</b></div>
      </div>
      <div className="flow-legend" aria-label="카드 처리 순서">
        <span>1 카드 공개</span><i>→</i><span>2 즉시 능력</span><i>→</i><span>3 상대 위협 확정</span><i>→</i><span>4 새 위협 등록</span>
      </div>
      <div className="event-track">
        {game.lastResolution.map((event, index) => (
          <article
            className={`event-card actor-${event.actor} kind-${event.kind} ${index === activeIndex ? "is-active" : ""} ${index < activeIndex ? "is-resolved" : ""} ${running && index > activeIndex ? "is-upcoming" : ""}`}
            key={`${game.resolutionKey}-${index}-${event.title}`}
            style={{ animationDelay: `${index * 90}ms` } as CSSProperties}
          >
            <small>{event.actor === "player" ? "내 카드" : event.actor === "cpu" ? "상대 카드" : "규칙"}</small>
            <strong>{event.title}</strong>
            <span>{event.detail}</span>
          </article>
        ))}
      </div>
      {active && <div className={`broadcast-call actor-${active.actor}`} key={`${game.resolutionKey}-${activeIndex}`}><b>{running ? "NOW" : "LAST"}</b><span>{active.title}</span><em>{active.detail}</em></div>}
    </section>
  );
}

function abilityIsActive(card: Card, acting: Side, opposing: Side) {
  const text = card.abilityText?.toLowerCase() ?? "";
  const opposingLast = opposing.played.at(-1);
  if (!text) return false;
  if (text.includes("glove")) return opposing.pending.length > 0;
  if (text.includes("pick off")) return opposing.bases.some(Boolean);
  if (text.includes("double play")) return opposing.bases.some((runner) => runner && runner.speed !== "fast");
  if (text.includes("fastball")) return opposing.pending.length > 0 && opposingLast?.type === "natural";
  if (text.includes("curve")) return opposing.pending.length > 0 && opposingLast?.type === "robot";
  if (text.includes("spit ball")) return opposing.pending.length > 0 && opposingLast?.type === "cyborg";
  if (text.includes("sinkerball")) return opposing.pending.length > 0 && Boolean(opposing.bases[1] || opposing.bases[2]);
  if (text.includes("knuckle ball")) return opposing.pending.some((hit) => hit !== "walk");
  if (text.startsWith("walk:")) return opposing.pending.some((hit) => hit !== "walk");
  if (text.includes("quick eye")) return opposingLast?.type === "cyborg";
  if (text.includes("clutch")) return text.includes("all 3 bases") ? acting.bases.every(Boolean) : Boolean(acting.bases[1] || acting.bases[2]);
  if (text.includes("leadoff")) return acting.played.length === 0;
  if (text.includes("rally")) return acting.score < opposing.score;
  if (text.includes("stolen base")) {
    const preview = cloneSide(acting);
    return advanceStealRunners(preview).motions.length > 0;
  }
  if (text.includes("pinch runner")) return acting.bases.some((runner) => runner && runner.speed !== "fast");
  if (text.includes("hit & run")) return card.hits.length > 0 && acting.bases.some(Boolean);
  return false;
}

function PlayerCard({ card, selected, disabled, abilityActive, onClick }: { card: Card; selected?: boolean; disabled?: boolean; abilityActive?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={`player-card type-${card.type} card-speed-${card.speed} ${selected ? "is-selected" : ""} ${abilityActive ? "has-live-ability" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${card.id} ${typeLabel[card.type]} 카드`}
    >
      <span className="card-stripe" />
      <span className="card-topline">
        <strong>{card.id}</strong>
        <span className="revenue-badge">수익 {card.revenue}</span>
      </span>
      <span className="card-role">{card.tier === "veteran" ? "베테랑" : card.tier === "rookie" ? "루키" : card.name}</span>
      <span className="card-figure" aria-hidden="true">
        <span className="figure-head" />
        <span className="figure-body" />
        <span className="figure-bat" />
      </span>
      <span className="type-ribbon">{typeLabel[card.type]}</span>
      <span className={`ability-box ${abilityActive ? "is-live" : ""}`} title={card.abilityText ?? undefined}>
        {abilityActive && <b>발동 가능</b>}
        {card.abilityTextKo ?? "기본 능력 없음"}
      </span>
      <span className="hit-row">
        {card.hits.length ? card.hits.map((hit, index) => <em key={`${hit}-${index}`}>{hitLabel[hit]}</em>) : <em className="no-hit">—</em>}
      </span>
      <span className="card-footer">
        <span>속도 {speedLabel[card.speed]}</span>
        {card.pinchHitter && <b>PH</b>}
      </span>
    </button>
  );
}

const basePoint: Record<0 | 1 | 2 | 3 | "score", { x: string; y: string }> = {
  0: { x: "58px", y: "97px" },
  1: { x: "102px", y: "50px" },
  2: { x: "58px", y: "6px" },
  3: { x: "14px", y: "50px" },
  score: { x: "58px", y: "97px" },
};

function BaseDiamond({ bases, motions = [] }: { bases: Array<Runner | null>; motions?: RunnerMotion[] }) {
  return (
    <div className="diamond" aria-label={`1루 ${bases[0] ? "주자 있음" : "비어 있음"}, 2루 ${bases[1] ? "주자 있음" : "비어 있음"}, 3루 ${bases[2] ? "주자 있음" : "비어 있음"}`}>
      <span className={`base base-second ${bases[1] ? `occupied speed-${bases[1].speed}` : ""}`}>2</span>
      <span className={`base base-third ${bases[2] ? `occupied speed-${bases[2].speed}` : ""}`}>3</span>
      <span className={`base base-first ${bases[0] ? `occupied speed-${bases[0].speed}` : ""}`}>1</span>
      <span className="home-plate" />
      {motions.map((motion, index) => (
        <span
          className={`runner-flight motion-${motion.speed} route-${motion.from}-${motion.to}`}
          key={`${motion.sequence}-${motion.cardId}-${motion.from}-${motion.to}-${index}`}
          style={{
            "--runner-from-x": basePoint[motion.from].x,
            "--runner-from-y": basePoint[motion.from].y,
            "--runner-to-x": basePoint[motion.to].x,
            "--runner-to-y": basePoint[motion.to].y,
            "--runner-delay": `${index * 100}ms`,
          } as CSSProperties}
          aria-label={`${motion.batter ? "타자" : `${motion.from}루 주자`}가 ${motion.to === "score" ? "홈으로 들어와 득점" : `${motion.to}루로 이동`}`}
        />
      ))}
    </div>
  );
}

function SnapshotTeam({ label, side, actor, focused, motions }: { label: string; side: VisualSide; actor: "player" | "cpu"; focused?: boolean; motions?: RunnerMotion[] }) {
  return (
    <div className={`snapshot-team snapshot-${actor} ${focused ? "is-focused" : ""}`}>
      <div className="snapshot-score"><span>{label}</span><strong>{side.score}</strong></div>
      <BaseDiamond bases={side.bases} motions={motions} />
      <div className="runner-readout">
        <small>루상 주자</small>
        <div>
          {side.bases.some(Boolean)
            ? side.bases.map((runner, index) => runner && <b className={`speed-${runner.speed}`} key={`${runner.cardId}-${index}`}>{index + 1}루 · {speedLabel[runner.speed]}</b>)
            : <em>없음</em>}
        </div>
      </div>
      <div className="snapshot-threats">
        <small>위협 안타 대기</small>
        <div>{side.pending.length ? side.pending.map((hit, index) => <b className={`speed-${side.pendingSpeed ?? "average"}`} key={`${hit}-${index}`}>{hitLabel[hit]} · {speedLabel[side.pendingSpeed ?? "average"]}</b>) : <em>없음</em>}</div>
      </div>
    </div>
  );
}

function SpeedLegend() {
  return (
    <div className="speed-legend" aria-label="주자 속도 색상">
      <span className="speed-fast">빠른 주자</span>
      <span className="speed-average">일반 주자</span>
      <span className="speed-slow">느린 주자</span>
    </div>
  );
}

function playbackDuration(event: ResolutionEvent) {
  if (event.runnerMotions?.length) return Math.max(1180, 720 + event.runnerMotions.length * 90);
  return 920;
}

function PlaybackStage({ event, index, total, running, onSkip }: { event: ResolutionEvent | undefined; index: number; total: number; running: boolean; onSkip: () => void }) {
  if (!event?.snapshot) return null;
  const actingLabel = event.actor === "player" ? "내 카드" : event.actor === "cpu" ? "상대 카드" : "규칙";
  const focusedTeam = event.kind === "settle"
    ? event.actor === "player" ? "cpu" : "player"
    : event.kind === "threat" || (event.kind === "ability" && event.runnerMotions?.length) ? event.actor : null;
  const cardFocused = event.kind === "reveal" || event.kind === "ability" || event.kind === "save";
  return (
    <section className={`playback-stage actor-${event.actor} playback-${event.kind}`} key={`${index}-${event.title}`} aria-label="현재 카드 처리 연출">
      <div className="playback-call">
        <div className="playback-progress"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
        <small>{actingLabel} · STEP {index + 1}/{total}</small>
        <h2>{event.title}</h2>
        <p>{event.detail}</p>
        {running && <button type="button" onClick={onSkip}>연출 건너뛰기</button>}
      </div>
      <div className={`playback-card-slot ${cardFocused ? "is-focused" : ""}`}>
        {event.card && <span className={`card-owner-label owner-${event.actor}`}>{event.actor === "player" ? "내가 낸 카드" : "상대가 낸 카드"}</span>}
        {event.card && <PlayerCard card={event.card} disabled abilityActive={(event.kind === "ability" || event.kind === "save") && event.abilityTriggered} />}
      </div>
      <div className="snapshot-field">
        <SnapshotTeam label="CPU · 홈" side={event.snapshot.cpu} actor="cpu" focused={focusedTeam === "cpu"} motions={focusedTeam === "cpu" ? event.runnerMotions : undefined} />
        <div className="snapshot-divider"><span>처리</span><i>→</i></div>
        <SnapshotTeam label="YOU · 원정" side={event.snapshot.player} actor="player" focused={focusedTeam === "player"} motions={focusedTeam === "player" ? event.runnerMotions : undefined} />
      </div>
    </section>
  );
}

function ScorePanel({ game }: { game: GameState }) {
  return (
    <section className="score-panel" aria-label="점수판">
      <div className="score-team">
        <span>{teamCode[game.cpu.team]}</span>
        <strong key={`cpu-score-${game.cpu.score}`}>{game.cpu.score}</strong>
      </div>
      <div className="inning-cell">
        <small>{game.stage === "exhibition" ? `EXHIBITION ${game.gameNumber}/3` : `WORLD SERIES ${game.gameNumber}`}</small>
        <b>{game.phase === "playing" ? `${game.round} / 6` : game.phase === "setting_on_deck" ? "ON DECK" : game.phase === "visitor_save" ? "SAVE" : game.phase === "buying" ? "BUY" : "FINAL"}</b>
      </div>
      <div className="score-team home-score">
        <strong key={`player-score-${game.player.score}`}>{game.player.score}</strong>
        <span>{teamCode[game.player.team]}</span>
      </div>
    </section>
  );
}

function TitleScreen({
  selectedTeam,
  enabledExpansions,
  aiDifficulty,
  onTeamChange,
  onExpansionChange,
  onDifficultyChange,
  onStart,
}: {
  selectedTeam: string;
  enabledExpansions: ExpansionSet[];
  aiDifficulty: AiDifficulty;
  onTeamChange: (team: string) => void;
  onExpansionChange: (set: ExpansionSet, enabled: boolean) => void;
  onDifficultyChange: (difficulty: AiDifficulty) => void;
  onStart: () => void;
}) {
  const marketCount = baseCards.filter((card) => card.category === "free_agent").length
    + enabledExpansions.reduce((total, set) => total + expansionCards.filter((card) => card.set === set).length, 0);
  return (
    <main className="title-screen">
      <section className="title-hero">
        <div className="title-badge" aria-hidden="true"><span>20</span><b>45</b></div>
        <p>PRIVATE DIGITAL LEAGUE</p>
        <h1>하이라이트<br /><i>리그 2045</i></h1>
        <span>여섯 장의 라인업으로 만드는 미래 야구의 결정적 장면</span>
        <div className="title-flow" aria-label="시즌 진행 방식">
          <b>3경기 미니 시즌</b><i>→</i><b>FA 영입</b><i>→</i><b>7전 4선승 월드 시리즈</b>
        </div>
      </section>

      <section className="season-setup" aria-label="새 시즌 설정">
        <div className="setup-heading">
          <div><p>NEW SEASON</p><h2>리그 설정</h2></div>
          <span>스타터 덱, 카드 세트와 CPU 난이도를 선택하세요.</span>
        </div>

        <div className="setup-block">
          <div className="setup-label"><span>01</span><div><b>스타터 덱</b><small>15장 · 시즌 중 변경 불가</small></div></div>
          <div className="starter-options">
            {teams.map((team) => (
              <button type="button" key={team} className={selectedTeam === team ? "is-selected" : ""} onClick={() => onTeamChange(team)}>
                <strong>{teamCode[team]}</strong><span>{teamLabel[team]}</span><small>ST 15장</small>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-block">
          <div className="setup-label"><span>02</span><div><b>카드 세트</b><small>시장 카드 풀 구성</small></div></div>
          <div className="set-options">
            <article className="set-option is-fixed">
              <span className="set-code">BASE</span><div><b>기본판</b><small>ST 60장 + FA 60장</small></div><em>필수</em>
            </article>
            {expansionCatalog.map((set) => set.ready ? (
              <label className={`set-option ${enabledExpansions.includes(set.id) ? "is-enabled" : ""}`} key={set.code}>
                <input type="checkbox" checked={enabledExpansions.includes(set.id)} onChange={(event) => onExpansionChange(set.id, event.target.checked)} />
                <span className="set-code">{set.code}</span><div><b>{set.name}</b><small>FA {set.count}장 · 신규 능력 3종</small></div><em>{enabledExpansions.includes(set.id) ? "사용" : "제외"}</em>
              </label>
            ) : (
              <article className="set-option is-upcoming" key={set.code}>
                <span className="set-code">{set.code}</span><div><b>{set.name}</b><small>{set.count}장 · 카드 입력 준비 중</small></div><em>예정</em>
              </article>
            ))}
          </div>
        </div>

        <div className="setup-block">
          <div className="setup-label"><span>03</span><div><b>AI 난이도</b><small>CPU 시작 로스터 보정</small></div></div>
          <div className="difficulty-options" role="group" aria-label="AI 난이도">
            {(Object.keys(aiDifficultyConfig) as AiDifficulty[]).map((difficulty) => {
              const option = aiDifficultyConfig[difficulty];
              return (
                <button
                  type="button"
                  key={difficulty}
                  className={aiDifficulty === difficulty ? "is-selected" : ""}
                  onClick={() => onDifficultyChange(difficulty)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                  <small>{option.count ? `시작 FA ${option.count}장` : "추가 FA 없음"}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="season-summary">
          <div><small>내 팀</small><b>{teamCode[selectedTeam]} · {teamLabel[selectedTeam]}</b></div>
          <div><small>AI 난이도</small><b>{aiDifficultyConfig[aiDifficulty].label} · 시작 FA {aiDifficultyConfig[aiDifficulty].count}장</b></div>
          <div><small>활성 확장</small><b>{enabledExpansions.length ? enabledExpansions.map((set) => expansionLabel[set]).join(", ") : "기본판만"}</b></div>
          <div><small>시장 대기 카드</small><b>{marketCount - aiDifficultyConfig[aiDifficulty].count}장</b></div>
        </div>
        <button type="button" className="season-start" onClick={onStart}><span>PLAY BALL</span><b>시즌 시작</b><i>→</i></button>
      </section>
    </main>
  );
}

function SeasonResult({ game, onRestart, onTitle }: { game: GameState; onRestart: () => void; onTitle: () => void }) {
  const won = game.worldSeriesWins.player > game.worldSeriesWins.cpu;
  const activeFa = activeRoster(game.player).filter((card) => card.category === "free_agent");
  return (
    <main className={`season-result ${won ? "is-champion" : "is-runner-up"}`}>
      <section className="result-scorecard">
        <p>WORLD SERIES · FINAL</p>
        <span className="result-kicker">{won ? "2045 LEAGUE CHAMPION" : "SEASON COMPLETE"}</span>
        <h1>{won ? "챔피언" : "준우승"}</h1>
        <div className="result-matchup">
          <div><small>YOU</small><b>{teamCode[game.player.team]}</b><span>{teamLabel[game.player.team]}</span></div>
          <strong>{game.worldSeriesWins.player}<i>—</i>{game.worldSeriesWins.cpu}</strong>
          <div><small>CPU</small><b>{teamCode[game.cpu.team]}</b><span>{teamLabel[game.cpu.team]}</span></div>
        </div>
        <p className="result-copy">{won ? "마지막 위협까지 지켜내고 월드 시리즈 정상에 올랐습니다." : "월드 시리즈는 끝났지만 완성한 로스터와 시즌 기록은 남았습니다."}</p>
        <div className="result-stats">
          <div><small>미니 시즌</small><b>{game.exhibitionWins.player}승 {game.exhibitionWins.cpu}패</b></div>
          <div><small>AI 난이도</small><b>{aiDifficultyConfig[game.aiDifficulty].label} · 시작 FA {game.cpuStartingFa.length}장</b></div>
          <div><small>영입 FA</small><b>{activeFa.length}명</b></div>
          <div><small>마이너 이동</small><b>{game.player.minors.length}명</b></div>
          <div><small>사용 세트</small><b>{game.enabledExpansions.length ? `BASE + ${game.enabledExpansions.map((set) => expansionLabel[set]).join(" + ")}` : "BASE"}</b></div>
        </div>
        <div className="result-actions">
          <button type="button" className="result-primary" onClick={onRestart}>같은 설정으로 다시</button>
          <button type="button" className="result-secondary" onClick={onTitle}>타이틀로</button>
        </div>
      </section>
    </main>
  );
}

export function GamePrototype() {
  const [screen, setScreen] = useState<Screen>("title");
  const [selectedTeam, setSelectedTeam] = useState("San Francisco");
  const [enabledExpansions, setEnabledExpansions] = useState<ExpansionSet[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>("normal");
  const [game, setGame] = useState<GameState>(() => makeGame("San Francisco", [], "normal"));
  const [showRules, setShowRules] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [turnTransition, setTurnTransition] = useState<"cpu" | "player" | null>(null);
  const playbackTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const turnTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackAnchorRef = useRef<HTMLDivElement>(null);
  const handAnchorRef = useRef<HTMLElement>(null);
  const visitorSaveAnchorRef = useRef<HTMLElement>(null);
  const marketAnchorRef = useRef<HTMLElement>(null);
  const previousPlaybackRunning = useRef(false);
  const previousMarketUpdateKey = useRef(game.marketUpdateKey);
  const turnWasRunning = useRef(false);
  const previousPlaybackActor = useRef<"player" | "cpu" | null>(null);

  const showTurnTransition = useCallback((turn: "cpu" | "player") => {
    if (turnTransitionTimer.current) clearTimeout(turnTransitionTimer.current);
    setTurnTransition(turn);
    turnTransitionTimer.current = setTimeout(() => setTurnTransition(null), 820);
  }, []);

  useEffect(() => {
    playbackTimers.current.forEach(clearTimeout);
    playbackTimers.current = [];
    const playable = game.lastResolution
      .map((event, index) => event.snapshot ? index : -1)
      .filter((index) => index >= 0);
    if (game.resolutionKey === 0 || playable.length === 0) {
      playbackTimers.current.push(setTimeout(() => {
        setPlaybackIndex(Math.max(0, game.lastResolution.length - 1));
        setPlaybackRunning(false);
      }, 0));
    } else {
      playbackTimers.current.push(setTimeout(() => {
        setPlaybackIndex(playable[0]);
        setPlaybackRunning(true);
      }, 0));
      let elapsed = playbackDuration(game.lastResolution[playable[0]]);
      playable.slice(1).forEach((eventIndex) => {
        playbackTimers.current.push(setTimeout(() => setPlaybackIndex(eventIndex), elapsed));
        elapsed += playbackDuration(game.lastResolution[eventIndex]);
      });
      playbackTimers.current.push(setTimeout(() => setPlaybackRunning(false), elapsed + 180));
    }
    return () => {
      playbackTimers.current.forEach(clearTimeout);
      playbackTimers.current = [];
    };
  }, [game.lastResolution, game.resolutionKey]);

  useEffect(() => {
    const wasRunning = turnWasRunning.current;
    turnWasRunning.current = playbackRunning;
    const actor = game.lastResolution[playbackIndex]?.actor;
    let nextTurn: "cpu" | "player" | null = null;

    if (playbackRunning && (actor === "player" || actor === "cpu")) {
      if (previousPlaybackActor.current === "player" && actor === "cpu") nextTurn = "cpu";
      if (previousPlaybackActor.current === "cpu" && actor === "player") nextTurn = "player";
      previousPlaybackActor.current = actor;
    } else if (!playbackRunning && wasRunning) {
      if (game.phase === "playing") nextTurn = "player";
      previousPlaybackActor.current = null;
    }
    if (!nextTurn) return;
    const timer = setTimeout(() => showTurnTransition(nextTurn), 0);
    return () => clearTimeout(timer);
  }, [game.lastResolution, game.phase, playbackIndex, playbackRunning, showTurnTransition]);

  useEffect(() => () => {
    if (turnTransitionTimer.current) clearTimeout(turnTransitionTimer.current);
  }, []);

  useEffect(() => {
    const wasRunning = previousPlaybackRunning.current;
    previousPlaybackRunning.current = playbackRunning;
    if (game.resolutionKey === 0 || typeof window === "undefined" || !window.matchMedia("(max-width: 760px)").matches) return;
    const restingTarget = game.phase === "buying"
      ? marketAnchorRef.current
      : game.phase === "visitor_save"
        ? visitorSaveAnchorRef.current
        : handAnchorRef.current;
    const target = playbackRunning ? playbackAnchorRef.current : wasRunning ? restingTarget : null;
    if (!target) return;
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, playbackRunning ? 90 : 180);
    return () => window.clearTimeout(timer);
  }, [game.phase, game.resolutionKey, playbackRunning]);

  useEffect(() => {
    const changed = previousMarketUpdateKey.current !== game.marketUpdateKey;
    previousMarketUpdateKey.current = game.marketUpdateKey;
    if (!changed || game.phase !== "buying" || game.lastResolution.some((event) => event.snapshot) || typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const timer = window.setTimeout(() => marketAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return () => window.clearTimeout(timer);
  }, [game.lastResolution, game.marketUpdateKey, game.phase]);

  function skipPlayback() {
    playbackTimers.current.forEach(clearTimeout);
    playbackTimers.current = [];
    const lastPlayable = game.lastResolution.findLastIndex((event) => Boolean(event.snapshot));
    if (lastPlayable >= 0) setPlaybackIndex(lastPlayable);
    setPlaybackRunning(false);
  }

  function restart() {
    setGame(makeGame(selectedTeam, enabledExpansions, aiDifficulty));
    setScreen("game");
  }

  function startSeason() {
    setGame(makeGame(selectedTeam, enabledExpansions, aiDifficulty));
    setScreen("game");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setExpansion(set: ExpansionSet, enabled: boolean) {
    setEnabledExpansions((current) => enabled ? [...new Set([...current, set])] : current.filter((item) => item !== set));
  }

  function returnToTitle() {
    setScreen("title");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prepareOnDeck(cardId: string | null) {
    setGame((current) => {
      if (current.phase !== "setting_on_deck") return current;
      const player = cloneSide(current.player);
      let detail = "온덱 없이 라인업 6장으로 시작합니다.";
      if (cardId) {
        const selected = player.hand.find((card) => card.id === cardId);
        if (!selected) return current;
        player.hand = player.hand.filter((card) => card.id !== selected.id);
        player.onDeck = selected;
        const replacement = player.deck.shift();
        if (replacement) player.hand.push(replacement);
        detail = `${selected.id}를 온덱에 보관하고 ${replacement?.id ?? "대체 카드 없음"}으로 손패를 보충했습니다.`;
      }
      return {
        ...current,
        player,
        phase: "playing",
        resolutionKey: current.resolutionKey + 1,
        lastResolution: [{ kind: "next", actor: "player", title: "온덱 준비 완료", detail }],
        log: [...current.log, `온덱 준비 · ${detail}`],
      };
    });
  }

  function playRound(cardId: string, pinchSource: "on_deck" | "lineup" | null = null) {
    if (game.phase !== "playing" || playbackRunning) return;
    setPlaybackRunning(true);
    setGame((current) => {
      const player = cloneSide(current.player);
      const cpu = cloneSide(current.cpu);
      const selectedCard = player.hand.find((card) => card.id === cardId);
      if (!selectedCard) return current;
      let playerCard = selectedCard;
      let pinchHitDetail: string | null = null;
      if (pinchSource) {
        if (!selectedCard.pinchHitter) return current;
        const fromOnDeck = pinchSource === "on_deck";
        const replacement = fromOnDeck ? player.onDeck : player.deck.shift();
        if (!replacement) return current;
        player.hand = player.hand.filter((card) => card.id !== selectedCard.id);
        player.discard.push(selectedCard);
        if (fromOnDeck) player.onDeck = null;
        player.hand.push(replacement);
        playerCard = replacement;
        pinchHitDetail = `${selectedCard.id}를 더그아웃으로 보내고 ${fromOnDeck ? "온덱" : "라인업 맨 위"} ${replacement.id}를 투입했습니다.`;
      }

      const playerMove = playOne(playerCard, player, cpu);
      const cpuCard = chooseCpuCard(cpu, player);
      const cpuMove = playOne(cpuCard, cpu, player);
      const nextRound = current.round + 1;
      const finished = player.hand.length === 0;
      const resolution = [
        ...moveEvents("player", playerCard, playerMove),
        ...moveEvents("cpu", cpuCard, cpuMove),
      ];
      if (pinchHitDetail) {
        resolution[0] = { ...resolution[0], title: "PH 대타 투입", detail: pinchHitDetail };
      }
      const log = [
        ...current.log,
        ...(pinchHitDetail ? [`R${current.round} PH: ${pinchHitDetail}`] : []),
        `R${current.round} 나: ${playerMove.line}`,
        ...playerMove.events.map((event) => `↳ ${event}`),
        playerMove.settled.length ? `↳ 상대 ${playerMove.settled.map((hit) => hitLabel[hit]).join(", ")} 확정` : "↳ 상대 위협 안타 없음",
        `R${current.round} CPU: ${cpuMove.line}`,
        ...cpuMove.events.map((event) => `↳ ${event}`),
        cpuMove.settled.length ? `↳ 내 ${cpuMove.settled.map((hit) => hitLabel[hit]).join(", ")} 확정` : "↳ 내 위협 안타 없음",
      ];

      if (finished) {
        return {
          ...current,
          player,
          cpu,
          round: current.round,
          phase: "visitor_save",
          selectedId: null,
          resolutionKey: current.resolutionKey + 1,
          lastResolution: resolution,
          log: [...log, "홈팀 마지막 위협 대기 · 비지터 세이브 선택"],
        };
      }

      return {
        ...current,
        player,
        cpu,
        round: finished ? 6 : nextRound,
        phase: "playing",
        selectedId: null,
        resolutionKey: current.resolutionKey + 1,
        lastResolution: resolution,
        log,
      };
    });
  }

  function resolveVisitorSave(source: "on_deck" | "lineup" | null) {
    if (playbackRunning) return;
    setPlaybackRunning(true);
    setGame((current) => {
      if (current.phase !== "visitor_save") return current;
      const player = cloneSide(current.player);
      const cpu = cloneSide(current.cpu);
      const resolution: ResolutionEvent[] = [];
      const log = [...current.log];
      let saveCard: Card | null = null;
      let sourceLabel = "사용 안 함";

      if (source === "on_deck") {
        if (!player.onDeck) return current;
        saveCard = player.onDeck;
        player.onDeck = null;
        sourceLabel = "온덱";
      } else if (source === "lineup") {
        if (player.deck.length === 0 && player.discard.length) {
          player.deck = shuffle(player.discard);
          player.discard = [];
        }
        saveCard = player.deck.shift() ?? null;
        if (!saveCard) return current;
        sourceLabel = "라인업 맨 위";
      }

      if (saveCard) {
        const saveEvents = applyDefensiveAbility(saveCard, player, cpu, cpu.played.at(-1));
        player.discard.push(saveCard);
        resolution.push({
          kind: "save",
          actor: "player",
          title: "비지터 세이브",
          detail: saveEvents.length
            ? `${sourceLabel} ${saveCard.id} 공개 · ${saveEvents.join(" ")}`
            : `${sourceLabel} ${saveCard.id} 공개 · 적용 가능한 수비 즉시 능력이 없습니다.`,
          card: saveCard,
          snapshot: snapshotSides(player, cpu),
          abilityTriggered: saveEvents.length > 0,
        });
        log.push(`비지터 세이브 · ${sourceLabel} ${saveCard.id} ${saveEvents.join(" ") || "수비 효과 없음"}`);
      } else {
        resolution.push({
          kind: "save",
          actor: "player",
          title: "비지터 세이브 사용 안 함",
          detail: "카드를 공개하지 않고 홈팀의 남은 위협 안타를 처리합니다.",
          snapshot: snapshotSides(player, cpu),
        });
        log.push("비지터 세이브 · 사용 안 함");
      }

      const finalSettlement = settlePending(cpu, cpu.played.at(-1));
      resolution.push({
        kind: "settle",
        actor: "cpu",
        title: "홈팀 마지막 위협 확정",
        detail: finalSettlement.hits.length
          ? `${finalSettlement.hits.map((hit) => hitLabel[hit]).join(" + ")}를 베이스에 반영했습니다.`
          : "모든 위협을 막았습니다.",
        snapshot: snapshotSides(player, cpu),
        runnerMotions: finalSettlement.runnerMotions,
      });
      if (finalSettlement.hits.length) log.push(`경기 종료 · 상대 마지막 ${finalSettlement.hits.map((hit) => hitLabel[hit]).join(", ")} 확정`);
      log.push(`FINAL ${teamCode[player.team]} ${player.score} : ${cpu.score} ${teamCode[cpu.team]}`);
      return finishMiniGame(current, player, cpu, resolution, log);
    });
  }

  function selectFreeAgent(cardId: string) {
    if (playbackRunning) return;
    setGame((current) => {
      if (current.phase !== "buying" || current.purchaseTurn !== "player") return current;
      const card = current.market.find((item) => item.id === cardId);
      if (!card || (card.cost ?? 999) > current.playerBudget || current.player.played.length === 0) return current;
      return { ...current, pendingPurchaseId: current.pendingPurchaseId === cardId ? null : cardId };
    });
  }

  function sendToMinors(cardId: string) {
    if (playbackRunning) return;
    setGame((current) => {
      if (current.phase !== "buying" || !current.pendingPurchaseId) return current;
      const recruit = current.market.find((card) => card.id === current.pendingPurchaseId);
      const demote = current.player.played.find((card) => card.id === cardId);
      if (!recruit || !demote || (recruit.cost ?? 999) > current.playerBudget) return current;
      const player = cloneSide(current.player);
      player.deck.unshift(recruit);
      player.played = player.played.filter((card) => card.id !== demote.id);
      player.minors.push(demote);
      const replenished = replenishMarket(current.market, current.freeAgentDeck, recruit.id);
      const activity: MarketActivity = { buyer: "player", recruit, demote, replacement: replenished.replacement };
      return {
        ...current,
        player,
        market: replenished.market,
        freeAgentDeck: replenished.freeAgentDeck,
        playerBudget: current.playerBudget - (recruit.cost ?? 0),
        pendingPurchaseId: null,
        marketActivity: [...current.marketActivity, activity],
        newMarketIds: replenished.replacement ? [replenished.replacement.id] : [],
        marketUpdateKey: current.marketUpdateKey + 1,
        resolutionKey: current.resolutionKey + 1,
        lastResolution: [
          { kind: "buy", actor: "player", title: `${recruit.id} 영입 완료`, detail: `${demote.id} 마이너 이동 · 새 선수는 다음 덱 맨 위` },
          { kind: "next", actor: "system", title: "로스터 15명 유지", detail: `FA 영입 ${activeRoster(player).filter((card) => card.category === "free_agent").length}명 · 마이너 ${player.minors.length}명` },
        ],
        log: [...current.log, `영입 · ${recruit.id} ${recruit.name} / ${demote.id} 마이너 이동`],
      };
    });
  }

  function finishBuyRound() {
    if (playbackRunning) return;
    setGame((current) => {
      if (current.phase !== "buying") return current;

      if (!current.cpuBought) {
        const cpuBuy = runCpuBuy(current.cpu, current.market, current.freeAgentDeck, current.cpuBudget);
        const log = [...current.log];
        cpuBuy.purchases.forEach((purchase) => log.push(`CPU 구매 · ${purchase}`));
        if (!cpuBuy.purchases.length) log.push("CPU 구매 · 영입 가능한 선수가 없어 패스");
        return {
          ...current,
          cpu: cpuBuy.cpu,
          market: cpuBuy.market,
          freeAgentDeck: cpuBuy.freeAgentDeck,
          cpuBudget: cpuBuy.budget,
          purchaseTurn: null,
          cpuBought: true,
          pendingPurchaseId: null,
          marketActivity: [...current.marketActivity, ...cpuBuy.activities],
          newMarketIds: cpuBuy.activities.flatMap((activity) => activity.replacement ? [activity.replacement.id] : []),
          marketUpdateKey: current.marketUpdateKey + 1,
          resolutionKey: current.resolutionKey + 1,
          lastResolution: [{
            kind: "buy",
            actor: "cpu",
            title: cpuBuy.purchases.length ? `CPU ${cpuBuy.purchases.length}명 영입` : "CPU 구매 패스",
            detail: cpuBuy.purchases.join(" · ") || "예산 안에서 영입할 선수가 없습니다.",
          }],
          log,
        };
      }

      const player = cloneSide(current.player);
      const cpu = cloneSide(current.cpu);
      const log = [...current.log];

      drawNextLineup(player);
      drawNextLineup(cpu);
      const enterWorldSeries = current.stage === "exhibition" && current.gameNumber === 3;
      const stage = enterWorldSeries ? "world_series" : current.stage;
      const gameNumber = enterWorldSeries ? 1 : current.gameNumber + 1;
      if (enterWorldSeries) log.push("3경기 미니 시즌 종료 · 7전 4선승 월드 시리즈 시작");
      else log.push(`${stage === "exhibition" ? "미니 시즌" : "월드 시리즈"} ${gameNumber}차전 시작`);

      return {
        ...current,
        player,
        cpu,
        stage,
        gameNumber,
        round: 1,
        phase: "setting_on_deck",
        playerBudget: 0,
        cpuBudget: current.cpuBudget,
        purchaseTurn: null,
        cpuBought: false,
        pendingPurchaseId: null,
        marketActivity: [],
        newMarketIds: [],
        selectedId: null,
        resolutionKey: current.resolutionKey + 1,
        lastResolution: [
          { kind: "next", actor: "system", title: enterWorldSeries ? "월드 시리즈 개막" : "다음 경기 준비", detail: `${gameNumber}차전 · 새 6장 라인업에서 온덱 카드를 준비합니다.` },
        ],
        log,
      };
    });
  }

  const playbackTotal = game.lastResolution.filter((event) => Boolean(event.snapshot)).length;
  const playbackStep = Math.max(0, game.lastResolution.slice(0, playbackIndex + 1).filter((event) => Boolean(event.snapshot)).length - 1);
  const pendingRecruit = game.market.find((card) => card.id === game.pendingPurchaseId) ?? null;

  if (screen === "title") {
    return (
      <TitleScreen
        selectedTeam={selectedTeam}
        enabledExpansions={enabledExpansions}
        aiDifficulty={aiDifficulty}
        onTeamChange={setSelectedTeam}
        onExpansionChange={setExpansion}
        onDifficultyChange={setAiDifficulty}
        onStart={startSeason}
      />
    );
  }

  if (game.phase === "series_finished") {
    return <SeasonResult game={game} onRestart={restart} onTitle={returnToTitle} />;
  }

  return (
    <main className="game-shell">
      {turnTransition && (
        <div className={`turn-transition turn-${turnTransition}`} role="status" aria-live="polite">
          <small>TURN CHANGE</small>
          <strong>{turnTransition === "cpu" ? "CPU 차례" : "내 차례"}</strong>
          <span>{turnTransition === "cpu" ? "상대 카드 처리" : "다음 카드 선택"}</span>
        </div>
      )}
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">45</span>
          <div>
            <p>PRIVATE DIGITAL PROTOTYPE</p>
            <h1>하이라이트 리그 <i>2045</i></h1>
          </div>
        </div>
        <nav aria-label="프로토타입 메뉴">
          <button type="button" className="nav-button" onClick={() => setShowRules((value) => !value)}>{showRules ? "규칙 닫기" : "핵심 규칙"}</button>
          <button type="button" className="nav-button" onClick={returnToTitle}>타이틀</button>
          <button type="button" className="restart-button" onClick={restart}>새 시즌</button>
        </nav>
      </header>

      {showRules && (
        <aside className="rules-strip">
          <b>현재 구현 범위</b>
          <span>① 6장으로 6라운드 진행</span>
          <span>② 먼저 상대 위협 안타에 내 카드의 수비 능력 적용</span>
          <span>③ 남은 안타 확정 후 내 안타를 위협 칸에 등록</span>
          <span>④ 글러브·견제·병살·구종 상성·볼넷·퀵 아이·클러치·도루 처리</span>
          <span>⑤ 빠른 주자 +1베이스 · 보통 주자 2루에서 1루타 득점 · 추월 금지</span>
          <span>⑥ 홈팀 마지막 카드 뒤 원정팀 비지터 세이브</span>
          <span>⑦ 경기 전 온덱 1장 선택 가능 · PH 카드는 버리고 온덱 또는 라인업 맨 위 카드 투입</span>
          <span>※ 위협 안타: 아직 득점 처리되지 않아 다음 카드로 막을 수 있는 안타</span>
        </aside>
      )}

      <section className="game-config-strip" aria-label="현재 시즌 설정">
        <div><small>STARTER</small><b>{teamCode[game.player.team]} · {teamLabel[game.player.team]}</b></div>
        <div><small>AI LEVEL</small><b>{aiDifficultyConfig[game.aiDifficulty].label} · 시작 FA {game.cpuStartingFa.length}장</b></div>
        <div><small>CARD SETS</small><b>{game.enabledExpansions.length ? `BASE + ${game.enabledExpansions.map((set) => expansionLabel[set]).join(" + ")}` : "BASE ONLY"}</b></div>
        <span>{game.cpuStartingFa.length ? `CPU 시작 보강 · ${game.cpuStartingFa.map((card) => card.id).join(" · ")}` : "CPU 추가 FA 없음 · 시즌 설정은 타이틀에서 변경"}</span>
      </section>

      <section className="series-strip" aria-label="시리즈 진행 상황">
        <div className={game.stage === "exhibition" ? "current" : "complete"}>
          <span>미니 시즌 · 3경기</span>
          <strong>{game.exhibitionWins.player} — {game.exhibitionWins.cpu}</strong>
        </div>
        <i>→</i>
        <div className={game.stage === "world_series" ? "current" : ""}>
          <span>월드 시리즈 · 4선승</span>
          <strong>{game.worldSeriesWins.player} — {game.worldSeriesWins.cpu}</strong>
        </div>
      </section>

      <ScorePanel game={game} />

      <ResolutionConsole game={game} activeIndex={playbackIndex} running={playbackRunning} />

      <div className="playback-anchor" ref={playbackAnchorRef}>
        <PlaybackStage
          event={game.lastResolution[playbackIndex]}
          index={playbackStep}
          total={playbackTotal}
          running={playbackRunning}
          onSkip={skipPlayback}
        />
      </div>

      <section className="stadium-board">
        <div className="dugout cpu-dugout">
          <div className="dugout-title">
            <span>CPU · {teamLabel[game.cpu.team]} <em>홈 · 후공</em></span>
            <b>수익 {game.cpu.revenue}</b>
          </div>
          <div className="cpu-hand" aria-label={`CPU 남은 카드 ${game.cpu.hand.length}장`}>
            {game.cpu.hand.map((card) => <span key={card.id} className="card-back" />)}
          </div>
          <div className="last-played">
            {game.cpu.played.at(-1) ? <PlayerCard card={game.cpu.played.at(-1)!} disabled /> : <div className="empty-card">CPU의 첫 카드를 기다리는 중</div>}
          </div>
        </div>

        <div className="field-zone">
          <SpeedLegend />
          <div className="threat-box opponent-threat">
            <span>CPU 위협 안타</span>
            <div>{game.cpu.pending.length ? game.cpu.pending.map((hit, index) => <b className={`speed-${game.cpu.pendingSpeed ?? "average"}`} key={`${hit}-${index}`}>{hitLabel[hit]} · {speedLabel[game.cpu.pendingSpeed ?? "average"]}</b>) : <em>없음</em>}</div>
          </div>
          <div className="field-score">
            <div>
              <small>{teamCode[game.cpu.team]}</small>
              <strong>{game.cpu.score}</strong>
              <BaseDiamond bases={game.cpu.bases} />
            </div>
            <span className="versus">VS</span>
            <div>
              <BaseDiamond bases={game.player.bases} />
              <strong>{game.player.score}</strong>
              <small>{teamCode[game.player.team]}</small>
            </div>
          </div>
          <div className="threat-box player-threat">
            <span>내 위협 안타</span>
            <div>{game.player.pending.length ? game.player.pending.map((hit, index) => <b className={`speed-${game.player.pendingSpeed ?? "average"}`} key={`${hit}-${index}`}>{hitLabel[hit]} · {speedLabel[game.player.pendingSpeed ?? "average"]}</b>) : <em>없음</em>}</div>
          </div>
        </div>

        <div className="dugout player-dugout">
          <div className="dugout-title">
            <span>YOU · {teamLabel[game.player.team]} <em>원정 · 선공</em></span>
            <b>수익 {game.player.revenue}</b>
          </div>
          <div className="last-played player-last">
            {game.player.played.at(-1) ? <PlayerCard card={game.player.played.at(-1)!} disabled /> : <div className="empty-card">{game.phase === "setting_on_deck" ? "먼저 아래에서 온덱 카드를 준비하세요" : "아래 손패에서 첫 카드를 선택하세요"}</div>}
          </div>
        </div>
      </section>

      {game.phase === "visitor_save" ? (
        <section ref={visitorSaveAnchorRef} className="visitor-save-panel">
          <div className="visitor-save-heading">
            <div>
              <p>END OF MINI-GAME · VISITOR SAVE</p>
              <h2>홈팀의 마지막 위협에 대응하시겠습니까?</h2>
              <span>공개한 카드에서는 빨간색 수비 즉시 능력만 적용되고, 안타와 공격 능력은 무시한 뒤 카드를 버립니다.</span>
            </div>
            <div className="save-threat-count"><span>남은 CPU 위협</span><strong>{game.cpu.pending.length}</strong></div>
          </div>
          <div className="visitor-save-options">
            <button type="button" className="save-option skip-save" disabled={playbackRunning} onClick={() => resolveVisitorSave(null)}>
              <small>선택 1</small><strong>사용 안 함</strong><span>카드를 소비하지 않고 위협을 그대로 처리</span>
            </button>
            <div className={`save-option-card ${game.player.onDeck ? "is-available" : "is-unavailable"}`}>
              <small>선택 2 · 온덱 공개</small>
              {game.player.onDeck ? <PlayerCard card={game.player.onDeck} disabled /> : <div className="empty-card">보관한 온덱 카드가 없습니다</div>}
              <button type="button" disabled={playbackRunning || !game.player.onDeck} onClick={() => resolveVisitorSave("on_deck")}>온덱으로 세이브</button>
            </div>
            <div className="save-option-card lineup-save">
              <small>선택 3 · 라인업 맨 위 공개</small>
              <span className="large-card-back" aria-label="아직 공개하지 않은 라인업 맨 위 카드">45</span>
              <button type="button" disabled={playbackRunning || (game.player.deck.length === 0 && game.player.discard.length === 0)} onClick={() => resolveVisitorSave("lineup")}>라인업 공개 후 세이브</button>
            </div>
          </div>
          {playbackRunning && <p className="save-waiting">6번째 카드 처리가 끝나면 선택할 수 있습니다.</p>}
        </section>
      ) : game.phase === "buying" ? (
        <section ref={marketAnchorRef} className="buy-section">
          <div className="buy-header">
            <div>
              <p>BUY ROUND · 예산은 이 라운드에서만 사용</p>
              <h2>자유계약 선수 영입</h2>
            </div>
            <div className="budget-chip"><span>내 예산</span><strong>{game.playerBudget}</strong></div>
            <button type="button" className="finish-buy" onClick={finishBuyRound}>
              {!game.cpuBought ? "내 구매 종료 · AI 구매 보기" : game.purchaseTurn === null ? "AI 구매 확인 · 다음 경기" : "구매 종료 · 다음 경기"}
            </button>
          </div>
          <div className={`cpu-market-report ${game.cpuBought ? "is-complete" : "is-waiting"}`}>
            <div>
              <p>CPU MARKET REPORT</p>
              <h3>{game.cpuBought ? "AI 구매 결과" : "AI 구매 차례 대기"}</h3>
              <span>{game.cpuBought ? "AI가 같은 시장에서 구매한 내용입니다." : "내 구매를 마치면 AI가 남은 시장에서 구매합니다."}</span>
            </div>
            {game.marketActivity.filter((activity) => activity.buyer === "cpu").length ? (
              <div className="cpu-purchase-list">
                {game.marketActivity.filter((activity) => activity.buyer === "cpu").map((activity, index) => (
                  <article key={`${activity.recruit.id}-${index}`}>
                    <b>영입 {activity.recruit.id} · {activity.recruit.name}</b>
                    <span>비용 {activity.recruit.cost} · 마이너 이동 {activity.demote.id}</span>
                    <em>{activity.replacement ? `시장 보충 ${activity.replacement.id} · ${activity.replacement.name}` : "FA 덱 소진"}</em>
                  </article>
                ))}
              </div>
            ) : game.cpuBought ? <strong className="cpu-pass">AI는 이번 라운드에 구매하지 않았습니다.</strong> : null}
          </div>
          <div className="market-lineup">
            {game.market.map((card) => {
              const affordable = (card.cost ?? 999) <= game.playerBudget;
              return (
                <div className={`market-slot ${game.newMarketIds.includes(card.id) ? "is-new-arrival" : ""}`} key={card.id}>
                  {game.newMarketIds.includes(card.id) && <b className="new-arrival-badge">NEW · 새 입고</b>}
                  <PlayerCard
                    card={card}
                    selected={game.pendingPurchaseId === card.id}
                    disabled={playbackRunning || !affordable || game.purchaseTurn !== "player"}
                    onClick={() => selectFreeAgent(card.id)}
                  />
                  <span className={affordable ? "can-buy" : "cannot-buy"}>비용 {card.cost} · {affordable ? "영입 가능" : "예산 부족"}</span>
                </div>
              );
            })}
          </div>
          {pendingRecruit ? (
            <div className="demote-panel">
              <div className="recruit-review">
                <p>영입 예정</p>
                <h3>{pendingRecruit.name} · 비용 {pendingRecruit.cost}</h3>
                <PlayerCard card={pendingRecruit} disabled />
              </div>
              <div className="demote-review">
                <div className="demote-heading">
                  <p>ROSTER MUST STAY AT 15</p>
                  <h3>마이너로 보낼 선수를 카드 내용까지 비교해 선택하세요</h3>
                  <span>방출 후보는 방금 끝난 경기에서 사용한 카드 {game.player.played.length}장입니다. 자동 가치 판정 없이 원하는 1장을 직접 선택합니다.</span>
                  <span>선택한 선수는 활성 로스터에서 빠지고, 영입 선수는 다음 덱 맨 위에 놓입니다.</span>
                </div>
                <div className="demote-cards">
                  {game.player.played.map((card) => (
                    <div className="demote-option" key={card.id}>
                      <PlayerCard card={card} onClick={() => sendToMinors(card.id)} />
                      <span>이 선수를 마이너로 보내고 영입 확정</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="buy-help">영입할 FA 카드를 먼저 선택하세요. 구매한 선수는 덱 맨 위에 놓여 다음 경기에 반드시 등장합니다.</p>
          )}
        </section>
      ) : game.phase === "setting_on_deck" ? (
        <section className="on-deck-setup">
          <div className="on-deck-header">
            <div>
              <p>PRE-GAME · ON DECK</p>
              <h2>온덱으로 보관할 카드 한 장을 선택하세요</h2>
              <span>선택한 카드는 손패에서 빼고 라인업 맨 위 카드로 보충합니다. PH 카드 사용이나 비지터 세이브 때 온덱 카드를 꺼낼 수 있습니다.</span>
            </div>
            <button type="button" onClick={() => prepareOnDeck(null)}>온덱 없이 시작</button>
          </div>
          <div className="on-deck-choices">
            {game.player.hand.map((card) => (
              <div className="on-deck-option" key={card.id}>
                <PlayerCard card={card} onClick={() => prepareOnDeck(card.id)} />
                <span>이 카드를 온덱에 보관</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section ref={handAnchorRef} className={`hand-section ${playbackRunning ? "is-locked" : ""}`}>
          <div className="section-heading">
            <div>
              <p>ROUND {game.round} · YOUR MOVE</p>
              <h2>카드를 내면 4단계가 순서대로 중계됩니다</h2>
            </div>
            <span>공개 → 능력 → 상대 위협 확정 → 새 위협 등록</span>
          </div>
          <aside className={`on-deck-summary ${game.player.onDeck ? "has-card" : "is-empty"}`}>
            <div><small>ON DECK</small><strong>{game.player.onDeck ? game.player.onDeck.id : "준비하지 않음"}</strong></div>
            {game.player.onDeck ? (
              <>
                <span>{typeLabel[game.player.onDeck.type]} · {speedLabel[game.player.onDeck.speed]} · {game.player.onDeck.hits.map((hit) => hitLabel[hit]).join(" + ") || "안타 없음"}</span>
                <em>{game.player.onDeck.abilityTextKo ?? "즉시 능력 없음"}</em>
              </>
            ) : <span>PH 사용 시 라인업 맨 위의 비공개 카드를 투입합니다.</span>}
          </aside>
          <div className="card-hand">
            {game.player.hand.map((card) => (
              <div className="hand-card-slot" key={card.id}>
                <PlayerCard
                  card={card}
                  selected={game.selectedId === card.id}
                  disabled={playbackRunning}
                  abilityActive={abilityIsActive(card, game.player, game.cpu)}
                  onClick={() => playRound(card.id)}
                />
                {card.pinchHitter && (
                  <div className="pinch-hit-actions">
                    <button
                      type="button"
                      className="pinch-hit-action"
                      disabled={playbackRunning || !game.player.onDeck}
                      onClick={() => playRound(card.id, "on_deck")}
                    >
                      PH · {game.player.onDeck ? `온덱 ${game.player.onDeck.id}` : "온덱 없음"}
                    </button>
                    <button
                      type="button"
                      className="pinch-hit-action is-lineup"
                      disabled={playbackRunning || game.player.deck.length === 0}
                      onClick={() => playRound(card.id, "lineup")}
                    >
                      PH · 라인업 맨 위 비공개 카드
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="lower-grid">
        <article className="play-log">
          <div className="section-heading compact">
            <div><p>PLAY BY PLAY</p><h2>경기 기록</h2></div>
            <span>{game.log.length} EVENTS</span>
          </div>
          <div className="log-lines">
            {[...game.log].reverse().slice(0, 12).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </div>
        </article>

        <article className="deck-status">
          <div className="section-heading compact">
            <div><p>ACTIVE ROSTER</p><h2>내 15인 로스터</h2></div>
            <span>FA 카드 {activeRoster(game.player).filter((card) => card.category === "free_agent").length}장</span>
          </div>
          <div className="deck-counts">
            <div><span>전체</span><strong>{activeRoster(game.player).length}</strong><em>항상 15명</em></div>
            <div><span>FA</span><strong>{activeRoster(game.player).filter((card) => card.category === "free_agent").length}</strong><em>영입 선수</em></div>
            <div><span>마이너</span><strong>{game.player.minors.length}</strong><em>로스터 제외</em></div>
            <div><span>대기 덱</span><strong>{game.player.deck.length}</strong><em>다음 드로우</em></div>
          </div>
          <p className="coming-note">시작은 ST 15장입니다. FA를 한 장 영입할 때마다 이번 경기에 사용한 선수 한 명을 마이너로 보내므로 활성 로스터는 항상 15장으로 유지됩니다.</p>
        </article>
      </section>

      <footer>
        <span>ACTIVE DATA · {120 + game.enabledExpansions.reduce((total, set) => total + expansionCards.filter((card) => card.set === set).length, 0)} CARDS</span>
        <span>CORE MATCH PROTOTYPE v0.3 · EXPANSION READY</span>
      </footer>
    </main>
  );
}
