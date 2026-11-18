import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"

export function readStructureReference(): ArrayBuffer {
  let dir = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    for (const relative of [
      "private/model-references/84a-structure.png",
      "apps/web/private/model-references/84a-structure.png",
    ]) {
      const path = join(dir, relative)
      if (existsSync(path)) return new Uint8Array(readFileSync(path)).buffer
    }
    dir = dirname(dir)
  }
  throw new Response("도면 미리보기 파일을 찾을 수 없습니다.", { status: 404 })
}
