import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

if ((window as any).Capacitor?.isNativePlatform?.()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#FF7A1A' }).catch(() => {})
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
