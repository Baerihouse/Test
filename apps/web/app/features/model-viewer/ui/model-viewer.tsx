import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { floorBasis } from "~/entities/building-model/model/model"
import {
  pendingGuides,
  referenceWallHeightMm,
  slabReference,
  structuralWalls,
} from "~/entities/building-model/model/84a-structure"
import type { ViewerController, ViewerOptions } from "../lib/scene.client"
import { PageHeader } from "~/shared/ui/page-header"
import { Button } from "~/shared/ui/button"
import { Checkbox } from "~/shared/ui/checkbox"
import { Select } from "~/shared/ui/select"
import { Card, CardHeader, CardTitle, CardContent } from "~/shared/ui/card"

export function ModelViewer() {
  const host = useRef<HTMLDivElement>(null)
  const viewer = useRef<ViewerController | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>("AW1")
  const [lowered, setLowered] = useState(false)
  const [drawing, setDrawing] = useState(true)
  const [pending, setPending] = useState(true)
  const [slab, setSlab] = useState(true)
  const [labels, setLabels] = useState(true)
  const options: ViewerOptions = useMemo(
    () => ({ lowered, drawing, pending, slab, labels, selectedId }),
    [lowered, drawing, pending, slab, labels, selectedId],
  )

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError("")
    void import("../lib/scene.client")
      .then(({ createViewer }) => {
        if (cancelled || !host.current) return
        viewer.current = createViewer(host.current, setSelectedId, setError)
        setReady(true)
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "3D 화면을 시작하지 못했습니다. 브라우저의 그래픽 가속을 확인한 뒤 다시 불러오세요. 아래 원본 도면은 계속 확인할 수 있습니다.",
          )
      })
    return () => {
      cancelled = true
      viewer.current?.dispose()
      viewer.current = null
    }
  }, [retry])

  useEffect(() => {
    viewer.current?.update(options)
  }, [options, ready])

  const selected = structuralWalls.find((wall) => wall.id === selectedId)
  const lengths = selected
    ? {
        width:
          Math.max(...selected.footprint.map((p) => p[0])) -
          Math.min(...selected.footprint.map((p) => p[0])),
        depth:
          Math.max(...selected.footprint.map((p) => p[1])) -
          Math.min(...selected.footprint.map((p) => p[1])),
      }
    : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="84A 확장형 · 3D 골조"
        description="201동 2층 기준 · 첨부 도면에서 추적한 한 세대 부분 골조"
        actions={
          <Link to="/model-settings" className="text-sm text-primary underline">
            마감재 설정
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
        <strong>검토 초안</strong>
        <span>2층 SL · GL +{floorBasis.structuralLevelMm.toLocaleString("ko-KR")} mm</span>
        <span>벽 높이 {referenceWallHeightMm.toLocaleString("ko-KR")} mm는 참고값</span>
        <span>전체 골조·구조검토 확정 모델이 아닙니다.</span>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="3D 보기 조작">
        <Button disabled={!ready} onClick={() => viewer.current?.frame("perspective")}>
          전체 보기
        </Button>
        <Button variant="outline" disabled={!ready} onClick={() => viewer.current?.frame("plan")}>
          위에서 보기
        </Button>
        <Button
          variant="outline"
          disabled={!ready}
          aria-pressed={lowered}
          onClick={() => setLowered(!lowered)}
        >
          {lowered ? "벽 전체 높이" : "벽 낮춰 보기"}
        </Button>
        <Button
          variant="outline"
          disabled={!ready}
          aria-label="3D 확대"
          onClick={() => viewer.current?.zoom(0.8)}
        >
          ＋ 확대
        </Button>
        <Button
          variant="outline"
          disabled={!ready}
          aria-label="3D 축소"
          onClick={() => viewer.current?.zoom(1.25)}
        >
          － 축소
        </Button>
        <Button
          variant="outline"
          disabled={!ready}
          aria-label="왼쪽 회전"
          onClick={() => viewer.current?.rotate(-1)}
        >
          ↶ 회전
        </Button>
        <Button
          variant="outline"
          disabled={!ready}
          aria-label="오른쪽 회전"
          onClick={() => viewer.current?.rotate(1)}
        >
          ↷ 회전
        </Button>
        <Button
          variant="outline"
          disabled={!ready}
          onClick={() => {
            try {
              viewer.current?.capture()
            } catch {
              setError("이미지를 저장하지 못했습니다. 다시 시도하세요.")
            }
          }}
        >
          화면 이미지 저장
        </Button>
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 space-y-2" aria-label="골조 3D 보기">
          {error ? (
            <div role="alert" className="space-y-2 rounded-md border border-danger/40 p-3 text-sm">
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>
                다시 불러오기
              </Button>
            </div>
          ) : null}
          <div className="relative overflow-hidden rounded-lg border border-border bg-slate-100">
            <div ref={host} className="h-[440px] w-full sm:h-[540px] 2xl:h-[660px]" />
            {!ready && !error ? (
              <p
                role="status"
                className="absolute inset-0 flex items-center justify-center bg-muted/70 text-sm"
              >
                3D 골조를 불러오는 중…
              </p>
            ) : null}
            {ready ? (
              <span className="pointer-events-none absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-xs text-slate-700">
                AW 벽체 {structuralWalls.length}개 ·{" "}
                {lowered ? "1,200mm 절단 보기" : "높이 참고 2,590mm"}
              </span>
            ) : null}
            <span className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 text-xs text-slate-700">
              검토 초안 · 마감 / 철근 미포함
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            드래그: 회전 · 휠: 확대/축소 · 오른쪽 드래그: 이동 · 터치: 한 손가락 회전 / 두 손가락
            확대·이동
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span>◼ 회청색: 평면·두께 대조 AW</span>
            <span className="text-amber-700">┄ 주황: 구조 사양·단차 확인 필요</span>
            <span className="text-primary">◼ 파랑: 선택 부재</span>
          </div>
        </section>
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>표시 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "원본 구조도 겹침", checked: drawing, set: setDrawing },
                { label: "확인 필요 윤곽", checked: pending, set: setPending },
                { label: "슬래브 참고 형상", checked: slab, set: setSlab },
                { label: "공간 이름", checked: labels, set: setLabels },
              ].map((option) => (
                <label key={option.label} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={option.checked}
                    onChange={(event) => option.set(event.target.checked)}
                  />
                  {option.label}
                </label>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>부재 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span>선택 부재</span>
                <Select
                  value={selectedId ?? ""}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {structuralWalls.map((wall) => (
                    <option key={wall.id} value={wall.id}>
                      {wall.label}
                    </option>
                  ))}
                  <option value="slab-reference">슬래브 · 참고</option>
                </Select>
              </label>
              {selected && lengths ? (
                <dl className="space-y-2">
                  <div>
                    <dt className="text-muted-foreground">평면 길이 / 두께</dt>
                    <dd className="font-medium">
                      {Math.round(Math.max(lengths.width, lengths.depth)).toLocaleString("ko-KR")} /{" "}
                      {selected.thicknessMm} mm
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">표시 높이</dt>
                    <dd>{lowered ? "1,200 mm · 절단 보기" : "2,590 mm · 참고"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">확인 상태</dt>
                    <dd>평면·두께 대조 / 높이·접합 확인 필요</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">근거</dt>
                    <dd>{selected.evidence}</dd>
                  </div>
                </dl>
              ) : (
                <p>{slabReference.note}</p>
              )}
              <p className="text-xs text-muted-foreground">
                벽 높이: 층간 2,800 − 일반 상세 슬래브 210 = 2,590mm. 보·부분별 슬래브 적용 확정 전
                참고값입니다.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
      <details className="rounded-md border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">확인 필요 부위와 모델링 범위</summary>
        <div className="mt-3 space-y-2">
          <p>
            문·창호 상부 보, SW 벽체, MW 벽체, 욕실 단차, AW3·AW16의 작은 연장/꺾임부는 확정 형상에
            포함하지 않았습니다. 슬래브는 단차·인양구가 없는 참고 형상입니다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {pendingGuides.map((guide) => (
              <li key={guide.id}>
                {guide.label}: {guide.reason}
              </li>
            ))}
          </ul>
          <p>
            명시 치수로 보정한 수동 추적 초안이며, 범용 도면 자동 인식 기능은 아직 아닙니다. 실명
            표지는 위치 안내용입니다. 마감 설정은 이 골조 화면에 아직 적용되지 않습니다.
          </p>
        </div>
      </details>
      <details className="rounded-md border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">원본 구조평면도와 비교</summary>
        <p className="my-2 text-muted-foreground">
          첨부 PDF의 세대 영역을 렌더링한 이미지입니다. 원본 PDF는 변경하지 않았습니다.
        </p>
        <img
          src="/model-reference"
          alt="첨부 84A 단위세대 구조평면도 세대 영역"
          loading="lazy"
          className="max-h-[800px] w-full object-contain"
        />
      </details>
    </div>
  )
}
