import { describe, expect, it } from "vitest"
import { createModel, layerSummary, modelSchema, parseBackup } from "./model"

describe("모델 설정과 백업 경계", () => {
  it("자재 없이 시작하고 두께 미정을 0으로 확정하지 않는다", () => {
    const model = createModel()
    expect(modelSchema.safeParse(model).success).toBe(true)
    expect(model.structuralLevelMm).toBe(3550)
    expect(layerSummary(model.layers)).toEqual({ knownThicknessMm: 0, incomplete: true })
  })
  it("골조 높이를 바꾼 백업을 거부한다", () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...createModel(), structuralLevelMm: 3200 })),
    ).toThrow()
  })
  it("없는 자재 참조와 중복 ID를 거부한다", () => {
    const model = createModel()
    model.layers[0].materialId = "missing"
    expect(modelSchema.safeParse(model).success).toBe(false)
    model.layers[0].materialId = null
    model.layers.push(model.layers[0])
    expect(modelSchema.safeParse(model).success).toBe(false)
  })
  it("음수·0·과대 두께를 거부하고 소수 두께를 보존한다", () => {
    const model = createModel()
    for (const thickness of [-1, 0, 1001]) {
      model.layers[0].thicknessMm = thickness
      expect(modelSchema.safeParse(model).success).toBe(false)
    }
    model.layers[0].thicknessMm = 9.5
    expect(parseBackup(JSON.stringify(model)).layers[0].thicknessMm).toBe(9.5)
  })
  it("같은 자재를 수정해도 부위 연결과 골조 높이를 유지한다", () => {
    const model = createModel()
    model.materials.push({ id: "tile", name: "타일", product: "", source: "", color: null })
    model.layers[0].materialId = "tile"
    model.materials[0].product = "추후 선정 제품"
    const restored = parseBackup(JSON.stringify(model))
    expect(restored.layers[0].materialId).toBe("tile")
    expect(restored.structuralLevelMm).toBe(3550)
    expect(restored.materials[0].product).toBe("추후 선정 제품")
  })
})
