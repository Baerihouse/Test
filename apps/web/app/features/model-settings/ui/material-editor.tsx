import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { materialSchema, type Material } from "~/entities/building-model/model/model"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"

export function MaterialEditor({
  material,
  onSave,
}: {
  material?: Material
  onSave: (material: Material) => boolean
}) {
  const defaults: Material = material ?? {
    id: crypto.randomUUID(),
    name: "",
    product: "",
    color: null,
    source: "",
  }
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Material>({
    resolver: zodResolver(materialSchema),
    defaultValues: defaults,
  })
  const color = watch("color")
  return (
    <form
      className="space-y-3"
      onSubmit={handleSubmit((value) => {
        if (onSave(value)) reset(value)
      })}
    >
      <Field label="자재 이름" htmlFor="material-name" required error={errors.name?.message}>
        <Input
          id="material-name"
          {...register("name")}
          aria-invalid={!!errors.name}
          placeholder="예: 거실 바닥 마루"
        />
      </Field>
      <Field label="제조사 / 제품명" htmlFor="material-product" error={errors.product?.message}>
        <Input id="material-product" {...register("product")} placeholder="추후 입력 가능" />
      </Field>
      <Field label="자료 출처 / 규격 메모" htmlFor="material-source" error={errors.source?.message}>
        <Input
          id="material-source"
          {...register("source")}
          placeholder="예: 자재승인서 또는 제품 규격"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="material-color" className="text-sm">
          표시 색상
        </label>
        <input
          id="material-color"
          type="color"
          value={color ?? "#cccccc"}
          onChange={(event) => setValue("color", event.target.value, { shouldDirty: true })}
          className="h-9 w-12 rounded border border-border"
        />
        <span className="text-sm text-muted-foreground">{color ?? "미정"}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setValue("color", null, { shouldDirty: true })}
        >
          색상 미정
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!isDirty}>
          {material ? "자재 수정 저장" : "자재 등록"}
        </Button>
        <Button type="button" variant="outline" onClick={() => reset(defaults)}>
          입력 취소
        </Button>
      </div>
    </form>
  )
}
