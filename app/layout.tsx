import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://appto.ar'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:  'ΛPPTO — Motor de Riesgo Crediticio B2B',
    template: '%s — ΛPPTO',
  },
  description:
    'Consultá el historial crediticio de tus clientes en segundos. Score BCRA, dictamen formal y red de garantías para inmobiliarias, financieras y equipos comerciales.',
  openGraph: {
    type:        'website',
    locale:      'es_AR',
    url:         SITE_URL,
    siteName:    'ΛPPTO',
    title:       'ΛPPTO — Motor de Riesgo Crediticio B2B',
    description: 'Score BCRA · Dictamen formal · Red de garantías. Evaluá el riesgo crediticio de tus clientes en 3 segundos.',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'ΛPPTO — Motor de Riesgo Crediticio B2B',
    description: 'Score BCRA · Dictamen formal · Red de garantías.',
  },
  robots: {
    index:  true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
