# AMP UP — Electron + React Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a working Electron + React + TypeScript app that renders the dashboard with our design system, implements sidebar navigation between views, and proves out local file system reading for the file tree.

**Architecture:** Electron app using electron-vite for build tooling, React for the UI, React Router for view navigation. The existing design system CSS (tokens, typography, components) is imported directly. Fonts and logo assets are bundled. The Electron main process exposes a minimal IPC API for reading directories and files from the local filesystem. No Python backend yet — this spike proves out the shell, rendering, and file system access.

**Tech Stack:** Electron, electron-vite, React 18, TypeScript, React Router, existing CSS design system

---

### Task 1: Scaffold Electron-Vite Project

**Files:**
- Create: `src/main/index.ts` (Electron main process)
- Create: `src/preload/index.ts` (preload bridge)
- Create: `src/renderer/index.html` (renderer entry HTML)
- Create: `src/renderer/main.tsx` (React entry)
- Create: `src/renderer/App.tsx` (root component)
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`

- [ ] **Step 1: Create the project with electron-vite**

```bash
cd /Users/kristidowns/Documents/Projects/amp-up-app
npm create electron-vite@latest app -- --template react-ts
```

This creates an `app/` subdirectory. We'll work inside it.

- [ ] **Step 2: Install dependencies**

```bash
cd app
npm install
npm install react-router-dom
```

- [ ] **Step 3: Verify the scaffold runs**

```bash
npm run dev
```

Expected: An Electron window opens with the default electron-vite React template. Close it.

- [ ] **Step 4: Configure the window in main process**

Replace `src/main/index.ts` with:

```typescript
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 12 },
    backgroundColor: '#F5F0EB',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppId('com.parrotlabs.amp-up')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 5: Run to verify window configuration**

```bash
npm run dev
```

Expected: Window opens at 1320x860 with hidden titlebar (native macOS traffic lights visible), warm beige background. Close it.

- [ ] **Step 6: Commit**

```bash
cd /Users/kristidowns/Documents/Projects/amp-up-app
git init
echo "node_modules\ndist\nout\n.DS_Store" > .gitignore
git add .
git commit -m "feat: scaffold electron-vite project with React + TypeScript"
```

---

### Task 2: Import Design System Assets

**Files:**
- Create: `app/src/renderer/assets/fonts/` (copy font files)
- Create: `app/src/renderer/assets/logos/` (copy logo files)
- Create: `app/src/renderer/styles/tokens.css` (copy from design-system)
- Create: `app/src/renderer/styles/typography.css` (copy + update font paths)
- Create: `app/src/renderer/styles/components.css` (copy from design-system)
- Create: `app/src/renderer/styles/global.css` (app-level base styles)

- [ ] **Step 1: Copy font files into the app**

```bash
mkdir -p app/src/renderer/assets/fonts
cp design-system/fonts/*.woff2 app/src/renderer/assets/fonts/
```

- [ ] **Step 2: Copy logo files into the app**

```bash
mkdir -p app/src/renderer/assets/logos
cp design-system/assets/*.svg app/src/renderer/assets/logos/
cp design-system/assets/*.png app/src/renderer/assets/logos/
```

- [ ] **Step 3: Copy CSS token and component files**

```bash
mkdir -p app/src/renderer/styles
cp design-system/tokens.css app/src/renderer/styles/tokens.css
cp design-system/components.css app/src/renderer/styles/components.css
```

- [ ] **Step 4: Copy typography.css and update font paths**

```bash
cp design-system/typography.css app/src/renderer/styles/typography.css
```

Then edit `app/src/renderer/styles/typography.css` — change all `url('../fonts/` references to `url('../assets/fonts/`:

Replace:
```css
src: url('../fonts/PPNeueMontreal-Regular.woff2') format('woff2');
```
With:
```css
src: url('../assets/fonts/PPNeueMontreal-Regular.woff2') format('woff2');
```

Do this for all 5 font-face declarations (PPNeueMontreal-Regular, Medium, SemiBold, Bold, and PPEditorialNew-UltralightItalic).

- [ ] **Step 5: Create global.css with base app styles**

Create `app/src/renderer/styles/global.css`:

```css
/* AMP UP — Global Styles */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-sans);
  background: #FEFCF9;
  color: #1a1a2e;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* macOS titlebar drag region */
.titlebar-drag-region {
  -webkit-app-region: drag;
  height: 38px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.14); }

/* No text selection on UI elements */
.no-select {
  -webkit-user-select: none;
  user-select: none;
}
```

- [ ] **Step 6: Import all CSS in main.tsx**

Replace `app/src/renderer/main.tsx`:

```tsx
import './styles/tokens.css'
import './styles/typography.css'
import './styles/components.css'
import './styles/global.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Verify fonts and styles load**

Replace `app/src/renderer/App.tsx` temporarily:

```tsx
export default function App() {
  return (
    <div style={{ padding: '80px 40px', background: '#F5F0EB', minHeight: '100%' }}>
      <div className="titlebar-drag-region" />
      <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 700, color: '#1a1a2e' }}>
        Hello, Rose
      </h1>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#8E8B87', marginTop: '4px' }}>
        PP Neue Montreal is loading if this looks clean and geometric.
      </p>
      <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '24px', color: '#1a1a2e', marginTop: '20px' }}>
        PP Editorial New italic accent text
      </p>
    </div>
  )
}
```

```bash
cd app && npm run dev
```

Expected: Window shows "Hello, Rose" in PP Neue Montreal, italic text in PP Editorial New. Warm beige background. macOS traffic lights visible in upper left.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: import design system — fonts, logos, CSS tokens, typography"
```

---

### Task 3: Build the App Shell with Sidebar and Router

**Files:**
- Create: `app/src/renderer/components/Sidebar.tsx`
- Create: `app/src/renderer/components/Sidebar.css`
- Create: `app/src/renderer/layouts/AppLayout.tsx`
- Create: `app/src/renderer/layouts/AppLayout.css`
- Create: `app/src/renderer/pages/Dashboard.tsx`
- Create: `app/src/renderer/pages/Dashboard.css`
- Modify: `app/src/renderer/App.tsx`

- [ ] **Step 1: Create Sidebar component**

Create `app/src/renderer/components/Sidebar.css`:

```css
.sidebar {
  width: 220px;
  background: #FEFCF9;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid #EDE8E2;
  padding-top: 38px; /* space for titlebar */
}

.sidebar-logo {
  padding: 22px 20px 16px;
  border-bottom: 1px solid #EDE8E2;
}

.sidebar-logo img {
  height: 26px;
}

.sidebar-nav {
  padding: 12px 10px;
  flex: 1;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #6B6966;
  border-radius: 10px;
  cursor: pointer;
  transition: all 100ms ease;
  position: relative;
  text-decoration: none;
  margin-bottom: 2px;
}

.nav-item:hover {
  background: #F0EBE5;
  color: #3D3832;
}

.nav-item.active {
  background: rgba(139, 43, 255, 0.08);
  color: #8B2BFF;
  font-weight: 600;
}

.nav-badge {
  position: absolute;
  right: 10px;
  background: #FF5C5C;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.nav-divider {
  height: 1px;
  background: #EDE8E2;
  margin: 8px 14px;
}

.sidebar-bottom {
  padding: 14px 20px;
  border-top: 1px solid #EDE8E2;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8B2BFF, #A855FF);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  position: relative;
}

.sidebar-avatar .online-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22C55E;
  border: 2px solid #FEFCF9;
}

.sidebar-user-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}

.sidebar-user-org {
  font-size: 11px;
  color: #8E8B87;
}
```

Create `app/src/renderer/components/Sidebar.tsx`:

```tsx
import { NavLink } from 'react-router-dom'
import logo from '../assets/logos/logo-wordmark-dark.svg'
import './Sidebar.css'

const systems = [
  { name: 'Learning System', path: '/system/learning', icon: 'book' },
  { name: 'Marketing System', path: '/system/marketing', icon: 'monitor' },
  { name: 'AI Operations', path: '/system/ai-ops', icon: 'layers' }
]

const BookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h5a3.5 3.5 0 013.5 3.5V18a2.5 2.5 0 00-2.5-2.5H2V3z"/>
    <path d="M18 3h-5a3.5 3.5 0 00-3.5 3.5V18a2.5 2.5 0 012.5-2.5H18V3z"/>
  </svg>
)

const MonitorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1z"/>
    <path d="M2 8h16"/><path d="M6 15v3M14 15v3M4 18h12"/>
  </svg>
)

const LayersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L2 6l8 4 8-4-8-4z"/><path d="M2 14l8 4 8-4"/><path d="M2 10l8 4 8-4"/>
  </svg>
)

const iconMap: Record<string, React.FC> = { book: BookIcon, monitor: MonitorIcon, layers: LayersIcon }

export default function Sidebar() {
  return (
    <aside className="sidebar no-select">
      <div className="sidebar-logo">
        <img src={logo} alt="AI Momentum Protocols" />
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span style={{ fontSize: '16px' }}>⬥</span> Dashboard
        </NavLink>
        <NavLink to="/inbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span style={{ fontSize: '14px' }}>✉</span> Inbox
          <span className="nav-badge">3</span>
        </NavLink>

        <div className="nav-divider" />

        {systems.map((sys) => {
          const Icon = iconMap[sys.icon]
          return (
            <NavLink key={sys.path} to={sys.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon /> {sys.name}
            </NavLink>
          )
        })}

        <div className="nav-divider" />

        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span style={{ fontSize: '16px' }}>⚙</span> Settings
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-avatar">
          R
          <div className="online-dot" />
        </div>
        <div>
          <div className="sidebar-user-name">Rose</div>
          <div className="sidebar-user-org">Parrot Labs</div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create AppLayout**

Create `app/src/renderer/layouts/AppLayout.css`:

```css
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  background: #F5F0EB;
  padding-top: 38px; /* space for titlebar */
}
```

Create `app/src/renderer/layouts/AppLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import './AppLayout.css'

export default function AppLayout() {
  return (
    <div className="app-layout">
      <div className="titlebar-drag-region" />
      <Sidebar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create placeholder Dashboard page**

Create `app/src/renderer/pages/Dashboard.css`:

```css
.dashboard {
  max-width: 1020px;
  margin: 0 auto;
  padding: 40px 48px 60px;
}

.dashboard-greeting {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.dashboard-subtitle {
  font-size: 14px;
  color: #8E8B87;
  margin-bottom: 36px;
}
```

Create `app/src/renderer/pages/Dashboard.tsx`:

```tsx
import './Dashboard.css'

export default function Dashboard() {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="dashboard">
      <h1 className="dashboard-greeting">{greeting}, Rose</h1>
      <p className="dashboard-subtitle">Here's what's happening across your systems.</p>
      <p style={{ color: '#B5B1AC', fontSize: '13px' }}>Dashboard content coming next...</p>
    </div>
  )
}
```

- [ ] **Step 4: Wire up the router in App.tsx**

Replace `app/src/renderer/App.tsx`:

```tsx
import { HashRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<div style={{ padding: '40px 48px' }}><h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e' }}>Inbox</h1></div>} />
          <Route path="/system/:systemId" element={<div style={{ padding: '40px 48px' }}><h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e' }}>System Overview</h1></div>} />
          <Route path="/settings" element={<div style={{ padding: '40px 48px' }}><h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e' }}>Settings</h1></div>} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
```

- [ ] **Step 5: Run and verify navigation**

```bash
cd app && npm run dev
```

Expected: App opens with sidebar on the left (logo, nav items, user profile at bottom) and dashboard on the right. Clicking nav items switches the main content. Active nav item is highlighted violet. macOS traffic lights work.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: app shell with sidebar navigation and React Router"
```

---

### Task 4: Build Dashboard System Cards

**Files:**
- Create: `app/src/renderer/components/SystemCard.tsx`
- Create: `app/src/renderer/components/SystemCard.css`
- Modify: `app/src/renderer/pages/Dashboard.tsx`
- Modify: `app/src/renderer/pages/Dashboard.css`

- [ ] **Step 1: Create SystemCard component**

Create `app/src/renderer/components/SystemCard.css`:

```css
.system-card {
  border-radius: 16px;
  padding: 24px;
  cursor: pointer;
  transition: all 200ms ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  text-decoration: none;
  color: white;
  display: block;
  overflow: hidden;
  position: relative;
}

.system-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.system-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.system-card-icon svg {
  width: 22px;
  height: 22px;
  stroke: white;
}

.system-card-name {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
}

.system-card-meta {
  font-size: 13px;
  opacity: 0.85;
}

.systems-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #B0ADA8;
  margin-bottom: 14px;
}
```

Create `app/src/renderer/components/SystemCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import './SystemCard.css'

interface SystemCardProps {
  name: string
  path: string
  gradient: string
  meta: string
  icon: React.ReactNode
}

export default function SystemCard({ name, path, gradient, meta, icon }: SystemCardProps) {
  return (
    <Link to={path} className="system-card" style={{ background: gradient }}>
      <div className="system-card-icon">{icon}</div>
      <div className="system-card-name">{name}</div>
      <div className="system-card-meta">{meta}</div>
    </Link>
  )
}
```

- [ ] **Step 2: Add system cards to Dashboard**

Replace `app/src/renderer/pages/Dashboard.tsx`:

```tsx
import SystemCard from '../components/SystemCard'
import './Dashboard.css'

const BookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h5a3.5 3.5 0 013.5 3.5V18a2.5 2.5 0 00-2.5-2.5H2V3z"/>
    <path d="M18 3h-5a3.5 3.5 0 00-3.5 3.5V18a2.5 2.5 0 012.5-2.5H18V3z"/>
  </svg>
)

const MonitorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1z"/>
    <path d="M2 8h16"/><path d="M6 15v3M14 15v3M4 18h12"/>
  </svg>
)

const LayersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L2 6l8 4 8-4-8-4z"/><path d="M2 14l8 4 8-4"/><path d="M2 10l8 4 8-4"/>
  </svg>
)

export default function Dashboard() {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="dashboard">
      <h1 className="dashboard-greeting">{greeting}, Rose</h1>
      <p className="dashboard-subtitle">Here's what's happening across your systems.</p>

      <div className="section-label">Your Systems</div>
      <div className="systems-grid">
        <SystemCard
          name="Learning System"
          path="/system/learning"
          gradient="linear-gradient(135deg, #8B2BFF, #A855FF)"
          meta="5 playbooks · 47 files · 2 open drafts"
          icon={<BookIcon />}
        />
        <SystemCard
          name="Marketing System"
          path="/system/marketing"
          gradient="linear-gradient(135deg, #FF7B00, #FFB875)"
          meta="3 playbooks · 23 files · Synced"
          icon={<MonitorIcon />}
        />
        <SystemCard
          name="AI Operations"
          path="/system/ai-ops"
          gradient="linear-gradient(135deg, #3D0052, #7A3D8F)"
          meta="12 playbooks · 112 files · 3 updates"
          icon={<LayersIcon />}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run and verify**

```bash
cd app && npm run dev
```

Expected: Dashboard shows "Good afternoon, Rose" with 3 saturated gradient system cards. Cards hover with lift effect. Clicking a card navigates to the system route.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: dashboard with system cards"
```

---

### Task 5: Add File System IPC Bridge

**Files:**
- Modify: `app/src/main/index.ts` (add IPC handlers)
- Modify: `app/src/preload/index.ts` (expose API to renderer)

- [ ] **Step 1: Add IPC handlers in main process**

Add to the top of `app/src/main/index.ts`, after existing imports:

```typescript
import { ipcMain } from 'electron'
import { readdir, readFile, stat } from 'fs/promises'
```

Add before `app.whenReady()`:

```typescript
ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const results = entries
      .filter(entry => !entry.name.startsWith('.') || entry.name === '.claude')
      .map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: join(dirPath, entry.name)
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    return { ok: true, entries: results }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { ok: true, content }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('fs:stat', async (_event, filePath: string) => {
  try {
    const stats = await stat(filePath)
    return {
      ok: true,
      stats: {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString()
      }
    }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})
```

- [ ] **Step 2: Expose API in preload script**

Replace `app/src/preload/index.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export interface FsResult<T> {
  ok: boolean
  error?: string
  entries?: T[]
  content?: string
  stats?: {
    size: number
    isDirectory: boolean
    modified: string
    created: string
  }
}

const api = {
  fs: {
    readDirectory: (path: string): Promise<FsResult<FileEntry>> =>
      ipcRenderer.invoke('fs:readDirectory', path),
    readFile: (path: string): Promise<FsResult<never>> =>
      ipcRenderer.invoke('fs:readFile', path),
    stat: (path: string): Promise<FsResult<never>> =>
      ipcRenderer.invoke('fs:stat', path),
  }
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 3: Add TypeScript type declarations for the API**

Create `app/src/renderer/env.d.ts`:

```typescript
interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

interface FsResult<T = unknown> {
  ok: boolean
  error?: string
  entries?: T[]
  content?: string
  stats?: {
    size: number
    isDirectory: boolean
    modified: string
    created: string
  }
}

interface ElectronAPI {
  fs: {
    readDirectory: (path: string) => Promise<FsResult<FileEntry>>
    readFile: (path: string) => Promise<FsResult>
    stat: (path: string) => Promise<FsResult>
  }
}

interface Window {
  api: ElectronAPI
}
```

- [ ] **Step 4: Verify IPC works with a quick test**

Temporarily add to `app/src/renderer/pages/Dashboard.tsx`, inside the component, before the return:

```typescript
React.useEffect(() => {
  window.api.fs.readDirectory('/Users/kristidowns/Documents/Projects').then(result => {
    console.log('FS test:', result)
  })
}, [])
```

Add `import React from 'react'` at the top if not already there.

```bash
cd app && npm run dev
```

Open DevTools (Cmd+Option+I). Check console — should see the directory listing. Then remove the test `useEffect`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: file system IPC bridge — readDirectory, readFile, stat"
```

---

### Task 6: Build File Tree Component

**Files:**
- Create: `app/src/renderer/components/FileTree.tsx`
- Create: `app/src/renderer/components/FileTree.css`

- [ ] **Step 1: Create FileTree CSS**

Create `app/src/renderer/components/FileTree.css`:

```css
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.tree-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #B5B1AC;
  padding: 14px 18px 6px;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 18px;
  font-size: 13px;
  color: #6B6966;
  cursor: pointer;
  transition: all 80ms ease;
}

.tree-item:hover {
  background: #F0EBE5;
  color: #3D3832;
}

.tree-item.active {
  background: rgba(139,43,255,0.06);
  color: #8B2BFF;
  font-weight: 500;
}

.tree-item-icon {
  width: 16px;
  text-align: center;
  font-size: 13px;
  opacity: 0.5;
  flex-shrink: 0;
}

.tree-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 2: Create FileTree component**

Create `app/src/renderer/components/FileTree.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import './FileTree.css'

interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

interface TreeNode extends FileEntry {
  children?: TreeNode[]
  expanded?: boolean
  depth: number
}

interface FileTreeProps {
  rootPath: string
  onFileSelect?: (path: string) => void
  selectedFile?: string
}

export default function FileTree({ rootPath, onFileSelect, selectedFile }: FileTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([])

  const loadDirectory = useCallback(async (dirPath: string, depth: number): Promise<TreeNode[]> => {
    const result = await window.api.fs.readDirectory(dirPath)
    if (!result.ok || !result.entries) return []
    return result.entries.map(entry => ({
      ...entry,
      depth,
      expanded: false,
      children: undefined
    }))
  }, [])

  useEffect(() => {
    if (rootPath) {
      loadDirectory(rootPath, 0).then(setNodes)
    }
  }, [rootPath, loadDirectory])

  const toggleDirectory = async (node: TreeNode, index: number) => {
    const updated = [...nodes]
    const flatIndex = findFlatIndex(updated, node.path)
    if (flatIndex === -1) return

    if (node.expanded) {
      collapseNode(updated, flatIndex)
    } else {
      const children = await loadDirectory(node.path, node.depth + 1)
      expandNode(updated, flatIndex, children)
    }
    setNodes(updated)
  }

  const findFlatIndex = (items: TreeNode[], path: string): number => {
    return items.findIndex(n => n.path === path)
  }

  const expandNode = (items: TreeNode[], index: number, children: TreeNode[]) => {
    items[index] = { ...items[index], expanded: true }
    items.splice(index + 1, 0, ...children)
  }

  const collapseNode = (items: TreeNode[], index: number) => {
    const node = items[index]
    items[index] = { ...items[index], expanded: false }
    let removeCount = 0
    for (let i = index + 1; i < items.length; i++) {
      if (items[i].depth > node.depth) removeCount++
      else break
    }
    items.splice(index + 1, removeCount)
  }

  const handleClick = (node: TreeNode, index: number) => {
    if (node.isDirectory) {
      toggleDirectory(node, index)
    } else {
      onFileSelect?.(node.path)
    }
  }

  return (
    <div className="file-tree">
      {nodes.map((node, index) => (
        <div
          key={node.path}
          className={`tree-item ${selectedFile === node.path ? 'active' : ''}`}
          style={{ paddingLeft: `${18 + node.depth * 16}px` }}
          onClick={() => handleClick(node, index)}
        >
          <span className="tree-item-icon">
            {node.isDirectory ? (node.expanded ? '▾' : '▸') : '📄'}
          </span>
          <span className="tree-item-name">{node.name}</span>
        </div>
      ))}
      {nodes.length === 0 && (
        <div style={{ padding: '18px', fontSize: '13px', color: '#B5B1AC' }}>
          No files found
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create a test page that uses FileTree**

Create `app/src/renderer/pages/SystemOverview.tsx`:

```tsx
import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import { useState } from 'react'

const systemPaths: Record<string, string> = {
  learning: '/Users/kristidowns/Documents/Projects/amp-up-app',
  marketing: '',
  'ai-ops': ''
}

export default function SystemOverview() {
  const { systemId } = useParams<{ systemId: string }>()
  const [selectedFile, setSelectedFile] = useState<string>()
  const rootPath = systemPaths[systemId || ''] || ''

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{
        width: '260px',
        background: '#FEFCF9',
        borderRight: '1px solid #EDE8E2',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #EDE8E2' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a2e' }}>
            {systemId === 'learning' ? 'Learning System' : systemId === 'marketing' ? 'Marketing System' : 'AI Operations'}
          </div>
          <div style={{ fontSize: '11px', color: '#8E8B87', marginTop: '2px' }}>
            {rootPath ? rootPath.split('/').pop() : 'No folder configured'}
          </div>
        </div>
        {rootPath && <FileTree rootPath={rootPath} onFileSelect={setSelectedFile} selectedFile={selectedFile} />}
      </div>
      <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>
          {systemId === 'learning' ? 'Learning System' : systemId === 'marketing' ? 'Marketing System' : 'AI Operations'}
        </h2>
        {selectedFile && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'white', borderRadius: '12px', fontSize: '13px', color: '#6B6966' }}>
            Selected: {selectedFile}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add route for SystemOverview**

In `app/src/renderer/App.tsx`, add the import and update the route:

```tsx
import SystemOverview from './pages/SystemOverview'
```

Replace the system route:
```tsx
<Route path="/system/:systemId" element={<SystemOverview />} />
```

- [ ] **Step 5: Run and verify file tree**

```bash
cd app && npm run dev
```

Click "Learning System" in the sidebar. Expected: Left panel shows a file tree of the `amp-up-app` directory. Click folders to expand them. Click files to select them (highlighted). The tree reads from the actual filesystem.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: file tree component reading from local filesystem via IPC"
```

---

### Task 7: Add File Content Viewer

**Files:**
- Create: `app/src/renderer/components/FileViewer.tsx`
- Create: `app/src/renderer/components/FileViewer.css`
- Modify: `app/src/renderer/pages/SystemOverview.tsx`

- [ ] **Step 1: Create FileViewer CSS**

Create `app/src/renderer/components/FileViewer.css`:

```css
.file-viewer {
  background: white;
  border-radius: 16px 16px 0 0;
  margin: 10px 10px 0;
  box-shadow: 0 -1px 4px rgba(0,0,0,0.03);
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
}

.file-viewer-content {
  width: 100%;
  max-width: 720px;
  padding: 48px 40px 80px;
}

.file-viewer-breadcrumb {
  font-size: 12px;
  color: #B5B1AC;
  margin-bottom: 24px;
  font-family: var(--font-mono);
}

.file-viewer-title {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #1a1a2e;
  margin-bottom: 24px;
}

.file-viewer-body {
  font-size: 15px;
  line-height: 1.75;
  color: #5C5955;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.file-viewer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #B5B1AC;
  font-size: 14px;
}
```

- [ ] **Step 2: Create FileViewer component**

Create `app/src/renderer/components/FileViewer.tsx`:

```tsx
import { useState, useEffect } from 'react'
import './FileViewer.css'

interface FileViewerProps {
  filePath: string | undefined
}

export default function FileViewer({ filePath }: FileViewerProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!filePath) {
      setContent('')
      return
    }
    setLoading(true)
    window.api.fs.readFile(filePath).then(result => {
      if (result.ok && result.content !== undefined) {
        setContent(result.content)
      } else {
        setContent(`Error reading file: ${result.error}`)
      }
      setLoading(false)
    })
  }, [filePath])

  if (!filePath) {
    return (
      <div className="file-viewer">
        <div className="file-viewer-empty">
          Select a file to view its contents
        </div>
      </div>
    )
  }

  const fileName = filePath.split('/').pop() || ''
  const dirPath = filePath.split('/').slice(-3, -1).join(' / ')

  return (
    <div className="file-viewer">
      <div className="file-viewer-content">
        <div className="file-viewer-breadcrumb">{dirPath}</div>
        <div className="file-viewer-title">{fileName}</div>
        {loading ? (
          <div style={{ color: '#B5B1AC' }}>Loading...</div>
        ) : (
          <div className="file-viewer-body">{content}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add FileViewer to SystemOverview**

Update `app/src/renderer/pages/SystemOverview.tsx` — replace the right panel content:

```tsx
import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import { useState } from 'react'

const systemPaths: Record<string, string> = {
  learning: '/Users/kristidowns/Documents/Projects/amp-up-app',
  marketing: '',
  'ai-ops': ''
}

export default function SystemOverview() {
  const { systemId } = useParams<{ systemId: string }>()
  const [selectedFile, setSelectedFile] = useState<string>()
  const rootPath = systemPaths[systemId || ''] || ''

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{
        width: '260px',
        background: '#FEFCF9',
        borderRight: '1px solid #EDE8E2',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #EDE8E2' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a2e' }}>
            {systemId === 'learning' ? 'Learning System' : systemId === 'marketing' ? 'Marketing System' : 'AI Operations'}
          </div>
          <div style={{ fontSize: '11px', color: '#8E8B87', marginTop: '2px' }}>
            {rootPath ? rootPath.split('/').pop() : 'No folder configured'}
          </div>
        </div>
        {rootPath && <FileTree rootPath={rootPath} onFileSelect={setSelectedFile} selectedFile={selectedFile} />}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F5F0EB' }}>
        <FileViewer filePath={selectedFile} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run and verify end-to-end**

```bash
cd app && npm run dev
```

Click "Learning System" → see file tree → click a `.md` file → see its content rendered in the right panel with the floating white card. Click `PROJECT-SYNTHESIS.md` to see a large file render.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: file viewer — reads and displays local file content"
```

---

## Summary

After all 7 tasks, you'll have:

1. **Working Electron app** with hidden titlebar and macOS traffic lights
2. **Design system imported** — PP Neue Montreal fonts, CSS tokens, logos
3. **App shell** — sidebar with navigation, React Router switching views
4. **Dashboard** — greeting, system cards with gradients
5. **File system IPC** — main process reads directories and files, exposed to renderer
6. **File tree** — reads actual local directories, expand/collapse, file selection
7. **File viewer** — displays file content in a styled floating card

This proves out the core technical stack: Electron rendering our design system, filesystem access via IPC, and the foundational UI structure. Next steps from here would be adding TipTap for rich markdown editing, git status integration, and the remaining dashboard sections.
