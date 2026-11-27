// Per-icon lucide imports. Every screen imports icons from here instead of
// 'lucide-react-native'.
//
// Previously each file imported from the package root. lucide-react-native has
// no "exports" map and its "react-native"/"main" entries are barrels that
// re-export all ~1,500 icons; Metro does not tree-shake, so the release Hermes
// bundle carried every icon (Popcorn, Bitcoin, FerrisWheel...) although the app
// uses about a hundred. Importing each icon's own ESM file keeps only these.
//
// Add a new icon here (kebab-case file name under dist/esm/icons). Types such
// as LucideIcon / LucideProps can still come from the package root with
// `import type`, which is erased at build time and bundles nothing.
export type { LucideIcon, LucideProps } from 'lucide-react-native';

export { default as AlertCircle } from 'lucide-react-native/dist/esm/icons/circle-alert';
export { default as AlertTriangle } from 'lucide-react-native/dist/esm/icons/triangle-alert';
export { default as ArrowLeft } from 'lucide-react-native/dist/esm/icons/arrow-left';
export { default as ArrowRight } from 'lucide-react-native/dist/esm/icons/arrow-right';
export { default as BadgeCheck } from 'lucide-react-native/dist/esm/icons/badge-check';
export { default as BarChart2 } from 'lucide-react-native/dist/esm/icons/chart-no-axes-column';
export { default as BarChart3 } from 'lucide-react-native/dist/esm/icons/chart-column';
export { default as BedDouble } from 'lucide-react-native/dist/esm/icons/bed-double';
export { default as Bell } from 'lucide-react-native/dist/esm/icons/bell';
export { default as BookOpen } from 'lucide-react-native/dist/esm/icons/book-open';
export { default as Briefcase } from 'lucide-react-native/dist/esm/icons/briefcase';
export { default as Building } from 'lucide-react-native/dist/esm/icons/building';
export { default as Building2 } from 'lucide-react-native/dist/esm/icons/building-2';
export { default as Calendar } from 'lucide-react-native/dist/esm/icons/calendar';
export { default as Camera } from 'lucide-react-native/dist/esm/icons/camera';
export { default as Car } from 'lucide-react-native/dist/esm/icons/car';
export { default as Check } from 'lucide-react-native/dist/esm/icons/check';
export { default as CheckCheck } from 'lucide-react-native/dist/esm/icons/check-check';
export { default as CheckCircle } from 'lucide-react-native/dist/esm/icons/circle-check-big';
export { default as CheckCircle2 } from 'lucide-react-native/dist/esm/icons/circle-check';
export { default as ChevronDown } from 'lucide-react-native/dist/esm/icons/chevron-down';
export { default as ChevronLeft } from 'lucide-react-native/dist/esm/icons/chevron-left';
export { default as ChevronRight } from 'lucide-react-native/dist/esm/icons/chevron-right';
export { default as ChevronUp } from 'lucide-react-native/dist/esm/icons/chevron-up';
export { default as ClipboardList } from 'lucide-react-native/dist/esm/icons/clipboard-list';
export { default as Clock } from 'lucide-react-native/dist/esm/icons/clock';
export { default as Compass } from 'lucide-react-native/dist/esm/icons/compass';
export { default as CreditCard } from 'lucide-react-native/dist/esm/icons/credit-card';
export { default as Download } from 'lucide-react-native/dist/esm/icons/download';
export { default as Edit3 } from 'lucide-react-native/dist/esm/icons/pen-line';
export { default as ExternalLink } from 'lucide-react-native/dist/esm/icons/external-link';
export { default as Eye } from 'lucide-react-native/dist/esm/icons/eye';
export { default as EyeOff } from 'lucide-react-native/dist/esm/icons/eye-off';
export { default as FileText } from 'lucide-react-native/dist/esm/icons/file-text';
export { default as Film } from 'lucide-react-native/dist/esm/icons/film';
export { default as Filter } from 'lucide-react-native/dist/esm/icons/filter';
export { default as Flame } from 'lucide-react-native/dist/esm/icons/flame';
export { default as FolderOpen } from 'lucide-react-native/dist/esm/icons/folder-open';
export { default as Globe } from 'lucide-react-native/dist/esm/icons/globe';
export { default as GraduationCap } from 'lucide-react-native/dist/esm/icons/graduation-cap';
export { default as HandCoins } from 'lucide-react-native/dist/esm/icons/hand-coins';
export { default as HardHat } from 'lucide-react-native/dist/esm/icons/hard-hat';
export { default as Hash } from 'lucide-react-native/dist/esm/icons/hash';
export { default as Heart } from 'lucide-react-native/dist/esm/icons/heart';
export { default as Bath } from 'lucide-react-native/dist/esm/icons/bath';
export { default as Upload } from 'lucide-react-native/dist/esm/icons/upload';
export { default as SquareParking } from 'lucide-react-native/dist/esm/icons/square-parking';
export { default as HelpCircle } from 'lucide-react-native/dist/esm/icons/circle-help';
export { default as Home } from 'lucide-react-native/dist/esm/icons/house';
export { default as Image } from 'lucide-react-native/dist/esm/icons/image';
export { default as ImagePlus } from 'lucide-react-native/dist/esm/icons/image-plus';
export { default as IndianRupee } from 'lucide-react-native/dist/esm/icons/indian-rupee';
export { default as Info } from 'lucide-react-native/dist/esm/icons/info';
export { default as KeyRound } from 'lucide-react-native/dist/esm/icons/key-round';
export { default as Landmark } from 'lucide-react-native/dist/esm/icons/landmark';
export { default as Layers } from 'lucide-react-native/dist/esm/icons/layers';
export { default as LayoutDashboard } from 'lucide-react-native/dist/esm/icons/layout-dashboard';
export { default as LayoutTemplate } from 'lucide-react-native/dist/esm/icons/layout-template';
export { default as Link } from 'lucide-react-native/dist/esm/icons/link';
export { default as Link2 } from 'lucide-react-native/dist/esm/icons/link-2';
export { default as List } from 'lucide-react-native/dist/esm/icons/list';
export { default as ListPlus } from 'lucide-react-native/dist/esm/icons/list-plus';
export { default as Locate } from 'lucide-react-native/dist/esm/icons/locate';
export { default as Lock } from 'lucide-react-native/dist/esm/icons/lock';
export { default as LogOut } from 'lucide-react-native/dist/esm/icons/log-out';
export { default as Mail } from 'lucide-react-native/dist/esm/icons/mail';
export { default as MapIcon } from 'lucide-react-native/dist/esm/icons/map';
export { default as Maximize } from 'lucide-react-native/dist/esm/icons/maximize';
export { default as MapPin } from 'lucide-react-native/dist/esm/icons/map-pin';
export { default as Menu } from 'lucide-react-native/dist/esm/icons/menu';
export { default as MessageCircle } from 'lucide-react-native/dist/esm/icons/message-circle';
export { default as MessageSquare } from 'lucide-react-native/dist/esm/icons/message-square';
export { default as Monitor } from 'lucide-react-native/dist/esm/icons/monitor';
export { default as Mountain } from 'lucide-react-native/dist/esm/icons/mountain';
export { default as MoreVertical } from 'lucide-react-native/dist/esm/icons/ellipsis-vertical';
export { default as Navigation } from 'lucide-react-native/dist/esm/icons/navigation';
export { default as Paperclip } from 'lucide-react-native/dist/esm/icons/paperclip';
export { default as Pencil } from 'lucide-react-native/dist/esm/icons/pencil';
export { default as PersonStanding } from 'lucide-react-native/dist/esm/icons/person-standing';
export { default as Phone } from 'lucide-react-native/dist/esm/icons/phone';
export { default as Plus } from 'lucide-react-native/dist/esm/icons/plus';
export { default as QrCode } from 'lucide-react-native/dist/esm/icons/qr-code';
export { default as Radio } from 'lucide-react-native/dist/esm/icons/radio';
export { default as Redo2 } from 'lucide-react-native/dist/esm/icons/redo-2';
export { default as RefreshCw } from 'lucide-react-native/dist/esm/icons/refresh-cw';
export { default as RotateCcw } from 'lucide-react-native/dist/esm/icons/rotate-ccw';
export { default as Ruler } from 'lucide-react-native/dist/esm/icons/ruler';
export { default as Satellite } from 'lucide-react-native/dist/esm/icons/satellite';
export { default as Save } from 'lucide-react-native/dist/esm/icons/save';
export { default as ScrollText } from 'lucide-react-native/dist/esm/icons/scroll-text';
export { default as Search } from 'lucide-react-native/dist/esm/icons/search';
export { default as Send } from 'lucide-react-native/dist/esm/icons/send';
export { default as Settings } from 'lucide-react-native/dist/esm/icons/settings';
export { default as Share2 } from 'lucide-react-native/dist/esm/icons/share-2';
export { default as Shield } from 'lucide-react-native/dist/esm/icons/shield';
export { default as ShieldCheck } from 'lucide-react-native/dist/esm/icons/shield-check';
export { default as ShoppingBag } from 'lucide-react-native/dist/esm/icons/shopping-bag';
export { default as SlidersHorizontal } from 'lucide-react-native/dist/esm/icons/sliders-horizontal';
export { default as Sparkle } from 'lucide-react-native/dist/esm/icons/sparkle';
export { default as Sparkles } from 'lucide-react-native/dist/esm/icons/sparkles';
export { default as Star } from 'lucide-react-native/dist/esm/icons/star';
export { default as Tag } from 'lucide-react-native/dist/esm/icons/tag';
export { default as Target } from 'lucide-react-native/dist/esm/icons/target';
export { default as Thermometer } from 'lucide-react-native/dist/esm/icons/thermometer';
export { default as Trash2 } from 'lucide-react-native/dist/esm/icons/trash-2';
export { default as TrendingUp } from 'lucide-react-native/dist/esm/icons/trending-up';
export { default as Undo2 } from 'lucide-react-native/dist/esm/icons/undo-2';
export { default as User } from 'lucide-react-native/dist/esm/icons/user';
export { default as UserMinus } from 'lucide-react-native/dist/esm/icons/user-minus';
export { default as UserPlus } from 'lucide-react-native/dist/esm/icons/user-plus';
export { default as Users } from 'lucide-react-native/dist/esm/icons/users';
export { default as UserSearch } from 'lucide-react-native/dist/esm/icons/user-search';
export { default as Video } from 'lucide-react-native/dist/esm/icons/video';
export { default as Wifi } from 'lucide-react-native/dist/esm/icons/wifi';
export { default as X } from 'lucide-react-native/dist/esm/icons/x';
export { default as XCircle } from 'lucide-react-native/dist/esm/icons/circle-x';
export { default as Zap } from 'lucide-react-native/dist/esm/icons/zap';
export { default as Mic } from 'lucide-react-native/dist/esm/icons/mic';
export { default as Square } from 'lucide-react-native/dist/esm/icons/square';
export { default as Play } from 'lucide-react-native/dist/esm/icons/play';
export { default as Pause } from 'lucide-react-native/dist/esm/icons/pause';
export { default as Copy } from 'lucide-react-native/dist/esm/icons/copy';
