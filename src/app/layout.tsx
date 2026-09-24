import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Space_Mono, Quicksand, Plus_Jakarta_Sans, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { personalInfo } from "@/data/site/personal";
import { ThemeProvider } from '@/components/spirit/theme/ThemeProvider'
import { SpiritCursorLayer } from '@/components/spirit/shell/SpiritCursorLayer'
import { QuickRecordModal } from '@/components/knowledge/capture/QuickRecordModal'
import { ToastProvider } from '@/components/spirit/feedback/ToastProvider'
import { getSessionProfile } from '@/lib/auth/getSessionProfile'
import { SITE_ROLE } from '@/lib/auth/roles'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  preload: false,
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["700"],
  preload: false,
});

const notoSansSc = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${personalInfo.name} - ${personalInfo.title}`,
  description: personalInfo.bio.join(' '),
  keywords: [...personalInfo.skills, personalInfo.title, '个人网站', '作品集'].join(', '),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'SpiritGarden',
    title: `${personalInfo.name} - ${personalInfo.title}`,
    description: personalInfo.bio[0],
    images: [{ url: '/spirit-garden/hero-landscape.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${personalInfo.name} - ${personalInfo.title}`,
    description: personalInfo.bio[0],
    images: ['/spirit-garden/hero-landscape.png'],
  },
  icons: {
    icon: '/spirit-garden/个人信使图标-彩色.png',
    apple: '/spirit-garden/个人信使图标-彩色.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getSessionProfile()

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${jetbrainsMono.variable} ${spaceMono.variable} ${quicksand.variable} ${plusJakarta.variable} ${notoSansSc.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <ToastProvider>
            {children}
            {profile?.role === SITE_ROLE.super_admin ? <QuickRecordModal /> : null}
            <SpiritCursorLayer />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
