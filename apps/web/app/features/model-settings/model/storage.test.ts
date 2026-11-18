import { describe, expect, it } from "vitest"
import { createModel } from "~/entities/building-model/model/model"
import { loadModel, saveModel, storageKey } from "./storage"

describe("로컬 모델 저장", () => {
  it("사용자별 저장을 분리하고 실제 저장값을 다시 읽는다", () => {
    const entries = new Map<string, string>()
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value)
      },
    }
    expect(storageKey("admin")).not.toBe(storageKey("member"))
    const model = createModel()
    model.layers[0].thicknessMm = 9.5
    saveModel(storage, storageKey("admin"), model)
    expect(loadModel(storage, storageKey("admin"))).toEqual(model)
    expect(loadModel(storage, storageKey("member"))).toEqual(createModel())
  })
  it("손상된 저장 데이터를 새 기본값으로 덮어쓰지 않는다", () => {
    expect(() => loadModel({ getItem: () => "{bad" }, "key")).toThrow()
    expect(() =>
      saveModel(
        {
          setItem: () => {
            throw new Error("quota")
          },
        },
        "key",
        createModel(),
      ),
    ).toThrow("quota")
  })
})
