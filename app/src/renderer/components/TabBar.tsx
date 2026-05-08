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
  branchName?: string
  isMain?: boolean
  isDirty?: boolean
}

export default function TabBar({ tabs, activeTab, onTabClick, onTabClose, branchName, isMain, isDirty }: TabBarProps) {
  const displayBranch = isMain ? 'Current Version' : branchName ? `Draft: ${humanize(branchName)}` : ''

  if (tabs.length === 0 && !displayBranch) return null

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
      {displayBranch && (
        <div className="tab-bar-right">
          <button className="draft-selector">
            <span className={`draft-dot ${isMain ? 'main' : 'draft'}`} />
            {displayBranch}
            <span style={{ fontSize: '10px', color: '#B5B1AC' }}>&#9662;</span>
          </button>
          {isDirty && <span className="draft-status-pill editing">Editing</span>}
          {!isDirty && <span className="draft-status-pill clean">Saved</span>}
        </div>
      )}
    </div>
  )
}

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
