import { Building2, Files, PencilRuler, PaintBucket, Box, Settings } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const navItems: NavItem[] = [
  { to: "/", label: "현장 목록", icon: Building2, end: true },
  { to: "/drawings", label: "도면 관리", icon: Files },
  { to: "/review", label: "도면 검토", icon: PencilRuler },
  { to: "/materials", label: "마감재 관리", icon: PaintBucket },
  { to: "/models", label: "3D 모델", icon: Box },
  { to: "/settings", label: "설정", icon: Settings },
]
