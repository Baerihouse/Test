import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import {
  applyCalibration,
  calibratedPoint,
  createSnapshot,
  type Point,
  type Wall,
} from "~/entities/workspace/model/workspace"
import { useWorkspace, RequireFloor } from "./workspace-context"
import { PdfSheet } from "./pdf-sheet"
import { WallEditor } from "./wall-editor"
import { PageHeader } from "~/shared/ui/page-header"
import { Button } from "~/shared/ui/button"
import { Input } from "~/shared/ui/input"
import { Select } from "~/shared/ui/select"
import { Checkbox } from "~/shared/ui/checkbox"
import { SheetGrid, type SheetColumn } from "~/shared/ui/sheet-grid"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"

export function ReviewPage() {
  return (
    <RequireFloor>
      <ReviewEditor />
    </RequireFloor>
  )
}
function ReviewEditor() {
  const { userId, floor, busy, updateFloor, href } = useWorkspace(),
    [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1),
    [mode, setMode] = useState<"inspect" | "calibrate" | "wall">("inspect"),
    [points, setPoints] = useState<Point[]>([])
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 }),
    [distance, setDistance] = useState(""),
    [error, setError] = useState(""),
    [selectedWall, setSelectedWall] = useState("")
  const [selection, setSelection] = useState<Set<string>>(new Set()),
    [confirm, setConfirm] = useState(false),
    [zoom, setZoom] = useState(1)
  if (!floor) return null
  const document =
    floor.documents.find((item) => item.id === params.get("document")) ?? floor.documents[0]
  const calibration = document?.calibrations.find((item) => item.page === page)
  const wall = floor.walls.find((item) => item.id === selectedWall)
  const columns: SheetColumn<Wall>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          aria-label="벽 전체 선택"
          ref={(node) => {
            if (node) node.indeterminate = selection.size > 0 && selection.size < floor.walls.length
          }}
          checked={floor.walls.length > 0 && selection.size === floor.walls.length}
          onChange={(event) =>
            setSelection(event.target.checked ? new Set(floor.walls.map((w) => w.id)) : new Set())
          }
        />
      ),
      focusable: false,
      cell: (row) => (
        <Checkbox
          aria-label={`${row.name} 선택`}
          checked={selection.has(row.id)}
          onChange={(event) =>
            setSelection((current) => {
              const next = new Set(current)
              if (event.target.checked) next.add(row.id)
              else next.delete(row.id)
              return next
            })
          }
        />
      ),
    },
    {
      key: "name",
      header: "벽",
      cell: (row) => (
        <button className="text-primary underline" onClick={() => setSelectedWall(row.id)}>
          {row.name}
        </button>
      ),
      copyText: (row) => row.name,
    },
    {
      key: "length",
      header: "길이(mm)",
      cell: (row) =>
        Math.round(Math.hypot(row.x2 - row.x1, row.y2 - row.y1)).toLocaleString("ko-KR"),
    },
    {
      key: "thickness",
      header: "두께 / 높이(mm)",
      cell: (row) => `${row.thickness ?? "미정"} / ${row.height ?? "미정"}`,
    },
    { key: "openings", header: "개구부", cell: (row) => row.openings.length },
    { key: "status", header: "확인", cell: (row) => (row.confirmed ? "벽 확인 완료" : "미확정") },
    {
      key: "edit",
      header: "수정",
      focusable: false,
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => setSelectedWall(row.id)}>
          벽·창호 수정
        </Button>
      ),
    },
  ]
  async function saveScale() {
    if (!floor || !document || points.length !== 2) return
    const value = Number(distance)
    if (!Number.isFinite(value) || value <= 0 || value > 1e6 || !pageSize.width) {
      setError("실제 길이를 0보다 크고 1,000,000mm 이하로 입력하세요.")
      return
    }
    try {
      const next = applyCalibration(floor, document.id, {
        page,
        ...pageSize,
        a: points[0],
        b: points[1],
        distanceMm: value,
      })
      if (await updateFloor(next)) {
        setPoints([])
        setMode("wall")
        setError("")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "기준 치수를 저장하지 못했습니다.")
    }
  }
  async function addWall() {
    if (!floor || !document || !calibration || points.length !== 2) return
    try {
      const a = calibratedPoint(points[0], calibration),
        b = calibratedPoint(points[1], calibration)
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) {
        setError("벽 시작점과 끝점을 서로 다르게 지정하세요.")
        return
      }
      const item: Wall = {
        id: crypto.randomUUID(),
        name: `벽 ${floor.walls.length + 1}`,
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        thickness: null,
        height: null,
        confirmed: false,
        note: "PDF 추적 · 두께/높이 확인 필요",
        materialId: null,
        drawingId: document.id,
        page,
        trace: [points[0], points[1]],
        openings: [],
      }
      if (
        await updateFloor({
          ...floor,
          walls: [...floor.walls, item],
          reviewRevision: floor.reviewRevision + 1,
        })
      ) {
        setPoints([])
        setSelectedWall(item.id)
        setError("")
      }
    } catch {
      setError("벽 좌표를 확인하세요.")
    }
  }
  async function generate() {
    if (!floor) return
    try {
      const snapshot = createSnapshot(floor)
      if (await updateFloor({ ...floor, models: [...floor.models, snapshot] }))
        window.location.assign(href("/models") + `&model=${snapshot.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "모델을 만들지 못했습니다.")
    }
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title="도면 검토 · 수정"
        description="① 기준 치수 두 점 지정 → ② 벽 시작·끝점 지정 → ③ 두께·높이·개구부 수정 → ④ 3D 생성"
        actions={
          <Button
            disabled={busy || !floor.walls.length}
            onClick={() => {
              void generate()
            }}
          >
            검토 내용으로 3D 생성
          </Button>
        }
      />
      {!document ? (
        <p className="text-sm">
          PDF를 먼저 등록하세요.{" "}
          <Link className="text-primary underline" to={href("/drawings")}>
            도면 등록으로 이동
          </Link>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="max-w-full text-sm">
              도면
              <Select
                className="max-w-full min-w-0"
                aria-label="검토 도면"
                value={document.id}
                onChange={(event) => {
                  const next = new URLSearchParams(params)
                  next.set("document", event.target.value)
                  setParams(next)
                  setPage(1)
                  setPoints([])
                  setMode("inspect")
                  setPageSize({ width: 0, height: 0 })
                }}
              >
                {floor.documents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.kind}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              페이지
              <Select
                className="max-w-full min-w-0"
                aria-label="검토 페이지"
                value={page}
                onChange={(event) => {
                  setPage(Number(event.target.value))
                  setPoints([])
                  setMode("inspect")
                  setPageSize({ width: 0, height: 0 })
                }}
              >
                {Array.from({ length: document.pages }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="outline" onClick={() => setZoom((value) => (value === 1 ? 1.5 : 1))}>
              {zoom === 1 ? "도면 확대" : "기본 배율"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-card p-3">
            <Button
              variant={mode === "calibrate" ? "primary" : "outline"}
              onClick={() => {
                setMode("calibrate")
                setPoints([])
              }}
            >
              기준 치수 지정
            </Button>
            <Button
              disabled={!calibration}
              variant={mode === "wall" ? "primary" : "outline"}
              onClick={() => {
                setMode("wall")
                setPoints([])
              }}
            >
              벽 두 점 지정
            </Button>
            <Button variant="ghost" onClick={() => setPoints([])}>
              지정점 취소
            </Button>
            <span className="text-sm text-muted-foreground">
              {calibration ? "현재 페이지 축척 지정됨" : "현재 페이지 축척 미지정"} ·{" "}
              {points.length}/2점
            </span>
            {mode === "calibrate" ? (
              <>
                <label className="text-sm">
                  두 점의 실제 길이 (mm)
                  <Input
                    aria-label="기준 실제 길이 (mm)"
                    type="number"
                    step="any"
                    value={distance}
                    onChange={(event) => setDistance(event.target.value)}
                  />
                </label>
                <Button
                  disabled={busy || points.length !== 2}
                  onClick={() => {
                    void saveScale()
                  }}
                >
                  기준 치수 저장
                </Button>
                <span className="text-xs text-muted-foreground">
                  재지정하면 같은 페이지의 추적 벽을 재계산하고 미확정으로 돌립니다.
                </span>
              </>
            ) : null}
            {mode === "wall" ? (
              <Button
                disabled={busy || points.length !== 2}
                onClick={() => {
                  void addWall()
                }}
              >
                지정한 두 점으로 벽 추가
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            PDF를 직접 보며 중심선을 지정하는 방식입니다. 자동 인식 결과가 아닙니다. 서로 다른
            도면의 원점·회전은 자동 정합되지 않으므로 주 평면 한 장에서 벽을 추적하고 보조 자료로
            치수를 확인하세요.
          </p>
          <PdfSheet
            userId={userId}
            documentId={document.id}
            page={page}
            zoom={zoom}
            points={points}
            walls={floor.walls.filter((w) => w.drawingId === document.id && w.page === page)}
            onSize={(width, height) => setPageSize({ width, height })}
            onPoint={
              mode === "inspect" || busy
                ? undefined
                : (point) =>
                    setPoints((current) => (current.length >= 2 ? [point] : [...current, point]))
            }
          />
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {selection.size ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <span>{selection.size}개 선택</span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void updateFloor({
                ...floor,
                walls: floor.walls.map((w) =>
                  selection.has(w.id) ? { ...w, confirmed: false } : w,
                ),
                reviewRevision: floor.reviewRevision + 1,
              })
            }}
          >
            선택 벽 미확정으로 변경
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
            선택 벽 삭제
          </Button>
        </div>
      ) : null}
      <SheetGrid
        columns={columns}
        rows={floor.walls}
        rowKey={(row) => row.id}
        empty="검토 벽이 없습니다. PDF 기준 치수를 지정한 뒤 벽을 추가하세요."
      />
      {confirm ? (
        <ConfirmPanel
          title="선택 벽을 삭제할까요?"
          description="벽과 연결 개구부의 검토 값을 삭제합니다. 기존 생성 모델 이력은 유지됩니다."
          pending={busy}
          confirmLabel="검토 벽 삭제"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void updateFloor({
              ...floor,
              walls: floor.walls.filter((w) => !selection.has(w.id)),
              reviewRevision: floor.reviewRevision + 1,
            }).then((ok) => {
              if (ok) {
                setSelection(new Set())
                setConfirm(false)
              }
            })
          }}
        />
      ) : null}
      {wall ? <WallEditor key={`${wall.id}-${JSON.stringify(wall)}`} wall={wall} /> : null}
    </div>
  )
}
