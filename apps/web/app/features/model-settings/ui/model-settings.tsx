import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import {
  createModel,
  floorBasis,
  layerSummary,
  parseBackup,
  surfaceLabels,
  surfaceSchema,
  type BuildingModel,
  type Material,
  type Surface,
} from "~/entities/building-model/model/model"
import { loadModel, saveModel, storageKey } from "../model/storage"
import { MaterialEditor } from "./material-editor"
import { LayerEditor } from "./layer-editor"
import { PageHeader } from "~/shared/ui/page-header"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/shared/ui/card"
import { Button } from "~/shared/ui/button"
import { Select } from "~/shared/ui/select"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"

const MAX_BACKUP_BYTES = 1024 * 1024

export function ModelSettings({ userId }: { userId: string }) {
  const [model, setModel] = useState<BuildingModel>(createModel)
  const [ready, setReady] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [selectedMaterial, setSelectedMaterial] = useState("")
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<BuildingModel | null>(null)
  const [reading, setReading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [params, setParams] = useSearchParams()
  const parsedSurface = surfaceSchema.safeParse(params.get("surface"))
  const surface: Surface = parsedSurface.success ? parsedSurface.data : "floor"
  const key = storageKey(userId)

  useEffect(() => {
    try {
      setModel(loadModel(window.localStorage, key))
    } catch {
      setBlocked(true)
      setError(
        "저장된 설정을 읽을 수 없습니다. 기존 데이터를 보호하기 위해 편집을 잠갔습니다. 백업 복원을 시도하세요.",
      )
    }
    setReady(true)
  }, [key])

  function commit(next: BuildingModel) {
    if (blocked) return false
    try {
      saveModel(window.localStorage, key, next)
      setModel(next)
      setError("")
      setNotice("이 브라우저에 저장했습니다.")
      return true
    } catch {
      setError(
        "저장하지 못했습니다. 입력은 유지됩니다. 브라우저 저장 설정과 남은 용량을 확인하세요.",
      )
      setNotice("")
      return false
    }
  }

  function saveMaterial(material: Material) {
    const existing = model.materials.some((item) => item.id === material.id)
    const next = {
      ...model,
      materials: existing
        ? model.materials.map((item) => (item.id === material.id ? material : item))
        : [...model.materials, material],
    }
    if (!commit(next)) return false
    setSelectedMaterial(material.id)
    return true
  }

  function moveLayer(id: string, direction: -1 | 1) {
    const entries = model.layers.filter((layer) => layer.surface === surface)
    const index = entries.findIndex((layer) => layer.id === id)
    const other = entries[index + direction]
    if (!other) return
    const firstIndex = model.layers.findIndex((layer) => layer.id === id)
    const otherIndex = model.layers.findIndex((layer) => layer.id === other.id)
    const layers = [...model.layers]
    ;[layers[firstIndex], layers[otherIndex]] = [layers[otherIndex], layers[firstIndex]]
    commit({ ...model, layers })
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "201-floor2-model-settings.json"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function readBackup(file: File | undefined) {
    if (!file) return
    setReading(true)
    setPendingImport(null)
    setError("")
    setNotice("")
    try {
      const allowedMime = ["application/json", "text/plain", ""]
      if (
        !file.name.toLowerCase().endsWith(".json") ||
        !allowedMime.includes(file.type) ||
        file.size > MAX_BACKUP_BYTES
      )
        throw new Error("invalid")
      setPendingImport(parseBackup(await file.text()))
    } catch {
      setError("복원할 수 없습니다. 이 모델 설정에서 백업한 1MB 이하 JSON 파일을 선택하세요.")
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const layers = model.layers.filter((layer) => layer.surface === surface)
  const summary = layerSummary(layers)
  const material = model.materials.find((item) => item.id === selectedMaterial)

  return (
    <div className="space-y-4">
      <PageHeader title="모델 설정" description={floorBasis.label} />
      <Card>
        <CardHeader>
          <CardTitle>기준 높이</CardTitle>
          <CardDescription>
            구조 바닥 기준입니다. 마감 바닥·천장고는 별도로 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">2층 SL</dt>
              <dd className="text-xl font-semibold">
                GL +{floorBasis.structuralLevelMm.toLocaleString("ko-KR")} mm
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">3층 SL</dt>
              <dd className="text-xl font-semibold">
                GL +{floorBasis.nextStructuralLevelMm.toLocaleString("ko-KR")} mm
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">층간 높이</dt>
              <dd className="text-xl font-semibold">
                {floorBasis.floorToFloorMm.toLocaleString("ko-KR")} mm
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            {floorBasis.source} · 마감재를 바꿔도 골조 기준 높이는 유지됩니다.
          </p>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        이 화면은 마감재와 층 구성 설정입니다. 도면 자동 인식·3D 형상 생성은 아직 연결되지
        않았습니다.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={!ready || blocked} onClick={exportBackup}>
          설정 백업
        </Button>
        <Button
          variant="outline"
          disabled={!ready || reading}
          onClick={() => fileRef.current?.click()}
        >
          {reading ? "읽는 중…" : "백업 복원"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="모델 설정 백업 파일"
          onChange={(event) => {
            void readBackup(event.target.files?.[0])
          }}
        />
        <span className="text-xs text-muted-foreground">
          현재 로그인 사용자 · 이 브라우저에 저장 · 다른 기기와 공유되지 않음
        </span>
      </div>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      ) : null}
      {pendingImport ? (
        <ConfirmPanel
          title="백업으로 교체할까요?"
          description={`자재 ${pendingImport.materials.length}개, 마감층 ${pendingImport.layers.length}개로 현재 설정을 교체합니다. 먼저 현재 설정을 백업하세요.`}
          confirmLabel="복원 확정"
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            try {
              saveModel(window.localStorage, key, pendingImport)
              setModel(pendingImport)
              setBlocked(false)
              setPendingImport(null)
              setSelectedMaterial("")
              setError("")
              setNotice("백업을 복원했습니다.")
            } catch {
              setError("복원 내용을 저장하지 못했습니다. 기존 설정을 유지합니다.")
            }
          }}
        />
      ) : null}
      {!ready ? (
        <p role="status">저장된 설정을 읽는 중…</p>
      ) : (
        <fieldset
          disabled={blocked || reading || pendingImport !== null}
          className="grid min-w-0 gap-4 disabled:opacity-60 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]"
        >
          <legend className="sr-only">마감재와 마감층 설정</legend>
          <Card>
            <CardHeader>
              <CardTitle>마감재 등록</CardTitle>
              <CardDescription>자재는 나중에 추가하거나 교체할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-1 text-sm">
                <span>수정할 자재</span>
                <Select
                  value={selectedMaterial}
                  onChange={(event) => setSelectedMaterial(event.target.value)}
                >
                  <option value="">새 자재 등록</option>
                  {model.materials.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </label>
              {!model.materials.length ? (
                <p className="text-sm text-muted-foreground">
                  등록된 자재가 없습니다. 마감층은 미정 상태로 유지됩니다.
                </p>
              ) : null}
              <MaterialEditor
                key={`${selectedMaterial}-${material?.name ?? ""}-${material?.product ?? ""}-${material?.color ?? ""}-${material?.source ?? ""}`}
                material={material}
                onSave={saveMaterial}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>부위별 마감층</CardTitle>
              <CardDescription>
                골조에서 실내 표면 방향으로 정렬합니다. 실제 시공 순서는 별도 검토합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2" aria-label="마감 부위 선택">
                {(Object.keys(surfaceLabels) as Surface[]).map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    aria-pressed={surface === value}
                    variant={surface === value ? "primary" : "outline"}
                    onClick={() => {
                      const next = new URLSearchParams(params)
                      next.set("surface", value)
                      setParams(next, { preventScrollReset: true })
                    }}
                  >
                    {surfaceLabels[value]}
                  </Button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  입력된 두께 합계:{" "}
                  {summary.knownThicknessMm.toLocaleString("ko-KR", { maximumFractionDigits: 20 })}{" "}
                  mm{" "}
                  {summary.incomplete || !layers.length
                    ? "· 미정 항목 있음 / 전체 두께 미확정"
                    : "· 입력값 기준"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    commit({
                      ...model,
                      layers: [
                        ...model.layers,
                        {
                          id: crypto.randomUUID(),
                          name: `${surfaceLabels[surface]} 추가층`,
                          surface,
                          materialId: null,
                          thicknessMm: null,
                        },
                      ],
                    })
                  }
                >
                  마감층 추가
                </Button>
              </div>
              {!layers.length ? (
                <p className="py-5 text-sm text-muted-foreground">
                  마감층이 없습니다. 추가 버튼으로 등록하세요.
                </p>
              ) : null}
              {layers.map((layer, index) => (
                <LayerEditor
                  key={`${layer.id}-${layer.name}-${layer.materialId}-${layer.thicknessMm}`}
                  layer={layer}
                  materials={model.materials}
                  index={index}
                  count={layers.length}
                  onSave={(value) =>
                    commit({
                      ...model,
                      layers: model.layers.map((item) => (item.id === value.id ? value : item)),
                    })
                  }
                  onMove={(direction) => moveLayer(layer.id, direction)}
                  onRemove={() => setRemoveId(layer.id)}
                />
              ))}
              {removeId ? (
                <ConfirmPanel
                  title="마감층을 제거할까요?"
                  description="선택한 마감층 설정만 제거합니다. 등록한 자재와 골조 기준 높이는 유지됩니다. 복구하려면 백업이 필요합니다."
                  confirmLabel="마감층 제거"
                  onCancel={() => setRemoveId(null)}
                  onConfirm={() => {
                    if (
                      commit({
                        ...model,
                        layers: model.layers.filter((layer) => layer.id !== removeId),
                      })
                    )
                      setRemoveId(null)
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
        </fieldset>
      )}
    </div>
  )
}
