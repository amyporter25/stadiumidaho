import { useEffect, useRef, useState } from 'react'
import { Routes, Route } from 'react-router'
import Header from './sections/Header'
import Hero from './sections/Hero'
import Philosophy from './sections/Philosophy'
import MapExplorer from './sections/MapExplorer'
import HomePlans from './sections/HomePlans'
import Capabilities from './sections/Capabilities'
import Spatial from './sections/Spatial'
import Footer from './sections/Footer'
import Preloader from './sections/Preloader'
import LotDetail from './pages/LotDetail'
import Login from './pages/Login'
import FlyoverVideo from './components/FlyoverVideo'
import StadiumSplat from './components/StadiumSplat'
import LotStudioPage from './studio/LotStudioPage'
import Phase3SamplePage from './studio/Phase3SamplePage'
import NeighborhoodExplorer from './studio/NeighborhoodExplorer'

function App() {
  const scrollRef = useRef({ y: 0, speed: 0 })
  const [currentLotName, setCurrentLotName] = useState<string | null>(null)

  useEffect(() => {
    let rafId: number
    let prevY = window.scrollY

    const tick = () => {
      const y = window.scrollY
      const delta = y - prevY
      scrollRef.current.y = y
      scrollRef.current.speed = delta
      prevY = y
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)
  }, [])

  // Deep-link support: #lot=2/1 opens that lot's page directly, so lot pages
  // can be shared. Anchor hashes (#map, #plans, …) are unaffected.
  useEffect(() => {
    const fromHash = () => {
      const m = window.location.hash.match(/^#lot=(.+)$/)
      setCurrentLotName(m ? decodeURIComponent(m[1]) : null)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  const handleSelectLot = (name: string) => {
    window.location.hash = `lot=${encodeURIComponent(name)}`
    setCurrentLotName(name)
  }
  const handleBack = () => {
    history.replaceState(null, '', window.location.pathname)
    setCurrentLotName(null)
    setTimeout(() => {
      document.querySelector('#map')?.scrollIntoView({ behavior: 'auto' })
    }, 0)
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Track B — isolated lot visualization experience */}
      <Route path="/studio" element={<LotStudioPage />} />
      <Route path="/studio/earth" element={<NeighborhoodExplorer />} />
      <Route path="/studio/sample" element={<Phase3SamplePage />} />
      <Route path="*" element={
        <>
          <Preloader />
          <Header scrollRef={scrollRef} forceLight={currentLotName !== null} />
          {currentLotName ? (
            <LotDetail lotName={currentLotName} onBack={handleBack} />
          ) : (
            <main>
              <Spatial />
              <Philosophy />
              <MapExplorer onSelectLot={handleSelectLot} />
              <FlyoverVideo />
              <StadiumSplat />
              <HomePlans />
              <Capabilities />
              <Hero />
            </main>
          )}
          <Footer />
        </>
      } />
    </Routes>
  )
}

export default App
