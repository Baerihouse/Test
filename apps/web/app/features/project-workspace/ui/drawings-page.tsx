import { useState } from "react"
import { Link } from "react-router"
import { drawingTypes, type DrawingDocument } from "~/entities/workspace/model/workspace"
import { useWorkspace, RequireFloor } from "./workspace-context"
import { readPdf } from "../model/repository.client"
import { PdfSheet } from "./pdf-sheet"
import { PageHeader } from "~/shared/ui/page-header"
import { Button } from "~/shared/ui/button"
import { Select } from "~/shared/ui/select"
import { Checkbox } from "~/shared/ui/checkbox"
import { SheetGrid, type SheetColumn } from "~/shared/ui/sheet-grid"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"

export function DrawingsPage() {
  return (
    <RequireFloor>
      <DrawingManager />
    </RequireFloor>
  )
}
function DrawingManager() {
  const { userId, data, site, floor, busy, commit, updateFloor, href } = useWorkspace()
  const [kind, setKind] = useState<(typeof drawingTypes)[number]>("평면도"),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [preview, setPreview] = useState(""),
    [page, setPage] = useState(1),
    [confirm, setConfirm] = useState(false)
  if (!floor || !site) return null
  const document = floor.documents.find((item) => item.id === preview)
  async function upload(files: File[]) {
    if (!floor || !site || !files.length) return
    setLoading(true)
    setError("")
    try {
      const { inspectPdf } = await import("../model/pdf.client")
      const documents: DrawingDocument[] = [],
        blobs: { id: string; blob: Blob }[] = []
      for (const file of files) {
        const pages = await inspectPdf(file)
        const id = crypto.randomUUID()
        documents.push({
          id,
          name: file.name,
          kind,
          size: file.size,
          pages,
          calibrations: [],
          createdAt: new Date().toISOString(),
        })
        blobs.push({ id, blob: file })
      }
      const next = { ...floor, documents: [...floor.documents, ...documents] }
      if (
        await commit(
          {
            ...data,
            sites: data.sites.map((item) =>
              item.id === site.id
                ? { ...item, floors: item.floors.map((f) => (f.id === floor.id ? next : f)) }
                : item,
            ),
          },
          blobs,
        )
      ) {
        setPreview(documents[0].id)
        setPage(1)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PDF 등록에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }
  const columns: SheetColumn<DrawingDocument>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          aria-label="도면 전체 선택"
          ref={(node) => {
            if (node)
              node.indeterminate = selected.size > 0 && selected.size < floor.documents.length
          }}
          checked={floor.documents.length > 0 && selected.size === floor.documents.length}
          onChange={(event) =>
            setSelected(
              event.target.checked ? new Set(floor.documents.map((d) => d.id)) : new Set(),
            )
          }
        />
      ),
      focusable: false,
      cell: (row) => (
        <Checkbox
          aria-label={`${row.name} 선택`}
          checked={selected.has(row.id)}
          onChange={(event) =>
            setSelected((current) => {
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
      header: "도면명",
      minW: "min-w-56",
      cell: (row) => (
        <button
          className="text-primary underline"
          onClick={() => {
            setPreview(row.id)
            setPage(1)
          }}
        >
          {row.name}
        </button>
      ),
      copyText: (row) => row.name,
    },
    { key: "kind", header: "자료 종류", cell: (row) => row.kind, copyText: (row) => row.kind },
    { key: "pages", header: "페이지", cell: (row) => row.pages },
    { key: "size", header: "용량", cell: (row) => `${(row.size / 1024 / 1024).toFixed(2)} MB` },
    {
      key: "action",
      header: "검토",
      focusable: false,
      cell: (row) => (
        <Link className="text-primary underline" to={href("/review") + `&document=${row.id}`}>
          도면 검토
        </Link>
      ),
    },
  ]
  return (
    <div className="space-y-4">
      <PageHeader
        title="도면 관리 · 등록"
        description={`${floor.name} · 여러 PDF를 종류별로 등록하세요. 원본 PDF는 변경하지 않습니다.`}
      />
      <fieldset
        disabled={busy || loading}
        className="flex flex-wrap items-end gap-3 rounded border border-border bg-card p-4"
      >
        <label className="space-y-1 text-sm">
          <span>등록할 자료 종류</span>
          <Select
            className="max-w-full min-w-0"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            {drawingTypes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span>PDF 선택 · 여러 파일 가능</span>
          <input
            aria-label="도면 PDF 등록"
            className="block max-w-full text-sm"
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ""
              void upload(files)
            }}
          />
        </label>
        <span className="text-xs text-muted-foreground">
          파일당 50MB · 최대 500페이지 · DWG/DWF는 추후 지원
        </span>
      </fieldset>
      {loading ? <p role="status">PDF 검증 및 등록 중…</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {selected.size ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{selected.size}개 선택</span>
          <Button
            disabled={busy}
            size="sm"
            variant="outline"
            onClick={() => {
              void updateFloor({
                ...floor,
                documents: floor.documents.map((d) => (selected.has(d.id) ? { ...d, kind } : d)),
              })
            }}
          >
            선택 자료 종류를 {kind}(으)로 변경
          </Button>
          <Button disabled={busy} size="sm" variant="danger" onClick={() => setConfirm(true)}>
            선택 도면 삭제
          </Button>
        </div>
      ) : null}
      <SheetGrid
        rows={floor.documents}
        columns={columns}
        rowKey={(row) => row.id}
        empty="등록된 PDF가 없습니다. 위에서 파일을 선택하세요."
      />
      {confirm ? (
        <ConfirmPanel
          title="선택 도면을 삭제할까요?"
          description="연결된 검토 벽도 삭제됩니다. 기존에 생성한 모델 이력은 남지만 원본은 다시 등록해야 합니다. 되돌릴 수 없습니다."
          pending={busy}
          confirmLabel="도면과 검토 삭제"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            const next = {
              ...floor,
              documents: floor.documents.filter((d) => !selected.has(d.id)),
              walls: floor.walls.filter((w) => !selected.has(w.drawingId)),
              reviewRevision: floor.reviewRevision + 1,
            }
            void commit(
              {
                ...data,
                sites: data.sites.map((item) =>
                  item.id === site.id
                    ? { ...item, floors: item.floors.map((f) => (f.id === floor.id ? next : f)) }
                    : item,
                ),
              },
              [],
              [...selected],
            ).then((ok) => {
              if (ok) {
                setSelected(new Set())
                setConfirm(false)
                setPreview("")
              }
            })
          }}
        />
      ) : null}
      {document ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <strong className="text-sm">{document.name}</strong>
            <label className="text-sm">
              페이지{" "}
              <Select
                className="max-w-full min-w-0"
                aria-label="PDF 미리보기 페이지"
                value={page}
                onChange={(event) => setPage(Number(event.target.value))}
              >
                {Array.from({ length: document.pages }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void readPdf(userId, document.id)
                  .then((blob) => {
                    const url = URL.createObjectURL(blob),
                      link = window.document.createElement("a")
                    link.href = url
                    link.download = document.name
                    link.click()
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                  })
                  .catch(() => setError("PDF 원본을 읽지 못했습니다."))
              }}
            >
              원본 내려받기
            </Button>
          </div>
          <PdfSheet userId={userId} documentId={document.id} page={page} />
        </section>
      ) : null}
    </div>
  )
}
