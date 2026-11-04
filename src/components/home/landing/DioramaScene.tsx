'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

interface DioramaSceneProps {
  fallbackSrc: string
  showStoryNodes?: boolean
  authMode?: boolean
  onCameraStateChange?: (state: { theta: number; phi: number; radius: number }) => void
  resetCameraKey?: number
}
interface CameraTarget { theta: number; phi: number; radius: number; target: [number, number, number] }
interface StoryNode { id: string; label: string; description: string; href: string; x: number; y: number; z: number; camera: CameraTarget }
const DEFAULT_CAMERA_TARGET: CameraTarget = { theta: 0.35, phi: 1.12, radius: 7.2, target: [0, 0.55, 0] }
const MAX_CAMERA_RADIUS = DEFAULT_CAMERA_TARGET.radius
const nodes = [
  { id: 'studio', label: '主屋 · 工作室', description: '在山谷中央记录作品、实验与每天的灵感。', href: '/projects', x: 0.53, y: 0.44, z: 0.82, camera: { theta: 0.35, phi: 1.12, radius: 5.4, target: [0.35, 0.8, -0.42] } },
  { id: 'herbs', label: '溪边 · 草本集', description: '沿着溪流走一段，看看被水汽和植物包围的日常。', href: '/vibe', x: 0.28, y: 0.65, z: 0.48, camera: { theta: -0.9, phi: 1.2, radius: 5.2, target: [-1.1, 0.34, 0.5] } },
  { id: 'archive', label: '山坡 · 档案亭', description: '在树影更深的山坡上，收藏版本、笔记和时间留下的痕迹。', href: '/changelog', x: 0.78, y: 0.34, z: 0.34, camera: { theta: 1.1, phi: 0.98, radius: 5.8, target: [1.35, 0.92, 0.28] } },
] as const satisfies readonly StoryNode[]

function createSurfaceTexture(base: string, accent: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.fillStyle = base
  context.fillRect(0, 0, 128, 128)
  for (let index = 0; index < 90; index += 1) {
    const x = (index * 47) % 128
    const y = (index * 71) % 128
    context.fillStyle = `${accent}${index % 3 === 0 ? '99' : '55'}`
    context.fillRect(x, y, 1 + (index % 3), 1 + (index % 2))
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

type SurfaceMaterialProfile = 'wood' | 'roof' | 'stone' | 'moss' | 'soil' | 'path' | 'wet-stone'

function createSurfaceProfileMaps(profile: SurfaceMaterialProfile) {
  const settings = {
    wood: { base: '#a77a52', accent: '#5f4432', roughness: 176 },
    roof: { base: '#657364', accent: '#334239', roughness: 216 },
    stone: { base: '#858b84', accent: '#4c5650', roughness: 232 },
    moss: { base: '#68845f', accent: '#9bad72', roughness: 194 },
    soil: { base: '#83684d', accent: '#b29368', roughness: 214 },
    path: { base: '#aa8a68', accent: '#d4bc93', roughness: 224 },
    'wet-stone': { base: '#687b76', accent: '#a4b9aa', roughness: 202 },
  }[profile]
  const createMap = (draw: (context: CanvasRenderingContext2D) => void, colorSpace: string = THREE.NoColorSpace) => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) return new THREE.Texture()
    draw(context)
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(profile === 'wood' ? 1.8 : 2.4, profile === 'wood' ? 3.2 : 2.4)
    texture.colorSpace = colorSpace
    return texture
  }
  const color = createMap((context) => {
    context.fillStyle = settings.base
    context.fillRect(0, 0, 256, 256)
    const grain = profile === 'wood' ? 46 : profile === 'moss' ? 22 : profile === 'soil' ? 34 : 28
    const weathering = profile === 'roof' || profile === 'stone' || profile === 'wet-stone' ? 0.18 : 0.1
    for (let index = 0; index < grain; index += 1) {
      const x = (index * 67 + 19) % 256
      const y = (index * 43 + 31) % 256
      context.strokeStyle = `${settings.accent}${Math.round((0.2 + weathering * (index % 4)) * 255).toString(16).padStart(2, '0')}`
      context.lineWidth = profile === 'wood' ? 1 + (index % 3) : 2 + (index % 4)
      context.beginPath()
      if (profile === 'wood') {
        context.moveTo(0, y)
        context.bezierCurveTo(68, y - 8, 174, y + 7, 256, y - 2)
      } else {
        context.arc(x, y, 2 + (index % 5), 0, Math.PI * 2)
      }
      context.stroke()
    }
  }, THREE.SRGBColorSpace)
  const roughness = createMap((context) => {
    context.fillStyle = `rgb(${settings.roughness}, ${settings.roughness}, ${settings.roughness})`
    context.fillRect(0, 0, 256, 256)
    for (let index = 0; index < 64; index += 1) {
      const value = 132 + (index % 9) * 12
      const y = (index * 41) % 256
      context.strokeStyle = `rgb(${value}, ${value}, ${value})`
      context.lineWidth = 1 + (index % 2)
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(256, y + ((index % 5) - 2) * 4)
      context.stroke()
    }
  })
  const normal = createMap((context) => {
    context.fillStyle = 'rgb(128, 128, 255)'
    context.fillRect(0, 0, 256, 256)
    for (let index = 0; index < 44; index += 1) {
      const y = (index * 53) % 256
      context.strokeStyle = `rgb(${116 + (index % 5) * 7}, ${116 + (index % 4) * 8}, 255)`
      context.lineWidth = 1 + (index % 2)
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(256, y + ((index % 3) - 1) * 6)
      context.stroke()
    }
  })
  const ao = createMap((context) => {
    const gradient = context.createRadialGradient(128, 128, 38, 128, 128, 186)
    gradient.addColorStop(0, 'rgb(255, 255, 255)')
    gradient.addColorStop(0.72, 'rgb(220, 220, 220)')
    gradient.addColorStop(1, 'rgb(146, 146, 146)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
  })
  return { color, roughness, normal, ao }
}

function createSurfaceProfileMaterial(profile: SurfaceMaterialProfile) {
  const maps = createSurfaceProfileMaps(profile)
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: maps.color, roughness: profile === 'wet-stone' ? 0.62 : 0.88, metalness: 0 })
  material.normalMap = maps.normal
  material.roughnessMap = maps.roughness
  material.aoMap = maps.ao
  material.aoMapIntensity = profile === 'soil' || profile === 'moss' ? 0.78 : 0.92
  material.normalScale.set(profile === 'wood' ? 0.2 : 0.12, profile === 'wood' ? 0.2 : 0.12)
  return material
}

function createCloudTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.clearRect(0, 0, canvas.width, canvas.height)
  const puffs = [[54, 72, 46], [96, 54, 52], [142, 62, 58], [190, 74, 42]] as const
  for (const [x, y, radius] of puffs) {
    const gradient = context.createRadialGradient(x, y, radius * 0.12, x, y, radius)
    gradient.addColorStop(0, 'rgba(255, 252, 244, 0.62)')
    gradient.addColorStop(0.62, 'rgba(255, 250, 240, 0.34)')
    gradient.addColorStop(1, 'rgba(255, 250, 240, 0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

type CabinMaterialProfile = 'wood' | 'roof' | 'stone'

function createCabinPbrMaps(profile: CabinMaterialProfile) {
  return createSurfaceProfileMaps(profile)
}

function splitCabinGeometry(source: THREE.BufferGeometry, roofCutoff: number) {
  const geometry = source.index ? source.toNonIndexed() : source
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const buckets = {
    wood: { position: [] as number[], normal: [] as number[], uv: [] as number[] },
    roof: { position: [] as number[], normal: [] as number[], uv: [] as number[] },
  }
  for (let offset = 0; offset < position.count; offset += 3) {
    const averageY = (position.getY(offset) + position.getY(offset + 1) + position.getY(offset + 2)) / 3
    const bucket = averageY >= roofCutoff ? buckets.roof : buckets.wood
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const index = offset + vertex
      bucket.position.push(position.getX(index), position.getY(index), position.getZ(index))
      if (normal) bucket.normal.push(normal.getX(index), normal.getY(index), normal.getZ(index))
      if (uv) bucket.uv.push(uv.getX(index), uv.getY(index))
    }
  }
  const createGeometry = (attributes: typeof buckets.wood) => {
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.Float32BufferAttribute(attributes.position, 3))
    if (attributes.normal.length) result.setAttribute('normal', new THREE.Float32BufferAttribute(attributes.normal, 3))
    if (attributes.uv.length) {
      const uvAttribute = new THREE.Float32BufferAttribute(attributes.uv, 2)
      result.setAttribute('uv', uvAttribute)
      result.setAttribute('uv1', uvAttribute.clone())
    }
    return result
  }
  return { wood: createGeometry(buckets.wood), roof: createGeometry(buckets.roof) }
}

function createCabinMaterial(source: THREE.Material, maps: ReturnType<typeof createCabinPbrMaps>, profile: CabinMaterialProfile) {
  const profileSettings = {
    wood: { color: 0xfff1d8, roughness: 0.68, normal: 0.22 },
    roof: { color: 0xb8c7bd, roughness: 0.9, normal: 0.12 },
    stone: { color: 0xd0d1c8, roughness: 0.94, normal: 0.1 },
  }[profile]
  const material = source instanceof THREE.MeshStandardMaterial ? source.clone() : new THREE.MeshStandardMaterial({ color: 0xffffff })
  material.color.setHex(profileSettings.color)
  material.map = maps.color
  material.normalMap = maps.normal
  material.roughnessMap = maps.roughness
  material.aoMap = maps.ao
  material.normalScale.set(profileSettings.normal, profileSettings.normal)
  material.roughness = profileSettings.roughness
  material.metalness = 0
  material.aoMapIntensity = profile === 'stone' ? 0.88 : 0.72
  material.needsUpdate = true
  return material
}

const mat = (color: number, roughness = 0.82, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, roughness, map, flatShading: false })

function createGroundContactMaterial(color: number, roughness: number, map?: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({ color, roughness, map, aoMap: map, aoMapIntensity: 0.6, metalness: 0 })
  material.normalScale.set(0.16, 0.16)
  return material
}

function addContactShadow(group: THREE.Group, x: number, y: number, z: number, scale: number) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(scale, 16), new THREE.MeshBasicMaterial({ color: 0x2e3b2b, transparent: true, opacity: 0.16, depthWrite: false }))
  shadow.name = 'contact-shadow'
  shadow.userData.contactShadow = true
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(x, y + 0.008, z)
  shadow.scale.set(1.45, 0.72, 1)
  group.add(shadow)
  return shadow
}

function addTree(group: THREE.Group, x: number, z: number, scale = 1, barkTexture?: THREE.Texture) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.11 * scale, 0.65 * scale, 6), mat(0x73513a, 0.9, barkTexture))
  trunk.name = 'procedural-tree-trunk'
  trunk.position.set(x, 0.35 * scale, z)
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.42 * scale, 0.9 * scale, 7), mat(0x4f7a4b))
  crown.name = 'procedural-tree-crown'
  crown.userData.windPhase = x * 0.9 + z * 0.6
  crown.position.set(x, 0.95 * scale, z)
  group.add(trunk, crown)
}

function addMountainTree(group: THREE.Group, x: number, y: number, z: number, scale = 1, barkTexture?: THREE.Texture, variationSeed = 0) {
  const tree = new THREE.Group()
  tree.name = 'forest-tree'
  tree.position.set(x, y, z)
  tree.rotation.y = variationSeed * 0.83
  tree.rotation.z = Math.sin(variationSeed * 1.7) * 0.025
  addTree(tree, 0, 0, scale * (0.92 + (variationSeed % 3) * 0.055), barkTexture)
  group.add(tree)
}

function addGlow(group: THREE.Group, x: number, y: number, z: number, color = 0xffd879, scale = 1) {
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, roughness: 0.35 }))
  glow.position.set(x, y, z)
  group.add(glow)
  return glow
}

function createMountainGeometry(radius: number, height: number, seed: number) {
  const geometry = new THREE.ConeGeometry(radius, height, 10, 4)
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index)
    const heightRatio = THREE.MathUtils.clamp((y + height / 2) / height, 0, 1)
    const wobble = 1 + Math.sin(index * 2.17 + seed) * 0.1 * (1 - heightRatio)
    position.setX(index, position.getX(index) * wobble)
    position.setZ(index, position.getZ(index) * wobble)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function createContourBandGeometry(radiusX: number, radiusZ: number, y: number, thickness: number, seed: number) {
  const segments = 12
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    const wobble = 1 + Math.sin(index * 2.41 + seed) * 0.055 + Math.cos(index * 1.17 + seed * 0.7) * 0.035
    const outerX = Math.cos(angle) * radiusX * wobble
    const outerZ = Math.sin(angle) * radiusZ * wobble
    const innerX = Math.cos(angle) * radiusX * 0.73 * wobble
    const innerZ = Math.sin(angle) * radiusZ * 0.73 * wobble
    const vertex = index * 4
    positions.push(outerX, y + thickness * 0.5, outerZ, innerX, y + thickness * 0.5, innerZ, outerX, y - thickness * 0.5, outerZ, innerX, y - thickness * 0.5, innerZ)
    const next = ((index + 1) % segments) * 4
    indices.push(vertex, vertex + 1, next, vertex + 1, next + 1, next)
    indices.push(vertex, next, vertex + 2, next, next + 2, vertex + 2)
    indices.push(vertex + 1, vertex + 3, next + 1, vertex + 3, next + 3, next + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createGroundRibbonGeometry(points: THREE.Vector3[], widths: number[]) {
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)]
    const next = points[Math.min(points.length - 1, index + 1)]
    const tangent = next.clone().sub(previous)
    tangent.y = 0
    tangent.normalize()
    const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const halfWidth = (widths[index] ?? widths[widths.length - 1] ?? 0.5) / 2
    const left = points[index].clone().addScaledVector(perpendicular, halfWidth)
    const right = points[index].clone().addScaledVector(perpendicular, -halfWidth)
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z)
    if (index < points.length - 1) {
      const vertex = index * 2
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function terrainHeightAt(x: number, z: number) {
  const rearShoulder = Math.max(0, (z + 0.92) * 0.035)
  const cabinTerrace = Math.exp(-(((x - 0.45) ** 2) / 2.8 + ((z + 0.42) ** 2) / 1.75)) * 0.085
  const streamBasin = Math.exp(-(((x + 1.45) ** 2) / 2.6 + ((z + 0.12) ** 2) / 3.2)) * 0.055
  return rearShoulder + cabinTerrace - streamBasin
}

function createValleyTerrainGeometry(points: THREE.Vector3[], widths: number[], shoulderHeight: number) {
  const positions: number[] = []
  const indices: number[] = []
  const samplesPerPoint = 5
  const strips = samplesPerPoint - 1
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)]
    const next = points[Math.min(points.length - 1, index + 1)]
    const tangent = next.clone().sub(previous)
    tangent.y = 0
    tangent.normalize()
    const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const halfWidth = (widths[index] ?? widths[widths.length - 1] ?? 0.8) / 2
    const center = points[index]
    const samples = [
      center.clone().addScaledVector(perpendicular, -(halfWidth + 0.72)).setY(center.y + shoulderHeight),
      center.clone().addScaledVector(perpendicular, -halfWidth).setY(center.y + 0.035),
      center.clone().setY(center.y),
      center.clone().addScaledVector(perpendicular, halfWidth).setY(center.y + 0.035),
      center.clone().addScaledVector(perpendicular, halfWidth + 0.72).setY(center.y + shoulderHeight),
    ]
    samples.forEach((sample) => positions.push(sample.x, sample.y, sample.z))
    if (index < points.length - 1) {
      const vertex = index * samplesPerPoint
      for (let strip = 0; strip < strips; strip += 1) {
        const nextVertex = (index + 1) * samplesPerPoint + strip
        indices.push(vertex + strip, nextVertex, vertex + strip + 1, nextVertex, nextVertex + 1, vertex + strip + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createGarden() {
  const garden = new THREE.Group()
  const groundTexture = createSurfaceTexture('#718b5e', '#9db77d')
  const woodTexture = createSurfaceTexture('#765640', '#c29a6d')
  const barkTexture = createSurfaceTexture('#4f382b', '#8b6348')
  const roofTexture = createSurfaceTexture('#4e5f46', '#82916a')
  const stoneTexture = createSurfaceTexture('#788078', '#aeb1a1')
  const soilMaterial = createSurfaceProfileMaterial('soil')
  const mossMaterial = createSurfaceProfileMaterial('moss')
  const pathMaterial = createSurfaceProfileMaterial('path')
  const wetStoneMaterial = createSurfaceProfileMaterial('wet-stone')
  const stoneMaterial = createSurfaceProfileMaterial('stone')
  const streamStoneMaterial = createGroundContactMaterial(0x768078, 0.98, stoneTexture)
  const valleyForeground = new THREE.Group()
  valleyForeground.name = 'valley-foreground'
  const valleyMidground = new THREE.Group()
  valleyMidground.name = 'valley-midground'
  const valleyBackground = new THREE.Group()
  valleyBackground.name = 'valley-background'
  const creekBankVegetation = new THREE.Group()
  creekBankVegetation.name = 'creek-bank-vegetation'
  creekBankVegetation.userData.ecoZone = 'creek'
  const cabinClearance = new THREE.Group()
  cabinClearance.name = 'cabin-clearance'
  cabinClearance.userData.ecoZone = 'cabin'
  const slopeForest = new THREE.Group()
  slopeForest.name = 'slope-forest'
  slopeForest.userData.ecoZone = 'slope'
  valleyForeground.add(creekBankVegetation)
  valleyMidground.add(cabinClearance)
  valleyBackground.add(slopeForest)
  garden.add(valleyForeground, valleyMidground, valleyBackground)
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.2, 0.35, 12), mossMaterial)
  ground.position.y = -0.2; ground.scale.z = 0.72; ground.receiveShadow = true; garden.add(ground)
  const pathPoints = [new THREE.Vector3(-0.02, 0.035, 0.62), new THREE.Vector3(0.02, 0.032, 1.12), new THREE.Vector3(0.28, 0.029, 1.62), new THREE.Vector3(0.62, 0.025, 2.12), new THREE.Vector3(0.95, 0.02, 2.58)]
  pathPoints.forEach((pathPoint) => { pathPoint.y = terrainHeightAt(pathPoint.x, pathPoint.z) + 0.028 })
  const path = new THREE.Mesh(createGroundRibbonGeometry(pathPoints, [0.78, 0.9, 1.02, 0.82, 0.62]), pathMaterial)
  path.name = 'path-ribbon'
  path.receiveShadow = true
  valleyForeground.add(path)
  const streamPoints = [new THREE.Vector3(-2.72, 0.035, 1.58), new THREE.Vector3(-2.36, 0.03, 1.04), new THREE.Vector3(-1.92, 0.026, 0.58), new THREE.Vector3(-1.6, 0.022, 0.04), new THREE.Vector3(-1.37, 0.018, -0.52), new THREE.Vector3(-0.95, 0.014, -1.08), new THREE.Vector3(-0.56, 0.01, -1.72)]
  streamPoints.forEach((streamPoint) => { streamPoint.y = terrainHeightAt(streamPoint.x, streamPoint.z) - 0.018 })
  const streamWidths = [0.62, 0.9, 0.76, 0.94, 0.72, 0.88, 0.58]
  const streamBank = new THREE.Mesh(createGroundRibbonGeometry(streamPoints, streamWidths.map((width) => width + 0.34)), wetStoneMaterial)
  streamBank.name = 'stream-bank'
  streamBank.position.y = -0.006
  streamBank.receiveShadow = true
  valleyForeground.add(streamBank)
  const waterTexture = createSurfaceTexture('#6faab7', '#d9f1ea')
  if (waterTexture) waterTexture.repeat.set(1.2, 3.8)
  const stream = new THREE.Mesh(createGroundRibbonGeometry(streamPoints, streamWidths), new THREE.MeshStandardMaterial({ color: 0x78b8c4, map: waterTexture, transparent: true, opacity: 0.82, roughness: 0.24, metalness: 0.04 }))
  stream.name = 'stream'
  stream.receiveShadow = true
  valleyForeground.add(stream)
  for (const [x, y, z, scale] of [[-2.32, 0.08, 1.08, 0.12], [-1.82, 0.07, 0.42, 0.16], [-1.48, 0.06, -0.2, 0.1], [-1.12, 0.05, -0.83, 0.14], [-0.7, 0.045, -1.48, 0.09]] as const) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 1), streamStoneMaterial)
    stone.name = 'stream-stone'
    stone.position.set(x, y, z)
    stone.rotation.set(scale * 2, scale * 3, scale)
    stone.castShadow = true
    valleyForeground.add(stone)
    const ripple = new THREE.Mesh(new THREE.RingGeometry(scale * 0.88, scale * 1.2, 20), new THREE.MeshBasicMaterial({ color: 0xd9f2e9, transparent: true, opacity: 0.08, depthWrite: false }))
    ripple.name = 'stream-ripple'
    ripple.userData.phase = (x + z) * 2.4
    ripple.rotation.x = -Math.PI / 2
    ripple.position.set(x, terrainHeightAt(x, z) + 0.012, z)
    valleyForeground.add(ripple)
  }

  const house = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.78, 1.25), mat(0xffffff, 0.82, woodTexture)); base.position.y = 0.48; base.castShadow = true
  const upper = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.5, 1.02), mat(0xd8c7a2, 0.86, woodTexture)); upper.position.set(0.08, 1.1, -0.04); upper.castShadow = true
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.48, 0.82, 4), mat(0xffffff, 0.78, roofTexture)); roof.rotation.y = Math.PI / 4 + 0.18; roof.position.set(-0.08, 1.62, -0.02); roof.scale.z = 0.82; roof.castShadow = true
  const eave = new THREE.Mesh(new THREE.TorusGeometry(1.13, 0.08, 5, 9), mat(0x7d4e3e)); eave.rotation.x = Math.PI / 2; eave.position.y = 1.33; eave.scale.z = 0.82
  const porch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.55), mat(0x8b684d)); porch.position.set(0, 0.2, 0.82)
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.62, 8), mat(0x614333)); door.scale.z = 0.18; door.position.set(0.08, 0.47, 0.88)
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), mat(0x9a584c)); chimney.position.set(-0.55, 1.38, -0.12)
  const chimneyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 6), mat(0x784239)); chimneyCap.position.set(-0.55, 1.68, -0.12)
  house.add(base, upper, roof, eave, porch, door, chimney, chimneyCap)
  for (const x of [-0.58, 0.58]) {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 5, 8), mat(0x6d4935))
    const window = new THREE.Mesh(new THREE.CircleGeometry(0.14, 8), new THREE.MeshStandardMaterial({ color: 0xffc96f, emissive: 0x8b572f, emissiveIntensity: 0.7, roughness: 0.6 }))
    frame.position.set(x * 0.8, 0.64, 0.78); window.position.set(x * 0.8, 0.64, 0.79); frame.rotation.x = Math.PI / 2; window.rotation.x = Math.PI / 2; house.add(frame, window)
  }
  const dormer = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.28, 3), mat(0x9a624b)); dormer.position.set(0.32, 1.68, -0.38); dormer.rotation.y = Math.PI; house.add(dormer)
  const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ color: 0xffc96f, emissive: 0xffa338, emissiveIntensity: 0.8 }))
  lantern.position.set(0.7, 0.58, 0.95); house.add(lantern)
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.04), mat(0xf0c77f)); sign.position.set(0, 1.34, 0.78); house.add(sign)
  house.name = 'procedural-house'
  house.position.set(0.45, terrainHeightAt(0.45, -0.42), -0.42); valleyMidground.add(house)

  const cabinTerrace = new THREE.Mesh(new THREE.CylinderGeometry(1.56, 1.82, 0.12, 16), soilMaterial)
  cabinTerrace.name = 'cabin-terrace'
  cabinTerrace.position.set(0.45, terrainHeightAt(0.45, -0.42) - 0.055, -0.42)
  cabinTerrace.scale.z = 0.7
  cabinTerrace.receiveShadow = true
  valleyMidground.add(cabinTerrace)
  for (const [x, z, scale] of [[-0.92, -0.12, 0.42], [1.46, -0.2, 0.34], [-0.86, -1.02, 0.3], [1.32, -0.94, 0.26]] as const) {
    const grass = new THREE.Mesh(new THREE.ConeGeometry(0.045 * scale, 0.26 * scale, 5), mat(0x58724d, 0.94))
    grass.name = 'cabin-clearance-grass'
    grass.position.set(x, terrainHeightAt(x, z) + 0.1 * scale, z)
    grass.userData.ecoZone = 'cabin'
    cabinClearance.add(grass)
  }
  const terraceShadow = addContactShadow(valleyMidground, 0.45, terrainHeightAt(0.45, -0.42), -0.42, 1.22)
  terraceShadow.name = 'terrace-contact-shadow'

  const smoke = new THREE.Group()
  smoke.name = 'smoke'
  for (const [index, [x, y, z, scale]] of [[-0.1, 2.03, -0.55, 0.22], [-0.03, 2.32, -0.53, 0.3], [0.08, 2.62, -0.5, 0.18]].entries()) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(scale, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf3eadf, transparent: true, opacity: 0.28, roughness: 1 }))
    puff.position.set(x, y, z)
    puff.userData.baseX = x
    puff.userData.baseY = y
    puff.userData.baseZ = z
    puff.userData.windPhase = index * 0.84
    smoke.add(puff)
  }
  valleyMidground.add(smoke)

  const giantTree = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.8, 9), mat(0x6f5039)); trunk.position.set(-1.65, 1.25, -0.4); trunk.rotation.z = -0.12; giantTree.add(trunk)
  for (const angle of [-0.8, -0.25, 0.35]) { const root = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.18, 1.2, 6), mat(0x6f5039)); root.position.set(-1.65 + Math.cos(angle) * 0.5, 0.22, -0.4 + Math.sin(angle) * 0.5); root.rotation.z = angle - Math.PI / 2; giantTree.add(root) }
  for (const [x, y, z, scale] of [[-1.7, 2.9, -0.4, 1.1], [-2.35, 2.65, -0.25, 0.8], [-1.15, 2.62, -0.45, 0.85]] as const) { const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72 * scale, 1), mat(0x466f45)); crown.position.set(x, y, z); giantTree.add(crown) }
  valleyBackground.add(giantTree)

  for (const tree of [[-1.9, 0.1, 1], [-1.45, -1.1, 0.8], [1.9, 0.15, 1.1], [2.1, 1.1, 0.75], [-2.7, -0.7, 0.75]] as const) addTree(valleyMidground, tree[0], tree[1], tree[2], barkTexture)
  const valleyPoints = [
    new THREE.Vector3(-3.1, -0.015, -1.48),
    new THREE.Vector3(-1.95, -0.012, -1.72),
    new THREE.Vector3(-0.65, -0.01, -1.86),
    new THREE.Vector3(0.75, -0.012, -1.82),
    new THREE.Vector3(2.35, -0.015, -1.5),
  ]
  const valleyWidths = [0.9, 1.5, 1.9, 1.55, 0.95]
  const valleyFloorPoints = valleyPoints.map((point) => point.clone().setY(terrainHeightAt(point.x, point.z) - 0.012))
  const valleyFloor = new THREE.Mesh(createValleyTerrainGeometry(valleyFloorPoints, valleyWidths, 0.16), mossMaterial)
  valleyFloor.name = 'forest-valley'
  valleyFloor.receiveShadow = true
  valleyMidground.add(valleyFloor)
  const valleyShoulder = new THREE.Mesh(createGroundRibbonGeometry(valleyFloorPoints.map((point) => point.clone().setY(point.y + 0.05)), valleyWidths.map((width) => width + 1.34)), stoneMaterial)
  valleyShoulder.name = 'forest-valley-shoulder'
  valleyShoulder.receiveShadow = true
  valleyMidground.add(valleyShoulder)

  const mountainRidge = new THREE.Group()
  mountainRidge.name = 'mountain-ridge'
  const mountainPlacements = [[-2.2, -0.7, 1.6, 0.2], [2.2, -0.55, 1.45, 1.1], [-2.8, 0.75, 1.15, 2.2], [2.75, 0.95, 1.05, 3.4]] as const
  for (const [x, z, scale, seed] of mountainPlacements) {
    const mountain = new THREE.Mesh(createMountainGeometry(1.3 * scale, 2.25 * scale, seed), mat(0x739b72, 0.96))
    mountain.position.set(x, 0.85 * scale, z)
    mountain.scale.z = 0.65
    mountain.castShadow = true
    mountain.receiveShadow = true
    mountainRidge.add(mountain)
    for (const [tier, radiusFactor, color] of [[0.22, 1.06, 0x668660], [0.5, 0.84, 0x587a59]] as const) {
      const slope = new THREE.Mesh(createContourBandGeometry(1.3 * scale * radiusFactor, 0.84 * scale * radiusFactor, tier * scale, 0.16 * scale, seed + tier), mat(color, 0.98, groundTexture))
      slope.name = 'mountain-slope-layer'
      slope.position.set(x, 0, z)
      slope.castShadow = true
      slope.receiveShadow = true
      mountainRidge.add(slope)
    }
  }
  valleyBackground.add(mountainRidge)
  const mountainForest = new THREE.Group()
  mountainForest.name = 'mountain-forest'
  for (const [x, y, z, scale, variationSeed] of [
    [-3.25, 0.02, -1.1, 0.8, 1], [-2.95, 0.2, -0.68, 0.62, 2], [-3.1, 0.05, 0.18, 0.76, 3], [-2.65, 0.12, 0.82, 0.56, 4],
    [3.18, 0.02, -1.02, 0.72, 5], [2.9, 0.18, -0.58, 0.58, 6], [3.08, 0.04, 0.28, 0.68, 7], [2.64, 0.1, 0.86, 0.52, 8],
  ] as const) addMountainTree(mountainForest, x, y, z, scale, barkTexture, variationSeed)
  mountainForest.userData.ecoZone = 'slope'
  slopeForest.add(mountainForest)
  const forestUnderstory = new THREE.Group()
  forestUnderstory.name = 'forest-understory'
  forestUnderstory.userData.ecoZone = 'creek'
  for (const [x, z, scale, rotation] of [
    [-2.38, 0.94, 0.65, -0.35], [-2.08, 1.24, 0.5, 0.2], [-1.15, 1.52, 0.42, -0.15],
    [1.28, 1.34, 0.48, 0.32], [2.08, 0.94, 0.58, -0.22], [2.45, 0.48, 0.46, 0.4],
  ] as const) {
    const fern = new THREE.Group()
    fern.userData.ecoZone = 'creek'
    fern.userData.windPhase = (x * 1.7 + z * 0.9) * 0.8
    fern.userData.isUnderstory = true
    fern.userData.baseRotationZ = 0
    fern.position.set(x, 0.045, z)
    fern.rotation.y = rotation
    for (const angle of [-0.7, -0.25, 0.2, 0.68]) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.065 * scale, 0.42 * scale, 5), mat(0x496a4a, 0.96))
      frond.position.set(Math.sin(angle) * 0.11 * scale, 0.18 * scale, Math.cos(angle) * 0.08 * scale)
      frond.rotation.z = angle
      fern.add(frond)
    }
    forestUnderstory.add(fern)
  }
  creekBankVegetation.add(forestUnderstory)
  for (const [x, z, scale] of [[-3.25, -1.1, 0.32], [-2.95, -0.68, 0.26], [-2.38, 0.94, 0.22], [2.9, -0.58, 0.26], [3.08, 0.28, 0.24], [2.08, 0.94, 0.2]] as const) addContactShadow(valleyForeground, x, 0, z, scale)
  for (const [x, z, scale] of [[-1.15, 0.9, 0.45], [-1.6, 1.25, 0.3], [1.55, 0.55, 0.38], [0.9, 1.45, 0.28]] as const) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 1), mat(0xffffff, 0.98, stoneTexture)); rock.position.set(x, scale * 0.45, z); valleyForeground.add(rock)
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.55), mat(0x9b684b)); bridge.position.set(-1.45, 0.1, 0.3); bridge.rotation.y = -0.52; valleyMidground.add(bridge)
  for (const side of [-0.4, 0.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.62), mat(0x76503c)); rail.position.set(-1.45 + side * 0.5, 0.28, 0.3); rail.rotation.y = -0.52; valleyMidground.add(rail)
  }
  const fence = new THREE.Group()
  for (let index = -2; index <= 2; index += 1) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), mat(0xb58a63)); post.position.set(index * 0.34 + 0.55, 0.2, 1.75); fence.add(post) }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08), mat(0xb58a63)); rail.position.set(0.55, 0.3, 1.75); fence.add(rail); valleyMidground.add(fence)
  for (const [x, z, scale] of [[-0.95, 1.18, 0.8], [-1.2, 1.4, 0.55], [1.25, 0.75, 0.65]] as const) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * scale, 0.035 * scale, 0.18 * scale, 6), mat(0xf0dfb6)); stem.position.set(x, 0.11 * scale, z)
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.12 * scale, 7), mat(0xc76555)); cap.position.set(x, 0.22 * scale, z); garden.add(stem, cap)
  }
  for (const [x, z, color] of [[-0.15, 1.28, 0xf4b3c2], [0.1, 1.34, 0xf7d67a], [0.35, 1.26, 0xd4a7e8], [0.78, 0.92, 0xf4b3c2]] as const) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.22, 5), mat(0x4f7a4b)); stem.position.set(x, 0.12, z)
    const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.9 })); flower.position.set(x, 0.25, z); garden.add(stem, flower)
  }
  for (const point of [[-1.9, 1.8, -0.55], [-1.25, 1.6, 0.5], [1.4, 0.5, 0.9], [0.8, 0.55, -0.1]] as const) {
    const glow = addGlow(garden, point[0], point[1], point[2], 0xffd879, 0.8)
    glow.name = 'glow'
  }
  for (const [x, y, z] of [[-1.1, 0.8, 0.5], [-0.5, 1.05, 1.15], [1.45, 0.7, 0.65], [1.85, 1.2, -0.1], [-2.15, 1.35, 0.55], [0.15, 1.55, 0.6]] as const) {
    const firefly = addGlow(garden, x, y, z, 0xffe39a, 0.42)
    firefly.name = 'firefly'
    firefly.userData.baseX = x
    firefly.userData.baseY = y
    firefly.userData.baseZ = z
  }
  const cloud = new THREE.Group()
  const cloudTexture = createCloudTexture()
  cloud.userData.texture = cloudTexture
  const cloudBack = new THREE.Group()
  cloudBack.name = 'cloud-layer-back'
  const cloudFront = new THREE.Group()
  cloudFront.name = 'cloud-layer-front'
  for (const [x, y, z, scale, opacity] of [[-2.8, 3.65, -4.8, 1.35, 0.26], [1.6, 3.9, -5.3, 1.08, 0.2]] as const) {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, color: 0xf4f7f1, transparent: true, opacity, depthWrite: false, fog: true }))
    puff.position.set(x, y, z)
    puff.scale.set(2.85 * scale, 0.64 * scale, 1)
    cloudBack.add(puff)
  }
  for (const [x, y, z, scale, opacity] of [[-2.3, 3.05, -2.5, 0.88, 0.42], [-0.05, 3.38, -2.8, 0.68, 0.34], [2.35, 3.08, -2.1, 0.78, 0.38]] as const) {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, color: 0xfff8e9, transparent: true, opacity, depthWrite: false, fog: true }))
    puff.position.set(x, y, z)
    puff.scale.set(2.05 * scale, 0.72 * scale, 1)
    cloudFront.add(puff)
  }
  cloud.add(cloudBack, cloudFront)
  cloud.name = 'cloud'
  valleyBackground.add(cloud)
  valleyMidground.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || !(object.material instanceof THREE.MeshStandardMaterial)) return
    object.material.roughness = Math.max(object.material.roughness, 0.82)
    object.material.color.multiplyScalar(1.02)
  })
  valleyBackground.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || !(object.material instanceof THREE.MeshStandardMaterial)) return
    object.material.color.multiplyScalar(0.88)
    object.material.roughness = Math.max(object.material.roughness, 0.96)
  })
  return garden
}

function setFallbackVisibility(root: THREE.Object3D, visible: boolean, part: 'cabin' | 'trees') {
  const fallbackNames = part === 'cabin' ? new Set(['procedural-house']) : new Set(['procedural-tree-trunk', 'procedural-tree-crown'])
  root.traverse((object) => {
    if (fallbackNames.has(object.name)) object.visible = visible
  })
}

interface AuthoredReveal { object: THREE.Object3D; baseScale: THREE.Vector3; startedAt: number | null }

export function DioramaScene({
  fallbackSrc,
  showStoryNodes = true,
  authMode = false,
  onCameraStateChange,
  resetCameraKey = 0,
}: DioramaSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraStateCallbackRef = useRef(onCameraStateChange)
  const resetCameraKeyRef = useRef(resetCameraKey)
  const authModeRef = useRef(authMode)
  const [fallback, setFallback] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [activeNode, setActiveNode] = useState<string | null>(null)
  const storySelectionRef = useRef<CameraTarget | null>(null)
  const storyPinnedRef = useRef(false)
  const selectStoryNode = (node: StoryNode) => { storySelectionRef.current = node.camera; storyPinnedRef.current = true; setActiveNode(node.id) }
  const returnToPanorama = () => { storySelectionRef.current = DEFAULT_CAMERA_TARGET; storyPinnedRef.current = false; setActiveNode(null); onCameraStateChange?.({ theta: DEFAULT_CAMERA_TARGET.theta, phi: DEFAULT_CAMERA_TARGET.phi, radius: DEFAULT_CAMERA_TARGET.radius }) }
  useEffect(() => {
    cameraStateCallbackRef.current = onCameraStateChange
    resetCameraKeyRef.current = resetCameraKey
    authModeRef.current = authMode
  }, [authMode, onCameraStateChange, resetCameraKey])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ambientMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }) } catch { queueMicrotask(() => setFallback(true)); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xbfd9df); scene.fog = new THREE.Fog(0xcbd7d4, 6.5, 14.5)
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40); const garden = createGarden(); setFallbackVisibility(garden, false, 'cabin'); setFallbackVisibility(garden, false, 'trees'); garden.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true }); scene.add(garden)
    const sky = new Sky()
    sky.name = 'sky-dome'
    sky.scale.setScalar(30)
    const skyUniforms = sky.material.uniforms
    skyUniforms.turbidity.value = 5.4
    skyUniforms.rayleigh.value = 1.35
    skyUniforms.mieCoefficient.value = 0.003
    skyUniforms.mieDirectionalG.value = 0.72
    const sunElevation = 0.64
    const sunDirection = new THREE.Vector3(-5.2, 4.4 + sunElevation * 2.4, 3.4).normalize()
    skyUniforms.sunPosition.value.copy(sunDirection.clone().multiplyScalar(12))
    scene.add(sky)
    let disposed = false
    let entryLight: THREE.PointLight | undefined
    const authoredTrees: THREE.Group[] = []
    const authoredReveals: AuthoredReveal[] = []
    const revealDuration = ambientMotion === 0 ? 0 : 0.72
    const registerReveal = (object: THREE.Object3D) => {
      const baseScale = object.scale.clone()
      object.scale.copy(baseScale).multiplyScalar(0.965)
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        const preparedMaterials = materials.map((material) => {
          const prepared = material.clone()
          prepared.transparent = true
          prepared.opacity = 0
          prepared.depthWrite = false
          prepared.needsUpdate = true
          return prepared
        })
        child.material = Array.isArray(child.material) ? preparedMaterials : preparedMaterials[0]
      })
      authoredReveals.push({ object, baseScale, startedAt: null })
    }
    const updateReveals = (elapsed: number) => {
      for (let index = authoredReveals.length - 1; index >= 0; index -= 1) {
        const reveal = authoredReveals[index]
        if (reveal.startedAt === null) reveal.startedAt = elapsed
        const progress = revealDuration === 0 ? 1 : THREE.MathUtils.smoothstep((elapsed - reveal.startedAt) / revealDuration, 0, 1)
        reveal.object.scale.copy(reveal.baseScale).multiplyScalar(0.965 + progress * 0.035)
        reveal.object.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material) => { material.opacity = progress; material.depthWrite = progress >= 1 })
        })
        if (progress >= 1) authoredReveals.splice(index, 1)
      }
    }
    const modelLoader = new GLTFLoader()
    const cabinPbrMaps = {
      wood: createCabinPbrMaps('wood'),
      roof: createCabinPbrMaps('roof'),
      stone: createCabinPbrMaps('stone'),
    }
    const loadModel = (path: string) => new Promise<THREE.Group>((resolve, reject) => {
      modelLoader.load(path, (gltf) => resolve(gltf.scene), undefined, reject)
    })
    void Promise.all([
      loadModel('/models/kenney-mini-forest/tree-high.glb'),
      loadModel('/models/kenney-mini-forest/tree.glb'),
    ]).then(([tallTree, smallTree]) => {
      if (disposed) return
      const placements = [
        [tallTree, -2.2, -0.25, 1.08],
        [tallTree, 2.15, -0.35, 0.92],
        [tallTree, -2.65, 0.65, 0.82],
        [smallTree, -1.65, -1.05, 0.92],
        [smallTree, 1.72, 0.35, 0.88],
        [smallTree, 2.6, 0.78, 0.76],
        [tallTree, -3.2, -1.08, 0.72],
        [smallTree, -2.92, -0.66, 0.62],
        [smallTree, -2.72, 0.82, 0.56],
        [tallTree, 3.14, -1.02, 0.68],
        [smallTree, 2.88, -0.56, 0.58],
        [smallTree, 2.68, 0.84, 0.52],
      ] as const
      for (const [source, x, z, scale] of placements) {
        const tree = source.clone(true)
        tree.name = 'authored-tree'
        tree.position.set(x, 0, z)
        tree.scale.setScalar(scale)
        tree.userData.baseRotationZ = Math.sin((x + z) * 2.7) * 0.018
        tree.userData.ecoZone = 'slope'
        tree.userData.windPhase = (x * 0.8 + z * 1.1) * 0.7
        tree.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.castShadow = true
          object.receiveShadow = true
        })
        registerReveal(tree)
        authoredTrees.push(tree)
        const slopeForest = garden.getObjectByName('slope-forest')
        if (slopeForest) slopeForest.add(tree)
        else garden.add(tree)
      }
    }).catch(() => {
      // Keep the procedural trees as fallback visibility when the authored assets are unavailable.
      setFallbackVisibility(garden, true, 'trees')
    })
    void loadModel('/models/poly-pizza-log-cabin/log-cabin.glb').then((cabin) => {
      if (disposed) return
      cabin.name = 'poly-pizza-log-cabin'
      cabin.rotation.y = Math.PI * 0.12
      const rawBounds = new THREE.Box3().setFromObject(cabin)
      const rawSize = rawBounds.getSize(new THREE.Vector3())
      const footprint = Math.max(rawSize.x, rawSize.z)
      const roofCutoff = rawBounds.min.y + rawSize.y * 0.58
      cabin.scale.setScalar(2.35 / footprint)
      const fittedBounds = new THREE.Box3().setFromObject(cabin)
      const fittedCenter = fittedBounds.getCenter(new THREE.Vector3())
      cabin.position.set(0.45 - fittedCenter.x, terrainHeightAt(0.45, -0.42) - fittedBounds.min.y, -0.42 - fittedCenter.z)
      const cottage = cabin.getObjectByName('Cottage_1')
      if (cottage instanceof THREE.Mesh && cottage.parent) {
        const sourceMaterial = Array.isArray(cottage.material) ? cottage.material[0] : cottage.material
        const split = splitCabinGeometry(cottage.geometry, roofCutoff)
        const woodMesh = new THREE.Mesh(split.wood, createCabinMaterial(sourceMaterial, cabinPbrMaps.wood, 'wood'))
        const roofMesh = new THREE.Mesh(split.roof, createCabinMaterial(sourceMaterial, cabinPbrMaps.roof, 'roof'))
        woodMesh.name = 'cabin-wood'
        roofMesh.name = 'cabin-roof'
        woodMesh.castShadow = true
        woodMesh.receiveShadow = true
        roofMesh.castShadow = true
        roofMesh.receiveShadow = true
        cottage.parent.add(woodMesh, roofMesh)
        cottage.visible = false
        cottage.geometry.dispose()
      }
      cabin.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        object.castShadow = true
        object.receiveShadow = true
        const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material
        const objectName = object.name.toLowerCase()
        const profileName: CabinMaterialProfile = object.name === 'cabin-roof' ? 'roof' : objectName.includes('door') || object.name === 'cabin-wood' ? 'wood' : 'stone'
        const profile = cabinPbrMaps[profileName]
        const uv = object.geometry.getAttribute('uv')
        if (uv && !object.geometry.getAttribute('uv1')) object.geometry.setAttribute('uv1', uv.clone())
        object.material = createCabinMaterial(sourceMaterial, profile, profileName)
      })
      const details = new THREE.Group()
      details.name = 'cabin-details'
      details.position.set(0.45, terrainHeightAt(0.45, -0.42), -0.42)
      details.rotation.y = cabin.rotation.y
      const stoneMaterial = createCabinMaterial(new THREE.MeshStandardMaterial({ color: 0x747a72, roughness: 0.96 }), cabinPbrMaps.stone, 'stone')
      const foundation = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 2.02), stoneMaterial)
      foundation.name = 'cabin-foundation'
      foundation.position.y = 0.07
      foundation.castShadow = true
      foundation.receiveShadow = true
      const firstStep = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.34), stoneMaterial)
      firstStep.name = 'cabin-entrance-step'
      firstStep.position.set(-0.34, 0.15, 1.05)
      firstStep.castShadow = true
      firstStep.receiveShadow = true
      const secondStep = firstStep.clone()
      secondStep.position.set(-0.34, 0.08, 1.34)
      const lanternMaterial = new THREE.MeshStandardMaterial({ color: 0xffc16e, emissive: 0xff8a3d, emissiveIntensity: 1.2, roughness: 0.42 })
      const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 1), lanternMaterial)
      lantern.name = 'cabin-entry-lantern'
      lantern.position.set(-0.34, 0.78, 0.95)
      const cabinEntryLight = new THREE.PointLight(0xffb35d, 1.15, 3.2, 2)
      cabinEntryLight.name = 'cabin-entry-light'
      cabinEntryLight.position.copy(lantern.position)
      details.add(foundation, firstStep, secondStep, lantern, cabinEntryLight)
      registerReveal(details)
      entryLight = cabinEntryLight
      const valleyMidground = garden.getObjectByName('valley-midground')
      if (valleyMidground) valleyMidground.add(details)
      else garden.add(details)
      const smokeGroup = garden.getObjectByName('smoke')
      if (smokeGroup) smokeGroup.position.set(0.5, -0.55, -0.1)
      if (valleyMidground) valleyMidground.add(cabin)
      else garden.add(cabin)
      registerReveal(cabin)
      const fallbackHouse = garden.getObjectByName('procedural-house')
      if (fallbackHouse) fallbackHouse.visible = false
    }).catch(() => {
      // Keep the authored procedural house visible when the local asset is unavailable.
      setFallbackVisibility(garden, true, 'cabin')
    })
    scene.add(new THREE.HemisphereLight(0xb9d2df, 0x4e5a4d, 1.35)); const sun = new THREE.DirectionalLight(0xffd7ad, 2.55); sun.position.copy(sunDirection.clone().multiplyScalar(8)); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -6; sun.shadow.camera.right = 6; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6; sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 20; sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.025; scene.add(sun)
    const windowLight = new THREE.PointLight(0xffb45f, 1.4, 4.5, 2)
    windowLight.position.set(0.7, 0.9, 0.65)
    scene.add(windowLight)
    const clock = new THREE.Clock()
    const stream = garden.getObjectByName('stream') as THREE.Mesh | undefined
    const streamMaterial = stream ? stream.material as THREE.MeshStandardMaterial : undefined
    const waterTexture = streamMaterial?.map
    const cloud = garden.getObjectByName('cloud')
    const cloudTexture = cloud?.userData.texture as THREE.Texture | undefined
    const cloudBack = cloud?.getObjectByName('cloud-layer-back')
    const cloudFront = cloud?.getObjectByName('cloud-layer-front')
    const valleyBackground = garden.getObjectByName('valley-background')
    const smoke = garden.getObjectByName('smoke')
    const animatedCrowns: THREE.Object3D[] = []
    const understoryFerns: THREE.Object3D[] = []
    const streamRipples: THREE.Mesh[] = []
    garden.traverse((object) => {
      if (object.name === 'procedural-tree-crown') animatedCrowns.push(object)
      if (object.userData.isUnderstory) understoryFerns.push(object)
      if (object.name === 'stream-ripple' && object instanceof THREE.Mesh) streamRipples.push(object)
    })
    const windField = {
      sample: (elapsed: number, windPhase: number, amplitude: number) => ({
        x: Math.sin(elapsed * 0.7 + windPhase) * amplitude,
        z: Math.cos(elapsed * 0.48 + windPhase * 1.3) * amplitude * 0.55,
        sway: Math.sin(elapsed * 0.92 + windPhase * 0.7) * amplitude,
      }),
    }
    const glows = garden.children.filter((object) => object.name === 'glow') as THREE.Mesh[]
    const fireflies = garden.children.filter((object) => object.name === 'firefly') as THREE.Mesh[]
    const orbit = { theta: DEFAULT_CAMERA_TARGET.theta, phi: DEFAULT_CAMERA_TARGET.phi, radius: DEFAULT_CAMERA_TARGET.radius }; const lookTarget = new THREE.Vector3(...DEFAULT_CAMERA_TARGET.target); let cameraTarget: CameraTarget = DEFAULT_CAMERA_TARGET; let cameraTransitionActive = false; let dragging = false; let lastX = 0; let lastY = 0; let cameraInertiaTheta = 0; let cameraInertiaPhi = 0; let observedResetCameraKey = resetCameraKey
    const emitCameraState = () => { cameraStateCallbackRef.current?.({ theta: orbit.theta, phi: orbit.phi, radius: orbit.radius }) }
    const updateCamera = () => { camera.position.set(orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta), orbit.radius * Math.cos(orbit.phi), orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta)); camera.lookAt(lookTarget) }
    updateCamera()
    const resize = () => { const width = canvas.clientWidth; const height = canvas.clientHeight; if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix() }
    let frame = 0
    const render = () => {
      const elapsed = clock.getElapsedTime()
      if (resetCameraKeyRef.current !== observedResetCameraKey) {
        observedResetCameraKey = resetCameraKeyRef.current
        orbit.theta = DEFAULT_CAMERA_TARGET.theta
        orbit.phi = DEFAULT_CAMERA_TARGET.phi
        orbit.radius = DEFAULT_CAMERA_TARGET.radius
        lookTarget.set(...DEFAULT_CAMERA_TARGET.target)
        cameraTarget = DEFAULT_CAMERA_TARGET
        cameraTransitionActive = false
        cameraInertiaTheta = 0
        cameraInertiaPhi = 0
        storySelectionRef.current = null
        storyPinnedRef.current = false
        setActiveNode(null)
        setZoom(1)
        updateCamera()
        emitCameraState()
      }
      const requestedCameraTarget = storySelectionRef.current
      if (requestedCameraTarget && requestedCameraTarget !== cameraTarget) { cameraTarget = requestedCameraTarget; cameraTransitionActive = true }
      if (cameraTransitionActive) {
        if (ambientMotion === 0) {
          orbit.theta = cameraTarget.theta
          orbit.phi = cameraTarget.phi
          orbit.radius = cameraTarget.radius
          lookTarget.set(...cameraTarget.target)
          cameraTransitionActive = false
        } else {
          orbit.theta = THREE.MathUtils.damp(orbit.theta, cameraTarget.theta, 5.5, 1 / 60)
          orbit.phi = THREE.MathUtils.damp(orbit.phi, cameraTarget.phi, 5.5, 1 / 60)
          orbit.radius = THREE.MathUtils.damp(orbit.radius, cameraTarget.radius, 5.5, 1 / 60)
          lookTarget.x = THREE.MathUtils.damp(lookTarget.x, cameraTarget.target[0], 5.5, 1 / 60)
          lookTarget.y = THREE.MathUtils.damp(lookTarget.y, cameraTarget.target[1], 5.5, 1 / 60)
          lookTarget.z = THREE.MathUtils.damp(lookTarget.z, cameraTarget.target[2], 5.5, 1 / 60)
          if (Math.abs(orbit.theta - cameraTarget.theta) < 0.002 && Math.abs(orbit.phi - cameraTarget.phi) < 0.002 && Math.abs(orbit.radius - cameraTarget.radius) < 0.01) cameraTransitionActive = false
        }
        updateCamera()
      }
      if (!dragging && authModeRef.current && ambientMotion > 0 && !cameraTransitionActive) {
        cameraInertiaTheta *= 0.9
        cameraInertiaPhi *= 0.9
        if (Math.abs(cameraInertiaTheta) > 0.0001 || Math.abs(cameraInertiaPhi) > 0.0001) {
          orbit.theta += cameraInertiaTheta
          orbit.phi = THREE.MathUtils.clamp(orbit.phi + cameraInertiaPhi, 0.68, 1.55)
          updateCamera()
          emitCameraState()
        }
      }
      if (authModeRef.current && ambientMotion > 0) garden.position.y = Math.sin(elapsed * 0.45) * 0.004
      updateReveals(elapsed)
      if (stream && streamMaterial) {
        streamMaterial.opacity = 0.76 + Math.sin(elapsed * 2.4) * 0.07 * ambientMotion
      }
      if (waterTexture) {
        const streamTangent = (elapsed * 0.035 * ambientMotion) % 1
        waterTexture.offset.x = streamTangent
        waterTexture.offset.y = (elapsed * 0.012 * ambientMotion) % 1
      }
      streamRipples.forEach((ripple, index) => {
        const windPhase = Number(ripple.userData.phase ?? index)
        const pulse = (Math.sin(elapsed * 1.65 + windPhase) + 1) / 2
        const rippleMaterial = ripple.material as THREE.MeshBasicMaterial
        rippleMaterial.opacity = ambientMotion === 0 ? 0 : 0.03 + pulse * 0.1
        ripple.scale.setScalar(0.86 + pulse * 0.22 * ambientMotion)
      })
      if (cloud) {
        cloud.position.x = Math.sin(elapsed * 0.08) * 0.18 * ambientMotion
        cloud.position.y = Math.sin(elapsed * 0.13) * 0.035 * ambientMotion
      }
      if (cloudBack) {
        cloudBack.position.x = Math.sin(elapsed * 0.035 + 1.4) * 0.12 * ambientMotion
        cloudBack.position.y = Math.sin(elapsed * 0.06) * 0.025 * ambientMotion
      }
      if (cloudFront) {
        cloudFront.position.x = Math.sin(elapsed * 0.075) * 0.22 * ambientMotion
        cloudFront.position.y = Math.sin(elapsed * 0.11 + 0.8) * 0.045 * ambientMotion
      }
      if (valleyBackground) valleyBackground.position.y = Math.sin(elapsed * 0.12) * 0.006 * ambientMotion
      if (smoke) {
        smoke.children.forEach((puff, index) => {
          const baseX = Number(puff.userData.baseX)
          const baseY = Number(puff.userData.baseY)
          const baseZ = Number(puff.userData.baseZ)
          const drift = ambientMotion === 0 ? 0 : (elapsed * 0.12 + index * 0.7) % 1
          const windPhase = Number(puff.userData.windPhase ?? index)
          const windSample = windField.sample(elapsed, windPhase, 0.18 * ambientMotion)
          puff.position.set(baseX + windSample.x + drift * 0.12 * ambientMotion, baseY + drift * 0.42 * ambientMotion, baseZ + windSample.z)
          const smokeMaterial = (puff as THREE.Mesh).material as THREE.MeshStandardMaterial
          smokeMaterial.opacity = 0.24 * (1 - drift)
          puff.scale.setScalar(0.8 + drift * 0.8)
        })
      }
      animatedCrowns.forEach((crown, index) => {
        const windPhase = Number(crown.userData.windPhase ?? index)
        const windSample = windField.sample(elapsed, windPhase, 0.025 * ambientMotion)
        crown.rotation.z = windSample.sway
      })
      understoryFerns.forEach((fern, index) => {
        const windPhase = Number(fern.userData.windPhase ?? index)
        const windSample = windField.sample(elapsed, windPhase, 0.42 * ambientMotion)
        fern.rotation.z = Number(fern.userData.baseRotationZ ?? 0) + windSample.sway
      })
      authoredTrees.forEach((tree, index) => {
        const windPhase = Number(tree.userData.windPhase ?? index)
        const windSample = windField.sample(elapsed, windPhase, 0.012 * ambientMotion)
        tree.rotation.z = windSample.sway + Number(tree.userData.baseRotationZ ?? 0)
      })
      fireflies.forEach((firefly, index) => {
        const baseX = Number(firefly.userData.baseX)
        const baseY = Number(firefly.userData.baseY)
        const baseZ = Number(firefly.userData.baseZ)
        firefly.position.set(baseX + Math.sin(elapsed * 0.8 + index) * 0.22 * ambientMotion, baseY + Math.sin(elapsed * 1.25 + index * 1.8) * 0.18 * ambientMotion, baseZ + Math.cos(elapsed * 0.65 + index) * 0.16 * ambientMotion)
      })
      glows.forEach((glow, index) => { const glowMaterial = glow.material as THREE.MeshStandardMaterial; glowMaterial.emissiveIntensity = 1.35 + Math.sin(elapsed * 2.2 + index * 1.6) * 0.65 * ambientMotion; glow.scale.setScalar(0.86 + Math.sin(elapsed * 1.7 + index) * 0.12 * ambientMotion) })
      if (entryLight) entryLight.intensity = 1.05 + Math.sin(elapsed * 1.8) * 0.18 * ambientMotion
      renderer.render(scene, camera); frame = requestAnimationFrame(render)
    }
    const interruptCameraTransition = () => { cameraTransitionActive = false; storySelectionRef.current = null; storyPinnedRef.current = false; cameraTarget = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius, target: [lookTarget.x, lookTarget.y, lookTarget.z] }; setActiveNode(null) }
    const down = (event: PointerEvent) => { interruptCameraTransition(); dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId) }
    const move = (event: PointerEvent) => { if (!dragging) return; const deltaX = event.clientX - lastX; const deltaY = event.clientY - lastY; orbit.theta -= deltaX * 0.008; orbit.phi = THREE.MathUtils.clamp(orbit.phi - deltaY * 0.006, 0.68, 1.55); if (authModeRef.current && ambientMotion > 0) { cameraInertiaTheta = -deltaX * 0.0008; cameraInertiaPhi = -deltaY * 0.0006 }; lastX = event.clientX; lastY = event.clientY; updateCamera(); emitCameraState() }
    const up = () => { dragging = false }; const wheel = (event: WheelEvent) => { event.preventDefault(); interruptCameraTransition(); orbit.radius = THREE.MathUtils.clamp(orbit.radius + event.deltaY * 0.004, 4.4, MAX_CAMERA_RADIUS); setZoom(MAX_CAMERA_RADIUS / orbit.radius); updateCamera(); emitCameraState() }
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && storySelectionRef.current) returnToPanorama() }
    frame = requestAnimationFrame(render); const observer = new ResizeObserver(resize); observer.observe(canvas); resize()
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('wheel', wheel, { passive: false }); document.addEventListener('keydown', keydown)
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); garden.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose()); else object.material.dispose() } if (object instanceof THREE.Sprite) object.material.dispose() }); waterTexture?.dispose(); cloudTexture?.dispose(); Object.values(cabinPbrMaps).forEach((maps) => [maps.color, maps.normal, maps.roughness, maps.ao].forEach((texture) => texture?.dispose())); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel); document.removeEventListener('keydown', keydown) }
  }, [])
  if (fallback) return <img className="sg-diorama-fallback" src={fallbackSrc} alt="数字庭院" />
  const activeStoryNode = nodes.find((node) => node.id === activeNode)
  return <div className="sg-diorama" style={{ ['--sg-diorama-zoom' as string]: zoom }}><canvas ref={canvasRef} className="sg-diorama__canvas" aria-label="可旋转缩放的数字庭院" />{showStoryNodes && <><div className="sg-diorama__nodes" aria-label="庭院故事节点">{nodes.map((node) => <button key={node.id} type="button" data-story-node={node.id} className={`sg-diorama-node${activeNode === node.id || zoom >= node.z + 0.35 ? ' is-visible' : ''}`} style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%`, zIndex: activeNode === node.id ? 2 : 1 }} onClick={() => selectStoryNode(node)} onMouseEnter={() => setActiveNode(node.id)} onMouseLeave={() => { if (!storyPinnedRef.current) setActiveNode(null) }} onFocus={() => selectStoryNode(node)} onBlur={() => { if (!storyPinnedRef.current) setActiveNode(null) }}><span className="sg-diorama-node__dot" aria-hidden /><span className="sg-diorama-node__label">{node.label}</span></button>)}</div>{activeStoryNode && <aside className="sg-diorama-story-panel" aria-live="polite" aria-label={`${activeStoryNode.label}区域说明`}><p className="sg-diorama-story-panel__eyebrow">庭院故事</p><h2>{activeStoryNode.label}</h2><p>{activeStoryNode.description}</p><div className="sg-diorama-story-panel__actions"><Link href={activeStoryNode.href} className="sg-btn sg-btn--primary">查看这个区域</Link><button type="button" className="sg-btn sg-btn--ghost" aria-label="Return to panorama" onClick={returnToPanorama}>返回全景</button></div></aside>}</>}</div>
}
