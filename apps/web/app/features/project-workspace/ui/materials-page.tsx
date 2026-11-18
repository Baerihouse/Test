import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { materialSchema, type ProjectMaterial } from "~/entities/workspace/model/workspace"
import { useWorkspace } from "./workspace-context"
import { PageHeader } from "~/shared/ui/page-header"
import { Button } from "~/shared/ui/button"
import { Input } from "~/shared/ui/input"
import { Field } from "~/shared/ui/field"
import { Checkbox } from "~/shared/ui/checkbox"
import { SheetGrid, type SheetColumn } from "~/shared/ui/sheet-grid"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"

export function MaterialsPage() {
  const { data, site, busy, commit } = useWorkspace()
  const [editing, setEditing] = useState(""),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [confirm, setConfirm] = useState(false)
  if (!site) return <p className="text-sm">현장 목록에서 현장을 먼저 등록하세요.</p>
  const columns: SheetColumn<ProjectMaterial>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          aria-label="자재 전체 선택"
          ref={(node) => {
            if (node)
              node.indeterminate = selected.size > 0 && selected.size < site.materials.length
          }}
          checked={site.materials.length > 0 && selected.size === site.materials.length}
          onChange={(event) =>
            setSelected(event.target.checked ? new Set(site.materials.map((m) => m.id)) : new Set())
          }
        />
      ),
      focusable: false,
      cell: (row) => (
        <Checkbox
          aria-label={`${row.name} 선택`}
          checked={selected.has(row.id)}
          onChange={(event) =>
            setSelected((value) => {
              const next = new Set(value)
              if (event.target.checked) next.add(row.id)
              else next.delete(row.id)
              return next
            })
          }
        />
      ),
    },
    { key: "name", header: "마감재", cell: (row) => row.name, copyText: (row) => row.name },
    { key: "product", header: "제품 / 제조사", cell: (row) => row.product || "미정" },
    {
      key: "color",
      header: "표시 색상",
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block size-4 rounded border"
            style={{ backgroundColor: row.color }}
          />
          {row.color}
        </span>
      ),
    },
    { key: "note", header: "규격 / 근거", cell: (row) => row.note },
    {
      key: "edit",
      header: "수정",
      focusable: false,
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => setEditing(row.id)}>
          자재 수정
        </Button>
      ),
    },
  ]
  return (
    <div className="space-y-4">
      <PageHeader
        title="마감재 관리 · 리스트"
        description={`${site.name}의 자재 목록입니다. 도면 검토에서 벽에 연결할 수 있습니다. 두께별 마감층·제품 텍스처는 후속 확장 대상입니다.`}
      />
      <MaterialForm
        key={`${site.id}-${editing}-${JSON.stringify(site.materials.find((m) => m.id === editing))}`}
        material={site.materials.find((m) => m.id === editing)}
        busy={busy}
        onCancel={() => setEditing("")}
        onSave={async (material) => {
          const exists = site.materials.some((m) => m.id === material.id)
          const ok = await commit({
            ...data,
            sites: data.sites.map((item) =>
              item.id === site.id
                ? {
                    ...item,
                    materials: exists
                      ? item.materials.map((m) => (m.id === material.id ? material : m))
                      : [...item.materials, material],
                  }
                : item,
            ),
          })
          if (ok) setEditing("")
          return ok
        }}
      />
      {selected.size ? (
        <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
          선택 자재 {selected.size}개 삭제
        </Button>
      ) : null}
      <SheetGrid
        columns={columns}
        rows={site.materials}
        rowKey={(row) => row.id}
        empty="등록된 마감재가 없습니다. 자재는 나중에 추가해도 됩니다."
      />
      {confirm ? (
        <ConfirmPanel
          title="선택 자재를 삭제할까요?"
          description="현재 검토 벽의 해당 자재 연결도 해제합니다. 모델 형상은 유지되지만 자재 색상은 기본 표시로 바뀝니다."
          pending={busy}
          confirmLabel="자재와 연결 삭제"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void commit({
              ...data,
              sites: data.sites.map((item) =>
                item.id === site.id
                  ? {
                      ...item,
                      materials: item.materials.filter((m) => !selected.has(m.id)),
                      floors: item.floors.map((f) => ({
                        ...f,
                        walls: f.walls.map((w) =>
                          selected.has(w.materialId ?? "") ? { ...w, materialId: null } : w,
                        ),
                        reviewRevision: f.reviewRevision + 1,
                      })),
                    }
                  : item,
              ),
            }).then((ok) => {
              if (ok) {
                setConfirm(false)
                setSelected(new Set())
                setEditing("")
              }
            })
          }}
        />
      ) : null}
    </div>
  )
}
function MaterialForm({
  material,
  busy,
  onSave,
  onCancel,
}: {
  material?: ProjectMaterial
  busy: boolean
  onSave: (value: ProjectMaterial) => Promise<boolean>
  onCancel: () => void
}) {
  const defaults: ProjectMaterial = material ?? {
    id: crypto.randomUUID(),
    name: "",
    product: "",
    color: "#b8c5d4",
    note: "",
  }
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectMaterial>({ resolver: zodResolver(materialSchema), defaultValues: defaults })
  return (
    <form
      className="rounded border border-border bg-card p-4"
      onSubmit={handleSubmit(async (value) => {
        if (await onSave(value)) reset({ ...defaults, id: crypto.randomUUID() })
      })}
    >
      <fieldset disabled={busy} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="자재 이름"
            htmlFor="project-material-name"
            required
            error={errors.name?.message}
          >
            <Input id="project-material-name" {...register("name")} />
          </Field>
          <Field
            label="제품 / 제조사"
            htmlFor="project-material-product"
            error={errors.product ? "200자 이내로 입력하세요." : undefined}
          >
            <Input id="project-material-product" {...register("product")} />
          </Field>
          <Field label="색상 · 표현용" htmlFor="project-material-color">
            <Input id="project-material-color" type="color" {...register("color")} />
          </Field>
          <Field
            label="규격 / 근거 메모"
            htmlFor="project-material-note"
            error={errors.note ? "500자 이내로 입력하세요." : undefined}
          >
            <Input id="project-material-note" {...register("note")} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit">{material ? "자재 수정 저장" : "자재 등록"}</Button>
          <Button
            type="button"
            variant="outline"
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
