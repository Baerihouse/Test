import { describe, expect, it } from "vitest"
import { pdfToPlan, structuralWalls, referenceWallHeightMm, slabReference } from "./84a-structure"
import { floorBasis } from "./model"

describe("첨부 84A 구조도 좌표와 확인 경계", () => {
  it("도면 200mm 기준을 변환하고 수평 전체 치수를 교차 확인한다", () => {
    const a = pdfToPlan(326.942749, 287.279663)
    const b = pdfToPlan(882.599654, 664.047711)
    expect(a).toEqual([0, 0])
    expect(b[0]).toBeCloseTo(14630, 0)
    expect(b[1]).toBeCloseTo(9920, 0)
  })
  it("표고와 참고 높이를 구분하며 원본의 층간 높이를 보존한다", () => {
    expect(floorBasis.structuralLevelMm).toBe(3550)
    expect(referenceWallHeightMm).toBe(2590)
    expect(slabReference.status).toBe("reference-only")
    expect(structuralWalls.every((wall) => wall.status === "plan-checked-height-reference")).toBe(
      true,
    )
  })
  it("벽체 본체만 선별하고 도면 폭과 일람 두께를 대조한다", () => {
    expect(structuralWalls).toHaveLength(9)
    expect(new Set(structuralWalls.map((wall) => wall.id)).size).toBe(9)
    structuralWalls.forEach((wall) => {
      const width =
        Math.max(...wall.footprint.map((p) => p[0])) - Math.min(...wall.footprint.map((p) => p[0]))
      const depth =
        Math.max(...wall.footprint.map((p) => p[1])) - Math.min(...wall.footprint.map((p) => p[1]))
      expect(Math.min(width, depth)).toBeCloseTo(wall.thicknessMm, 0)
    })
    const aw1 = structuralWalls.find((wall) => wall.id === "AW1")!
    expect(
      Math.max(...aw1.footprint.map((p) => p[0])) - Math.min(...aw1.footprint.map((p) => p[0])),
    ).toBeCloseTo(2520, 0)
    expect(
      structuralWalls.some((wall) => wall.id.startsWith("SW") || wall.id.startsWith("MW")),
    ).toBe(false)
  })
})
