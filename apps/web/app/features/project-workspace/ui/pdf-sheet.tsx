import { useEffect, useRef, useState } from "react"
import type { Point, Wall } from "~/entities/workspace/model/workspace"
import { readPdf } from "../model/repository.client"

export function PdfSheet({
  userId,
  documentId,
  page,
  zoom = 1,
  points = [],
  walls = [],
  onPoint,
  onSize,
}: {
  userId: string
  documentId: string
  page: number
  zoom?: number
  points?: Point[]
  walls?: Wall[]
  onPoint?: (point: Point) => void
  onSize?: (width: number, height: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    sizeCallback = useRef(onSize)
  sizeCallback.current = onSize
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [size, setSize] = useState({ width: 1000, height: 700 })
  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined
    setError("")
    setLoading(true)
    void (async () => {
      const { getDocument } = await import("../model/pdf.client")
      const blob = await readPdf(userId, documentId)
      if (cancelled) return
      const task = getDocument({
        data: new Uint8Array(await blob.arrayBuffer()),
        enableXfa: false,
      })
      cleanup = () => {
        void task.destroy()
      }
      const pdf = await task.promise,
        pdfPage = await pdf.getPage(page)
      if (cancelled || !canvas.current) return
      const base = pdfPage.getViewport({ scale: 1 }),
        viewport = pdfPage.getViewport({ scale: (1200 * zoom) / base.width })
      canvas.current.width = Math.ceil(viewport.width)
      canvas.current.height = Math.ceil(viewport.height)
      const context = canvas.current.getContext("2d")
      if (!context) throw new Error("도면 표시를 시작하지 못했습니다.")
      await pdfPage.render({ canvas: canvas.current, canvasContext: context, viewport }).promise
      if (cancelled) return
      setSize({ width: viewport.width, height: viewport.height })
      sizeCallback.current?.(base.width, base.height)
      setLoading(false)
    })().catch(() => {
      if (!cancelled) {
        setError(
          "PDF 페이지를 표시하지 못했습니다. 다른 페이지를 선택하거나 원본 파일을 확인하세요.",
        )
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [userId, documentId, page, zoom])
  return (
    <div className="max-h-[720px] max-w-full overflow-auto rounded border border-border bg-slate-200 p-2">
      {loading ? (
        <p role="status" className="p-3 text-sm">
          PDF 페이지를 그리는 중…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div
        className="relative bg-white"
        style={{
          width: size.width,
          height: size.height,
          display: loading || error ? "none" : "block",
        }}
      >
        <canvas ref={canvas} className="block" />
        <svg
          aria-label="PDF 도면 검토 영역"
          role="img"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          style={{ cursor: onPoint ? "crosshair" : "default" }}
          onClick={(event) => {
            if (!onPoint) return
            const rect = event.currentTarget.getBoundingClientRect()
            onPoint([
              Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
              Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
            ])
          }}
        >
          {walls
            .filter((wall) => wall.trace)
            .map((wall) => (
              <line
                key={wall.id}
                x1={wall.trace![0][0]}
                y1={wall.trace![0][1]}
                x2={wall.trace![1][0]}
                y2={wall.trace![1][1]}
                stroke={wall.confirmed ? "#2563eb" : "#d97706"}
                strokeWidth={0.003}
              />
            ))}
          {points.map((point, i) => (
            <circle key={i} cx={point[0]} cy={point[1]} r={0.006} fill="#dc2626" />
          ))}
          {points.length === 2 ? (
            <line
              x1={points[0][0]}
              y1={points[0][1]}
              x2={points[1][0]}
              y2={points[1][1]}
              stroke="#dc2626"
              strokeWidth={0.002}
            />
          ) : null}
        </svg>
      </div>
    </div>
  )
}
