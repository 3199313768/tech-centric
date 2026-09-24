'use client'

import Image from 'next/image'
import Link from 'next/link'
import { SpiritDustCanvas } from '@/components/home/landing/SpiritDustCanvas'
import { DioramaScene } from '@/components/home/landing/DioramaScene'
import { personalInfo, workExperience } from '@/data/site/personal'
import type { HeroSeason } from '@/lib/site/homeStats'
import { SITE_ROUTES } from '@/lib/site/routes'

interface SpiritGardenHomeProps {
  heroSeason?: HeroSeason
}

export function SpiritGardenHome({
  heroSeason = 'spring',
}: SpiritGardenHomeProps) {
  return (
    <main className="sg-hero-stage sg-hero-stage--garden">
        <div className="sg-hero-backdrop sg-hero-backdrop--natural sg-hero-backdrop--blend" aria-hidden>
          <DioramaScene fallbackSrc="/spirit-garden/hero-landscape.png" />
          <SpiritDustCanvas className="sg-spirit-dust-canvas" />
          <div
            className={`sg-hero-backdrop-overlay sg-hero-backdrop-overlay--garden sg-hero-season--${heroSeason}`}
          />
        </div>

        <div className="sg-hero-inner-wrap sg-hero-inner-wrap--garden sg-hero-enter">
          <section id="hero" className="sg-hero-intro">
            <div className="sg-hero-profile-row sg-enter sg-enter--1">
              <div className="sg-hero-avatar-sm">
                <Image
                  src="/spirit-garden/个人信使角色-透明底.png"
                  alt={personalInfo.name}
                  fill
                  sizes="40px"
                  className="sg-hero-avatar-img"
                />
              </div>
              <div className="sg-hero-profile-meta">
                <span className="sg-hero-name">{personalInfo.name}</span>
                <span className="sg-hero-badge">{personalInfo.title}</span>
              </div>
            </div>

            <h1 className="sg-hero-garden-title sg-enter sg-enter--2">欢迎来到我的数字庭院</h1>

            <p className="sg-hero-garden-lead sg-enter sg-enter--3">
              {personalInfo.bio[0]}
              {workExperience[0]?.company
                ? ` 目前在 ${workExperience[0].company} 深耕水利数字孪生与前端效能。`
                : ''}
            </p>

            <div className="sg-hero-actions sg-enter sg-enter--4">
              <Link href={SITE_ROUTES.projects} className="sg-btn sg-btn--primary">
                探寻作品
              </Link>
              <Link href={SITE_ROUTES.about} className="sg-btn sg-btn--ghost">
                了解我
              </Link>
            </div>
          </section>
        </div>
    </main>
  )
}
