import type { Metadata } from "next";
import { GamePrototype } from "./game-prototype";

export const metadata: Metadata = {
  title: "하이라이트 리그 2045 · 새 시즌",
  description: "스타터 덱과 확장을 고르고 미래 야구 시즌을 진행하는 디지털 프로토타입",
};

export default function Home() {
  return <GamePrototype />;
}
