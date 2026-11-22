// lucide-react-native ships typings only for its root barrel; the per-icon ESM
// files under dist/esm/icons have no .d.ts. src/icons.ts imports those files
// directly (so Metro bundles only the icons we use), and this declaration gives
// each one the same LucideIcon type the barrel exports.
declare module 'lucide-react-native/dist/esm/icons/*' {
  import type { LucideIcon } from 'lucide-react-native';
  const Icon: LucideIcon;
  export default Icon;
}
