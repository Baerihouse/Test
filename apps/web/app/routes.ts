import { type RouteConfig, index, layout, route } from "@react-router/dev/routes"

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  layout("routes/_app.tsx", [
    layout("routes/workspace.tsx", [
      index("routes/sites.tsx"),
      route("drawings", "routes/drawings.tsx"),
      route("review", "routes/review.tsx"),
      route("materials", "routes/materials.tsx"),
      route("models", "routes/models.tsx"),
      route("settings", "routes/project-settings.tsx"),
    ]),
    route("model-settings", "routes/model-settings.tsx"),
    route("model-viewer", "routes/model-viewer.tsx"),
    route("model-reference", "routes/model-reference.ts"),
    // 데이터 전용 리소스 라우트(변경 이력) — 사이드바 버전 배지가 fetch 한다.
    route("changelog", "routes/changelog.tsx"),
  ]),
  route("forbidden", "routes/forbidden.tsx"),
  route("*", "routes/$.tsx"),
] satisfies RouteConfig
