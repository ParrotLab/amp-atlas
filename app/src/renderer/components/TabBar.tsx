import './TabBar.css'

export interface Tab {
  path: string
  name: string
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string | undefined
  onTabClick: (path: string) => void
  onTabClose: (path: string) => void
}

export default function TabBar({ tabs, activeTab, onTabClick, onTabClose }: TabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <div
          key={tab.path}
          className={`tab ${activeTab === tab.path ? 'active' : ''}`}
          onClick={() => onTabClick(tab.path)}
        >
          {tab.name}
          <button
            className="tab-close"
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
  )
}
