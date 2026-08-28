// Firebase project configuration for BH45's online-play layer.
//
// This project intentionally shares ONE Firebase project across all 7
// "Highlight League"-family game repos. Each game writes only under its own
// root path in Realtime Database (this game: `games/bh45/rooms/<roomCode>`),
// so a single set of keys/rules covers every repo.
//
// No real project has been provisioned yet. Fill in the real values below
// once the shared Firebase project exists (Firebase console -> Project
// settings -> General -> "Your apps" -> SDK setup and configuration).
//
// Required for Realtime Database usage: at minimum `databaseURL` (and
// normally `apiKey`/`projectId`/`appId`) must be set, or lib/net.ts will
// throw a friendly "not configured yet" error instead of silently failing.
export const FIREBASE_CONFIG = {
  // apiKey: "REPLACE_ME",
  // authDomain: "REPLACE_ME.firebaseapp.com",
  // databaseURL: "https://REPLACE_ME-default-rtdb.firebaseio.com",
  // projectId: "REPLACE_ME",
  // storageBucket: "REPLACE_ME.appspot.com",
  // messagingSenderId: "REPLACE_ME",
  // appId: "REPLACE_ME",
} as const;
