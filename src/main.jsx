import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import UebergabeApp from './App.jsx'
import BoersenradarApp from './boersenradar/App.jsx'

// Einfaches Hash-Routing zwischen den beiden Apps in diesem Repo:
//   #/            -> KI-Börsenradar (Standard auf diesem Branch)
//   #/uebergabe   -> bestehende Übergabe-App (unverändert)
function Router() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.startsWith('#/uebergabe') ? <UebergabeApp /> : <BoersenradarApp />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
