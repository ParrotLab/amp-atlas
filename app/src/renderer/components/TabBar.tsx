import { useState, useEffect, useRef } from 'react'
import { displayName } from '../utils/naming'
import './TabBar.css'

export interface Tab {
  path: string
  name: string
  status?: 'modified' | 'new'
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string | undefined
  onTabClick: (path: string) => void
  onTabClose: (path: string) => void
  onReorder: (fromPath: string, toIndex: number) => void
}

export default function TabBar({ tabs, activeTab, onTabClick, onTabClose, onReorder }: TabBarProps) {
  const [dragPath, setDragPath] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ index: number; after: boolean } | null>(null)
  const activeTabRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the active tab into view when it changes (opening a file, restoring a tab).
  // Fires only on activeTab change, so scrolling the strip yourself isn't fought.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeTab])

  const finishDrop = () => {
    if (dragPath && dropAt) onReorder(dragPath, dropAt.after ? dropAt.index + 1 : dropAt.index)
    setDragPath(null)
    setDropAt(null)
  }

  return (
    <div className="editor-toolbar">
      <div
        className="editor-tabs"
        onDragOver={e => { if (dragPath) e.preventDefault() }}
        onDrop={finishDrop}
      >
        {tabs.map((tab, i) => {
          const indicator = dropAt && dropAt.index === i ? (dropAt.after ? ' drop-after' : ' drop-before') : ''
          return (
            <div
              key={tab.path}
              ref={activeTab === tab.path ? activeTabRef : undefined}
              className={`tab ${activeTab === tab.path ? 'active' : ''}${dragPath === tab.path ? ' dragging' : ''}${indicator}`.trim()}
              draggable
              onClick={() => onTabClick(tab.path)}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onTabClose(tab.path) } }}
              onDragStart={(e) => { setDragPath(tab.path); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tab.path) }}
              onDragEnd={() => { setDragPath(null); setDropAt(null) }}
              onDragOver={(e) => {
                if (!dragPath) return
                e.preventDefault()
                if (tab.path === dragPath) { setDropAt(null); return }
                const rect = e.currentTarget.getBoundingClientRect()
                setDropAt({ index: i, after: e.clientX > rect.left + rect.width / 2 })
              }}
            >
              {tab.status && <span className={`tab-dirty ${tab.status}`} aria-label="Uncommitted changes" />}
              <span className="tab-name">{displayName(tab.name)}</span>
              <button
                className="tab-close"
                aria-label={`Close ${displayName(tab.name)}`}
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.path) }}
              >
                &times;
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
