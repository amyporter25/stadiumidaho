import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { lots } from '../data/lots'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform float time;

void main() {
  vec2 coord = gl_FragCoord.xy / resolution;
  vec2 st = coord;
  coord *= 10.0;

  float len;
  for (int i = 0; i < 5; i++) {
    len = length(vec2(coord.x, coord.y));
    coord.x += cos(coord.y + sin(len)) + cos(time * 0.07) * 0.2;
    coord.y += sin(coord.x + cos(len)) + sin(time * 0.1);
  }

  len *= cos(len * 0.4);
  len -= 10.0;

  for (float i = 0.0; i < 5.0; i++) {
    len += 1.0 / abs(mod(st.x, 0.09 * i) * 200.0) * 1.0;
  }

  float r = cos(len + 0.2) * 0.4 + 0.5;
  float g = cos(len + 0.1) * 0.4 + 0.5;
  float b = cos(len - 0.05) * 0.45 + 0.55;

  vec3 color = vec3(r, g, b);
  color = smoothstep(0.1, 0.9, color);
  color *= 0.7;

  gl_FragColor = vec4(color, 1.0);
}
`

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const uniformsRef = useRef<{ resolution: THREE.Uniform; time: THREE.Uniform }>({
    resolution: new THREE.Uniform(new THREE.Vector2(1, 1)),
    time: new THREE.Uniform(0),
  })

  const [submitHovered, setSubmitHovered] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    lotTitle: 'No specific lot yet',
    timeframe: 'Just browsing',
    message: '',
  })

  const { user } = useAuth()

  // Pre-fill name and email from authenticated user
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
      }))
    }
  }, [user])

  const createInquiry = trpc.inquiry.create.useMutation({
    onSuccess: () => {
      setSubmitted(true)
      setSubmitError(null)
    },
    onError: (err) => {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    },
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvasHostRef.current
    if (!canvas || !host) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    const camera = new THREE.Camera()

    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        resolution: uniformsRef.current.resolution,
        time: uniformsRef.current.time,
      },
      depthTest: false,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const handleResize = () => {
      const rect = host.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      renderer.setSize(w, h, false)
      uniformsRef.current.resolution.value.set(w, h)
    }
    handleResize()

    const ro = new ResizeObserver(handleResize)
    ro.observe(host)

    let rafId: number
    const startTime = performance.now()
    const animate = () => {
      uniformsRef.current.time.value = (performance.now() - startTime) / 1000
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!formData.name || !formData.email) {
      setSubmitError('Please fill in your name and email.')
      return
    }

    createInquiry.mutate({
      fullName: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      interest: 'General Inquiry',
      lotTitle: formData.lotTitle === 'No specific lot yet' ? undefined : formData.lotTitle,
      timeframe: formData.timeframe,
      message: formData.message || undefined,
      userId: user?.id,
    })
  }

  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '700px',
        backgroundColor: '#0b0b0b',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
      }}
    >
      {/* Left: shader */}
      <div
        ref={canvasHostRef}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '420px',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 'clamp(24px, 4vw, 48px)',
            left: 'clamp(24px, 4vw, 48px)',
            right: 'clamp(24px, 4vw, 48px)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(36px, 4.5vw, 64px)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1.02,
              color: '#ffffff',
              marginBottom: '16px',
              textShadow: '0 2px 24px rgba(0,0,0,0.25)',
              maxWidth: '520px',
            }}
          >
            Find your
            <br />
            homesite
          </h2>
          <p
            style={{
              fontSize: '13px',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.9)',
              textTransform: 'uppercase',
            }}
          >
            SEASIDE ESTATES · Sales & Inquiries
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div
        style={{
          backgroundColor: '#0b0b0b',
          color: '#ffffff',
          padding: 'clamp(40px, 5vw, 72px) clamp(24px, 4vw, 60px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: '520px', width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
          <p
            style={{
              fontSize: '11px',
              letterSpacing: '0.24em',
              color: 'rgba(255,255,255,0.6)',
              textTransform: 'uppercase',
              marginBottom: '14px',
            }}
          >
            Get in touch
          </p>
          <h3
            style={{
              fontSize: 'clamp(28px, 3.2vw, 40px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              marginBottom: '36px',
            }}
          >
            Schedule a tour or send us a note.
          </h3>

          {submitted ? (
            <div
              style={{
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '32px 28px',
                fontSize: '15px',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              Thank you — our sales team will be in touch within one business
              day to answer your questions or arrange your visit.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {submitError && (
                <div
                  style={{
                    border: '1px solid rgba(255,100,100,0.5)',
                    padding: '14px 18px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: 'rgba(255,150,150,0.9)',
                    marginBottom: '4px',
                  }}
                >
                  {submitError}
                </div>
              )}
              <Row>
                <Field label="Full name" type="text" name="name" placeholder="Jane Doe" value={formData.name} onChange={handleChange} />
                <Field label="Phone (optional)" type="tel" name="phone" placeholder="(555) 000-0000" value={formData.phone} onChange={handleChange} />
              </Row>
              <Field label="Email" type="email" name="email" placeholder="you@domain.com" value={formData.email} onChange={handleChange} />
              <Row>
                <SelectField
                  label="Lot of interest"
                  name="lotTitle"
                  value={formData.lotTitle}
                  onChange={handleChange}
                  options={['No specific lot yet', ...lots.map((l) => l.title)]}
                />
                <SelectField
                  label="Purchase timeframe"
                  name="timeframe"
                  value={formData.timeframe}
                  onChange={handleChange}
                  options={[
                    'Just browsing',
                    'Within 3 months',
                    '3–6 months',
                    '6–12 months',
                    'More than a year',
                  ]}
                />
              </Row>
              <TextareaField
                label="Message (optional)"
                name="message"
                placeholder="Questions about a lot, building requirements, financing…"
                value={formData.message}
                onChange={handleChange}
              />
              <button
                type="submit"
                disabled={createInquiry.isPending}
                onMouseEnter={() => setSubmitHovered(true)}
                onMouseLeave={() => setSubmitHovered(false)}
                style={{
                  marginTop: '12px',
                  padding: '18px 24px',
                  fontSize: '13px',
                  fontWeight: 500,
                  letterSpacing: '0.16em',
                  color: submitHovered ? '#0b0b0b' : '#ffffff',
                  backgroundColor: submitHovered ? '#ffffff' : 'transparent',
                  border: '1px solid #ffffff',
                  cursor: createInquiry.isPending ? 'wait' : 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.25s ease',
                  fontFamily: '"Helvetica Neue", sans-serif',
                  opacity: createInquiry.isPending ? 0.6 : 1,
                }}
              >
                {createInquiry.isPending ? 'Submitting...' : 'Submit Inquiry'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
      }}
    >
      {children}
    </div>
  )
}

const fieldBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  fontSize: '15px',
  backgroundColor: 'transparent',
  color: '#ffffff',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.35)',
  outline: 'none',
  fontFamily: 'inherit',
  letterSpacing: '0.01em',
  appearance: 'none',
  colorScheme: 'dark',
}

const labelBase: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.2em',
  color: 'rgba(255,255,255,0.6)',
  textTransform: 'uppercase',
  marginBottom: '4px',
  display: 'block',
}

function Field({
  label,
  type,
  name,
  placeholder,
  min,
  value,
  onChange,
}: {
  label: string
  type: string
  name: string
  placeholder?: string
  min?: number
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelBase}>{label}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        min={min}
        value={value}
        onChange={onChange}
        style={fieldBase}
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#ffffff')}
        onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.35)')}
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string
  name: string
  options: string[]
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelBase}>{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        style={{ ...fieldBase, paddingRight: '20px' }}
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#ffffff')}
        onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.35)')}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ color: '#000', backgroundColor: '#fff' }}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextareaField({
  label,
  name,
  placeholder,
  value,
  onChange,
}: {
  label: string
  name: string
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelBase}>{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        rows={3}
        value={value}
        onChange={onChange}
        style={{ ...fieldBase, resize: 'vertical', paddingTop: '12px' }}
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#ffffff')}
        onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.35)')}
      />
    </label>
  )
}
