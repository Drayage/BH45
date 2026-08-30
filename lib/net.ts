"use client";

// Online-play networking layer for Highlight League 2045 (BH45).
//
// Host-authority pattern over Firebase Realtime Database:
//   - The HOST is the only client that ever runs the game reducer, shuffle(),
//     and AI-vs-cpu-side logic. It owns the authoritative GameState.
//   - After every local state change, the host writes a REDACTED view of the
//     state (see redactGameState) to `games/bh45/rooms/<roomCode>/state`,
//     tagged with a monotonically increasing `seq`.
//   - The GUEST only ever subscribes to that path and mirrors it into local
//     state — it never runs the reducer itself. Guest actions are sent as
//     small "intent" messages under `.../intents/<pushId>`; the host applies
//     them (via the same reducer it uses for its own local actions) and
//     re-broadcasts the result.
//
// RTDB root path convention (shared across the 7 sibling "Highlight
// League"-family repos, one Firebase project each writing to its own root):
//   games/bh45/rooms/<roomCode>
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  onChildAdded,
  runTransaction,
  onDisconnect,
  push,
  serverTimestamp,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import { FIREBASE_CONFIG } from "@/lib/firebaseConfig";
import type { Card, GameState, PendingCardChoice, Side } from "@/app/game-prototype";

export type RoomRole = "host" | "guest";
export type RoomStatus = "waiting" | "active" | "ended";

/** Actions a guest client can request the host apply. Extend this union as
 * more of the game's phases grow guest interactivity (see the note in
 * game-prototype.tsx near `sendGuestIntent`). */
export type NetIntent = { type: "submitCard" } & PendingCardChoice;

export type RoomMeta = {
  hostId: string;
  guestId: string | null;
  status: RoomStatus;
  createdAt: number;
};

const ROOT = "games/bh45/rooms";

function roomPath(code: string) {
  return `${ROOT}/${code}`;
}

// --- Firebase app/db (lazy — never touched unless the user opens the
// online-play UI, so a placeholder/empty config never crashes the app). ---
let cachedApp: FirebaseApp | null = null;
function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  const config = FIREBASE_CONFIG as Record<string, string | undefined>;
  if (!config.databaseURL) {
    throw new Error("온라인 플레이가 아직 설정되지 않았습니다 (lib/firebaseConfig.ts에 실제 Firebase 키가 필요합니다).");
  }
  const existing = getApps();
  cachedApp = existing.length ? existing[0]! : initializeApp(FIREBASE_CONFIG);
  return cachedApp;
}

let cachedDb: Database | null = null;
function db(): Database {
  if (!cachedDb) cachedDb = getDatabase(getFirebaseApp());
  return cachedDb;
}

function randomRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  let code = "";
  for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function randomClientId(): string {
  return `c-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

// --- Room lifecycle --------------------------------------------------------

export type CreateRoomResult = { roomCode: string; clientId: string };

export async function createRoom(): Promise<CreateRoomResult> {
  const database = db();
  const clientId = randomClientId();
  let roomCode = randomRoomCode();
  let claimed = false;
  for (let attempt = 0; attempt < 5 && !claimed; attempt += 1) {
    const metaRef = ref(database, `${roomPath(roomCode)}/meta`);
    const result = await runTransaction(metaRef, (current: RoomMeta | null) => {
      if (current) return; // code taken — abort and retry with a new one
      return { hostId: clientId, guestId: null, status: "waiting", createdAt: Date.now() } satisfies RoomMeta;
    });
    claimed = result.committed;
    if (!claimed) roomCode = randomRoomCode();
  }
  if (!claimed) throw new Error("방 코드를 생성하지 못했습니다. 다시 시도해주세요.");
  await markPresent(roomCode, "host");
  return { roomCode, clientId };
}

export type JoinRoomResult = { clientId: string };

export async function joinRoom(roomCodeInput: string): Promise<JoinRoomResult> {
  const database = db();
  const roomCode = roomCodeInput.trim().toUpperCase();
  if (!roomCode) throw new Error("방 코드를 입력해주세요.");
  const clientId = randomClientId();
  const metaRef = ref(database, `${roomPath(roomCode)}/meta`);
  let outcome: "ok" | "not_found" | "full" = "not_found";
  await runTransaction(metaRef, (current: RoomMeta | null) => {
    if (!current) {
      outcome = "not_found";
      return; // abort
    }
    if (current.guestId && current.guestId !== clientId) {
      outcome = "full";
      return; // abort
    }
    outcome = "ok";
    return { ...current, guestId: clientId, status: "active" } satisfies RoomMeta;
  });
  if (outcome === "not_found") throw new Error("방을 찾을 수 없습니다. 코드를 확인해주세요.");
  if (outcome === "full") throw new Error("이미 다른 상대가 참가한 방입니다.");
  await markPresent(roomCode, "guest");
  return { clientId };
}

async function markPresent(roomCode: string, role: RoomRole) {
  const presenceRef = ref(db(), `${roomPath(roomCode)}/presence/${role}`);
  await set(presenceRef, { at: serverTimestamp() });
  onDisconnect(presenceRef).remove();
}

export function leaveRoom(roomCode: string, role: RoomRole) {
  try {
    void remove(ref(db(), `${roomPath(roomCode)}/presence/${role}`));
  } catch {
    // best-effort — room state naturally goes stale if this fails
  }
}

export function subscribePresence(roomCode: string, role: RoomRole, onChange: (present: boolean) => void): Unsubscribe {
  return onValue(ref(db(), `${roomPath(roomCode)}/presence/${role}`), (snapshot) => onChange(snapshot.exists()));
}

// --- Authoritative state broadcast (host -> everyone) ----------------------
//
// `writeRoomState` guards against stale/out-of-order writes racing each
// other (e.g. two host state changes fired close together) with a Realtime
// Database transaction: a write is only applied if the incoming `seq` is
// strictly greater than whatever is currently stored.
export async function writeRoomState(roomCode: string, seq: number, state: GameState): Promise<void> {
  const stateRef = ref(db(), `${roomPath(roomCode)}/state`);
  // Stored as a single JSON string rather than a nested object: Realtime
  // Database silently drops empty arrays/objects (a write of `[]` behaves
  // like a delete), which would corrupt this game's many empty-by-default
  // arrays (discard/minors/pending/...) on the reader's side. A JSON blob
  // sidesteps that entirely.
  await runTransaction(stateRef, (current: { seq: number } | null) => {
    if (current && typeof current.seq === "number" && current.seq >= seq) return; // stale — abort
    return { seq, updatedAt: Date.now(), payload: JSON.stringify(state) };
  });
}

export function subscribeRoomState(roomCode: string, onState: (state: GameState, seq: number) => void): Unsubscribe {
  const stateRef = ref(db(), `${roomPath(roomCode)}/state`);
  let lastSeq = -1;
  return onValue(stateRef, (snapshot) => {
    const value = snapshot.val() as { seq: number; payload: string } | null;
    if (!value || typeof value.seq !== "number" || typeof value.payload !== "string" || value.seq <= lastSeq) return;
    lastSeq = value.seq;
    try {
      onState(JSON.parse(value.payload) as GameState, value.seq);
    } catch {
      // malformed/partial write — ignore and wait for the next broadcast
    }
  });
}

// --- Guest -> host action intents -------------------------------------------

export function sendIntent(roomCode: string, action: NetIntent) {
  return push(ref(db(), `${roomPath(roomCode)}/intents`), { action, createdAt: Date.now() });
}

export function subscribeIntents(roomCode: string, onIntent: (intentId: string, action: NetIntent) => void): Unsubscribe {
  return onChildAdded(ref(db(), `${roomPath(roomCode)}/intents`), (snapshot) => {
    const value = snapshot.val() as { action: NetIntent } | null;
    if (!value || !snapshot.key) return;
    onIntent(snapshot.key, value.action);
  });
}

export function clearIntent(roomCode: string, intentId: string): Promise<void> {
  return remove(ref(db(), `${roomPath(roomCode)}/intents/${intentId}`));
}

export function closeRoom(roomCode: string): Promise<void> {
  return remove(ref(db(), roomPath(roomCode)));
}

// --- Redaction ---------------------------------------------------------------
//
// Hides the OTHER side's hand/deck/on-deck card identities before a state
// is broadcast to a viewer: only counts (array length) survive, filled with
// generic placeholder cards so the existing card-rendering UI keeps working
// off real data shapes. Publicly-known piles (played/discard/minors/removed,
// and the face-up FA market) are left untouched.
function placeholderCard(team: string, index: number): Card {
  return {
    id: `HIDDEN-${team}-${index}`,
    set: "base",
    category: "starter",
    name: "Hidden Card",
    team,
    tier: null,
    type: "natural",
    cost: null,
    revenue: 0,
    speed: "average",
    pinchHitter: false,
    abilityText: null,
    abilityTextKo: null,
    hits: [],
  };
}

function redactSide(side: Side): Side {
  return {
    ...side,
    hand: side.hand.map((_, index) => placeholderCard(side.team, index)),
    deck: side.deck.map((_, index) => placeholderCard(side.team, index)),
    onDeck: side.onDeck ? placeholderCard(side.team, -1) : null,
  };
}

/** Produces the GameState a viewer on `hideSide` should NOT see the secrets
 * of — i.e. redacts `hideSide`'s hand/deck/on-deck. In this game host is
 * always the "player" (visitor) side and guest is always the "cpu" (home)
 * side, so the host broadcasts `redactGameState(state, "player")` and the
 * guest only ever receives that hidden-from-them view of the opponent. */
export function redactGameState(state: GameState, hideSide: "player" | "cpu"): GameState {
  return {
    ...state,
    [hideSide]: redactSide(state[hideSide]),
    freeAgentDeck: state.freeAgentDeck.map((_, index) => placeholderCard("FA", index)),
  };
}
