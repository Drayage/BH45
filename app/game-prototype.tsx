"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import cardData from "@/data/base-cards.json";

type PlayerType = "natural" | "cyborg" | "robot";
type Speed = "slow" | "average" | "fast";
type Hit = "single" | "double" | "triple" | "home_run";
type ThreatHit = Hit | "walk";

type Card = {
  id: string;
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
  phase: "setting_on_deck" | "playing" | "buying" | "series_finished";
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
  selectedId: string | null;
  resolutionKey: number;
  lastResolution: ResolutionEvent[];
  log: string[];
};

const cards = cardData as Card[];
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
    score: 0,
    revenue: 0,
  };
}

function makeGame(playerTeam: string): GameState {
  const rivals = teams.filter((team) => team !== playerTeam);
  const cpuTeam = rivals[Math.floor(Math.random() * rivals.length)];
  const freeAgents = shuffle(cards.filter((card) => card.category === "free_agent" && card.id.startsWith("FA-")));
  return {
    player: makeSide(playerTeam),
    cpu: makeSide(cpuTeam),
    round: 1,
    phase: "setting_on_deck",
    stage: "exhibition",
    gameNumber: 1,
    exhibitionWins: { player: 0, cpu: 0 },
    worldSeriesWins: { player: 0, cpu: 0 },
    market: freeAgents.slice(0, 6),
    freeAgentDeck: freeAgents.slice(6),
    playerBudget: 0,
    cpuBudget: 0,
    purchaseTurn: null,
    cpuBought: false,
    pendingPurchaseId: null,
    selectedId: null,
    resolutionKey: 0,
    lastResolution: [
      { kind: "reveal", actor: "player", title: "온덱 준비", detail: "손패 한 장을 온덱에 보관하거나 건너뛴 뒤 경기를 시작합니다." },
      { kind: "ability", actor: "system", title: "② 즉시 능력", detail: "수비 능력으로 상대 위협 안타를 먼저 막습니다." },
      { kind: "settle", actor: "system", title: "③ 안타 확정", detail: "남은 위협을 주루에 반영한 뒤 새 위협을 등록합니다." },
    ],
    log: [
      `${teamLabel[playerTeam]} vs ${teamLabel[cpuTeam]}`,
      "온덱 카드를 준비한 뒤 상대 위협 안타를 막고 내 카드를 냅니다.",
    ],
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

function advanceHit(side: Side, hit: ThreatHit, source: Card | undefined) {
  if (hit === "walk") {
    const next = [...side.bases];
    if (next[0]) {
      if (next[1]) {
        if (next[2]) side.score += 1;
        next[2] = next[1];
      }
      next[1] = next[0];
    }
    next[0] = { cardId: source?.id ?? "walk", speed: source?.speed ?? "average" };
    side.bases = next;
    return;
  }

  const hitDistance = hit === "single" ? 1 : hit === "double" ? 2 : hit === "triple" ? 3 : 4;
  if (hitDistance === 4) {
    side.score += side.bases.filter(Boolean).length + 1;
    side.bases = [null, null, null];
    return;
  }

  const next: Array<Runner | null> = [null, null, null];
  for (let base = 2; base >= 0; base -= 1) {
    const runner = side.bases[base];
    if (!runner) continue;
    let distance = hitDistance;
    if (runner.speed === "fast") distance += 1;
    if (runner.speed === "average" && base === 1 && hit === "single") distance = 2;
    const ideal = base + distance;
    if (ideal >= 3) {
      side.score += 1;
      continue;
    }

    const leadBase = next.findIndex((occupied, index) => index > base && Boolean(occupied));
    const destination = leadBase >= 0 ? Math.min(ideal, leadBase - 1) : ideal;
    next[Math.max(base, destination)] = runner;
  }
  next[hitDistance - 1] = { cardId: source?.id ?? "hit", speed: source?.speed ?? "average" };
  side.bases = next;
}

function removeRunner(side: Side, count: number, allowFast = true) {
  for (let base = 2; base >= 0 && count > 0; base -= 1) {
    const runner = side.bases[base];
    if (runner && (allowFast || runner.speed !== "fast")) {
      side.bases[base] = null;
      count -= 1;
    }
  }
}

function reduceHits(hits: ThreatHit[]) {
  return hits.flatMap<ThreatHit>((hit) => {
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
  if (!text) return events;

  const granted = parseGrantedHit(text);
  const onScoringBase = Boolean(acting.bases[1] || acting.bases[2]);
  if (text.includes("quick eye") && opposingLast?.type === "cyborg" && granted) {
    acting.pending.push(granted);
    if (text.includes("2 walks")) acting.pending.push("walk");
    events.push(`퀵 아이가 ${hitLabel[granted]}를 추가했습니다.`);
  } else if (text.includes("clutch") && onScoringBase && granted) {
    acting.pending.push(granted);
    events.push(`클러치가 ${hitLabel[granted]}를 추가했습니다.`);
  } else if (text.includes("leadoff") && playIndex === 0 && granted) {
    acting.pending.push(granted);
    events.push(`리드오프가 ${hitLabel[granted]}를 추가했습니다.`);
  } else if (text.includes("rally") && acting.score < opposing.score && granted) {
    acting.pending.push(granted);
    events.push(`랠리가 ${hitLabel[granted]}를 추가했습니다.`);
  }

  return events;
}

function applyDefensiveAbility(card: Card, acting: Side, opposing: Side, opposingLast: Card | undefined) {
  const text = card.abilityText?.toLowerCase() ?? "";
  const events: string[] = [];
  if (!text) return events;

  if (text.includes("magna glove")) {
    opposing.pending.splice(0, 2);
    events.push("마그나 글러브로 위협 안타 2개를 지웠습니다.");
  } else if (text.includes("glove")) {
    opposing.pending.splice(0, 1);
    events.push("글러브로 위협 안타 1개를 지웠습니다.");
  }

  if (text.includes("pick off")) {
    removeRunner(opposing, text.includes("all") ? 3 : 1);
    events.push("견제로 주자를 제거했습니다.");
  }
  if (text.includes("double play")) {
    removeRunner(opposing, 2, false);
    events.push("병살로 빠르지 않은 주자를 최대 2명 제거했습니다.");
  }
  if (text.includes("fastball") && opposingLast?.type === "natural") {
    opposing.pending = [];
    events.push("패스트볼이 내추럴의 위협 안타를 모두 취소했습니다.");
  }
  if (text.includes("curve") && opposingLast?.type === "robot") {
    opposing.pending = [];
    events.push("커브가 로봇의 위협 안타를 모두 취소했습니다.");
  }
  if (text.includes("spit ball") && opposingLast?.type === "cyborg") {
    opposing.pending = [];
    events.push("스핏볼이 사이보그의 위협 안타를 모두 취소했습니다.");
  }
  if (text.includes("knuckle ball")) {
    opposing.pending = reduceHits(opposing.pending);
    events.push("너클볼이 모든 위협 안타를 1베이스 줄였습니다.");
  }
  if (text.startsWith("walk:")) {
    opposing.pending = opposing.pending.map(() => "walk");
    events.push("위협 안타가 볼넷으로 바뀌었습니다.");
  }

  return events;
}

function commitPending(side: Side, source: Card | undefined) {
  const hits = [...side.pending];
  side.pending = [];
  side.pendingSpeed = null;
  hits.forEach((hit) => advanceHit(side, hit, source));
  return hits;
}

function playOne(card: Card, acting: Side, opposing: Side) {
  const opposingLast = opposing.played.at(-1);
  const revealFrame: MoveFrame = { acting: visualSide(acting), opposing: visualSide(opposing) };
  acting.pendingSpeed = card.speed;
  const events = applyAbility(card, acting, opposing, opposingLast, acting.played.length);
  const abilityFrame: MoveFrame = { acting: visualSide(acting), opposing: visualSide(opposing) };
  const settled = commitPending(opposing, opposingLast);
  const settleFrame: MoveFrame = { acting: visualSide(acting), opposing: visualSide(opposing) };
  acting.hand = acting.hand.filter((item) => item.id !== card.id);
  acting.played.push(card);
  acting.revenue += card.revenue;
  acting.pending.push(...card.hits);
  if (acting.pending.length) acting.pendingSpeed = card.speed;
  const threatFrame: MoveFrame = { acting: visualSide(acting), opposing: visualSide(opposing) };
  return {
    events,
    settled,
    frames: { reveal: revealFrame, ability: abilityFrame, settle: settleFrame, threat: threatFrame },
    line: `${teamCode[acting.team]} · ${card.id} ${typeLabel[card.type]} / ${card.hits.map((hit) => hitLabel[hit]).join(" + ") || "안타 없음"}`,
  };
}

function chooseCpuCard(side: Side, opponent: Side) {
  const pendingCount = opponent.pending.length;
  const ranked = [...side.hand].sort((a, b) => {
    const aDefense = a.abilityText && /Glove|Fastball|Curve|Pick Off|Double Play|Knuckle/.test(a.abilityText) ? 1 : 0;
    const bDefense = b.abilityText && /Glove|Fastball|Curve|Pick Off|Double Play|Knuckle/.test(b.abilityText) ? 1 : 0;
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
  const nextMarket = market.filter((card) => card.id !== purchasedId);
  const nextDeck = [...freeAgentDeck];
  const replacement = nextDeck.shift();
  if (replacement) nextMarket.push(replacement);
  return { market: nextMarket, freeAgentDeck: nextDeck };
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
  }

  return { cpu, market, freeAgentDeck, budget, purchases };
}

function miniGameWinner(player: Side, cpu: Side): "player" | "cpu" | "tie" {
  if (player.score > cpu.score) return "player";
  if (player.score < cpu.score) return "cpu";
  return "tie";
}

function activeRoster(side: Side) {
  return [...side.deck, ...side.discard, ...side.hand, ...side.played, ...(side.onDeck ? [side.onDeck] : [])];
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
      detail: move.events.length ? move.events.join(" ") : (card.abilityTextKo ?? "발동할 즉시 능력이 없습니다."),
      card,
      snapshot: orientFrame(actor, move.frames.ability),
    },
    {
      kind: "settle",
      actor,
      title: "상대 위협 확정",
      detail: move.settled.length ? `${move.settled.map((hit) => hitLabel[hit]).join(" + ")}를 베이스에 반영했습니다.` : "남은 위협 안타가 없습니다.",
      card,
      snapshot: orientFrame(actor, move.frames.settle),
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
            <small>{event.actor === "player" ? "YOU" : event.actor === "cpu" ? "CPU" : "RULE"}</small>
            <strong>{event.title}</strong>
            <span>{event.detail}</span>
          </article>
        ))}
      </div>
      {active && <div className={`broadcast-call actor-${active.actor}`} key={`${game.resolutionKey}-${activeIndex}`}><b>{running ? "NOW" : "LAST"}</b><span>{active.title}</span><em>{active.detail}</em></div>}
    </section>
  );
}

function PlayerCard({ card, selected, disabled, onClick }: { card: Card; selected?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={`player-card type-${card.type} ${selected ? "is-selected" : ""}`}
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
      <span className="ability-box" title={card.abilityText ?? undefined}>{card.abilityTextKo ?? "기본 능력 없음"}</span>
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

function BaseDiamond({ bases }: { bases: Array<Runner | null> }) {
  return (
    <div className="diamond" aria-label={`1루 ${bases[0] ? "주자 있음" : "비어 있음"}, 2루 ${bases[1] ? "주자 있음" : "비어 있음"}, 3루 ${bases[2] ? "주자 있음" : "비어 있음"}`}>
      <span className={`base base-second ${bases[1] ? `occupied speed-${bases[1].speed}` : ""}`}>2</span>
      <span className={`base base-third ${bases[2] ? `occupied speed-${bases[2].speed}` : ""}`}>3</span>
      <span className={`base base-first ${bases[0] ? `occupied speed-${bases[0].speed}` : ""}`}>1</span>
      <span className="home-plate" />
    </div>
  );
}

function SnapshotTeam({ label, side, actor, focused }: { label: string; side: VisualSide; actor: "player" | "cpu"; focused?: boolean }) {
  return (
    <div className={`snapshot-team snapshot-${actor} ${focused ? "is-focused" : ""}`}>
      <div className="snapshot-score"><span>{label}</span><strong>{side.score}</strong></div>
      <BaseDiamond bases={side.bases} />
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

function PlaybackStage({ event, index, total, running, onSkip }: { event: ResolutionEvent | undefined; index: number; total: number; running: boolean; onSkip: () => void }) {
  if (!event?.snapshot) return null;
  const actingLabel = event.actor === "player" ? "YOU" : event.actor === "cpu" ? "CPU" : "RULE";
  const focusedTeam = event.kind === "settle"
    ? event.actor === "player" ? "cpu" : "player"
    : event.kind === "threat" ? event.actor : null;
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
        {event.card && <PlayerCard card={event.card} disabled />}
      </div>
      <div className="snapshot-field">
        <SnapshotTeam label="CPU · 홈" side={event.snapshot.cpu} actor="cpu" focused={focusedTeam === "cpu"} />
        <div className="snapshot-divider"><span>처리</span><i>→</i></div>
        <SnapshotTeam label="YOU · 원정" side={event.snapshot.player} actor="player" focused={focusedTeam === "player"} />
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
        <b>{game.phase === "playing" ? `${game.round} / 6` : game.phase === "setting_on_deck" ? "ON DECK" : game.phase === "buying" ? "BUY" : "FINAL"}</b>
      </div>
      <div className="score-team home-score">
        <strong key={`player-score-${game.player.score}`}>{game.player.score}</strong>
        <span>{teamCode[game.player.team]}</span>
      </div>
    </section>
  );
}

export function GamePrototype() {
  const [selectedTeam, setSelectedTeam] = useState("San Francisco");
  const [game, setGame] = useState<GameState>(() => makeGame("San Francisco"));
  const [showRules, setShowRules] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [turnTransition, setTurnTransition] = useState<"cpu" | "player" | null>(null);
  const playbackTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const turnTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackAnchorRef = useRef<HTMLDivElement>(null);
  const handAnchorRef = useRef<HTMLElement>(null);
  const previousPlaybackRunning = useRef(false);
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
      playable.slice(1).forEach((eventIndex, order) => {
        playbackTimers.current.push(setTimeout(() => setPlaybackIndex(eventIndex), (order + 1) * 920));
      });
      playbackTimers.current.push(setTimeout(() => setPlaybackRunning(false), playable.length * 920 + 180));
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
    const target = playbackRunning ? playbackAnchorRef.current : wasRunning ? handAnchorRef.current : null;
    if (!target) return;
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, playbackRunning ? 90 : 180);
    return () => window.clearTimeout(timer);
  }, [game.resolutionKey, playbackRunning]);

  function skipPlayback() {
    playbackTimers.current.forEach(clearTimeout);
    playbackTimers.current = [];
    const lastPlayable = game.lastResolution.findLastIndex((event) => Boolean(event.snapshot));
    if (lastPlayable >= 0) setPlaybackIndex(lastPlayable);
    setPlaybackRunning(false);
  }

  function restart(team = selectedTeam) {
    setGame(makeGame(team));
  }

  function selectTeam(team: string) {
    setSelectedTeam(team);
    setGame(makeGame(team));
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

  function playRound(cardId: string, usePinchHitter = false) {
    if (game.phase !== "playing" || playbackRunning) return;
    setGame((current) => {
      const player = cloneSide(current.player);
      const cpu = cloneSide(current.cpu);
      const selectedCard = player.hand.find((card) => card.id === cardId);
      if (!selectedCard) return current;
      let playerCard = selectedCard;
      let pinchHitDetail: string | null = null;
      if (usePinchHitter) {
        if (!selectedCard.pinchHitter) return current;
        const fromOnDeck = Boolean(player.onDeck);
        const replacement = player.onDeck ?? player.deck.shift();
        if (!replacement) return current;
        player.hand = player.hand.filter((card) => card.id !== selectedCard.id);
        player.discard.push(selectedCard);
        player.onDeck = null;
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
        if (player.deck.length === 0 && player.discard.length) {
          player.deck = shuffle(player.discard);
          player.discard = [];
        }
        const saveFromOnDeck = Boolean(player.onDeck);
        const saveCard = player.onDeck ?? player.deck.shift();
        player.onDeck = null;
        if (saveCard) {
          const saveEvents = applyDefensiveAbility(saveCard, player, cpu, cpu.played.at(-1));
          player.discard.push(saveCard);
          resolution.push({
            kind: "save",
            actor: "player",
            title: "비지터 세이브",
            detail: saveEvents.length
              ? `${saveFromOnDeck ? "온덱" : "라인업 맨 위"} ${saveCard.id} 공개 · ${saveEvents.join(" ")}`
              : `${saveFromOnDeck ? "온덱" : "라인업 맨 위"} ${saveCard.id} 공개 · 적용 가능한 수비 능력이 없습니다.`,
            card: saveCard,
            snapshot: snapshotSides(player, cpu),
          });
          log.push(`비지터 세이브 · ${saveFromOnDeck ? "온덱" : "라인업"} ${saveCard.id} ${saveEvents.join(" ") || "수비 효과 없음"}`);
        }
        const finalCpu = commitPending(cpu, cpu.played.at(-1));
        resolution.push({
          kind: "settle",
          actor: "cpu",
          title: "홈팀 마지막 위협 확정",
          detail: finalCpu.length ? finalCpu.map((hit) => hitLabel[hit]).join(" + ") : "모든 위협을 막았습니다.",
          snapshot: snapshotSides(player, cpu),
        });
        if (finalCpu.length) log.push(`경기 종료 · 상대 마지막 ${finalCpu.map((hit) => hitLabel[hit]).join(", ")} 확정`);
        log.push(`FINAL ${teamCode[player.team]} ${player.score} : ${cpu.score} ${teamCode[cpu.team]}`);

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
            round: current.round,
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
        const firstBuyer = player.revenue < cpu.revenue
          ? "player"
          : cpu.revenue < player.revenue
            ? "cpu"
            : winner === "player" ? "cpu" : "player";

        if (firstBuyer === "cpu") {
          const cpuBuy = runCpuBuy(cpu, market, freeAgentDeck, cpuBudget);
          nextCpu = cpuBuy.cpu;
          market = cpuBuy.market;
          freeAgentDeck = cpuBuy.freeAgentDeck;
          cpuBudget = cpuBuy.budget;
          cpuBuy.purchases.forEach((purchase) => log.push(`CPU 구매 · ${purchase}`));
        }
        log.push(`구매 라운드 · 내 예산 ${player.revenue}, CPU 예산 ${cpu.revenue}`);

        return {
          ...current,
          player,
          cpu: nextCpu,
          round: current.round,
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
          selectedId: null,
          resolutionKey: current.resolutionKey + 1,
          lastResolution: [
            ...resolution,
            { kind: "buy", actor: "system", title: "구매 라운드", detail: `내 예산 ${player.revenue} · CPU 예산 ${cpu.revenue}` },
          ],
          log,
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

  function selectFreeAgent(cardId: string) {
    setGame((current) => {
      if (current.phase !== "buying" || current.purchaseTurn !== "player") return current;
      const card = current.market.find((item) => item.id === cardId);
      if (!card || (card.cost ?? 999) > current.playerBudget || current.player.played.length === 0) return current;
      return { ...current, pendingPurchaseId: current.pendingPurchaseId === cardId ? null : cardId };
    });
  }

  function sendToMinors(cardId: string) {
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
      return {
        ...current,
        player,
        market: replenished.market,
        freeAgentDeck: replenished.freeAgentDeck,
        playerBudget: current.playerBudget - (recruit.cost ?? 0),
        pendingPurchaseId: null,
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
    setGame((current) => {
      if (current.phase !== "buying") return current;
      const player = cloneSide(current.player);
      let cpu = cloneSide(current.cpu);
      let market = [...current.market];
      let freeAgentDeck = [...current.freeAgentDeck];
      let cpuBudget = current.cpuBudget;
      const log = [...current.log];

      if (!current.cpuBought) {
        const cpuBuy = runCpuBuy(cpu, market, freeAgentDeck, cpuBudget);
        cpu = cpuBuy.cpu;
        market = cpuBuy.market;
        freeAgentDeck = cpuBuy.freeAgentDeck;
        cpuBudget = cpuBuy.budget;
        cpuBuy.purchases.forEach((purchase) => log.push(`CPU 구매 · ${purchase}`));
      }

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
        market,
        freeAgentDeck,
        stage,
        gameNumber,
        round: 1,
        phase: "setting_on_deck",
        playerBudget: 0,
        cpuBudget,
        purchaseTurn: null,
        cpuBought: false,
        pendingPurchaseId: null,
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
          <button type="button" className="restart-button" onClick={() => restart()}>새 미니게임</button>
        </nav>
      </header>

      {showRules && (
        <aside className="rules-strip">
          <b>현재 구현 범위</b>
          <span>① 6장으로 6라운드 진행</span>
          <span>② 먼저 상대 위협 안타에 내 카드의 수비 능력 적용</span>
          <span>③ 남은 안타 확정 후 내 안타를 위협 칸에 등록</span>
          <span>④ 글러브·견제·병살·구종 상성·볼넷·퀵 아이·클러치 처리</span>
          <span>⑤ 빠른 주자 +1베이스 · 보통 주자 2루에서 1루타 득점 · 추월 금지</span>
          <span>⑥ 홈팀 마지막 카드 뒤 원정팀 비지터 세이브</span>
          <span>⑦ 경기 전 온덱 1장 선택 가능 · PH 카드는 버리고 온덱 또는 라인업 맨 위 카드 투입</span>
          <span>※ 위협 안타: 아직 득점 처리되지 않아 다음 카드로 막을 수 있는 안타</span>
        </aside>
      )}

      <section className="team-picker" aria-label="팀 선택">
        <span>내 스타터 덱</span>
        {teams.map((team) => (
          <button type="button" key={team} className={team === selectedTeam ? "active" : ""} onClick={() => selectTeam(team)}>
            <b>{teamCode[team]}</b> {teamLabel[team]}
          </button>
        ))}
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

      {game.phase === "series_finished" ? (
        <section className="result-panel">
          <p>WORLD SERIES FINAL</p>
          <h2>{game.worldSeriesWins.player > game.worldSeriesWins.cpu ? "챔피언" : "준우승"}</h2>
          <strong>{teamCode[game.player.team]} {game.worldSeriesWins.player} — {game.worldSeriesWins.cpu} {teamCode[game.cpu.team]}</strong>
          <span>3경기 미니 시즌과 7전 4선승 월드 시리즈를 완료했습니다.</span>
          <button type="button" onClick={() => restart()}>같은 팀으로 새 시즌</button>
        </section>
      ) : game.phase === "buying" ? (
        <section className="buy-section">
          <div className="buy-header">
            <div>
              <p>BUY ROUND · 예산은 이 라운드에서만 사용</p>
              <h2>자유계약 선수 영입</h2>
            </div>
            <div className="budget-chip"><span>내 예산</span><strong>{game.playerBudget}</strong></div>
            <button type="button" className="finish-buy" onClick={finishBuyRound}>구매 종료 · 다음 경기</button>
          </div>
          <div className="market-lineup">
            {game.market.map((card) => {
              const affordable = (card.cost ?? 999) <= game.playerBudget;
              return (
                <div className="market-slot" key={card.id}>
                  <PlayerCard
                    card={card}
                    selected={game.pendingPurchaseId === card.id}
                    disabled={!affordable}
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
                  onClick={() => playRound(card.id)}
                />
                {card.pinchHitter && (
                  <button
                    type="button"
                    className="pinch-hit-action"
                    disabled={playbackRunning || (!game.player.onDeck && game.player.deck.length === 0)}
                    onClick={() => playRound(card.id, true)}
                  >
                    PH 사용 · {game.player.onDeck ? `온덱 ${game.player.onDeck.id}` : "라인업 맨 위"} 투입
                  </button>
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
        <span>BASE DATA · 120 CARDS VERIFIED</span>
        <span>CORE MATCH PROTOTYPE v0.2 · VISUAL RESOLUTION</span>
      </footer>
    </main>
  );
}
