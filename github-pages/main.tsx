import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GamePrototype } from "../app/game-prototype";
import { PwaRegister } from "../app/pwa-register";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) throw new Error("게임을 표시할 루트 요소를 찾지 못했습니다.");

createRoot(root).render(
  <StrictMode>
    <GamePrototype />
    <PwaRegister />
  </StrictMode>,
);
