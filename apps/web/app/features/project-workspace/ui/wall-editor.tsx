import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  openingSchema,
  wallSchema,
  type Opening,
  type Wall,
} from "~/entities/workspace/model/workspace"
import { useWorkspace } from "./workspace-context"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Select } from "~/shared/ui/select"
import { Checkbox } from "~/shared/ui/checkbox"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"

const optionalNumber = (value: string | null | undefined) =>
  value === "" || value === null || value === undefined ? null : Number(value)
export function WallEditor({ wall, onSaved }: { wall: Wall; onSaved?: () => void }) {
  const { site, floor, busy, updateFloor } = useWorkspace()
  const [error, setError] = useState(""),
    [removing, setRemoving] = useState<string | null>(null),
    [editingOpening, setEditingOpening] = useState<string>("")
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Wall>({ resolver: zodResolver(wallSchema), defaultValues: wall })
  if (!floor) return null
  async function save(value: Wall) {
    if (!floor) return
    const parsed = wallSchema.safeParse(value)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    if (
      await updateFloor({
        ...floor,
        walls: floor.walls.map((item) => (item.id === wall.id ? parsed.data : item)),
        reviewRevision: floor.reviewRevision + 1,
      })
    ) {
      setError("")
      reset(parsed.data)
      onSaved?.()
    }
  }
  const currentOpening = wall.openings.find((opening) => opening.id === editingOpening)
  return (
    <section className="space-y-4 rounded border border-border bg-card p-4">
      <h3 className="font-semibold">벽 수정 · {wall.name}</h3>
      <form
        onSubmit={handleSubmit(
          (value) => {
            const coordsChanged = ["x1", "y1", "x2", "y2"].some(
              (key) => value[key as "x1"] !== wall[key as "x1"],
            )
            void save({ ...value, trace: coordsChanged ? null : value.trace })
          },
          () =>
            setError(
              "이름·좌표·높이·두께 및 개구부 범위를 확인하세요. 미정 치수가 있으면 확인 완료를 해제하세요.",
            ),
        )}
        className="space-y-3"
      >
        <fieldset disabled={busy || removing !== null} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="벽 이름" htmlFor="wall-name" error={errors.name?.message}>
              <Input id="wall-name" {...register("name")} />
            </Field>
            <Field label="두께 (mm)" htmlFor="wall-thickness" hint="미정은 비워 둡니다.">
              <Input
                id="wall-thickness"
                type="number"
                step="any"
                {...register("thickness", { setValueAs: optionalNumber })}
              />
            </Field>
            <Field label="높이 (mm)" htmlFor="wall-height" hint="실제 높이 미정은 비워 둡니다.">
              <Input
                id="wall-height"
                type="number"
                step="any"
                {...register("height", { setValueAs: optionalNumber })}
              />
            </Field>
          </div>
          <details>
            <summary className="cursor-pointer text-sm">평면 좌표 직접 수정 (mm)</summary>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["x1", "y1", "x2", "y2"] as const).map((key) => (
                <Field key={key} label={key.toUpperCase()} htmlFor={`wall-${key}`}>
                  <Input
                    id={`wall-${key}`}
                    type="number"
                    step="any"
                    {...register(key, { valueAsNumber: true })}
                  />
                </Field>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              좌표를 직접 수정하면 이 벽은 PDF 재보정 대상에서 제외됩니다.
            </p>
          </details>
          <Field label="마감재 연결" htmlFor="wall-material">
            <Select
              className="max-w-full min-w-0"
              id="wall-material"
              {...register("materialId", {
                setValueAs: (value: string) => (value === "" ? null : value),
              })}
            >
              <option value="">미정 / 미연결</option>
              {site?.materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="근거 / 확인 필요 메모" htmlFor="wall-note">
            <Input id="wall-note" {...register("note")} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox {...register("confirmed")} />이 벽의 위치·두께·높이를 도면 또는 직접 입력으로
            확인했습니다.
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={!isDirty}>
              벽 수정 저장
            </Button>
            <Button type="button" variant="outline" onClick={() => reset(wall)}>
              입력 취소
            </Button>
          </div>
        </fieldset>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="space-y-2 border-t border-border pt-3">
        <h4 className="text-sm font-semibold">문·창호·개구부</h4>
        <p className="text-xs text-muted-foreground">
          벽 시작점에서의 거리와 폭·높이·하단 높이로 지정합니다. 창호 제품 형상은 단순 표시입니다.
        </p>
        {isDirty ? (
          <p className="text-xs text-warning">
            벽 수정 내용을 먼저 저장하거나 취소한 뒤 개구부를 편집하세요.
          </p>
        ) : null}
        {wall.openings.map((opening) => (
          <div
            key={opening.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span>
              {opening.name} · {opening.kind === "door" ? "문" : "창호"} · {opening.width}×
              {opening.height}mm · {opening.confirmed ? "확인" : "미확정"}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={busy || isDirty}
                variant="outline"
                size="sm"
                onClick={() => setEditingOpening(opening.id)}
              >
                개구부 수정
              </Button>
              <Button
                disabled={busy || isDirty}
                variant="ghost"
                size="sm"
                onClick={() => setRemoving(opening.id)}
              >
                개구부 삭제
              </Button>
            </div>
          </div>
        ))}
        <OpeningEditor
          key={`${wall.id}-${editingOpening}-${wall.openings.length}`}
          opening={currentOpening}
          busy={busy || isDirty || removing !== null}
          onSave={async (opening) => {
            const next = {
              ...wall,
              openings: currentOpening
                ? wall.openings.map((item) => (item.id === opening.id ? opening : item))
                : [...wall.openings, opening],
            }
            const parsed = wallSchema.safeParse(next)
            if (!parsed.success) {
              setError(parsed.error.issues[0].message)
              return false
            }
            const ok = await updateFloor({
              ...floor,
              walls: floor.walls.map((item) => (item.id === wall.id ? next : item)),
              reviewRevision: floor.reviewRevision + 1,
            })
            if (ok) {
              setError("")
              setEditingOpening("")
            }
            return ok
          }}
          onCancel={() => setEditingOpening("")}
        />
        {removing ? (
          <ConfirmPanel
            title="개구부를 삭제할까요?"
            description="이 개구부의 입력값을 삭제합니다. 기존 생성 모델은 유지되며 다시 생성하면 반영됩니다."
            pending={busy}
            confirmLabel="개구부 삭제"
            onCancel={() => setRemoving(null)}
            onConfirm={() => {
              void save({
                ...wall,
                openings: wall.openings.filter((opening) => opening.id !== removing),
              }).then(() => setRemoving(null))
            }}
          />
        ) : null}
      </div>
    </section>
  )
}
function OpeningEditor({
  opening,
  busy,
  onSave,
  onCancel,
}: {
  opening?: Opening
  busy: boolean
  onSave: (value: Opening) => Promise<boolean>
  onCancel: () => void
}) {
  const defaults: Opening = opening ?? {
    id: crypto.randomUUID(),
    name: "",
    kind: "door",
    offset: 0,
    width: 900,
    height: 2100,
    sill: 0,
    confirmed: false,
  }
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Opening>({ resolver: zodResolver(openingSchema), defaultValues: defaults })
  return (
    <form
      onSubmit={handleSubmit(async (value) => {
        if (await onSave(value)) reset({ ...defaults, id: crypto.randomUUID() })
      })}
      className="space-y-3 rounded bg-muted/30 p-3"
    >
      <fieldset disabled={busy} className="space-y-3">
        <p className="text-xs text-muted-foreground">
          아래 초기 숫자는 입력 예시입니다. 실제 치수로 바꾸고 저장하세요. 확인 체크 전에는
          미확정으로 표시합니다.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="개구부 이름" htmlFor="opening-name" error={errors.name?.message}>
            <Input id="opening-name" {...register("name")} placeholder="예: 거실 창" />
          </Field>
          <Field label="종류" htmlFor="opening-kind">
            <Select className="max-w-full min-w-0" id="opening-kind" {...register("kind")}>
              <option value="door">문 개구부</option>
              <option value="window">창호 개구부</option>
            </Select>
          </Field>
          {(
            [
              ["offset", "벽 시작점에서 거리"],
              ["width", "폭"],
              ["height", "높이"],
              ["sill", "하단 높이"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={`${label} (mm)`}
              htmlFor={`opening-${key}`}
              error={errors[key] ? "유효한 치수를 입력하세요." : undefined}
            >
              <Input
                id={`opening-${key}`}
                type="number"
                step="any"
                {...register(key, { valueAsNumber: true })}
              />
            </Field>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox {...register("confirmed")} />
          개구부 치수를 확인했습니다.
        </label>
        <div className="flex gap-2">
          <Button size="sm" type="submit">
            {opening ? "개구부 수정 저장" : "개구부 추가"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              reset(defaults)
              onCancel()
            }}
          >
            입력 취소
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
