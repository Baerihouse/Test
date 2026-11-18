import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link } from "react-router"
import { buildingTypes } from "~/entities/workspace/model/workspace"
import { useWorkspace, RequireFloor } from "./workspace-context"
import { PageHeader } from "~/shared/ui/page-header"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Select } from "~/shared/ui/select"

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  buildingType: z.enum(buildingTypes),
  floorName: z.string().trim().min(1).max(100),
  elevation: z.coerce.number().finite().min(-1e7).max(1e7),
  offsetX: z.coerce.number().finite().min(-1e7).max(1e7),
  offsetY: z.coerce.number().finite().min(-1e7).max(1e7),
  referenceHeight: z.coerce.number().positive().max(30000),
  referenceThickness: z.coerce.number().positive().max(2000),
})
type SettingsInput = z.infer<typeof schema>
export function SettingsPage() {
  const { site, floor } = useWorkspace()
  return (
    <div className="space-y-4">
      <PageHeader title="설정" description="현재 현장·층의 이름과 높이·배치 기준을 관리합니다." />
      <RequireFloor>
        {site && floor ? (
          <SettingsForm key={`${site.id}-${floor.id}-${floor.reviewRevision}`} />
        ) : null}
      </RequireFloor>
      <section className="space-y-2 rounded border border-border p-4 text-sm">
        <strong>저장 범위 및 기존 자료</strong>
        <p>
          현장·PDF·검토·모델은 현재 로그인 사용자의 이 브라우저에 저장됩니다. 서버 동기화·다른 PC
          공유는 아직 지원하지 않습니다. 브라우저 데이터 삭제 시 소실될 수 있으므로 PDF 원본과 검토
          백업을 별도 보관하세요.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link className="text-primary underline" to="/model-viewer">
            기존 84A 참고 모델
          </Link>
          <Link className="text-primary underline" to="/model-settings">
            이전 마감층 설정 열기
          </Link>
        </div>
      </section>
    </div>
  )
}
function SettingsForm() {
  const { data, site, floor, busy, commit } = useWorkspace(),
    [error, setError] = useState("")
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SettingsInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: site?.name,
      buildingType: site?.buildingType,
      floorName: floor?.name,
      elevation: floor?.elevation,
      offsetX: floor?.offsetX,
      offsetY: floor?.offsetY,
      referenceHeight: floor?.referenceHeight,
      referenceThickness: floor?.referenceThickness,
    },
  })
  if (!site || !floor) return null
  function backup() {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      ),
      link = document.createElement("a")
    link.href = url
    link.download = "현장-검토-모델-백업-PDF미포함.json"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <form
      className="space-y-4 rounded border border-border bg-card p-4"
      onSubmit={handleSubmit(async (values) => {
        if (site.floors.some((f) => f.id !== floor.id && f.name === values.floorName)) {
          setError("같은 현장에 층 이름이 중복됩니다.")
          return
        }
        const nextFloor = {
          ...floor,
          name: values.floorName,
          elevation: values.elevation,
          offsetX: values.offsetX,
          offsetY: values.offsetY,
          referenceHeight: values.referenceHeight,
          referenceThickness: values.referenceThickness,
          reviewRevision: floor.reviewRevision + 1,
        }
        await commit({
          ...data,
          sites: data.sites.map((item) =>
            item.id === site.id
              ? {
                  ...item,
                  name: values.name,
                  buildingType: values.buildingType,
                  floors: item.floors.map((f) => (f.id === floor.id ? nextFloor : f)),
                }
              : item,
          ),
        })
      })}
    >
      <fieldset disabled={busy} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="현장명"
            htmlFor="setting-site"
            error={errors.name ? "현장명을 1~100자로 입력하세요." : undefined}
          >
            <Input id="setting-site" {...register("name")} />
          </Field>
          <Field label="건물 타입" htmlFor="setting-type">
            <Select className="max-w-full min-w-0" id="setting-type" {...register("buildingType")}>
              {buildingTypes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field
            label="층 이름"
            htmlFor="setting-floor"
            error={errors.floorName ? "층 이름을 1~100자로 입력하세요." : undefined}
          >
            <Input id="setting-floor" {...register("floorName")} />
          </Field>
          {(
            [
              ["elevation", "구조 바닥 GL 높이"],
              ["offsetX", "모아보기 X 이동"],
              ["offsetY", "모아보기 Y 이동"],
              ["referenceHeight", "미정 벽 참고 높이"],
              ["referenceThickness", "미정 벽 참고 두께"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={`${label} (mm)`}
              htmlFor={`setting-${key}`}
              error={errors[key] ? "유효한 범위의 숫자를 입력하세요." : undefined}
            >
              <Input id={`setting-${key}`} type="number" step="any" {...register(key)} />
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          층 높이/이동값은 새로 생성하는 모델부터 적용됩니다. 다른 층의 PDF 원점이 다르면 X/Y
          이동으로 맞춘 뒤 모델을 다시 생성하세요. 도면 회전·자동 정합은 아직 지원하지 않습니다.
        </p>
        <Button type="submit" disabled={!isDirty}>
          설정 저장
        </Button>
      </fieldset>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <div className="border-t border-border pt-3">
        <Button type="button" variant="outline" onClick={backup}>
          검토·모델 백업 내려받기
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          JSON에 현장·층·검토·모델·자재 메타데이터를 보관합니다. PDF 원본은 포함하지 않으며 도면
          관리에서 별도로 내려받으세요. JSON 복원 UI는 아직 제공하지 않습니다.
        </p>
      </div>
    </form>
  )
}
