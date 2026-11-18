import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import {
  unresolvedCount,
  wallPieces,
  type ModelSnapshot,
  type ProjectMaterial,
} from "~/entities/workspace/model/workspace"

export interface ModelLayer {
  floorName: string
  snapshot: ModelSnapshot
}
export interface ProjectScene {
  setModels: (
    layers: ModelLayer[],
    materials: ProjectMaterial[],
    cut: boolean,
    colors: boolean,
  ) => void
  frame: (plan?: boolean) => void
  zoom: (factor: number) => void
  rotate: () => void
  capture: () => void
  dispose: () => void
}
function release(group: THREE.Group) {
  group.traverse((item) => {
    if (item instanceof THREE.Mesh || item instanceof THREE.Line) {
      item.geometry.dispose()
      const materials = Array.isArray(item.material) ? item.material : [item.material]
      materials.forEach((material) => material.dispose())
    }
  })
  group.clear()
}

export function createProjectScene(
  host: HTMLElement,
  onSelect: (text: string) => void,
  onError: (message: string) => void,
): ProjectScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0xf1f5f9)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.style.display = "block"
  renderer.domElement.style.touchAction = "none"
  renderer.domElement.tabIndex = 0
  renderer.domElement.setAttribute(
    "aria-label",
    "현장별 3D 모델. 드래그 회전, 휠 확대, 우클릭 이동",
  )
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10000),
    group = new THREE.Group()
  scene.add(group, new THREE.HemisphereLight(0xffffff, 0x64748b, 2.8))
  const light = new THREE.DirectionalLight(0xffffff, 2.5)
  light.position.set(8, 20, 12)
  scene.add(light)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2 - 0.001
  let radius = 10,
    centerHeight = 1,
    signature = "",
    description = "",
    disposed = false,
    raf = 0
  function frame(plan = false) {
    controls.target.set(0, centerHeight, 0)
    if (plan) camera.position.set(0, centerHeight + radius * 3, 0.001)
    else camera.position.set(radius * 1.8, centerHeight + radius * 1.6, radius * 2.1)
    camera.far = radius * 100 + 100
    camera.updateProjectionMatrix()
    controls.maxDistance = radius * 15
    controls.minDistance = Math.max(radius / 20, 0.05)
    controls.update()
  }
  function setModels(
    layers: ModelLayer[],
    materials: ProjectMaterial[],
    cut: boolean,
    colors: boolean,
  ) {
    release(group)
    const points = layers.flatMap(({ snapshot }) =>
      snapshot.walls.flatMap((wall) => [
        [wall.x1 + snapshot.offsetX, wall.y1 + snapshot.offsetY],
        [wall.x2 + snapshot.offsetX, wall.y2 + snapshot.offsetY],
      ]),
    )
    if (!points.length) return
    const minX = Math.min(...points.map((point) => point[0])),
      maxX = Math.max(...points.map((point) => point[0])),
      minZ = Math.min(...points.map((point) => point[1])),
      maxZ = Math.max(...points.map((point) => point[1]))
    const centerX = (minX + maxX) / 2,
      centerZ = (minZ + maxZ) / 2,
      bottom = Math.min(...layers.map(({ snapshot }) => snapshot.elevation))
    let top = 0
    for (const { snapshot, floorName } of layers) {
      const base = (snapshot.elevation - bottom) / 1000
      for (const wall of snapshot.walls) {
        const dx = wall.x2 - wall.x1,
          dz = wall.y2 - wall.y1,
          length = Math.hypot(dx, dz),
          height = wall.height ?? snapshot.referenceHeight
        top = Math.max(top, base + height / 1000)
        const pending =
          unresolvedCount([wall]) > 0 ||
          wall.openings.some((opening) => opening.height + opening.sill > height)
        const materialColor = materials.find((item) => item.id === wall.materialId)?.color
        const label = `${floorName} / ${wall.name} · 길이 ${Math.round(length)}mm · 두께 ${wall.thickness ?? `미정(참고 ${snapshot.referenceThickness})`}mm · 높이 ${wall.height ?? `미정(참고 ${snapshot.referenceHeight})`}mm · ${pending ? "미확정" : "확인 완료"}`
        for (const piece of wallPieces(wall, snapshot.referenceHeight)) {
          const actualHeight = cut
            ? Math.min(piece.height, Math.max(0, 1200 - piece.base))
            : piece.height
          if (actualHeight <= 0) continue
          const geometry = new THREE.BoxGeometry(
            piece.length / 1000,
            actualHeight / 1000,
            (wall.thickness ?? snapshot.referenceThickness) / 1000,
          )
          const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
              color: pending ? 0xd8a04d : colors && materialColor ? materialColor : 0xa7b8cb,
              roughness: 0.85,
              transparent: pending,
              opacity: pending ? 0.7 : 1,
            }),
          )
          const along = piece.start + piece.length / 2
          mesh.position.set(
            (wall.x1 + (dx / length) * along + snapshot.offsetX - centerX) / 1000,
            base + (piece.base + actualHeight / 2) / 1000,
            (wall.y1 + (dz / length) * along + snapshot.offsetY - centerZ) / 1000,
          )
          mesh.rotation.y = -Math.atan2(dz, dx)
          mesh.userData.label = label
          group.add(mesh)
          const outline = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: pending ? 0x9a5d08 : 0x516980 }),
          )
          outline.position.copy(mesh.position)
          outline.rotation.copy(mesh.rotation)
          group.add(outline)
        }
        for (const opening of wall.openings.filter((item) => item.kind === "window")) {
          const visibleHeight = cut
            ? Math.min(opening.height, Math.max(0, 1200 - opening.sill))
            : opening.height
          if (!visibleHeight) continue
          const glass = new THREE.Mesh(
            new THREE.BoxGeometry(opening.width / 1000, visibleHeight / 1000, 0.02),
            new THREE.MeshStandardMaterial({
              color: opening.confirmed ? 0x7dd3fc : 0xf59e0b,
              transparent: true,
              opacity: 0.35,
              depthWrite: false,
            }),
          )
          const along = opening.offset + opening.width / 2
          glass.position.set(
            (wall.x1 + (dx / length) * along + snapshot.offsetX - centerX) / 1000,
            base + (opening.sill + visibleHeight / 2) / 1000,
            (wall.y1 + (dz / length) * along + snapshot.offsetY - centerZ) / 1000,
          )
          glass.rotation.y = -Math.atan2(dz, dx)
          glass.userData.label = `${label} / ${opening.name} · ${opening.confirmed ? "확인" : "미확정"}`
          group.add(glass)
        }
      }
      const grid = new THREE.GridHelper(
        Math.max((maxX - minX) / 1000, (maxZ - minZ) / 1000, 5) * 1.3,
        20,
        0xa1b2c5,
        0xdbe4ef,
      )
      grid.position.y = base - 0.005
      group.add(grid)
    }
    radius = Math.max(2, Math.hypot((maxX - minX) / 1000, (maxZ - minZ) / 1000, top) / 2)
    centerHeight = top / 2
    const nextSignature = layers.map(({ snapshot }) => snapshot.id).join(",")
    if (nextSignature !== signature) {
      signature = nextSignature
      frame()
    }
    description = `${layers.map((layer) => layer.floorName).join(" / ")} · 미확정 ${layers.reduce((sum, layer) => sum + unresolvedCount(layer.snapshot.walls), 0)}개 · 참고 형상 포함`
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(40) / 2) * Math.max(1, 1.3 / camera.aspect)),
    )
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  frame()
  function render() {
    if (disposed) return
    controls.update()
    renderer.render(scene, camera)
    raf = requestAnimationFrame(render)
  }
  render()
  let start = { x: 0, y: 0 }
  const pointerDown = (event: PointerEvent) => {
    start = { x: event.clientX, y: event.clientY }
  }
  const pointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5 || event.button !== 0)
      return
    const bounds = renderer.domElement.getBoundingClientRect(),
      ray = new THREE.Raycaster()
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      camera,
    )
    const hit = ray
      .intersectObjects(group.children)
      .find((item) => typeof item.object.userData.label === "string")
    if (hit) onSelect(hit.object.userData.label as string)
  }
  const lost = (event: Event) => {
    event.preventDefault()
    onError("3D 표시가 중단되었습니다. 다시 불러오기를 눌러 주세요.")
  }
  renderer.domElement.addEventListener("pointerdown", pointerDown)
  renderer.domElement.addEventListener("pointerup", pointerUp)
  renderer.domElement.addEventListener("webglcontextlost", lost)
  return {
    setModels,
    frame,
    zoom: (factor) => {
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target)
      controls.update()
    },
    rotate: () => {
      const offset = camera.position
        .clone()
        .sub(controls.target)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 8)
      camera.position.copy(controls.target).add(offset)
      controls.update()
    },
    capture() {
      renderer.render(scene, camera)
      const canvas = document.createElement("canvas")
      canvas.width = renderer.domElement.width
      canvas.height = renderer.domElement.height + 80
      const context = canvas.getContext("2d")
      if (!context) return
      context.fillStyle = "white"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(renderer.domElement, 0, 0)
      context.fillStyle = "#334155"
      context.font = "16px sans-serif"
      context.fillText(description, 12, canvas.height - 48)
      context.fillText(
        "검토 기반 모델 · 주황: 미확정 · 격자는 층 기준면이며 슬래브 형상이 아닙니다.",
        12,
        canvas.height - 18,
      )
      const link = document.createElement("a")
      link.href = canvas.toDataURL()
      link.download = "현장-3D-검토모델.png"
      link.click()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener("pointerdown", pointerDown)
      renderer.domElement.removeEventListener("pointerup", pointerUp)
      renderer.domElement.removeEventListener("webglcontextlost", lost)
      release(group)
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
