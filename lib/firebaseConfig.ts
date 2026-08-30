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
  apiKey: "AIzaSyByKyy7PYBIMi2K1jxH6KmzfWbE2_SsB5A",
  authDomain: "deadline-38cdb.firebaseapp.com",
  databaseURL: "https://deadline-38cdb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "deadline-38cdb",
  storageBucket: "deadline-38cdb.firebasestorage.app",
  messagingSenderId: "768255871086",
  appId: "1:768255871086:web:ad7713b5a3b8e01f9cbe7f",
} as const;
