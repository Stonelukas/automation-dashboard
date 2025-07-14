import { Inter } from 'next/font/google'
import { ReactNode } from 'react'
import { OptimizedLayout } from '../components/OptimizedLayout'
import './globals.css'

// Performance optimization: Font loading with display swap
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
})

export const metadata = {
  title: 'File Cleanup Automation Dashboard',
  description: 'A modern web-based dashboard for automating file cleanup tasks with real-time progress tracking',
  keywords: ['automation', 'file cleanup', 'dashboard', 'react', 'nextjs'],
  authors: [{ name: 'Automation Dashboard Team' }],
  creator: 'Automation Dashboard',
  publisher: 'Automation Dashboard',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Performance optimizations
  other: {
    'X-UA-Compatible': 'IE=edge',
  },
}

// Viewport configuration for responsive design
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        
        {/* Favicon and app icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        
        {/* PWA support */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        
        {/* Security headers */}
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:;" />
      </head>
      <body className={inter.className}>
        <OptimizedLayout enablePerformanceMonitor={typeof window !== 'undefined' && typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'}>
          {children}
        </OptimizedLayout>
      </body>
    </html>
  )
}
