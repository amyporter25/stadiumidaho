import { useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { lots, type Lot } from '../data/lots'

gsap.registerPlugin(ScrollTrigger)

interface WorksProps {
  scrollRef: React.MutableRefObject<{ y: number; speed: number }>
  onSelectLot: (id: string) => void
}

export default function Works({ scrollRef: _scrollRef, onSelectLot }: WorksProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const imageLoadedRef = useRef<boolean[]>(new Array(lots.length).fill(false))
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(lots.length).fill(null))
  const strengthRef = useRef(0)
  const prevScrollYRef = useRef(0)
  const randsRef = useRef<number[][]>(
    lots.map(() => [Math.random(), Math.random(), Math.random(), Math.random()])
  )

  const setCanvasRef = useCallback((el: HTMLCanvasElement | null, index: number) => {
    canvasRefs.current[index] = el
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.from('.work-item', {
        y: 80,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 70%',
          once: true,
        },
      })
    }, section)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    lots.forEach((lot, i) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        imagesRef.current[i] = img
        imageLoadedRef.current[i] = true
        const canvas = canvasRefs.current[i]
        if (canvas) {
          const rect = canvas.parentElement?.getBoundingClientRect()
          if (rect) {
            canvas.width = rect.width * Math.min(window.devicePixelRatio, 2)
            canvas.height = rect.height * Math.min(window.devicePixelRatio, 2)
          }
          drawImage(canvas, img, 0, randsRef.current[i])
        }
      }
      img.src = lot.img
    })
  }, [])

  useEffect(() => {
    let rafId: number
    const animate = () => {
      const scrollY = window.scrollY
      const scrollDelta = scrollY - prevScrollYRef.current
      const dt = 1 / 60

      const targetStrength = (Math.abs(scrollDelta) * 10) / window.innerHeight
      strengthRef.current *= Math.exp(-dt * 10)
      strengthRef.current += Math.min(targetStrength, 5)
      const strength = Math.min(1, strengthRef.current)

      canvasRefs.current.forEach((canvas, i) => {
        if (!canvas || !imagesRef.current[i]) return

        if (Math.random() > Math.exp(-dt * 25 * (1 + strength))) {
          randsRef.current[i] = [Math.random(), Math.random(), Math.random(), Math.random()]
        }

        drawImage(canvas, imagesRef.current[i]!, strength, randsRef.current[i])
      })

      prevScrollYRef.current = scrollY
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [])

  useEffect(() => {
    const handleResize = () => {
      canvasRefs.current.forEach((canvas, i) => {
        if (!canvas || !canvas.parentElement) return
        const rect = canvas.parentElement.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio, 2)
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        if (imagesRef.current[i]) {
          drawImage(canvas, imagesRef.current[i]!, 0, randsRef.current[i])
        }
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <section
      id="works"
      ref={sectionRef}
      style={{
        backgroundColor: '#f4f4f5',
        padding: '120px clamp(20px, 4vw, 60px)',
      }}
    >
      <div style={{ maxWidth: '1560px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '60px',
            borderBottom: '1px solid #1a1a1a',
            paddingBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#000000',
            }}
          >
            Homesites &amp; Lots
          </h2>
          <span
            style={{
              fontSize: '12px',
              letterSpacing: '0.18em',
              color: '#666666',
              textTransform: 'uppercase',
            }}
          >
            Current Inventory
          </span>
        </div>

        <div
          ref={gridRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 640px), 1fr))',
            gap: '2px',
          }}
        >
          {lots.map((lot, i) => (
            <LotCard
              key={lot.id}
              lot={lot}
              index={i}
              setCanvasRef={setCanvasRef}
              onClick={() => onSelectLot(lot.id)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function statusColors(status: Lot['status']): { fg: string; bg: string; border: string } {
  switch (status) {
    case 'Available':
      return { fg: '#1a6b3a', bg: '#e8f5e9', border: '#1a6b3a' }
    case 'Under Contract':
      return { fg: '#8a5a00', bg: '#fdf3e0', border: '#8a5a00' }
    case 'Sold':
      return { fg: '#8a1a1a', bg: '#fbeaea', border: '#8a1a1a' }
    case 'Coming Soon':
      return { fg: '#1a4a8a', bg: '#e8f0fb', border: '#1a4a8a' }
  }
}

function LotCard({
  lot,
  index,
  setCanvasRef,
  onClick,
}: {
  lot: Lot
  index: number
  setCanvasRef: (el: HTMLCanvasElement | null, index: number) => void
  onClick: () => void
}) {
  const status = statusColors(lot.status)
  return (
    <button
      onClick={onClick}
      className="work-item"
      style={{
        border: '1px solid #000000',
        backgroundColor: '#ffffff',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'block',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%',
          overflow: 'hidden',
          backgroundColor: '#e5e5e5',
        }}
      >
        <canvas
          ref={(el) => setCanvasRef(el, index)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: '14px',
            left: '14px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: status.fg,
            backgroundColor: status.bg,
            border: `1px solid ${status.border}`,
            padding: '6px 12px',
            zIndex: 2,
          }}
        >
          {lot.status}
        </span>
      </div>
      <div
        style={{
          padding: '20px 24px',
          borderTop: '1px solid #000000',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: '#666666',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Lot {lot.id} · {lot.phase} · {lot.type}
          </p>
          <p
            style={{
              fontSize: '18px',
              fontWeight: 500,
              color: '#000000',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}
          >
            {lot.title}
          </p>
        </div>
        <span
          style={{
            fontSize: '12px',
            letterSpacing: '0.14em',
            color: '#000000',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          View →
        </span>
      </div>
    </button>
  )
}

function drawImage(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  strength: number,
  rands: number[]
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const cw = canvas.width
  const ch = canvas.height

  const imgRatio = img.width / img.height
  const canvasRatio = cw / ch
  let sw = img.width
  let sh = img.height
  let sx = 0
  let sy = 0
  if (imgRatio > canvasRatio) {
    sw = img.height * canvasRatio
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / canvasRatio
    sy = (img.height - sh) / 2
  }

  ctx.clearRect(0, 0, cw, ch)

  if (strength < 0.01) {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
    return
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)

  const numStrips = Math.floor(3 + strength * 12)
  for (let s = 0; s < numStrips; s++) {
    const stripY = Math.floor(rands[s % 4] * ch * (0.3 + s * 0.15)) % ch
    const stripH = Math.floor(2 + Math.random() * ch * 0.06 * strength)
    const offsetX = (rands[(s + 1) % 4] - 0.5) * cw * 0.15 * strength

    if (rands[(s + 2) % 4] > 0.7) {
      ctx.drawImage(canvas, 0, stripY, cw, stripH, offsetX, stripY, cw, stripH)
    }
  }

  if (strength > 0.05) {
    const shiftAmount = strength * 6
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = strength * 0.3
    ctx.drawImage(canvas, shiftAmount, 0, cw, ch, 0, 0, cw, ch)
    ctx.drawImage(canvas, -shiftAmount, 0, cw, ch, 0, 0, cw, ch)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  if (strength > 0.3) {
    ctx.fillStyle = `rgba(255,255,255,${(strength - 0.3) * 0.15})`
    ctx.fillRect(0, 0, cw, ch)
  }
}
