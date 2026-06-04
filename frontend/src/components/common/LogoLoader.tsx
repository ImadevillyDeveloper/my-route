import { useEffect, useState } from 'react'

const FRAMES = ['/logo-f1.png', '/logo-f2.png', '/logo-f3.png', '/logo-f4.png']

interface Props {
  size?: number
  fullPage?: boolean
}

export default function LogoLoader({ size = 72, fullPage = false }: Props) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 180)
    return () => clearInterval(t)
  }, [])

  const img = (
    <img
      src={FRAMES[frame]}
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
      alt=""
    />
  )

  if (!fullPage) return img

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      minHeight: 220,
      width: '100%',
    }}>
      {img}
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Загрузка...</span>
    </div>
  )
}
