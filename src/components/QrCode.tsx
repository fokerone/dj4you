import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** QR code as crisp SVG (dark modules on a light quiet zone, as scanners expect). */
export function QrCode({ text, size = 184, label }: { text: string; size?: number; label: string }) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const count = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    return { path: d, n: count }
  }, [text])
  const pad = 3
  return (
    <svg className="qr" width={size} height={size} viewBox={`${-pad} ${-pad} ${n + pad * 2} ${n + pad * 2}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x={-pad} y={-pad} width={n + pad * 2} height={n + pad * 2} fill="#ffffff" />
      <path d={path} fill="#0b0d12" />
    </svg>
  )
}
