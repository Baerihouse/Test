import { Outlet, useLoaderData, type LoaderFunctionArgs } from "react-router"
import { requireUser } from "~/features/auth/model/session.server"
import { WorkspaceProvider } from "~/features/project-workspace/ui/workspace-context"
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  return { userId: user.id }
}
export default function WorkspaceRoute() {
  const { userId } = useLoaderData<typeof loader>()
  return (
    <WorkspaceProvider key={userId} userId={userId}>
      <Outlet />
    </WorkspaceProvider>
  )
}
