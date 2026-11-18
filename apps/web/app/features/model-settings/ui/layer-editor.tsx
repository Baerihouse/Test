import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { layerSchema, type FinishLayer, type Material } from "~/entities/building-model/model/model"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Select } from "~/shared/ui/select"

export function LayerEditor({
  layer,
  materials,
  index,
  count,
  onSave,
  onMove,
  onRemove,
}: {
  layer: FinishLayer
  materials: Material[]
  index: number
  count: number
  onSave: (layer: FinishLayer) => boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FinishLayer>({
    resolver: zodResolver(layerSchema),
    defaultValues: layer,
  })
  return (
    <form
      className="space-y-3 border-b border-border py-4 last:border-0"
      onSubmit={handleSubmit((value) => {
        if (onSave(value)) reset(value)
      })}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {index + 1}. {layer.name}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={index === 0 || isDirty}
            onClick={() => onMove(-1)}
            aria-label={`${layer.name} 앞 순서로`}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={index === count - 1 || isDirty}
            onClick={() => onMove(1)}
            aria-label={`${layer.name} 뒤 순서로`}
          >
            ↓
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            층 제거
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="층 이름" htmlFor={`name-${layer.id}`} error={errors.name?.message}>
          <Input id={`name-${layer.id}`} {...register("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="적용 자재" htmlFor={`material-${layer.id}`}>
          <Select
            id={`material-${layer.id}`}
            {...register("materialId", {
              setValueAs: (value: string) => (value === "" ? null : value),
            })}
          >
            <option value="">미정 · 나중에 선택</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="두께 (mm)"
          htmlFor={`thickness-${layer.id}`}
          hint="모르면 비워 두세요."
          error={errors.thicknessMm ? "0보다 크고 1,000 이하인 숫자를 입력하세요." : undefined}
        >
          <Input
            id={`thickness-${layer.id}`}
            type="number"
            step="any"
            {...register("thicknessMm", {
              setValueAs: (value: string | null | undefined) =>
                value === "" || value === null || value === undefined ? null : Number(value),
            })}
            aria-invalid={!!errors.thicknessMm}
            placeholder="미정"
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!isDirty}>
          마감층 저장
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => reset(layer)}>
          입력 취소
        </Button>
        {isDirty ? (
          <span className="self-center text-xs text-muted-foreground">저장 전 변경 있음</span>
        ) : null}
      </div>
    </form>
  )
}
