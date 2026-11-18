import type { LoaderFunctionArgs } from "react-router"
import { requireUser } from "~/features/auth/model/session.server"
import { ModelViewer } from "~/features/model-viewer/ui/model-viewer"

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request)
  return null
}

export default function ModelViewerRoute() {
  return <ModelViewer />
}
