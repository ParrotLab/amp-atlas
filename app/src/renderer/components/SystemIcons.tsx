// Shared SVG icons for systems — used in Sidebar, Dashboard, and Settings
// All icons use a consistent 20x20 viewBox with stroke-based rendering

const I = ({ size = 18, children }: { size?: number; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const BookIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M2 3h5a3.5 3.5 0 013.5 3.5V18a2.5 2.5 0 00-2.5-2.5H2V3z"/><path d="M18 3h-5a3.5 3.5 0 00-3.5 3.5V18a2.5 2.5 0 012.5-2.5H18V3z"/></I>
export const MonitorIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M17 3H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1z"/><path d="M2 8h16"/><path d="M6 15v3M14 15v3M4 18h12"/></I>
export const LayersIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M10 2L2 6l8 4 8-4-8-4z"/><path d="M2 14l8 4 8-4"/><path d="M2 10l8 4 8-4"/></I>
export const StarIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M10 2l2.5 5.1 5.6.8-4.1 3.9 1 5.6L10 14.8l-5 2.6 1-5.6-4.1-3.9 5.6-.8z"/></I>
export const GearIcon = ({ size = 18 }: { size?: number }) => <I size={size}><circle cx="10" cy="10" r="3"/><path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.93 3.93l1.41 1.41M14.66 14.66l1.41 1.41M3.93 16.07l1.41-1.41M14.66 5.34l1.41-1.41"/></I>
export const RocketIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M10 18s-4-3.5-4-8c0-4 2.5-8 4-8s4 4 4 8c0 4.5-4 8-4 8z"/><circle cx="10" cy="10" r="2"/><path d="M6 14l-3 3M14 14l3 3"/></I>
export const DocIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M14 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z"/><path d="M8 7h4M8 10h4M8 13h2"/></I>
export const LightIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M10 2a5 5 0 013 9v2a1 1 0 01-1 1H8a1 1 0 01-1-1v-2a5 5 0 013-9z"/><path d="M8 16h4M9 18h2"/></I>

// Additional icons
export const HeartIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M10 17S2 12.5 2 7.5C2 4.5 4.5 2 7 2c1.5 0 2.5.8 3 2 .5-1.2 1.5-2 3-2 2.5 0 5 2.5 5 5.5C18 12.5 10 17 10 17z"/></I>
export const ShieldIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M10 2l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V5l7-3z"/></I>
export const ChatIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H7l-4 3V5a1 1 0 011-1z"/></I>
export const PencilIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z"/><path d="M11 6l3 3"/></I>
export const FolderIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M2 5a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"/></I>
export const TargetIcon = ({ size = 18 }: { size?: number }) => <I size={size}><circle cx="10" cy="10" r="8"/><circle cx="10" cy="10" r="5"/><circle cx="10" cy="10" r="2"/></I>
export const ChartIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M2 17h16"/><path d="M5 17V8M9 17V4M13 17V10M17 17V6"/></I>
export const UsersIcon = ({ size = 18 }: { size?: number }) => <I size={size}><circle cx="7" cy="6" r="3"/><path d="M1 17v-1a4 4 0 014-4h4a4 4 0 014 4v1"/><circle cx="15" cy="7" r="2.5"/><path d="M15 12.5a3 3 0 013 3V17"/></I>
export const GlobeIcon = ({ size = 18 }: { size?: number }) => <I size={size}><circle cx="10" cy="10" r="8"/><path d="M2 10h16"/><path d="M10 2a12 12 0 014 8 12 12 0 01-4 8 12 12 0 01-4-8 12 12 0 014-8z"/></I>
export const ClockIcon = ({ size = 18 }: { size?: number }) => <I size={size}><circle cx="10" cy="10" r="8"/><path d="M10 5v5l3.5 2"/></I>
export const BoltIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M11 1L4 11h5l-1 8 7-10h-5l1-8z"/></I>
export const MusicIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M8 17a3 3 0 100-6 3 3 0 000 6z"/><path d="M11 17V3l6-2v14"/><path d="M14 15a3 3 0 100-6 3 3 0 000 6z"/></I>
export const CameraIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M2 7a2 2 0 012-2h2l1.5-2h5L14 5h2a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V7z"/><circle cx="10" cy="11" r="3"/></I>
export const CodeIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M6 6L1 10l5 4M14 6l5 4-5 4M12 2l-4 16"/></I>
export const PuzzleIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M8 2v2a2 2 0 104 0V2h4a2 2 0 012 2v4h-2a2 2 0 100 4h2v4a2 2 0 01-2 2h-4v-2a2 2 0 10-4 0v2H4a2 2 0 01-2-2v-4h2a2 2 0 100-4H2V4a2 2 0 012-2h4z"/></I>
export const MapIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M1 5l6-3 6 3 6-3v14l-6 3-6-3-6 3V5z"/><path d="M7 2v14M13 5v14"/></I>
export const BriefcaseIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M2 7a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V7z"/><path d="M7 5V3a1 1 0 011-1h4a1 1 0 011 1v2"/></I>
export const SparkleIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5z"/><path d="M15 12l.75 2.25L18 15l-2.25.75L15 18l-.75-2.25L12 15l2.25-.75z"/></I>
export const FlaskIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M7 2h6M8 2v6l-5 8a1 1 0 00.9 1.5h12.2a1 1 0 00.9-1.5L12 8V2"/><path d="M5 13h10"/></I>
export const MegaphoneIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M17 4v12l-6-2.5V6.5L17 4z"/><path d="M11 6.5H5a2 2 0 00-2 2v1a2 2 0 002 2h1l1.5 5H10l-1.5-5H11"/></I>
export const TrophyIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M6 2h8v6a4 4 0 01-8 0V2z"/><path d="M6 4H3v2a3 3 0 003 3M14 4h3v2a3 3 0 01-3 3"/><path d="M10 12v3M7 17h6"/></I>
export const WrenchIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M15.5 2.5a4.5 4.5 0 00-5.6 5.3L3 14.7V17h2.3l6.9-6.9a4.5 4.5 0 005.3-5.6l-2.8 2.8-2-2 2.8-2.8z"/></I>
export const LeafIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M17 3S8 4 5 10c-2 4-1 7-1 7"/><path d="M3 17c4-1 7-4 9-7"/><path d="M17 3c-2 6-6 10-14 14"/></I>
export const DiamondIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M5 3h10l3 5-8 10L2 8l3-5z"/><path d="M2 8h16"/></I>
export const HomeIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M3 10l7-7 7 7"/><path d="M5 8v8a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8"/></I>
export const AnchorIcon = ({ size = 18 }: { size?: number }) => <I size={size}><circle cx="10" cy="5" r="3"/><path d="M10 8v10"/><path d="M3 13a7 7 0 0014 0"/><path d="M7 12h6"/></I>
export const CrownIcon = ({ size = 18 }: { size?: number }) => <I size={size}><path d="M3 16h14l-2-10-3.5 4L10 4 8.5 10 5 6 3 16z"/><path d="M3 16a1 1 0 001 1h12a1 1 0 001-1"/></I>

export const iconMap: Record<string, React.FC<{ size?: number }>> = {
  book: BookIcon,
  monitor: MonitorIcon,
  layers: LayersIcon,
  star: StarIcon,
  gear: GearIcon,
  rocket: RocketIcon,
  doc: DocIcon,
  light: LightIcon,
  heart: HeartIcon,
  shield: ShieldIcon,
  chat: ChatIcon,
  pencil: PencilIcon,
  folder: FolderIcon,
  target: TargetIcon,
  chart: ChartIcon,
  users: UsersIcon,
  globe: GlobeIcon,
  clock: ClockIcon,
  bolt: BoltIcon,
  music: MusicIcon,
  camera: CameraIcon,
  code: CodeIcon,
  puzzle: PuzzleIcon,
  map: MapIcon,
  briefcase: BriefcaseIcon,
  sparkle: SparkleIcon,
  flask: FlaskIcon,
  megaphone: MegaphoneIcon,
  trophy: TrophyIcon,
  wrench: WrenchIcon,
  leaf: LeafIcon,
  diamond: DiamondIcon,
  home: HomeIcon,
  anchor: AnchorIcon,
  crown: CrownIcon,
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
  { value: 'heart', label: 'Heart' },
  { value: 'shield', label: 'Shield' },
  { value: 'chat', label: 'Chat' },
  { value: 'pencil', label: 'Pencil' },
  { value: 'folder', label: 'Folder' },
  { value: 'target', label: 'Target' },
  { value: 'chart', label: 'Chart' },
  { value: 'users', label: 'Users' },
  { value: 'globe', label: 'Globe' },
  { value: 'clock', label: 'Clock' },
  { value: 'bolt', label: 'Bolt' },
  { value: 'music', label: 'Music' },
  { value: 'camera', label: 'Camera' },
  { value: 'code', label: 'Code' },
  { value: 'puzzle', label: 'Puzzle' },
  { value: 'map', label: 'Map' },
  { value: 'briefcase', label: 'Briefcase' },
  { value: 'sparkle', label: 'Sparkle' },
  { value: 'flask', label: 'Flask' },
  { value: 'megaphone', label: 'Megaphone' },
  { value: 'trophy', label: 'Trophy' },
  { value: 'wrench', label: 'Wrench' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'home', label: 'Home' },
  { value: 'anchor', label: 'Anchor' },
  { value: 'crown', label: 'Crown' },
]
