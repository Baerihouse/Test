import { describe, expect, it } from "vitest"
import {
  applyCalibration,
  calibratedPoint,
  createSnapshot,
  emptyWorkspace,
  unresolvedCount,
  wallPieces,
  wallSchema,
  workspaceSchema,
  type Calibration,
  type ProjectFloor,
  type Wall,
} from "./workspace"

const calibration: Calibration = {
  page: 1,
  width: 1000,
  height: 500,
  a: [0, 0],
  b: [1, 0],
  distanceMm: 10000,
}
function wall(): Wall {
  return {
    id: "wall",
    name: "벽",
    x1: 0,
    y1: 0,
    x2: 5000,
    y2: 0,
    thickness: 200,
    height: 2800,
    confirmed: true,
    note: "직접 확인",
    materialId: null,
    drawingId: "drawing",
    page: 1,
    trace: [
      [0, 0],
      [0.5, 0],
    ],
    openings: [],
  }
}
function floor(): ProjectFloor {
  return {
    id: "floor",
    name: "2층",
    elevation: 3550,
    offsetX: 0,
    offsetY: 0,
    referenceHeight: 2800,
    referenceThickness: 200,
    reviewRevision: 1,
    documents: [
      {
        id: "drawing",
        name: "평면.pdf",
        kind: "평면도",
        size: 100,
        pages: 1,
        calibrations: [calibration],
        createdAt: "2026-11-18",
      },
    ],
    walls: [wall()],
    models: [],
  }
}
describe("현장 도면 검토 계약", () => {
  it("빈 현장으로 시작하며 샘플 금액이나 모델을 생성하지 않는다", () => {
    expect(emptyWorkspace()).toEqual({ version: 1, revision: 0, sites: [] })
  })
  it("PDF 종횡비를 보존하여 기준 치수로 보정한다", () => {
    expect(calibratedPoint([1, 1], calibration)).toEqual([10000, 5000])
    expect(() => calibratedPoint([1, 1], { ...calibration, b: [0, 0] })).toThrow()
  })
  it("보정 변경은 해당 페이지의 추적 벽만 변경하고 확인을 해제한다", () => {
    const f = floor()
    f.walls.push({ ...wall(), id: "manual", trace: null })
    const result = applyCalibration(f, "drawing", { ...calibration, distanceMm: 20000 })
    expect(result.walls[0].x2).toBe(10000)
    expect(result.walls[0].confirmed).toBe(false)
    expect(result.walls[1].x2).toBe(5000)
    expect(result.reviewRevision).toBe(2)
  })
  it("미정 치수를 확인 완료로 위장할 수 없다", () => {
    expect(wallSchema.safeParse({ ...wall(), thickness: null }).success).toBe(false)
    expect(unresolvedCount([{ ...wall(), confirmed: false, thickness: null }])).toBe(1)
  })
  it("벽 밖 또는 서로 겹치는 개구부를 거부한다", () => {
    const opening = {
      id: "opening",
      name: "문",
      kind: "door" as const,
      offset: 1000,
      width: 900,
      height: 2100,
      sill: 0,
      confirmed: true,
    }
    expect(wallSchema.safeParse({ ...wall(), openings: [opening] }).success).toBe(true)
    expect(
      wallSchema.safeParse({ ...wall(), openings: [{ ...opening, offset: 4900 }] }).success,
    ).toBe(false)
    expect(
      wallSchema.safeParse({
        ...wall(),
        openings: [opening, { ...opening, id: "other", offset: 1500 }],
      }).success,
    ).toBe(false)
  })
  it("문 개구부를 실제 벽 조각에서 제외한다", () => {
    const w = wall()
    w.openings = [
      {
        id: "o",
        name: "문",
        kind: "door",
        offset: 1000,
        width: 900,
        height: 2100,
        sill: 0,
        confirmed: true,
      },
    ]
    const pieces = wallPieces(w, 2800)
    expect(pieces).toEqual([
      { start: 0, length: 1000, base: 0, height: 2800 },
      { start: 1000, length: 900, base: 2100, height: 700 },
      { start: 1900, length: 3100, base: 0, height: 2800 },
    ])
  })
  it("생성 모델은 검토 데이터와 분리된 스냅샷이다", () => {
    const f = floor(),
      snapshot = createSnapshot(f)
    f.walls[0].x2 = 6000
    f.elevation = 0
    expect(snapshot.walls[0].x2).toBe(5000)
    expect(snapshot.elevation).toBe(3550)
    expect(snapshot.reviewRevision).toBe(1)
  })
  it("빈 층과 참고 높이보다 높은 개구부를 생성하지 않는다", () => {
    expect(() => createSnapshot({ ...floor(), walls: [] })).toThrow()
    const f = floor()
    f.walls[0] = {
      ...wall(),
      confirmed: false,
      height: null,
      openings: [
        {
          id: "o",
          name: "창",
          kind: "window",
          offset: 1000,
          width: 1000,
          height: 2000,
          sill: 1200,
          confirmed: false,
        },
      ],
    }
    expect(() => createSnapshot(f)).toThrow()
  })
  it("다른 층 도면·다른 현장 자재 연결과 중복 층을 거부한다", () => {
    const value = {
      version: 1,
      revision: 0,
      sites: [
        {
          id: "site",
          name: "현장",
          buildingType: "공동주택",
          createdAt: "now",
          materials: [],
          floors: [floor()],
        },
      ],
    }
    expect(workspaceSchema.safeParse(value).success).toBe(true)
    value.sites[0].floors[0].walls[0].drawingId = "foreign"
    expect(workspaceSchema.safeParse(value).success).toBe(false)
    value.sites[0].floors[0].walls[0].drawingId = "drawing"
    value.sites[0].floors[0].walls[0].materialId = "foreign-material"
    expect(workspaceSchema.safeParse(value).success).toBe(false)
    value.sites[0].floors[0].walls[0].materialId = null
    value.sites[0].floors.push({ ...floor(), id: "other-floor" })
    expect(workspaceSchema.safeParse(value).success).toBe(false)
  })
})
