# Highlight League 2045

Baseball Highlights: 2045의 카드 수치와 경기 흐름을 바탕으로 만든 개인용 한국어 디지털 프로토타입입니다.

## 주요 기능

- 기본판과 카드 확장 선택
- Coaches와 Ball Parks 확장
- 보통·어려움·매우 어려움 AI
- 온덱, PH, 비지터 세이브, 위협 안타와 주자 이동 연출
- 모바일·데스크톱 반응형 UI
- 홈 화면 설치와 오프라인 재방문을 지원하는 PWA

## 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
```

프로덕션 검증:

```bash
npm test
npm run lint
```

## PWA

프로덕션 환경에서 서비스 워커가 자동 등록됩니다. 지원 브라우저에서 사이트를 연 뒤 `앱 설치` 또는 `홈 화면에 추가`를 선택하면 독립 실행 앱으로 사용할 수 있습니다. 처음 한 번 온라인으로 실행한 뒤에는 캐시된 앱 셸로 다시 열 수 있습니다.

앱 아이콘을 다시 만들려면 Pillow가 설치된 환경에서 다음을 실행합니다.

```bash
python scripts/generate-pwa-icons.py
```

## 데이터

- `data/base-cards.json`: 기본 ST·FA 카드
- `data/expansion-cards.json`: 선수 카드 확장
- `data/coaches.json`: 코치 15장
- `data/ballparks.json`: 구장 10장

개인 연구 및 플레이용 프로젝트입니다.
