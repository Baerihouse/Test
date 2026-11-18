# DOMAIN_MODEL.md

이 문서는 프로젝트의 핵심 업무 개념과 도메인 관계를 진행 중에 정리하는 문서다.

프로젝트 시작 시 억지로 완성하지 않는다. 실제 기능, 화면, DB, API가 생기면서 확인된 내용만 추가한다.

---

## 작성 시점

- 핵심 도메인 이름이 정해졌을 때
- 업무 엔티티 간 관계가 코드나 DB에 반영될 때
- 상태값, 권한, 생명주기 규칙이 생길 때
- 도메인 용어가 팀 내에서 반복해서 쓰이기 시작할 때

---

## 작성할 내용

```txt
Domain:
Purpose:
Main users:
Core entities:
Entity relationships:
Status lifecycle:
Role/permission rules:
Important invariants:
Related screens:
Related APIs:
Related tables:
Open questions:
```

---

## Domain Notes

### 현장별 PDF 작업공간 (제품 0.3.0)

- `entities/workspace/model/workspace.ts`: Site(현장명/건물타입) → ProjectFloor(층명/GL/XY이동/참고치수) → DrawingDocument(PDF종류/페이지/보정) / Wall(mm 좌표/미정 높이·두께/근거/자재ID) → Opening(문/창의 벽 시작점 거리/폭/높이/하단높이/확인상태).
- 현장별 ProjectMaterial, 같은 현장 벽에만 참조. 도면과 페이지는 같은 층에만 연결. 이름/참조/중복ID/범위/개구부 겹침을 schema에서 검증.
- `ModelSnapshot`: 생성 당시 벽/개구부/GL/XY/참고치수·reviewRevision 복제. 검토 변경과 별개로 보관. 수정 후 재생성 전까지 기존 모델 유지 및 상태 알림. 모델 삭제는 검토와 PDF를 삭제하지 않음.
- 보정은 페이지별 두 정규화 점 + 페이지 종횡 + 실제 mm. 재보정은 연결된 추적 벽을 재계산하고 확인 해제, 숫자로 좌표 수정한 벽은 trace=null로 보정에서 제외.
- 불확실한 높이/두께=null. 참고치수로 주황 형상 표시하며 확인 완료로 자동 승격하지 않음. 개구부 미확정도 전체 벽의 미확정 집계에 포함.
- IndexedDB는 사용자별로 키를 분리하는 로컬 기능이다. 같은 브라우저의 개발자 도구까지 방어하는 서버 권한/RLS 또는 조직 공동 저장으로 간주하지 않음.

### 모델 설정 (제품 0.1.0)

- 구현: `apps/web/app/entities/building-model/model/model.ts`, `/model-settings`
- 첫 대상: 201동 2층·84A 확장형. SL GL +3,550mm / 다음 층 +6,350mm. 사용자가 동 단면도를 기준으로 지정.
- `BuildingModel`: 고정된 층 기준과 자재 목록, 마감층 목록을 가짐. 스키마 버전 1.
- `Material`: 이름, 제품/제조사 메모, 색상(null=미정), 출처 메모. 구조 기준 표고와 독립.
- `FinishLayer`: 바닥/벽/천장, 층 이름, 자재 ID(null=미정), 두께 mm(null=미정). 같은 자재를 여러 마감층에서 참조 가능. 자재 수정은 ID를 유지.
- 층의 배열 순서는 골조에서 실내 표면 방향의 재료 구성. 현장의 확정 시공 순서를 의미하지 않음.
- 미정 두께를 0mm로 확정하지 않음. 알려진 두께 합과 전체 두께 미확정을 구분.
- 로그인 사용자별 브라우저 로컬 저장. 서버 DB/API/공동 저장은 없음. 백업은 대상 층·표고·버전·ID 참조를 검증한 후 확인을 거쳐 복원.
- 도면 자동 인식·여러 현장 및 여러 층 저장은 미구현. 3D 초안은 다음 별도 모델로 제공하며 마감 설정과의 렌더 연결은 아직 없음.

### 도면 기반 부분 골조 (제품 0.2.0)

- 구현: `entities/building-model/model/84a-structure.ts`, `/model-viewer`.
- 구조평면의 명시 치수에 맞춘 좌표 변환과 수동 선별 AW 벽체 9개. 각 벽은 부호·평면 polygon·두께·근거·참고 높이와 확인 상태를 가짐.
- `plan-checked-height-reference`: 평면/두께는 일람과 대조, 높이는 층간2,800−일반상세210=2,590mm 참고. 확인된 높이로 승격하지 않음.
- `pendingGuides`: SW/MW/보의 사양 미확정 윤곽. `slabReference`: 210mm 일반 상세와 세대 범위의 참고 형상, 단차/인양구 미반영.
- GPU 표시 좌표는 미터, 데이터/표시는 mm. 로컬 높이 원점은 2층 SL GL+3,550mm. 원본 PNG는 인증된 리소스 route로 제공.
