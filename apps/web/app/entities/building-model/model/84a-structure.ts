import { floorBasis } from "./model"

export type PlanPoint = readonly [number, number]
export type StructuralPart = {
  id: string
  label: string
  footprint: PlanPoint[]
  thicknessMm: number
  heightMm: number
  evidence: string
  status: "plan-checked-height-reference"
}

export const drawingCalibration = {
  originX: 326.942749,
  originY: 287.279663,
  pointsPerMm: 7.59613 / 200,
  crop: [317, 275, 897, 676],
} as const

export function pdfToPlan(x: number, y: number): PlanPoint {
  return [
    (x - drawingCalibration.originX) / drawingCalibration.pointsPerMm,
    (y - drawingCalibration.originY) / drawingCalibration.pointsPerMm,
  ]
}

export const referenceWallHeightMm = floorBasis.floorToFloorMm - 210

function wall(
  id: string,
  rect: readonly [number, number, number, number],
  thicknessMm: number,
): StructuralPart {
  const [x0, y0, x1, y1] = rect
  return {
    id,
    label: id,
    thicknessMm,
    heightMm: referenceWallHeightMm,
    footprint: [pdfToPlan(x0, y0), pdfToPlan(x1, y0), pdfToPlan(x1, y1), pdfToPlan(x0, y1)],
    evidence: "단위세대 구조평면도 p1 좌표 · 벽체일람표-1 p1 2층 두께 대조",
    status: "plan-checked-height-reference",
  }
}

// 부재 부호가 연결된 벽체 본체만 선별한다. 인접 보/개구부 사각형은 벽으로 채우지 않는다.
export const structuralWalls: StructuralPart[] = [
  wall("AW1", [459.684906, 454.204346, 555.395996, 463.699493], 250),
  wall("AW2", [708.267883, 393.625305, 715.864014, 462.749969], 200),
  wall("AW3", [732.76532, 502.629578, 740.36145, 585.427246], 200),
  wall("AW11", [551.5979, 287.279663, 626.609558, 294.875793], 200),
  wall("AW12", [672.945862, 287.279663, 713.585083, 294.875793], 200),
  wall("AW13", [759.921448, 287.279663, 824.108643, 294.875793], 200),
  wall("AW14", [421.704315, 656.450928, 467.281006, 664.047058], 200),
  wall("AW15", [536.405701, 656.450928, 583.881409, 664.047058], 200),
  wall("AW16", [709.976929, 656.450928, 744.919067, 664.047058], 200),
]

export const pendingGuides: { id: string; label: string; points: PlanPoint[]; reason: string }[] = [
  {
    id: "mw-left",
    label: "MWXX · 좌측",
    points: [pdfToPlan(326.943, 395.33), pdfToPlan(326.943, 664.047)],
    reason: "동 구조평면도에서 벽체 부호·사양 확인 필요",
  },
  {
    id: "mw-right",
    label: "MWXX · 우측",
    points: [pdfToPlan(883.93, 287.28), pdfToPlan(883.93, 664.047)],
    reason: "동 구조평면도에서 벽체 부호·사양 확인 필요",
  },
  {
    id: "entry",
    label: "코어 접합 · 출입구",
    points: [pdfToPlan(326.943, 391.5), pdfToPlan(491, 391.5), pdfToPlan(491, 291)],
    reason: "동 구조평면도 및 B2 일람 확인 필요",
  },
  {
    id: "sw-left",
    label: "SW12 · 욕실1",
    points: [pdfToPlan(394, 412.43), pdfToPlan(394, 513.45), pdfToPlan(331.69, 513.45)],
    reason: "SW12 벽체 일람·높이 확인 필요",
  },
  {
    id: "sw-right",
    label: "SW12 · 욕실2",
    points: [
      pdfToPlan(712, 460.47),
      pdfToPlan(810.44, 460.47),
      pdfToPlan(810.44, 395.9),
      pdfToPlan(746.63, 395.9),
    ],
    reason: "SW12 벽체 일람·높이 확인 필요",
  },
  {
    id: "sw-balcony",
    label: "SW12 · 발코니",
    points: [pdfToPlan(740, 664.05), pdfToPlan(740, 604.8), pdfToPlan(883.93, 604.8)],
    reason: "SW12 및 AW16 꺾임부 접합·단차 확인 필요",
  },
  {
    id: "sw20",
    label: "SW20",
    points: [pdfToPlan(806.45, 660.25), pdfToPlan(863.8, 660.25)],
    reason: "SW20 벽체 일람 확인 필요",
  },
  {
    id: "beam-top",
    label: "B3 · 상부 개구부",
    points: [pdfToPlan(516.66, 291.08), pdfToPlan(866.65, 291.08)],
    reason: "B3 보 춤·하단 높이 미정. 창호 상부를 벽으로 채우지 않음",
  },
  {
    id: "beam-bottom",
    label: "B3 / B3A · 하부 개구부",
    points: [pdfToPlan(352.58, 660.25), pdfToPlan(806.45, 660.25)],
    reason: "B3/B3A 보 일람·개구부 상단 높이 확인 필요",
  },
]

export const slabReference = {
  thicknessMm: 210,
  footprint: [
    [0, 2925],
    [4420, 2925],
    [4420, 0],
    [14630, 0],
    [14630, 9920],
    [0, 9920],
  ] as PlanPoint[],
  status: "reference-only" as const,
  note: "일반 상세 210mm 참고 형상. 세대별 슬래브 부호·외곽·욕실 단차·인양구 미반영",
}

export const roomLabels = [
  { label: "침실1", x: 1700, y: 8000 },
  { label: "침실2", x: 4800, y: 8000 },
  { label: "거실", x: 8000, y: 7200 },
  { label: "안방", x: 12800, y: 6100 },
  { label: "주방 / 식당", x: 8500, y: 2000 },
  { label: "현관", x: 4500, y: 3500 },
]
