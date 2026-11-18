import React from 'react'
import ReactDOM from 'react-dom/client'
import { installHttpApi, isNative } from './lib/bridge'
import App from './App'
import './index.css'

// No desktop o window.api vem do Electron; no celular/navegador usamos a versão HTTP.
installHttpApi()
if (isNative()) {
  document.documentElement.classList.add('native')
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {})
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
