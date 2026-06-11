// Shared SVG icons for systems — used in Sidebar, Dashboard, and Settings

export const BookIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h5a3.5 3.5 0 013.5 3.5V18a2.5 2.5 0 00-2.5-2.5H2V3z"/>
    <path d="M18 3h-5a3.5 3.5 0 00-3.5 3.5V18a2.5 2.5 0 012.5-2.5H18V3z"/>
  </svg>
)

export const MonitorIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1z"/>
    <path d="M2 8h16"/><path d="M6 15v3M14 15v3M4 18h12"/>
  </svg>
)

export const LayersIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L2 6l8 4 8-4-8-4z"/><path d="M2 14l8 4 8-4"/><path d="M2 10l8 4 8-4"/>
  </svg>
)

export const StarIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2l2.5 5.1 5.6.8-4.1 3.9 1 5.6L10 14.8l-5 2.6 1-5.6-4.1-3.9 5.6-.8z"/>
  </svg>
)

export const GearIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="3"/>
    <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.93 3.93l1.41 1.41M14.66 14.66l1.41 1.41M3.93 16.07l1.41-1.41M14.66 5.34l1.41-1.41"/>
  </svg>
)

export const RocketIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 18s-4-3.5-4-8c0-4 2.5-8 4-8s4 4 4 8c0 4.5-4 8-4 8z"/>
    <circle cx="10" cy="10" r="2"/>
    <path d="M6 14l-3 3M14 14l3 3"/>
  </svg>
)

export const DocIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z"/>
    <path d="M8 7h4M8 10h4M8 13h2"/>
  </svg>
)

export const LightIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2a5 5 0 013 9v2a1 1 0 01-1 1H8a1 1 0 01-1-1v-2a5 5 0 013-9z"/>
    <path d="M8 16h4M9 18h2"/>
  </svg>
)

export const iconMap: Record<string, React.FC<{ size?: number }>> = {
  book: BookIcon,
  monitor: MonitorIcon,
  layers: LayersIcon,
  star: StarIcon,
  gear: GearIcon,
  rocket: RocketIcon,
  doc: DocIcon,
  light: LightIcon,
}

export const iconList = [
  { value: 'book', label: 'Book' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'layers', label: 'Layers' },
  { value: 'star', label: 'Star' },
  { value: 'gear', label: 'Gear' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'doc', label: 'Document' },
  { value: 'light', label: 'Light' },
]
