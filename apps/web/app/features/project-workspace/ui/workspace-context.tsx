import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router"
import {
  emptyWorkspace,
  type ProjectFloor,
  type Site,
  type Workspace,
} from "~/entities/workspace/model/workspace"
import { loadWorkspace, persistWorkspace } from "../model/repository.client"
import { Select } from "~/shared/ui/select"
import { Button } from "~/shared/ui/button"
import { ZodError } from "zod"

type Commit = (
  next: Workspace,
  files?: { id: string; blob: Blob }[],
  remove?: string[],
) => Promise<boolean>
interface ContextValue {
  userId: string
  data: Workspace
  site: Site | undefined
  floor: ProjectFloor | undefined
  busy: boolean
  commit: Commit
  updateFloor: (floor: ProjectFloor) => Promise<boolean>
  select: (siteId: string, floorId?: string) => void
  href: (path: string) => string
  message: (value: string) => void
}
const WorkspaceContext = createContext<ContextValue | null>(null)
export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("Workspace provider missing")
  return value
}

export function WorkspaceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [data, setData] = useState<Workspace>(emptyWorkspace)
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("")
  const lock = useRef(false)
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    let alive = true
    void loadWorkspace(userId)
      .then((value) => {
        if (alive) {
          setData(value)
          setReady(true)
        }
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : "현장을 읽지 못했습니다.")
      })
    return () => {
      alive = false
    }
  }, [userId])
  const site = data.sites.find((item) => item.id === params.get("site")) ?? data.sites[0]
  const floor = site?.floors.find((item) => item.id === params.get("floor")) ?? site?.floors[0]
  function select(siteId: string, floorId?: string) {
    const next = new URLSearchParams()
    next.set("site", siteId)
    if (floorId) next.set("floor", floorId)
    setParams(next)
  }
  function href(path: string) {
    const query = new URLSearchParams()
    if (site) query.set("site", site.id)
    if (floor) query.set("floor", floor.id)
    return `${path}?${query}`
  }
  const commit: Commit = async (next, files = [], remove = []) => {
    if (lock.current || !ready) return false
    lock.current = true
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const value = await persistWorkspace(userId, data.revision, next, files, remove)
      setData(value)
      setNotice("저장했습니다.")
      return true
    } catch (reason) {
      setError(
        reason instanceof ZodError
          ? "입력값·참조 자료·등록 개수 제한을 확인하세요. 기존 데이터는 유지됩니다."
          : reason instanceof Error
            ? reason.message
            : "저장하지 못했습니다. 입력을 확인하세요.",
      )
      return false
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function updateFloor(next: ProjectFloor) {
    if (!site) return false
    return commit({
      ...data,
      sites: data.sites.map((item) =>
        item.id === site.id
          ? { ...item, floors: item.floors.map((f) => (f.id === next.id ? next : f)) }
          : item,
      ),
    })
  }
  if (!ready)
    return (
      <div className="space-y-3 p-4">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button onClick={() => window.location.reload()}>다시 읽기</Button>
          </>
        ) : (
          <p role="status">저장된 현장을 읽는 중…</p>
        )}
      </div>
    )
  return (
    <WorkspaceContext.Provider
      value={{
        userId,
        data,
        site,
        floor,
        busy,
        commit,
        updateFloor,
        select,
        href,
        message: setNotice,
      }}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3">
        <label className="min-w-40 flex-1 space-y-1 text-sm">
          <span>현장</span>
          <Select
            className="max-w-full min-w-0"
            value={site?.id ?? ""}
            onChange={(event) => select(event.target.value)}
            aria-label="현재 현장"
          >
            <option value="" disabled>
              현장을 등록하세요
            </option>
            {data.sites.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.buildingType}
              </option>
            ))}
          </Select>
        </label>
        <label className="min-w-32 flex-1 space-y-1 text-sm">
          <span>층</span>
          <Select
            className="max-w-full min-w-0"
            value={floor?.id ?? ""}
            onChange={(event) => {
              if (site) select(site.id, event.target.value)
            }}
            aria-label="현재 층"
          >
            <option value="" disabled>
              층을 등록하세요
            </option>
            {site?.floors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>
        <span className="text-xs text-muted-foreground">이 브라우저에 저장 · PDF 우선 지원</span>
      </div>
      {error ? (
        <p role="alert" className="mb-3 rounded border border-danger/40 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-3 text-sm text-success">
          {notice}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className="text-sm">
          저장 중…
        </p>
      ) : null}
      <div key={`${site?.id ?? "empty"}:${floor?.id ?? "empty"}`}>{children}</div>
    </WorkspaceContext.Provider>
  )
}
export function RequireFloor({ children }: { children: ReactNode }) {
  const { floor, href } = useWorkspace()
  return floor ? (
    children
  ) : (
    <div className="rounded border border-border p-6 text-sm">
      <p>먼저 현장과 층을 등록하세요.</p>
      <Link className="text-primary underline" to={href("/")}>
        현장 목록으로 이동
      </Link>
    </div>
  )
}
