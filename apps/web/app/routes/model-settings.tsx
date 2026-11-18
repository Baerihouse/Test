import { useLoaderData, type LoaderFunctionArgs } from "react-router"
import { requireUser } from "~/features/auth/model/session.server"
import { ModelSettings } from "~/features/model-settings/ui/model-settings"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  return { userId: user.id }
}

export default function ModelSettingsRoute() {
  const { userId } = useLoaderData<typeof loader>()
  return <ModelSettings key={userId} userId={userId} />
}
