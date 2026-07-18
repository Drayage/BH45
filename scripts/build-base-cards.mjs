import { mkdir, writeFile } from "node:fs/promises";

const sourceImages = {
  starterSfBoston: "httpssteamusercontentaakamaihdnetugc7919882953082131974A3EA2E997E0EB287BF0CBA605F32A628F492790.jpg",
  starterLa: "httpssteamusercontentaakamaihdnetugc79198829531608574574DCC3D337E61D4184FD361A369E225D333F0A01.jpg",
  starterNy: "httpssteamusercontentaakamaihdnetugc791988035055676465886CFD6F4A460F4C361D89102F3B89B7946EFA59.jpg",
  freeAgentA: "httpssteamusercontentaakamaihdnetugc7919882953161101764CDE9DCB2510284137C9A55E2433F076C5E8ADB9.jpg",
  freeAgent062: "httpssteamusercontentaakamaihdnetugc791988295316150361EF016F36F9E72250761EBC93924027171C11C3B3.jpg",
  freeAgentB: "httpssteamusercontentaakamaihdnetugc791988295316122721DAA188250E9A90014FBBBB4FE1878CEA496C3DF1.jpg",
  freeAgentC: "httpssteamusercontentaakamaihdnetugc79198829531608974984ACD9A72183475A9105DE1E7D4F3F14F2986638.jpg",
};

const ability = {
  glove: "Glove: Cancel 1 Hit",
  pickOff: "Pick Off: Remove 1 base runner",
  walk: "Walk: Change all Hits to Walks",
  fastball: "Fastball: Cancel all Hits vs. a Natural",
  curve: "Curve: Cancel all Hits vs. a Robot",
  spitBall: "Spit Ball: Cancel all Hits vs. a Cyborg",
  knuckleBall: "Knuckle Ball: Reduce all Hits by 1 base",
  doublePlay: "Double Play: Remove up to 2 base runners (no Fast)",
  stolenBase: "Stolen Base: Advance all Average and Fast base runners 1 base",
  clutchSingle: "Clutch: Single (if runner on 2nd or 3rd)",
  clutchDouble: "Clutch: Double (if runner on 2nd or 3rd)",
  leadoffSingle: "Leadoff: If this is your first card played, Single",
  leadoffDouble: "Leadoff: If this is your first card played, Double",
  quickSingle: "Quick Eye: Single (if vs. Cyborg)",
  quickTriple: "Quick Eye: Triple (if vs. Cyborg)",
  quickHomerun: "Quick Eye: Homerun (if vs. Cyborg)",
};

const A = "average";
const F = "fast";
const S = "slow";
const single = "single";
const double = "double";
const triple = "triple";
const homeRun = "home_run";

function id(prefix, number) {
  return `${prefix}-${String(number).padStart(3, "0")}`;
}

function starterCard(number, team, tier, type, revenue, hits, speed, pinchHitter, abilityText, sourceImage) {
  return {
    id: id("ST", number),
    set: "base",
    category: "starter",
    name: tier === "rookie" ? "Rookie" : "Veteran",
    team,
    tier,
    type,
    cost: null,
    revenue,
    speed,
    pinchHitter,
    abilityText,
    hits,
    sourceImage,
  };
}

function freeAgentCard(number, name, team, type, cost, revenue, hits, speed, pinchHitter, abilityText, sourceImage) {
  return {
    id: id("FA", number),
    set: "base",
    category: "free_agent",
    name,
    team,
    tier: null,
    type,
    cost,
    revenue,
    speed,
    pinchHitter,
    abilityText,
    hits,
    sourceImage,
  };
}

const rookiePattern = [
  ["natural", 0, [single], A, false, ability.glove],
  ["cyborg", 2, [], A, true, ability.pickOff],
  ["natural", 2, [single], A, false, null],
  ["natural", 2, [single], A, false, null],
  ["natural", 1, [], A, true, ability.glove],
  ["cyborg", 1, [], A, true, ability.walk],
  ["robot", 2, [double], S, false, null],
  ["robot", 1, [double], A, false, null],
  ["robot", 1, [single, single], S, false, null],
  ["robot", 1, [single, single], S, false, null],
];

function makeStarterTeam(team, firstId, veteranRows, sourceImage) {
  const rookies = rookiePattern.map((row, index) =>
    starterCard(firstId + index, team, "rookie", ...row, sourceImage),
  );
  const veterans = veteranRows.map((row, index) =>
    starterCard(firstId + 10 + index, team, "veteran", ...row, sourceImage),
  );
  return [...rookies, ...veterans];
}

const starterCards = [
  ...makeStarterTeam("San Francisco", 1, [
    ["natural", 0, [single], A, false, ability.clutchDouble],
    ["cyborg", 2, [], A, true, ability.fastball],
    ["natural", 2, [single], A, false, ability.glove],
    ["robot", 0, [homeRun], A, true, null],
    ["robot", 2, [single, single], A, false, null],
  ], sourceImages.starterSfBoston),
  ...makeStarterTeam("Los Angeles", 16, [
    ["natural", 1, [], A, true, ability.leadoffSingle],
    ["cyborg", 2, [], A, true, ability.curve],
    ["robot", 1, [single, double], A, false, null],
    ["natural", 1, [homeRun], A, false, null],
    ["robot", 1, [single, single], A, false, ability.stolenBase],
  ], sourceImages.starterLa),
  ...makeStarterTeam("Boston", 31, [
    ["natural", 0, [single], A, true, ability.clutchSingle],
    ["cyborg", 2, [], A, true, ability.knuckleBall],
    ["natural", 1, [triple], S, false, ability.glove],
    ["robot", 1, [homeRun], A, false, null],
    ["robot", 2, [double], F, false, null],
  ], sourceImages.starterSfBoston),
  ...makeStarterTeam("New York", 46, [
    ["natural", 1, [single], A, false, ability.doublePlay],
    ["cyborg", 1, [single], A, false, ability.fastball],
    ["robot", 2, [double], S, true, ability.quickSingle],
    ["natural", 0, [homeRun], A, true, null],
    ["robot", 2, [triple], A, false, null],
  ], sourceImages.starterNy),
];

const fa = freeAgentCard;
const freeAgentCards = [
  fa(61, "Bucky Cano", "Baltimore", "natural", 7, 2, [single, single], A, false, ability.doublePlay, sourceImages.freeAgentA),
  fa(62, "Peeyee Rizzuto", "Texas", "natural", 4, 1, [single], F, true, ability.glove, sourceImages.freeAgent062),
  fa(63, "Ichiro Matsui", "Seattle", "natural", 6, 1, [single, single], F, true, ability.glove, sourceImages.freeAgentB),
  fa(64, "Brooks Nettles", "Detroit", "natural", 6, 1, [single, single], A, false, ability.clutchSingle, sourceImages.freeAgentB),
  fa(65, "Frankie Foxx", "Pittsburgh", "natural", 4, 2, [double], S, true, ability.glove, sourceImages.freeAgentC),
  fa(66, "Maury Aparicio", "San Francisco", "natural", 5, 1, [single], F, true, ability.doublePlay, sourceImages.freeAgentC),
  fa(67, "Mickey Maris", "New York", "natural", 7, 0, [single, homeRun], A, false, ability.glove, sourceImages.freeAgentA),
  fa(68, "Babe Bench", "Cincinnati", "natural", 5, 1, [single, double], S, false, ability.glove, sourceImages.freeAgentA),
  fa(69, "Mark Lopes", "Detroit", "natural", 5, 3, [single, single], A, false, null, sourceImages.freeAgentB),
  fa(70, "Derek Belanger", "Kansas City", "natural", 5, 4, [], A, true, ability.doublePlay, sourceImages.freeAgentA),
  fa(71, "Joe Mays", "Pittsburgh", "natural", 5, 1, [double], A, true, ability.clutchSingle, sourceImages.freeAgentC),
  fa(72, "Boog Banks", "Chicago", "natural", 5, 2, [double], A, true, ability.glove, sourceImages.freeAgentB),
  fa(73, "Dave Trout", "San Francisco", "natural", 5, 3, [triple], A, true, null, sourceImages.freeAgentC),
  fa(74, "Josh Lynn", "Boston", "natural", 5, 2, [], F, true, ability.leadoffSingle, sourceImages.freeAgentC),
  fa(75, "Ozzie Foxx", "Chicago", "natural", 5, 2, [single], A, true, ability.doublePlay, sourceImages.freeAgentB),
  fa(76, "Nellie McGhee", "Pittsburgh", "natural", 5, 2, [single], F, true, ability.glove, sourceImages.freeAgentC),
  fa(77, "Bucky Tulo", "Boston", "natural", 6, 1, [triple], F, true, ability.glove, sourceImages.freeAgentA),
  fa(78, "Moose Giambi", "New York", "natural", 7, 2, [homeRun], A, true, ability.glove, sourceImages.freeAgentB),
  fa(79, "Hank Hornsby", "Atlanta", "natural", 8, 3, [single], F, true, ability.leadoffSingle, sourceImages.freeAgentA),
  fa(80, "Ty Terry", "Pittsburgh", "natural", 8, 2, [homeRun], A, true, ability.clutchSingle, sourceImages.freeAgentB),
  fa(81, "Troy Jeter", "New York", "natural", 7, 3, [single, single], A, false, ability.glove, sourceImages.freeAgentB),
  fa(82, "Willie McGwire", "Boston", "natural", 8, 2, [single, double], F, false, ability.glove, sourceImages.freeAgentA),
  fa(83, "Barry Sosa", "Chicago", "natural", 9, 1, [homeRun, homeRun], A, false, null, sourceImages.freeAgentB),
  fa(84, "Dizzy Drysdale", "New York", "cyborg", 5, 2, [double], A, true, ability.spitBall, sourceImages.freeAgentB),
  fa(85, "Hoyt Niekro", "St. Louis", "cyborg", 5, 2, [single], A, true, ability.knuckleBall, sourceImages.freeAgentB),
  fa(86, "Blue Moon Odoul", "Seattle", "cyborg", 6, 3, [single], A, true, ability.fastball, sourceImages.freeAgentA),
  fa(87, "Satchel Seaver", "New York", "cyborg", 6, 3, [single], A, true, ability.fastball, sourceImages.freeAgentC),
  fa(88, "Juan Spahn", "St. Louis", "cyborg", 8, 2, [double, single], A, false, ability.curve, sourceImages.freeAgentC),
  fa(89, "CC Clemens", "Boston", "cyborg", 7, 2, [triple], A, true, ability.fastball, sourceImages.freeAgentB),
  fa(90, "Hideo Tanaka", "Cleveland", "cyborg", 8, 0, [single, single, single], A, false, ability.curve, sourceImages.freeAgentB),
  fa(91, "Nolan Gooden", "New York", "cyborg", 5, 2, [double], A, true, ability.walk, sourceImages.freeAgentB),
  fa(92, "Daisuke Darvish", "Texas", "cyborg", 7, 1, [single, double], A, false, ability.curve, sourceImages.freeAgentA),
  fa(93, "Sandy Gibson", "Pittsburgh", "cyborg", 7, 1, [homeRun], A, true, ability.fastball, sourceImages.freeAgentB),
  fa(94, "Yu Nomo", "Baltimore", "cyborg", 8, 3, [triple], A, true, ability.knuckleBall, sourceImages.freeAgentB),
  fa(95, "Z Bat", "Boston", "robot", 5, 0, [double, homeRun], S, false, null, sourceImages.freeAgentB),
  fa(96, "Wiffle", "Seattle", "robot", 4, 0, [single, single, single], S, false, null, sourceImages.freeAgentB),
  fa(97, "Model T", "Cleveland", "robot", 6, 0, [single, double, double], S, false, null, sourceImages.freeAgentB),
  fa(98, "Bat 90", "Cincinnati", "robot", 4, 1, [homeRun], S, true, ability.quickSingle, sourceImages.freeAgentB),
  fa(99, "Sonic Bat", "Cleveland", "robot", 5, 2, [single], A, true, ability.quickTriple, sourceImages.freeAgentC),
  fa(100, "Big Mo", "San Francisco", "robot", 5, 0, [single, single], S, false, ability.quickHomerun, sourceImages.freeAgentC),
  fa(101, "Bat 90", "Cincinnati", "robot", 4, 1, [homeRun], S, true, ability.quickSingle, sourceImages.freeAgentC),
  fa(102, "Kong 35", "Los Angeles", "robot", 6, 1, [homeRun], S, true, ability.clutchSingle, sourceImages.freeAgentC),
  fa(103, "Sprint 36", "Philadelphia", "robot", 6, 1, [single, double], F, false, ability.stolenBase, sourceImages.freeAgentC),
  fa(104, "Speedo 42", "Pittsburgh", "robot", 6, 1, [single, double], F, false, ability.stolenBase, sourceImages.freeAgentB),
  fa(105, "Speedbot", "Kansas City", "robot", 6, 1, [single, triple], F, false, null, sourceImages.freeAgentC),
  fa(106, "Bat 44", "Cincinnati", "robot", 5, 2, [single, double], S, false, ability.stolenBase, sourceImages.freeAgentC),
  fa(107, "Bat 100 L", "Chicago", "robot", 6, 3, [homeRun], A, true, null, sourceImages.freeAgentA),
  fa(108, "Bat 100 R", "Cleveland", "robot", 6, 3, [homeRun], A, true, null, sourceImages.freeAgentC),
  fa(109, "5 Tool Model", "Cincinnati", "robot", 10, 1, [single, single, single], F, false, ability.clutchSingle, sourceImages.freeAgentC),
  fa(110, "See Ya", "Detroit", "robot", 7, 0, [homeRun, homeRun], S, false, null, sourceImages.freeAgentC),
  fa(111, "Turtlebot TR", "Texas", "robot", 4, 2, [single, single], A, false, null, sourceImages.freeAgentC),
  fa(112, "Turtlebot LG", "Atlanta", "robot", 4, 2, [single, single], A, false, null, sourceImages.freeAgentC),
  fa(113, "Boomer 3", "Baltimore", "robot", 7, 0, [single, single], F, false, ability.leadoffSingle, sourceImages.freeAgentB),
  fa(114, "Mini Motor CX", "San Francisco", "robot", 4, 0, [single, single], F, false, ability.stolenBase, sourceImages.freeAgentB),
  fa(115, "Mini Motor FX", "Detroit", "robot", 4, 0, [single, single], F, false, ability.stolenBase, sourceImages.freeAgentB),
  fa(116, "Cy Pie", "St. Louis", "natural", 8, 2, [single], F, true, ability.leadoffDouble, sourceImages.freeAgentB),
  fa(117, "Max Verlander", "Philadelphia", "cyborg", 11, 2, [triple, double], F, false, ability.curve, sourceImages.freeAgentB),
  fa(118, "Catfish Carlton", "Cleveland", "cyborg", 9, 1, [single, single, double], A, false, ability.spitBall, sourceImages.freeAgentB),
  fa(119, "Model SK", "Baltimore", "robot", 6, 2, [double, single], A, false, ability.quickSingle, sourceImages.freeAgentB),
  fa(120, "Model TT", "Detroit", "robot", 6, 2, [double, single], A, false, ability.quickSingle, sourceImages.freeAgentA),
];

const cards = [...starterCards, ...freeAgentCards];

function validate() {
  const errors = [];
  if (cards.length !== 120) errors.push(`expected 120 cards, got ${cards.length}`);
  if (starterCards.length !== 60) errors.push(`expected 60 starter cards, got ${starterCards.length}`);
  if (freeAgentCards.length !== 60) errors.push(`expected 60 free agents, got ${freeAgentCards.length}`);

  const seen = new Set();
  for (const card of cards) {
    if (seen.has(card.id)) errors.push(`duplicate id ${card.id}`);
    seen.add(card.id);
    if (!card.sourceImage) errors.push(`missing source image for ${card.id}`);
    if (!["natural", "cyborg", "robot"].includes(card.type)) errors.push(`invalid type for ${card.id}`);
    if (![A, F, S].includes(card.speed)) errors.push(`invalid speed for ${card.id}`);
    if (!Array.isArray(card.hits)) errors.push(`invalid hits for ${card.id}`);
  }

  for (let number = 1; number <= 60; number += 1) {
    if (!seen.has(id("ST", number))) errors.push(`missing ${id("ST", number)}`);
  }
  for (let number = 61; number <= 120; number += 1) {
    if (!seen.has(id("FA", number))) errors.push(`missing ${id("FA", number)}`);
  }

  if (errors.length) throw new Error(errors.join("\n"));
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  const columns = [
    "id", "set", "category", "name", "team", "tier", "type", "cost", "revenue",
    "speed", "pinchHitter", "abilityText", "hits", "sourceImage",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n") + "\n";
}

validate();
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/base-cards.json", import.meta.url), JSON.stringify(cards, null, 2) + "\n");
await writeFile(new URL("../data/base-cards.csv", import.meta.url), toCsv(cards));

const summary = cards.reduce((result, card) => {
  result[card.category] = (result[card.category] ?? 0) + 1;
  result[card.type] = (result[card.type] ?? 0) + 1;
  return result;
}, {});
console.log(JSON.stringify({ cards: cards.length, ...summary }, null, 2));
