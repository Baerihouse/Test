import type { LoaderFunctionArgs } from "react-router"
import { requireUser } from "~/features/auth/model/session.server"
import { readStructureReference } from "~/features/model-viewer/model/reference.server"

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request)
  return new Response(readStructureReference(), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
