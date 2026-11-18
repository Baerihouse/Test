import {
  emptyWorkspace,
  workspaceSchema,
  type Workspace,
} from "~/entities/workspace/model/workspace"

let connection: Promise<IDBDatabase> | undefined
function database(): Promise<IDBDatabase> {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open("woomi-drawing-workspace", 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore("workspace")
        request.result.createObjectStore("files")
      }
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close()
          connection = undefined
        }
        resolve(request.result)
      }
      request.onerror = () => {
        connection = undefined
        reject(new Error("브라우저 저장소를 열지 못했습니다."))
      }
      request.onblocked = () => {
        connection = undefined
        reject(new Error("다른 탭을 닫고 다시 시도하세요."))
      }
    })
  return connection
}
export async function loadWorkspace(userId: string): Promise<Workspace> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction("workspace").objectStore("workspace").get(userId)
    request.onsuccess = () => {
      try {
        resolve(
          request.result === undefined ? emptyWorkspace() : workspaceSchema.parse(request.result),
        )
      } catch {
        reject(new Error("저장된 데이터가 손상되었습니다. 자동 초기화하지 않습니다."))
      }
    }
    request.onerror = () => reject(new Error("저장된 현장을 읽지 못했습니다."))
  })
}
export async function persistWorkspace(
  userId: string,
  previousRevision: number,
  next: Workspace,
  additions: { id: string; blob: Blob }[] = [],
  removals: string[] = [],
): Promise<Workspace> {
  const parsed = workspaceSchema.parse({ ...next, revision: previousRevision + 1 })
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["workspace", "files"], "readwrite")
    let failure = "저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인하세요."
    const store = transaction.objectStore("workspace"),
      request = store.get(userId)
    request.onsuccess = () => {
      try {
        const current = request.result as Workspace | undefined
        if ((current?.revision ?? 0) !== previousRevision) {
          failure = "다른 탭에서 변경되었습니다. 새로고침 후 다시 시도하세요."
          transaction.abort()
          return
        }
        store.put(parsed, userId)
        additions.forEach(({ id, blob }) =>
          transaction.objectStore("files").put(blob, `${userId}:${id}`),
        )
        removals.forEach((id) => transaction.objectStore("files").delete(`${userId}:${id}`))
      } catch {
        transaction.abort()
      }
    }
    transaction.oncomplete = () => resolve(parsed)
    transaction.onabort = () => reject(new Error(failure))
    transaction.onerror = () => reject(new Error(failure))
  })
}
export async function readPdf(userId: string, documentId: string): Promise<Blob> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(`${userId}:${documentId}`)
    request.onsuccess = () =>
      request.result instanceof Blob
        ? resolve(request.result)
        : reject(new Error("PDF 원본을 찾을 수 없습니다. 원본을 다시 등록하세요."))
    request.onerror = () => reject(new Error("PDF를 읽지 못했습니다."))
  })
}
