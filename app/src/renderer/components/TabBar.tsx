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
}

export default function TabBar({ tabs, activeTab, onTabClick, onTabClose }: TabBarProps) {
  return (
    <div className="editor-toolbar">
      <div className="editor-tabs">
        {tabs.map(tab => (
          <div
            key={tab.path}
            className={`tab ${activeTab === tab.path ? 'active' : ''}`}
            onClick={() => onTabClick(tab.path)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onTabClose(tab.path) } }}
          >
            {tab.status && <span className={`tab-dirty ${tab.status}`} aria-label="Uncommitted changes" />}
            <span className="tab-name">{tab.name}</span>
            <button
              className="tab-close"
              aria-label={`Close ${tab.name}`}
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.path)
              }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
