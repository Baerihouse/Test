import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import {
  drawingCalibration,
  pdfToPlan,
  pendingGuides,
  referenceWallHeightMm,
  roomLabels,
  slabReference,
  structuralWalls,
  type PlanPoint,
} from "~/entities/building-model/model/84a-structure"

export interface ViewerOptions {
  lowered: boolean
  drawing: boolean
  pending: boolean
  slab: boolean
  labels: boolean
  selectedId: string | null
}
export interface ViewerController {
  update: (options: ViewerOptions) => void
  frame: (view: "perspective" | "plan") => void
  zoom: (factor: number) => void
  rotate: (direction: number) => void
  capture: () => void
  dispose: () => void
}

const centerX = 14630 / 2
const centerY = 9920 / 2
function position(point: PlanPoint, height = 0) {
  return new THREE.Vector3((point[0] - centerX) / 1000, height, (point[1] - centerY) / 1000)
}

function shape(points: readonly PlanPoint[]) {
  const result = new THREE.Shape()
  points.forEach((point, i) => {
    const p = position(point)
    if (i === 0) result.moveTo(p.x, -p.z)
    else result.lineTo(p.x, -p.z)
  })
  result.closePath()
  return result
}

function clearGroup(group: THREE.Group) {
  group.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Sprite
    ) {
      if ("geometry" in object) object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (material instanceof THREE.SpriteMaterial) material.map?.dispose()
        material.dispose()
      })
    }
  })
  group.clear()
}

export function createViewer(
  host: HTMLElement,
  onSelect: (id: string) => void,
  onError: (message: string) => void,
): ViewerController {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0xf1f5f9)
  renderer.domElement.tabIndex = 0
  renderer.domElement.setAttribute(
    "aria-label",
    "84A 골조 3D 화면. 드래그 회전, 휠 확대, 오른쪽 드래그 이동",
  )
  renderer.domElement.style.touchAction = "none"
  renderer.domElement.style.display = "block"
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 150)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = 3
  controls.maxDistance = 55
  controls.maxPolarAngle = Math.PI / 2 - 0.01
  controls.target.set(0, 0.8, 0)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.5))
  const light = new THREE.DirectionalLight(0xffffff, 3)
  light.position.set(4, 12, 8)
  scene.add(light)
  const grid = new THREE.GridHelper(24, 24, 0xcbd5e1, 0xe2e8f0)
  grid.position.y = -0.23
  scene.add(grid)
  const parts = new THREE.Group()
  scene.add(parts)
  let options: ViewerOptions = {
    lowered: false,
    drawing: true,
    pending: true,
    slab: true,
    labels: true,
    selectedId: null,
  }
  let sourceTexture: THREE.Texture | null = null
  let disposed = false
  let overlayFailed = false

  function update(next: ViewerOptions) {
    options = next
    clearGroup(parts)
    const wallHeight = next.lowered ? 1.2 : referenceWallHeightMm / 1000
    for (const wall of structuralWalls) {
      const geometry = new THREE.ExtrudeGeometry(shape(wall.footprint), {
        depth: wallHeight,
        bevelEnabled: false,
      })
      const material = new THREE.MeshStandardMaterial({
        color: wall.id === next.selectedId ? 0x2563eb : 0xb8c5d4,
        roughness: 0.82,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.x = -Math.PI / 2
      mesh.userData.partId = wall.id
      parts.add(mesh)
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x53677f }),
      )
      edges.rotation.x = -Math.PI / 2
      parts.add(edges)
    }
    if (next.slab) {
      const mesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape(slabReference.footprint), {
          depth: slabReference.thicknessMm / 1000,
          bevelEnabled: false,
        }),
        new THREE.MeshStandardMaterial({
          color: 0xe5c78f,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = -slabReference.thicknessMm / 1000
      mesh.userData.partId = "slab-reference"
      parts.add(mesh)
    }
    if (next.pending) {
      for (const guide of pendingGuides) {
        const points: THREE.Vector3[] = []
        const height = wallHeight
        for (let i = 1; i < guide.points.length; i += 1) {
          const a = guide.points[i - 1],
            b = guide.points[i]
          points.push(position(a, height), position(b, height))
          if (!guide.id.startsWith("beam"))
            points.push(
              position(a, 0),
              position(b, 0),
              position(a, 0),
              position(a, height),
              position(b, 0),
              position(b, height),
            )
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const lines = new THREE.LineSegments(
          geometry,
          new THREE.LineDashedMaterial({ color: 0xc27712, dashSize: 0.14, gapSize: 0.08 }),
        )
        lines.computeLineDistances()
        parts.add(lines)
      }
    }
    if (next.drawing && sourceTexture) {
      const [x0, y0, x1, y1] = drawingCalibration.crop
      const width = (x1 - x0) / drawingCalibration.pointsPerMm / 1000
      const depth = (y1 - y0) / drawingCalibration.pointsPerMm / 1000
      const center = pdfToPlan((x0 + x1) / 2, (y0 + y1) / 2)
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshBasicMaterial({
          map: sourceTexture,
          transparent: true,
          opacity: 0.74,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      plane.rotation.x = -Math.PI / 2
      plane.position.copy(position(center, 0.003))
      parts.add(plane)
    }
    if (next.labels) {
      for (const room of roomLabels) {
        const canvas = document.createElement("canvas")
        canvas.width = 320
        canvas.height = 80
        const ctx = canvas.getContext("2d")
        if (!ctx) continue
        ctx.fillStyle = "rgba(255,255,255,0.88)"
        ctx.fillRect(0, 0, 320, 80)
        ctx.fillStyle = "#334155"
        ctx.font = "600 34px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(room.label, 160, 40)
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: texture, depthTest: false }),
        )
        sprite.position.copy(position([room.x, room.y], 0.04))
        sprite.scale.set(2.1, 0.525, 1)
        parts.add(sprite)
      }
    }
  }

  const textureLoader = new THREE.TextureLoader()
  textureLoader.load(
    "/model-reference",
    (texture) => {
      if (disposed) {
        texture.dispose()
        return
      }
      sourceTexture = texture
      texture.colorSpace = THREE.SRGBColorSpace
      update(options)
    },
    undefined,
    () => {
      if (!disposed && !overlayFailed) {
        overlayFailed = true
        onError(
          "도면 겹침 이미지를 불러오지 못했습니다. 새로고침하거나 다시 로그인하세요. 3D 골조는 계속 볼 수 있습니다.",
        )
      }
    },
  )

  function frame(view: "perspective" | "plan") {
    controls.target.set(0, 0.6, 0)
    if (view === "plan") camera.position.set(0, 27, 0.02)
    else camera.position.set(13, 14, 17)
    controls.update()
  }
  frame("perspective")
  function resize() {
    const width = host.clientWidth,
      height = host.clientHeight
    if (!width || !height) return
    camera.aspect = width / height
    // 세로 화면에서도 모델을 가로로 자르지 않고 현재 카메라 방향을 유지한다.
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(40) / 2) * Math.max(1, 1.3 / camera.aspect)),
    )
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  let raf = 0
  function render() {
    if (disposed) return
    controls.update()
    renderer.render(scene, camera)
    raf = requestAnimationFrame(render)
  }
  render()
  let pointerStart = { x: 0, y: 0 }
  const down = (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY }
  }
  const up = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5
    )
      return
    const bounds = renderer.domElement.getBoundingClientRect()
    const cursor = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(cursor, camera)
    const hit = raycaster
      .intersectObjects(parts.children)
      .find((item) => typeof item.object.userData.partId === "string")
    if (hit) onSelect(hit.object.userData.partId as string)
  }
  const contextLost = (event: Event) => {
    event.preventDefault()
    onError("3D 표시가 중단되었습니다. 다시 불러오기를 누르세요.")
  }
  renderer.domElement.addEventListener("pointerdown", down)
  renderer.domElement.addEventListener("pointerup", up)
  renderer.domElement.addEventListener("webglcontextlost", contextLost)

  return {
    update,
    frame,
    zoom(factor) {
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target)
      controls.update()
    },
    rotate(direction) {
      const offset = camera.position.clone().sub(controls.target)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), (direction * Math.PI) / 8)
      camera.position.copy(controls.target).add(offset)
      controls.update()
    },
    capture() {
      renderer.render(scene, camera)
      const canvas = document.createElement("canvas")
      canvas.width = renderer.domElement.width
      canvas.height = renderer.domElement.height + 70
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Image capture unavailable")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(renderer.domElement, 0, 0)
      ctx.fillStyle = "#334155"
      ctx.font = "18px sans-serif"
      ctx.fillText("84A 확장형 · 검토 초안 · 2층 SL GL+3,550mm", 16, canvas.height - 40)
      ctx.fillText(
        `벽높이 ${options.lowered ? "1,200mm 절단 보기" : "2,590mm 참고"} · 주황: 확인 필요 · 마감/철근 미포함`,
        16,
        canvas.height - 14,
      )
      const link = document.createElement("a")
      link.download = "84A-골조-검토초안.png"
      link.href = canvas.toDataURL("image/png")
      link.click()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener("pointerdown", down)
      renderer.domElement.removeEventListener("pointerup", up)
      renderer.domElement.removeEventListener("webglcontextlost", contextLost)
      clearGroup(parts)
      grid.geometry.dispose()
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
      gridMaterials.forEach((material) => material.dispose())
      sourceTexture?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
