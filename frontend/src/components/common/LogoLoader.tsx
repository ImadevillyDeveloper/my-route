import { useEffect, useState } from 'react'

const FRAMES = ['/logo-f1.png', '/logo-f2.png', '/logo-f3.png', '/logo-f4.png']

// Кадры — отдельные PNG-файлы; без предзагрузки первый показ анимации может
// дёргаться (браузер догружает следующий кадр по ходу смены). Грузим все
// сразу один раз при первом импорте модуля, чтобы к моменту любого показа
// лоадера все кадры уже были в кэше и смена шла плавно с самого начала.
if (typeof window !== 'undefined') {
  FRAMES.forEach(src => { const img = new Image(); img.src = src })
}

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
    <div className="logo-loader-fullpage" style={{
      // bottom: var(--nav-safe) вместо inset:0 — чтобы нижнее меню (на мобильном)
      // оставалось видимым и кликабельным поверх лоадера, а не пряталось под ним.
      // left переопределяется в index.css на десктопе, чтобы не перекрывать
      // боковое меню — там своя ширина вместо нижнего таб-бара.
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--nav-safe)', zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      background: 'var(--bg-gray)',
    }}>
      {img}
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Загрузка...</span>
    </div>
  )
}
