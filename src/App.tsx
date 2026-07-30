import { useEffect, useRef, useState } from 'react'
import { Routes, Route } from 'react-router'
import Header from './sections/Header'
import Hero from './sections/Hero'
import Philosophy from './sections/Philosophy'
import Works from './sections/Works'
import MapExplorer from './sections/MapExplorer'
import Capabilities from './sections/Capabilities'
import Spatial from './sections/Spatial'
import Footer from './sections/Footer'
import Preloader from './sections/Preloader'
import LotDetail from './pages/LotDetail'
import Login from './pages/Login'

function App() {
  const scrollRef = useRef({ y: 0, speed: 0 })
  const [currentLotId, setCurrentLotId] = useState<string | null>(null)

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

  const handleSelectLot = (id: string) => setCurrentLotId(id)
  const handleBack = () => {
    setCurrentLotId(null)
    setTimeout(() => {
      document.querySelector('#works')?.scrollIntoView({ behavior: 'auto' })
    }, 0)
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={
        <>
          <Preloader />
          <Header scrollRef={scrollRef} forceLight={currentLotId !== null} />
          {currentLotId ? (
            <LotDetail lotId={currentLotId} onBack={handleBack} />
          ) : (
            <main>
              <Spatial />
              <Philosophy />
              <Works scrollRef={scrollRef} onSelectLot={handleSelectLot} />
              <MapExplorer onSelectLot={handleSelectLot} />
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
