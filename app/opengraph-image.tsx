import { ImageResponse } from 'next/og'

export const dynamic     = 'force-dynamic'
export const alt         = 'ΛPPTO — Motor de Riesgo Crediticio B2B'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  // Try to load Inter (supports Greek — Λ renders correctly).
  // Falls back to satori's built-in font if the CDN is unreachable at build time.
  let fontData: ArrayBuffer | null = null
  try {
    const res = await fetch(
      'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuDyfAZNhiJ-Ek-_EeA.woff'
    )
    if (res.ok && res.headers.get('content-type')?.includes('font')) {
      fontData = await res.arrayBuffer()
    }
  } catch {
    // render without custom font
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '80px 80px 0' }}>

          {/* Large Λ */}
          <div style={{
            fontSize: 220,
            fontWeight: 900,
            color: '#0f172a',
            lineHeight: 1,
            letterSpacing: '-8px',
            marginBottom: 0,
          }}>
            Λ
          </div>

          {/* Brand + tagline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
            <div style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-2px',
              lineHeight: 1,
            }}>
              ΛPPTO
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 400,
              color: '#94a3b8',
              letterSpacing: '4px',
              textTransform: 'uppercase',
            }}>
              Motor de Riesgo Crediticio B2B
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '28px 80px',
          background: '#0f172a',
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 400,
            color: '#475569',
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>
            BCRA · AFIP · Score 0–1000
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 900,
            color: '#006C49',
            letterSpacing: '3px',
          }}>
            appto.ar
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: 'Inter', data: fontData, weight: 900, style: 'normal' as const }]
        : [],
    }
  )
}
