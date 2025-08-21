import '@/styles/globals.scss'
import { StrictMode } from 'react'
import HolyLoader from 'holy-loader'
import { type Metadata, type Viewport } from 'next'
import Providers from './providers'
import ScrollTopButton from '@/components/scroll-top-button'
import TailwindIndicator from '@/components/tailwind-indicator'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#030712' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1.0,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'GoogleDriveアップローダー',
  applicationName: 'GoogleDriveアップローダー',
  description: 'GoogleDriveアップローダー',
  openGraph: {
    title: 'GoogleDriveアップローダー',
    siteName: 'GoogleDriveアップローダー',
    description: 'GoogleDriveアップローダー',
    type: 'website',
    images: [''],
  },
  icons: [
    {
      rel: 'icon',
      url: '/favicon-16x16.png',
      sizes: '16x16',
      type: 'image/png',
    },
    {
      rel: 'icon',
      url: '/favicon-32x32.png',
      sizes: '32x32',
      type: 'image/png',
    },
    {
      url: '/android-chrome-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      url: '/android-chrome-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StrictMode>
      <html lang="jp" suppressHydrationWarning>
        <body>
          <HolyLoader color="#9333ea" height="1px" easing="linear" />
          <Providers>
            <div className="flex flex-col w-full min-h-screen overflow-y-auto">
              <main className="flex flex-col w-full min-h-screen">
                {children}
              </main>
              <ScrollTopButton />
            </div>
            <TailwindIndicator />
          </Providers>
        </body>
      </html>
    </StrictMode>
  )
}
