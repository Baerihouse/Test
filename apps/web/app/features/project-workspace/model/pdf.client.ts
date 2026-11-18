import { GlobalWorkerOptions, getDocument } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url"

GlobalWorkerOptions.workerSrc = workerUrl
export const MAX_PDF_BYTES = 50 * 1024 * 1024
export async function inspectPdf(file: File): Promise<number> {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("현재는 PDF만 등록할 수 있습니다. DWG·DWF는 추후 지원합니다.")
  if (!["application/pdf", ""].includes(file.type)) throw new Error("PDF 파일 형식을 확인하세요.")
  if (!file.size || file.size > MAX_PDF_BYTES)
    throw new Error("PDF는 파일당 50MB 이하로 등록하세요.")
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
    throw new Error("파일 내용이 올바른 PDF가 아닙니다.")
  const task = getDocument({ data: bytes, enableXfa: false, stopAtErrors: true })
  try {
    const doc = await task.promise
    if (doc.numPages > 500) throw new Error("500페이지 이하의 PDF를 등록하세요.")
    return doc.numPages
  } catch (error) {
    if (error instanceof Error && error.message.includes("500페이지")) throw error
    throw new Error("PDF를 열지 못했습니다. 손상 여부·암호 설정을 확인하세요.")
  } finally {
    await task.destroy()
  }
}
export { getDocument }
