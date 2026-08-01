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

  const handleSelectLot = (name: string) => setCurrentLotName(name)
  const handleBack = () => {
    setCurrentLotName(null)
    setTimeout(() => {
      document.querySelector('#map')?.scrollIntoView({ behavior: 'auto' })
    }, 0)
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
