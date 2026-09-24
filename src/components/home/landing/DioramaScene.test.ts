import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/components/home/landing/DioramaScene.tsx', 'utf8')
const styles = readFileSync('src/app/globals.css', 'utf8')

describe('diorama scene contract', () => {
  it('provides a client-only interactive canvas with a static fallback', () => {
    expect(source).toContain("'use client'")
    expect(source).toContain('<canvas')
    expect(source).toContain('WebGLRenderer')
    expect(source).toContain("addEventListener('wheel'")
    expect(source).toContain("addEventListener('pointerdown'")
    expect(source).toContain('createGarden')
  })

  it('does not start an automatic rotation loop', () => {
    expect(source).not.toContain('rotation +=')
    expect(source).not.toContain('setInterval')
  })

  it('gives the canvas backdrop the full hero height', () => {
    expect(styles).toContain('.sg-hero-stage--garden .sg-hero-backdrop--natural {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;')
  })

  it('animates local garden details without auto-rotating the camera', () => {
    expect(source).toContain('THREE.Clock')
    expect(source).toContain('stream.material')
    expect(source).toContain('cloud.position')
    expect(source).toContain('glow.material')
    expect(source).not.toContain('orbit.theta += delta')
  })

  it('adds layered ambient life and a wider exploration range', () => {
    expect(source).toContain("name = 'firefly'")
    expect(source).toContain("name = 'smoke'")
    expect(source).toContain('firefly.position')
    expect(source).toContain('puff.position')
    expect(source).toContain('MathUtils.clamp(orbit.phi -')
    expect(source).toContain('0.68, 1.55')
  })

  it('uses natural materials instead of flat toy-like shading', () => {
    expect(source).toContain('CanvasTexture')
    expect(source).toContain('mat(0xffffff, 0.82')
    expect(source).toContain('flatShading: false')
    expect(source).toContain('PointLight')
    expect(source).not.toContain('flatShading: true')
  })

  it('loads the detailed authored cabin GLB and keeps a procedural fallback', () => {
    expect(source).toContain("GLTFLoader")
    expect(source).toContain('/models/poly-pizza-log-cabin/log-cabin.glb')
    expect(source).toContain('procedural-house')
    expect(source).toContain('gltf.scene')
  })

  it('does not flash procedural placeholders before authored models finish loading', () => {
    expect(source).toContain("setFallbackVisibility(garden, false, 'cabin')")
    expect(source).toContain("setFallbackVisibility(garden, false, 'trees')")
    expect(source).toContain("setFallbackVisibility(garden, true, 'cabin')")
    expect(source).toContain("setFallbackVisibility(garden, true, 'trees')")
    expect(source).toContain('fallback visibility')
  })

  it('reveals authored models with a soft opacity and scale transition', () => {
    expect(source).toContain('authoredReveals')
    expect(source).toContain('registerReveal')
    expect(source).toContain('prepared.transparent = true')
    expect(source).toContain('THREE.MathUtils.smoothstep')
    expect(source).toContain('revealDuration')
  })

  it('does not zoom out beyond the initial panorama framing', () => {
    expect(source).toContain('MAX_CAMERA_RADIUS')
    expect(source).toContain('orbit.radius + event.deltaY * 0.004, 4.4, MAX_CAMERA_RADIUS')
    expect(source).toContain('const MAX_CAMERA_RADIUS = DEFAULT_CAMERA_TARGET.radius')
  })

  it('defines distinct procedural material profiles for the cabin and valley floor', () => {
    expect(source).toContain('SurfaceMaterialProfile')
    expect(source).toContain('createSurfaceProfileMaps')
    expect(source).toContain("profile === 'wood'")
    expect(source).toContain("profile === 'moss'")
    expect(source).toContain("profile === 'soil'")
    expect(source).toContain('weathering')
    expect(source).toContain('normalMap')
    expect(source).toContain('roughnessMap')
  })

  it('embeds the cabin and the paths into a shared terrain height field', () => {
    expect(source).toContain('terrainHeightAt')
    expect(source).toContain("name = 'cabin-terrace'")
    expect(source).toContain('terrainHeightAt(pathPoint.x, pathPoint.z)')
    expect(source).toContain('terrainHeightAt(streamPoint.x, streamPoint.z)')
    expect(source).toContain('streamBasin')
  })

  it('grounds the terrace with layered contact shadows and depth contrast', () => {
    expect(source).toContain("name = 'terrace-contact-shadow'")
    expect(source).toContain('valleyMidground.traverse')
    expect(source).toContain('material.roughness = Math.max')
    expect(source).toContain('material.color.multiplyScalar')
  })

  it('adds readable architectural details around the cabin entrance', () => {
    expect(source).toContain("name = 'cabin-details'")
    expect(source).toContain("name = 'cabin-entry-light'")
    expect(source).toContain('cabin-foundation')
    expect(source).toContain('cabin-entrance-step')
  })

  it('enriches the authored cabin with PBR texture channels', () => {
    expect(source).toContain('normalMap')
    expect(source).toContain('roughnessMap')
    expect(source).toContain('aoMap')
    expect(source).toContain("setAttribute('uv1'")
    expect(source).toContain('normalScale')
  })

  it('separates wood, roof, and stone material profiles', () => {
    expect(source).toContain('splitCabinGeometry')
    expect(source).toContain('cabinPbrMaps.wood')
    expect(source).toContain('cabinPbrMaps.roof')
    expect(source).toContain('cabinPbrMaps.stone')
    expect(source).toContain('roofCutoff')
    expect(source).toContain('roof: { color:')
    expect(source).toContain('stone: { color:')
    expect(source).toContain('material.color.setHex')
  })

  it('uses irregular mountain geometry and authored tree meshes for the landscape', () => {
    expect(source).toContain('createMountainGeometry')
    expect(source).toContain("name = 'mountain-ridge'")
    expect(source).toContain('/models/kenney-mini-forest/tree-high.glb')
    expect(source).toContain("name = 'authored-tree'")
    expect(source).toContain("name = 'procedural-tree-crown'")
  })

  it('builds a layered forest valley around the mountain ridge', () => {
    expect(source).toContain('createContourBandGeometry')
    expect(source).toContain("name = 'mountain-slope-layer'")
    expect(source).toContain("name = 'forest-valley'")
    expect(source).toContain("name = 'mountain-forest'")
    expect(source).toContain('addMountainTree')
  })

  it('uses continuous valley terrain with raised shoulders', () => {
    expect(source).toContain('createValleyTerrainGeometry')
    expect(source).toContain("name = 'forest-valley-shoulder'")
    expect(source).toContain('shoulderHeight')
  })

  it('organizes the valley into foreground, midground, and background layers', () => {
    expect(source).toContain("name = 'valley-foreground'")
    expect(source).toContain("name = 'valley-midground'")
    expect(source).toContain("name = 'valley-background'")
    expect(source).toContain('valleyBackground.position')
  })

  it('distributes forest trees and understory with deterministic variation', () => {
    expect(source).toContain("name = 'forest-understory'")
    expect(source).toContain("name = 'forest-tree'")
    expect(source).toContain('tree.rotation.y')
    expect(source).toContain('variationSeed')
  })

  it('grounds valley materials with AO and contact-shadow settings', () => {
    expect(source).toContain('createGroundContactMaterial')
    expect(source).toContain('aoMapIntensity')
    expect(source).toContain('contactShadow')
    expect(source).toContain('receiveShadow = true')
  })

  it('keeps story nodes accessible and respects reduced motion', () => {
    expect(source).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(source).toContain('ambientMotion')
    expect(source).toContain('data-story-node')
    expect(source).toContain('onFocus={() => selectStoryNode(node)}')
    expect(styles).toContain('.sg-diorama-node:focus-visible')
  })

  it('defines story descriptions and camera targets for each valley node', () => {
    expect(source).toContain('description:')
    expect(source).toContain('camera: { theta:')
    expect(source).toContain('target: [')
    expect(source).toContain('activeNode')
  })

  it('transitions the camera to a node and lets direct manipulation interrupt it', () => {
    expect(source).toContain('cameraTarget')
    expect(source).toContain('cameraTransitionActive')
    expect(source).toContain('MathUtils.damp')
    expect(source).toContain('cameraTransitionActive = false')
    expect(source).toContain('Return to panorama')
  })

  it('renders an accessible region description panel for the active story node', () => {
    expect(source).toContain('sg-diorama-story-panel')
    expect(source).toContain('aria-live="polite"')
    expect(source).toContain('activeStoryNode.description')
    expect(source).toContain('查看这个区域')
    expect(styles).toContain('.sg-diorama-story-panel')
  })

  it('returns to the panorama with Escape and cleans up the keyboard listener', () => {
    expect(source).toContain("event.key === 'Escape'")
    expect(source).toContain("addEventListener('keydown'")
    expect(source).toContain("removeEventListener('keydown'")
    expect(source).toContain('returnToPanorama()')
  })

  it('builds the stream and path as curved ground ribbons with natural edges', () => {
    expect(source).toContain('createGroundRibbonGeometry')
    expect(source).toContain("name = 'stream-bank'")
    expect(source).toContain("name = 'path-ribbon'")
    expect(source).toContain('waterTexture.offset.x')
    expect(source).toContain("name = 'stream-stone'")
  })

  it('uses atmospheric sky scattering, soft cloud sprites, and a coordinated sun direction', () => {
    expect(source).toContain("from 'three/examples/jsm/objects/Sky.js'")
    expect(source).toContain('createCloudTexture')
    expect(source).toContain('SpriteMaterial')
    expect(source).toContain('sky.material.uniforms')
    expect(source).toContain('sunDirection')
    expect(source).toContain('outputColorSpace = THREE.SRGBColorSpace')
    expect(source).toContain('shadow.camera.left = -6')
    expect(source).toContain('shadow.normalBias')
    expect(source).toContain("scene.background = new THREE.Color(0xbfd9df)")
    expect(source).toContain("name = 'cloud-layer-back'")
    expect(source).toContain("name = 'cloud-layer-front'")
    expect(source).toContain('sunElevation')
  })

  it('drives foliage and smoke from a shared wind field', () => {
    expect(source).toContain('windField')
    expect(source).toContain('windField.sample')
    expect(source).toContain("name = 'forest-understory'")
    expect(source).toContain('windPhase')
    expect(source).toContain('ambientMotion')
  })

  it('animates stream flow and stone-edge ripples', () => {
    expect(source).toContain("name = 'stream-ripple'")
    expect(source).toContain('streamRipples')
    expect(source).toContain('streamTangent')
    expect(source).toContain('rippleMaterial.opacity')
    expect(source).toContain('waterTexture.offset.x')
  })

  it('separates ecological vegetation zones around creek, cabin, and slopes', () => {
    expect(source).toContain("name = 'creek-bank-vegetation'")
    expect(source).toContain("name = 'cabin-clearance'")
    expect(source).toContain("name = 'slope-forest'")
    expect(source).toContain('ecoZone')
  })
})
