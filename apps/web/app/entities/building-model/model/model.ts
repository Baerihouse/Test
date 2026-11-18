import { z } from "zod"

export const floorBasis = {
  siteId: "201-floor2-84a-expanded",
  label: "201동 · 2층 · 84A 확장형",
  structuralLevelMm: 3550,
  nextStructuralLevelMm: 6350,
  floorToFloorMm: 2800,
  source: "201동 단면도 · 사용자 지정",
} as const

const text = z.string().trim().min(1, "이름을 입력하세요.").max(100, "100자 이내로 입력하세요.")
const id = z.string().min(1).max(100)
export const surfaceSchema = z.enum(["floor", "wall", "ceiling"])
export type Surface = z.infer<typeof surfaceSchema>
export const surfaceLabels: Record<Surface, string> = {
  floor: "바닥",
  wall: "벽",
  ceiling: "천장",
}

export const materialSchema = z.object({
  id,
  name: text,
  product: z.string().trim().max(200),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  source: z.string().trim().max(300),
})
export type Material = z.infer<typeof materialSchema>

export const layerSchema = z.object({
  id,
  name: text,
  surface: surfaceSchema,
  materialId: id.nullable(),
  thicknessMm: z.number().finite().positive().max(1000).nullable(),
})
export type FinishLayer = z.infer<typeof layerSchema>

export const modelSchema = z
  .object({
    version: z.literal(1),
    siteId: z.literal(floorBasis.siteId),
    structuralLevelMm: z.literal(3550),
    materials: z.array(materialSchema).max(500),
    layers: z.array(layerSchema).max(500),
  })
  .strict()
  .superRefine((model, ctx) => {
    const materialIds = new Set(model.materials.map((m) => m.id))
    const layerIds = new Set(model.layers.map((layer) => layer.id))
    if (materialIds.size !== model.materials.length || layerIds.size !== model.layers.length) {
      ctx.addIssue({ code: "custom", message: "ID가 중복되었습니다." })
    }
    model.layers.forEach((layer, index) => {
      if (layer.materialId !== null && !materialIds.has(layer.materialId)) {
        ctx.addIssue({
          code: "custom",
          path: ["layers", index],
          message: "없는 자재를 참조합니다.",
        })
      }
    })
  })
export type BuildingModel = z.infer<typeof modelSchema>

export function createModel(): BuildingModel {
  return {
    version: 1,
    siteId: floorBasis.siteId,
    structuralLevelMm: floorBasis.structuralLevelMm,
    materials: [],
    layers: [
      {
        id: "floor-finish",
        surface: "floor",
        name: "바닥 마감",
        materialId: null,
        thicknessMm: null,
      },
      { id: "wall-finish", surface: "wall", name: "벽 마감", materialId: null, thicknessMm: null },
      {
        id: "ceiling-finish",
        surface: "ceiling",
        name: "천장 마감",
        materialId: null,
        thicknessMm: null,
      },
    ],
  }
}

export function parseBackup(contents: string): BuildingModel {
  return modelSchema.parse(JSON.parse(contents))
}

export function layerSummary(layers: FinishLayer[]) {
  return {
    knownThicknessMm: layers.reduce((sum, layer) => sum + (layer.thicknessMm ?? 0), 0),
    incomplete: layers.some((layer) => layer.thicknessMm === null || layer.materialId === null),
  }
}
