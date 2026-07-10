import './styles/tokens.css'
import './styles/fonts.css'
import './styles/typography.css'
import './styles/components.css'
import './styles/global.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
)
