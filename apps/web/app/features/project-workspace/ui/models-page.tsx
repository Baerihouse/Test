import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { unresolvedCount } from "~/entities/workspace/model/workspace"
import { useWorkspace, RequireFloor } from "./workspace-context"
import type { ProjectScene } from "../lib/project-scene.client"
import { PageHeader } from "~/shared/ui/page-header"
import { Button } from "~/shared/ui/button"
import { Select } from "~/shared/ui/select"
import { Checkbox } from "~/shared/ui/checkbox"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"

export function ModelsPage() {
  return (
    <RequireFloor>
      <ModelsViewer />
    </RequireFloor>
  )
}
function ModelsViewer() {
  const { site, floor, href, updateFloor, busy } = useWorkspace(),
    [params, setParams] = useSearchParams()
  const [cut, setCut] = useState(false),
    [colors, setColors] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [selection, setSelection] = useState("부재를 누르면 치수와 확인 상태가 표시됩니다."),
    [retry, setRetry] = useState(0),
    [deleting, setDeleting] = useState(false)
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<ProjectScene | null>(null)
  const all = params.get("all") === "1"
  const snapshot =
    floor?.models.find((item) => item.id === params.get("model")) ?? floor?.models.at(-1)
  const layers = useMemo(
    () =>
      all
        ? (site?.floors.flatMap((f) => {
            const m = f.models.at(-1)
            return m ? [{ floorName: f.name, snapshot: m }] : []
          }) ?? [])
        : snapshot && floor
          ? [{ floorName: floor.name, snapshot }]
          : [],
    [all, site, floor, snapshot],
  )
  const hasModels = layers.length > 0
  useEffect(() => {
    if (!hasModels) return
    let cancelled = false
    setReady(false)
    setError("")
    void import("../lib/project-scene.client")
      .then(({ createProjectScene }) => {
        if (cancelled || !host.current) return
        controller.current = createProjectScene(host.current, setSelection, setError)
        setReady(true)
      })
      .catch(() => {
        if (!cancelled)
          setError("3D를 시작하지 못했습니다. 브라우저 그래픽 가속을 확인하고 다시 불러오세요.")
      })
    return () => {
      cancelled = true
      controller.current?.dispose()
      controller.current = null
    }
  }, [retry, hasModels])
  useEffect(() => {
    if (ready) controller.current?.setModels(layers, site?.materials ?? [], cut, colors)
  }, [layers, site?.materials, cut, colors, ready])
  if (!floor || !site) return null
  const pending = layers.reduce((sum, layer) => sum + unresolvedCount(layer.snapshot.walls), 0)
  function setQuery(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { preventScrollReset: true })
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title="3D 모델"
        description={`${site.name} · ${all ? "현장 내 여러 층 최신 모델" : floor.name}`}
        actions={
          <Link className="text-sm text-primary underline" to={href("/review")}>
            도면 검토·새 모델 생성
          </Link>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        {!all && snapshot ? (
          <Button size="sm" variant="outline" onClick={() => setDeleting(true)}>
            선택 모델 삭제
          </Button>
        ) : null}
        <label className="text-sm">
          보기
          <Select
            className="max-w-full min-w-0"
            aria-label="모델 보기 범위"
            value={all ? "1" : "0"}
            onChange={(event) => setQuery("all", event.target.value)}
          >
            <option value="0">현재 층</option>
            <option value="1">현재 현장 여러 층 모아보기</option>
          </Select>
        </label>
        {!all ? (
          <label className="max-w-full text-sm">
            보관 모델
            <Select
              className="max-w-full min-w-0"
              aria-label="보관 모델 선택"
              value={snapshot?.id ?? ""}
              onChange={(event) => setQuery("model", event.target.value)}
            >
              <option disabled value="">
                생성된 모델 없음
              </option>
              {[...floor.models].reverse().map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} · {new Date(model.createdAt).toLocaleString("ko-KR")}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      {deleting && snapshot ? (
        <ConfirmPanel
          title="선택한 보관 모델을 삭제할까요?"
          description="이 모델 이력만 삭제합니다. PDF 원본과 현재 검토 내용은 유지됩니다. 삭제한 이력은 되돌릴 수 없습니다."
          pending={busy}
          confirmLabel="보관 모델 삭제"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            void updateFloor({
              ...floor,
              models: floor.models.filter((model) => model.id !== snapshot.id),
            }).then((ok) => {
              if (ok) setDeleting(false)
            })
          }}
        />
      ) : null}
      {!all && snapshot && snapshot.reviewRevision !== floor.reviewRevision ? (
        <p role="status" className="rounded border border-warning/50 p-3 text-sm">
          이 모델을 생성한 뒤 검토·설정이 수정되었습니다. 이전 결과는 보존됐으며, 변경 반영은 도면
          검토에서 3D를 다시 생성하세요.
        </p>
      ) : null}
      {all ? (
        <p className="text-sm text-muted-foreground">
          층별 최신 저장 모델을 SL 높이와 X/Y 이동값으로 배치합니다. 도면 원점·회전은 자동 정합하지
          않습니다. 설정에서 위치를 맞춘 뒤 각 층의 모델을 다시 생성하세요.
        </p>
      ) : null}
      {!hasModels ? (
        <div className="rounded border border-dashed border-border p-8 text-sm">
          생성된 모델이 없습니다. 도면을 등록하고 벽을 검토한 뒤{" "}
          <Link className="text-primary underline" to={href("/review")}>
            3D 생성
          </Link>
          을 눌러 주세요.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!ready} onClick={() => controller.current?.frame()}>
              전체 보기
            </Button>
            <Button
              disabled={!ready}
              variant="outline"
              onClick={() => controller.current?.frame(true)}
            >
              위에서 보기
            </Button>
            <Button
              disabled={!ready}
              variant="outline"
              onClick={() => controller.current?.zoom(0.8)}
            >
              확대
            </Button>
            <Button
              disabled={!ready}
              variant="outline"
              onClick={() => controller.current?.zoom(1.25)}
            >
              축소
            </Button>
            <Button
              disabled={!ready}
              variant="outline"
              onClick={() => controller.current?.rotate()}
            >
              회전
            </Button>
            <Button
              disabled={!ready}
              variant="outline"
              onClick={() => {
                try {
                  controller.current?.capture()
                } catch {
                  setError("화면 이미지를 저장하지 못했습니다.")
                }
              }}
            >
              이미지 저장
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cut} onChange={(event) => setCut(event.target.checked)} />벽 낮춰
              보기
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={colors} onChange={(event) => setColors(event.target.checked)} />
              연결 자재 색상
            </label>
          </div>
          <p className="rounded border border-warning/40 p-3 text-sm">
            벽 {layers.reduce((sum, layer) => sum + layer.snapshot.walls.length, 0)}개 · 미확정{" "}
            {pending}개 · 주황색은 치수/근거 확인이 필요한 참고 형상입니다. 격자는 층 기준면이며
            슬래브·마감층은 생성하지 않습니다.
          </p>
          {error ? (
            <div role="alert" className="text-sm text-danger">
              {error}{" "}
              <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
                다시 불러오기
              </Button>
            </div>
          ) : null}
          <div className="relative overflow-hidden rounded border border-border bg-slate-100">
            <div ref={host} className="h-[440px] sm:h-[600px]" />
            {!ready && !error ? (
              <p role="status" className="absolute inset-0 flex items-center justify-center">
                3D 모델을 불러오는 중…
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            드래그 회전 · 휠 확대 · 오른쪽 드래그 이동 · 터치 한 손가락 회전 / 두 손가락 확대·이동
          </p>
          <p className="rounded border border-border p-3 text-sm" aria-live="polite">
            {selection}
          </p>
          <ul className="space-y-1 text-sm">
            {layers.map((layer) => (
              <li key={layer.snapshot.id}>
                {layer.floorName} · GL {layer.snapshot.elevation.toLocaleString("ko-KR")}mm ·{" "}
                {layer.snapshot.name} · 미확정 {unresolvedCount(layer.snapshot.walls)}개
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
