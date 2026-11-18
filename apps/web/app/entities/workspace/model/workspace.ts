import { z } from "zod"

const id = z.string().min(1).max(100)
const title = z.string().trim().min(1, "이름을 입력하세요.").max(100, "100자 이내로 입력하세요.")
const mm = z.number().finite().min(-1e7).max(1e7)
const positive = z.number().finite().positive().max(1e6)
const pointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])
export type Point = z.infer<typeof pointSchema>
export const buildingTypes = ["공동주택", "오피스", "데이터센터", "상업시설", "기타"] as const
export const drawingTypes = ["평면도", "구조도", "단면도", "일람표", "마감표", "기타"] as const
export const materialSchema = z.object({
  id,
  name: title,
  product: z.string().max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  note: z.string().max(500),
})
export type ProjectMaterial = z.infer<typeof materialSchema>
export const calibrationSchema = z.object({
  page: z.number().int().positive(),
  width: positive,
  height: positive,
  a: pointSchema,
  b: pointSchema,
  distanceMm: positive,
})
export type Calibration = z.infer<typeof calibrationSchema>
export const documentSchema = z.object({
  id,
  name: title,
  kind: z.enum(drawingTypes),
  size: z
    .number()
    .positive()
    .max(50 * 1024 * 1024),
  pages: z.number().int().min(1).max(500),
  calibrations: z.array(calibrationSchema),
  createdAt: z.string(),
})
export type DrawingDocument = z.infer<typeof documentSchema>
export const openingSchema = z.object({
  id,
  name: title,
  kind: z.enum(["door", "window"]),
  offset: z.number().min(0),
  width: positive,
  height: positive,
  sill: z.number().min(0),
  confirmed: z.boolean(),
})
export type Opening = z.infer<typeof openingSchema>
export const wallSchema = z
  .object({
    id,
    name: title,
    x1: mm,
    y1: mm,
    x2: mm,
    y2: mm,
    thickness: positive.max(2000).nullable(),
    height: positive.max(30000).nullable(),
    confirmed: z.boolean(),
    note: z.string().max(500),
    materialId: id.nullable(),
    drawingId: id,
    page: z.number().int().positive(),
    trace: z.tuple([pointSchema, pointSchema]).nullable(),
    openings: z.array(openingSchema).max(100),
  })
  .superRefine((wall, ctx) => {
    const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
    if (length < 1) ctx.addIssue({ code: "custom", message: "벽 길이는 1mm 이상이어야 합니다." })
    if (wall.confirmed && (wall.height === null || wall.thickness === null))
      ctx.addIssue({
        code: "custom",
        message: "높이·두께가 미정이면 벽을 확인 완료로 지정할 수 없습니다.",
      })
    const sorted = [...wall.openings].sort((a, b) => a.offset - b.offset)
    sorted.forEach((opening, index) => {
      if (
        opening.offset + opening.width > length + 0.01 ||
        (wall.height !== null && opening.sill + opening.height > wall.height + 0.01)
      )
        ctx.addIssue({ code: "custom", message: "개구부가 벽 길이 또는 높이 범위를 벗어납니다." })
      if (index && sorted[index - 1].offset + sorted[index - 1].width > opening.offset + 0.01)
        ctx.addIssue({ code: "custom", message: "개구부가 서로 겹칩니다." })
    })
  })
export type Wall = z.infer<typeof wallSchema>
const snapshotSchema = z.object({
  id,
  name: title,
  createdAt: z.string(),
  reviewRevision: z.number().int().min(0),
  elevation: mm,
  offsetX: mm.default(0),
  offsetY: mm.default(0),
  referenceHeight: positive,
  referenceThickness: positive,
  walls: z.array(wallSchema).max(2000),
})
export type ModelSnapshot = z.infer<typeof snapshotSchema>
export const floorSchema = z.object({
  id,
  name: title,
  elevation: mm,
  offsetX: mm.default(0),
  offsetY: mm.default(0),
  referenceHeight: positive.max(30000),
  referenceThickness: positive.max(2000),
  reviewRevision: z.number().int().min(0),
  documents: z.array(documentSchema).max(200),
  walls: z.array(wallSchema).max(2000),
  models: z.array(snapshotSchema).max(100),
})
export type ProjectFloor = z.infer<typeof floorSchema>
export const siteSchema = z.object({
  id,
  name: title,
  buildingType: z.enum(buildingTypes),
  floors: z.array(floorSchema).max(200),
  materials: z.array(materialSchema).max(1000),
  createdAt: z.string(),
})
export type Site = z.infer<typeof siteSchema>
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().min(0),
    sites: z.array(siteSchema).max(100),
  })
  .superRefine((workspace, ctx) => {
    const ids = new Set<string>()
    function unique(value: string) {
      if (ids.has(value)) ctx.addIssue({ code: "custom", message: "ID가 중복되었습니다." })
      ids.add(value)
    }
    workspace.sites.forEach((site) => {
      unique(site.id)
      const materialIds = new Set(site.materials.map((material) => material.id))
      site.materials.forEach((m) => unique(m.id))
      const names = new Set<string>()
      site.floors.forEach((floor) => {
        unique(floor.id)
        if (names.has(floor.name))
          ctx.addIssue({ code: "custom", message: "같은 현장에 층 이름이 중복되었습니다." })
        names.add(floor.name)
        const documents = new Map(floor.documents.map((d) => [d.id, d]))
        floor.documents.forEach((d) => unique(d.id))
        floor.models.forEach((m) => unique(m.id))
        floor.walls.forEach((wall) => {
          unique(wall.id)
          wall.openings.forEach((opening) => unique(opening.id))
          if (
            !documents.has(wall.drawingId) ||
            wall.page > (documents.get(wall.drawingId)?.pages ?? 0)
          )
            ctx.addIssue({ code: "custom", message: "벽의 도면·페이지가 해당 층에 없습니다." })
          if (wall.materialId !== null && !materialIds.has(wall.materialId))
            ctx.addIssue({ code: "custom", message: "현장에 없는 자재를 참조합니다." })
        })
      })
    })
  })
export type Workspace = z.infer<typeof workspaceSchema>
export function emptyWorkspace(): Workspace {
  return { version: 1, revision: 0, sites: [] }
}

export function calibratedPoint(point: Point, calibration: Calibration): [number, number] {
  const pixels = Math.hypot(
    (calibration.b[0] - calibration.a[0]) * calibration.width,
    (calibration.b[1] - calibration.a[1]) * calibration.height,
  )
  if (pixels < 1) throw new Error("기준점 두 개가 너무 가깝습니다.")
  const scale = calibration.distanceMm / pixels
  return [point[0] * calibration.width * scale, point[1] * calibration.height * scale]
}
export function applyCalibration(
  floor: ProjectFloor,
  drawingId: string,
  calibration: Calibration,
): ProjectFloor {
  calibratedPoint([0, 0], calibration)
  return {
    ...floor,
    reviewRevision: floor.reviewRevision + 1,
    documents: floor.documents.map((document) =>
      document.id === drawingId
        ? {
            ...document,
            calibrations: [
              ...document.calibrations.filter((c) => c.page !== calibration.page),
              calibration,
            ],
          }
        : document,
    ),
    walls: floor.walls.map((wall) => {
      if (wall.drawingId !== drawingId || wall.page !== calibration.page || !wall.trace) return wall
      const a = calibratedPoint(wall.trace[0], calibration),
        b = calibratedPoint(wall.trace[1], calibration)
      return { ...wall, x1: a[0], y1: a[1], x2: b[0], y2: b[1], confirmed: false }
    }),
  }
}
export function createSnapshot(floor: ProjectFloor): ModelSnapshot {
  if (!floor.walls.length) throw new Error("도면 검토에서 벽을 먼저 추가하세요.")
  if (
    floor.walls.some((wall) =>
      wall.openings.some(
        (opening) => opening.sill + opening.height > (wall.height ?? floor.referenceHeight),
      ),
    )
  )
    throw new Error(
      "개구부가 벽의 높이 또는 참고 높이보다 큽니다. 실제 벽 높이나 참고 높이를 확인하세요.",
    )
  return snapshotSchema.parse({
    id: crypto.randomUUID(),
    name: `${floor.name} 모델 ${floor.models.length + 1}`,
    createdAt: new Date().toISOString(),
    reviewRevision: floor.reviewRevision,
    elevation: floor.elevation,
    offsetX: floor.offsetX,
    offsetY: floor.offsetY,
    referenceHeight: floor.referenceHeight,
    referenceThickness: floor.referenceThickness,
    walls: structuredClone(floor.walls),
  })
}
export function unresolvedCount(walls: Wall[]) {
  return walls.filter(
    (wall) =>
      !wall.confirmed ||
      wall.height === null ||
      wall.thickness === null ||
      wall.openings.some((opening) => !opening.confirmed),
  ).length
}

export type WallPiece = { start: number; length: number; base: number; height: number }
export function wallPieces(wall: Wall, referenceHeight: number): WallPiece[] {
  const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1),
    height = wall.height ?? referenceHeight
  const result: WallPiece[] = []
  let cursor = 0
  for (const opening of [...wall.openings].sort((a, b) => a.offset - b.offset)) {
    if (opening.offset > cursor)
      result.push({ start: cursor, length: opening.offset - cursor, base: 0, height })
    if (opening.sill > 0)
      result.push({
        start: opening.offset,
        length: opening.width,
        base: 0,
        height: Math.min(opening.sill, height),
      })
    const top = opening.sill + opening.height
    if (top < height)
      result.push({ start: opening.offset, length: opening.width, base: top, height: height - top })
    cursor = opening.offset + opening.width
  }
  if (cursor < length) result.push({ start: cursor, length: length - cursor, base: 0, height })
  return result.filter((piece) => piece.length > 0 && piece.height > 0)
}
