import type { Metadata } from "next";
import { GamePrototype } from "./game-prototype";

export const metadata: Metadata = {
  title: "2045 하이라이트 리그 — 코어 매치 프로토타입",
  description: "Baseball Highlights: 2045 기본판 카드 수치를 보존한 비공개 디지털 프로토타입",
  other: {
    "codex-preview": "development",
  },
};

export default function Home() {
  return <GamePrototype />;
}
