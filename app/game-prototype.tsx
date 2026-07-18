"use client";

import { useState } from "react";
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
  hits: Hit[];
};

type Runner = { cardId: string; speed: Speed };
type Side = {
  team: string;
  deck: Card[];
  hand: Card[];
  played: Card[];
  bases: Array<Runner | null>;
  pending: ThreatHit[];
  score: number;
  revenue: number;
};

type GameState = {
  player: Side;
  cpu: Side;
  round: number;
  phase: "playing" | "finished";
  selectedId: string | null;
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
    hand: deck.slice(0, 6),
    played: [],
    bases: [null, null, null],
    pending: [],
    score: 0,
    revenue: 0,
  };
}

function makeGame(playerTeam: string): GameState {
  const rivals = teams.filter((team) => team !== playerTeam);
  const cpuTeam = rivals[Math.floor(Math.random() * rivals.length)];
  return {
    player: makeSide(playerTeam),
    cpu: makeSide(cpuTeam),
    round: 1,
    phase: "playing",
    selectedId: null,
    log: [
      `${teamLabel[playerTeam]} vs ${teamLabel[cpuTeam]}`,
      "상대 카드의 위협 안타를 막고, 남은 안타가 확정된 뒤 내 카드를 냅니다.",
    ],
  };
}

function cloneSide(side: Side): Side {
  return { ...side, hand: [...side.hand], played: [...side.played], bases: [...side.bases], pending: [...side.pending] };
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

  const distance = hit === "single" ? 1 : hit === "double" ? 2 : hit === "triple" ? 3 : 4;
  const next: Array<Runner | null> = [null, null, null];
  for (let base = 2; base >= 0; base -= 1) {
    const runner = side.bases[base];
    if (!runner) continue;
    const destination = base + distance;
    if (destination >= 3) side.score += 1;
    else next[destination] = runner;
  }
  if (distance >= 4) side.score += 1;
  else next[distance - 1] = { cardId: source?.id ?? "hit", speed: source?.speed ?? "average" };
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

function commitPending(side: Side, source: Card | undefined) {
  const hits = [...side.pending];
  side.pending = [];
  hits.forEach((hit) => advanceHit(side, hit, source));
  return hits;
}

function playOne(card: Card, acting: Side, opposing: Side) {
  const opposingLast = opposing.played.at(-1);
  const events = applyAbility(card, acting, opposing, opposingLast, acting.played.length);
  const settled = commitPending(opposing, opposingLast);
  acting.hand = acting.hand.filter((item) => item.id !== card.id);
  acting.played.push(card);
  acting.revenue += card.revenue;
  acting.pending.push(...card.hits);
  return {
    events,
    settled,
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

function resultLabel(game: GameState) {
  if (game.player.score > game.cpu.score) return "승리";
  if (game.player.score < game.cpu.score) return "패배";
  return "무승부";
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
      <span className="card-role">{card.tier === "veteran" ? "VETERAN" : card.tier === "rookie" ? "ROOKIE" : card.name}</span>
      <span className="card-figure" aria-hidden="true">
        <span className="figure-head" />
        <span className="figure-body" />
        <span className="figure-bat" />
      </span>
      <span className="type-ribbon">{typeLabel[card.type]}</span>
      <span className="ability-box">{card.abilityText ?? "기본 능력 없음"}</span>
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
      <span className={`base base-second ${bases[1] ? "occupied" : ""}`}>2</span>
      <span className={`base base-third ${bases[2] ? "occupied" : ""}`}>3</span>
      <span className={`base base-first ${bases[0] ? "occupied" : ""}`}>1</span>
      <span className="home-plate" />
    </div>
  );
}

function ScorePanel({ game }: { game: GameState }) {
  return (
    <section className="score-panel" aria-label="점수판">
      <div className="score-team">
        <span>{teamCode[game.cpu.team]}</span>
        <strong>{game.cpu.score}</strong>
      </div>
      <div className="inning-cell">
        <small>MINI GAME</small>
        <b>{game.phase === "finished" ? "FINAL" : `${game.round} / 6`}</b>
      </div>
      <div className="score-team home-score">
        <strong>{game.player.score}</strong>
        <span>{teamCode[game.player.team]}</span>
      </div>
    </section>
  );
}

export function GamePrototype() {
  const [selectedTeam, setSelectedTeam] = useState("San Francisco");
  const [game, setGame] = useState<GameState>(() => makeGame("San Francisco"));
  const [showRules, setShowRules] = useState(false);

  function restart(team = selectedTeam) {
    setGame(makeGame(team));
  }

  function selectTeam(team: string) {
    setSelectedTeam(team);
    setGame(makeGame(team));
  }

  function playRound(cardId: string) {
    if (game.phase !== "playing") return;
    setGame((current) => {
      const player = cloneSide(current.player);
      const cpu = cloneSide(current.cpu);
      const playerCard = player.hand.find((card) => card.id === cardId);
      if (!playerCard) return current;

      const playerMove = playOne(playerCard, player, cpu);
      const cpuCard = chooseCpuCard(cpu, player);
      const cpuMove = playOne(cpuCard, cpu, player);
      const nextRound = current.round + 1;
      const finished = player.hand.length === 0;
      const log = [
        ...current.log,
        `R${current.round} 나: ${playerMove.line}`,
        ...playerMove.events.map((event) => `↳ ${event}`),
        playerMove.settled.length ? `↳ 상대 ${playerMove.settled.map((hit) => hitLabel[hit]).join(", ")} 확정` : "↳ 상대 위협 안타 없음",
        `R${current.round} CPU: ${cpuMove.line}`,
        ...cpuMove.events.map((event) => `↳ ${event}`),
        cpuMove.settled.length ? `↳ 내 ${cpuMove.settled.map((hit) => hitLabel[hit]).join(", ")} 확정` : "↳ 내 위협 안타 없음",
      ];

      if (finished) {
        const finalCpu = commitPending(cpu, cpu.played.at(-1));
        if (finalCpu.length) log.push(`경기 종료 · 상대 마지막 ${finalCpu.map((hit) => hitLabel[hit]).join(", ")} 확정`);
        log.push(`FINAL ${teamCode[player.team]} ${player.score} : ${cpu.score} ${teamCode[cpu.team]}`);
      }

      return {
        player,
        cpu,
        round: finished ? 6 : nextRound,
        phase: finished ? "finished" : "playing",
        selectedId: null,
        log,
      };
    });
  }

  return (
    <main className="game-shell">
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

      <ScorePanel game={game} />

      <section className="stadium-board">
        <div className="dugout cpu-dugout">
          <div className="dugout-title">
            <span>CPU · {teamLabel[game.cpu.team]}</span>
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
          <div className="threat-box opponent-threat">
            <span>CPU 위협 안타</span>
            <div>{game.cpu.pending.length ? game.cpu.pending.map((hit, index) => <b key={`${hit}-${index}`}>{hitLabel[hit]}</b>) : <em>없음</em>}</div>
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
            <div>{game.player.pending.length ? game.player.pending.map((hit, index) => <b key={`${hit}-${index}`}>{hitLabel[hit]}</b>) : <em>없음</em>}</div>
          </div>
        </div>

        <div className="dugout player-dugout">
          <div className="dugout-title">
            <span>YOU · {teamLabel[game.player.team]}</span>
            <b>수익 {game.player.revenue}</b>
          </div>
          <div className="last-played player-last">
            {game.player.played.at(-1) ? <PlayerCard card={game.player.played.at(-1)!} disabled /> : <div className="empty-card">아래 손패에서 첫 카드를 선택하세요</div>}
          </div>
        </div>
      </section>

      {game.phase === "finished" ? (
        <section className="result-panel">
          <p>MINI GAME FINAL</p>
          <h2>{resultLabel(game)}</h2>
          <strong>{teamCode[game.player.team]} {game.player.score} — {game.cpu.score} {teamCode[game.cpu.team]}</strong>
          <span>획득 수익 {game.player.revenue} · 다음 단계에서 자유계약 시장 구매에 사용</span>
          <button type="button" onClick={() => restart()}>같은 팀으로 다시 경기</button>
        </section>
      ) : (
        <section className="hand-section">
          <div className="section-heading">
            <div>
              <p>ROUND {game.round} · YOUR MOVE</p>
              <h2>플레이할 카드 한 장을 고르세요</h2>
            </div>
            <span>선택 즉시 능력과 안타가 처리됩니다</span>
          </div>
          <div className="card-hand">
            {game.player.hand.map((card) => (
              <PlayerCard
                key={card.id}
                card={card}
                selected={game.selectedId === card.id}
                onClick={() => playRound(card.id)}
              />
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
            <div><p>STARTER DECK</p><h2>내 시작 덱 구성</h2></div>
            <span>FA 카드 0장</span>
          </div>
          <div className="deck-counts">
            <div><span>전체</span><strong>15</strong><em>ST 카드</em></div>
            <div><span>손패</span><strong>{game.player.hand.length}</strong><em>플레이 가능</em></div>
            <div><span>플레이</span><strong>{game.player.played.length}</strong><em>사용 완료</em></div>
            <div><span>덱</span><strong>{game.player.deck.length}</strong><em>미사용</em></div>
          </div>
          <p className="coming-note">현재 미니게임에는 선택한 팀의 ST 카드 15장만 들어갑니다. FA 카드는 미니게임 종료 후 구매 단계가 구현될 때 별도 시장에서만 나타납니다.</p>
        </article>
      </section>

      <footer>
        <span>BASE DATA · 120 CARDS VERIFIED</span>
        <span>CORE MATCH PROTOTYPE v0.1</span>
      </footer>
    </main>
  );
}
