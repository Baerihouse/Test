import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link } from "react-router"
import { buildingTypes, type ProjectFloor } from "~/entities/workspace/model/workspace"
import { useWorkspace } from "./workspace-context"
import { PageHeader } from "~/shared/ui/page-header"
import { Button } from "~/shared/ui/button"
import { Input } from "~/shared/ui/input"
import { Field } from "~/shared/ui/field"
import { Select } from "~/shared/ui/select"
import { Card, CardHeader, CardTitle, CardContent } from "~/shared/ui/card"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"

const schema = z.object({
  name: z.string().trim().min(1, "현장명을 입력하세요.").max(100),
  buildingType: z.enum(buildingTypes),
  floorName: z.string().trim().min(1, "층 이름을 입력하세요.").max(100),
  elevation: z.coerce.number().finite().min(-1e7).max(1e7),
  referenceHeight: z.coerce.number().positive().max(30000),
})
type InputValues = z.infer<typeof schema>
function makeFloor(values: InputValues): ProjectFloor {
  return {
    id: crypto.randomUUID(),
    name: values.floorName,
    elevation: values.elevation,
    offsetX: 0,
    offsetY: 0,
    referenceHeight: values.referenceHeight,
    referenceThickness: 200,
    reviewRevision: 0,
    documents: [],
    walls: [],
    models: [],
  }
}
export function SitesPage() {
  const { data, site, busy, commit, select, href } = useWorkspace()
  const [mode, setMode] = useState<"site" | "floor">("site"),
    [deleting, setDeleting] = useState<ProjectFloor | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<InputValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      buildingType: "공동주택",
      floorName: "1층",
      elevation: 0,
      referenceHeight: 2800,
    },
  })
  const submit = handleSubmit(async (values) => {
    const newFloor = makeFloor(values)
    if (mode === "floor" && site) {
      if (site.floors.some((f) => f.name === newFloor.name)) {
        setError("floorName", { message: "이미 등록된 층 이름입니다." })
        return
      }
      if (
        await commit({
          ...data,
          sites: data.sites.map((item) =>
            item.id === site.id ? { ...item, floors: [...item.floors, newFloor] } : item,
          ),
        })
      ) {
        select(site.id, newFloor.id)
        reset()
      }
    } else {
      const id = crypto.randomUUID()
      if (
        await commit({
          ...data,
          sites: [
            ...data.sites,
            {
              id,
              name: values.name,
              buildingType: values.buildingType,
              floors: [newFloor],
              materials: [],
              createdAt: new Date().toISOString(),
            },
          ],
        })
      ) {
        select(id, newFloor.id)
        reset()
      }
    }
  })
  return (
    <div className="space-y-4">
      <PageHeader
        title="현장 목록"
        description="현장과 층을 만들고 도면·검토·모델을 구분해 보관합니다."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>현장 / 층 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <fieldset disabled={busy} className="space-y-3">
                <Field label="등록 대상" htmlFor="create-mode">
                  <Select
                    className="max-w-full min-w-0"
                    id="create-mode"
                    value={mode}
                    onChange={(event) => {
                      const next = event.target.value === "floor" ? "floor" : "site"
                      setMode(next)
                      if (next === "floor" && site)
                        reset({
                          name: site.name,
                          buildingType: site.buildingType,
                          floorName: "",
                          elevation: 0,
                          referenceHeight: 2800,
                        })
                    }}
                  >
                    <option value="site">새 현장과 첫 층</option>
                    <option value="floor" disabled={!site}>
                      현재 현장에 층 추가
                    </option>
                  </Select>
                </Field>
                <Field label="현장명" htmlFor="site-name" required error={errors.name?.message}>
                  <Input id="site-name" {...register("name")} readOnly={mode === "floor"} />
                </Field>
                <Field label="건물 타입" htmlFor="building-type">
                  <Select
                    className="max-w-full min-w-0"
                    id="building-type"
                    {...register("buildingType")}
                    disabled={mode === "floor"}
                  >
                    {buildingTypes.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="층 이름"
                  htmlFor="floor-name"
                  required
                  error={errors.floorName?.message}
                >
                  <Input id="floor-name" {...register("floorName")} placeholder="예: 201동 2층" />
                </Field>
                <Field
                  label="층 구조 바닥 높이 · GL 기준 (mm)"
                  htmlFor="floor-level"
                  error={errors.elevation ? "유효한 높이를 입력하세요." : undefined}
                >
                  <Input id="floor-level" type="number" step="any" {...register("elevation")} />
                </Field>
                <Field
                  label="미정 벽의 참고 높이 (mm)"
                  htmlFor="reference-height"
                  hint="실제 벽 높이 미입력 시 주황색 참고 형상에만 사용합니다."
                  error={
                    errors.referenceHeight ? "0보다 크고 30,000 이하로 입력하세요." : undefined
                  }
                >
                  <Input
                    id="reference-height"
                    type="number"
                    step="any"
                    {...register("referenceHeight")}
                  />
                </Field>
                <Button type="submit">{mode === "site" ? "현장 등록" : "층 추가"}</Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {!data.sites.length ? (
            <div className="rounded border border-dashed border-border p-8 text-sm">
              등록된 현장이 없습니다. 왼쪽에서 첫 현장을 등록하세요.
            </div>
          ) : (
            data.sites.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>
                    {item.name}{" "}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {item.buildingType}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {item.floors.map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0"
                    >
                      <button
                        className="text-left text-sm hover:underline"
                        onClick={() => select(item.id, f.id)}
                      >
                        <strong>{f.name}</strong> · GL {f.elevation.toLocaleString("ko-KR")}mm
                        <br />
                        <span className="text-muted-foreground">
                          PDF {f.documents.length}개 · 검토 벽 {f.walls.length}개 · 모델{" "}
                          {f.models.length}개
                        </span>
                      </button>
                      <div className="flex gap-2">
                        <Link
                          className="text-sm text-primary underline"
                          to={`/drawings?site=${item.id}&floor=${f.id}`}
                        >
                          도면 등록
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setDeleting(f)
                          }}
                        >
                          층 삭제
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
          {site ? (
            <Link
              className="inline-block text-sm text-primary underline"
              to={href("/models") + "&all=1"}
            >
              현재 현장의 여러 층 모델 모아보기 →
            </Link>
          ) : null}
        </div>
      </div>
      {deleting && site ? (
        <ConfirmPanel
          title={`${deleting.name}을 삭제할까요?`}
          description={`이 층의 PDF ${deleting.documents.length}개와 검토·모델 이력을 함께 삭제합니다. 되돌릴 수 없습니다. 원본을 별도 보관했는지 확인하세요.`}
          pending={busy}
          confirmLabel="층과 자료 삭제"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            void commit(
              {
                ...data,
                sites: data.sites.map((item) =>
                  item.floors.some((f) => f.id === deleting.id)
                    ? { ...item, floors: item.floors.filter((f) => f.id !== deleting.id) }
                    : item,
                ),
              },
              [],
              deleting.documents.map((document) => document.id),
            ).then((ok) => {
              if (ok) setDeleting(null)
            })
          }}
        />
      ) : null}
    </div>
  )
}
