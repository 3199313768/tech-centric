'use client'

import dynamic from 'next/dynamic'

const SpiritCursorTrail = dynamic(
  () => import('@/components/home/shell/SpiritCursorTrail').then((module) => ({ default: module.SpiritCursorTrail })),
  { ssr: false },
)
const SpiritCursor = dynamic(
  () => import('@/components/home/shell/SpiritCursor').then((module) => ({ default: module.SpiritCursor })),
  { ssr: false },
)

export function SpiritCursorLayer() {
  return (
    <>
      <SpiritCursorTrail />
      <SpiritCursor />
    </>
  )
}
