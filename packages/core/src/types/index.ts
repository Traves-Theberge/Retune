export interface CvaVariantMap {
  [variantGroup: string]: string[];
}

export interface CvaMetadata {
  hasCva: boolean;
  cvaIdentifier?: string;
  variants: CvaVariantMap;
  variantClasses?: Record<string, Record<string, string>>;
  defaultVariants: Record<string, string>;
  baseClasses: string;
}

export interface PropDefinition {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export type ViewportPreset = 'responsive' | 'mobile' | 'tablet' | 'desktop';
export type StageTabId = 'stage' | 'ast' | 'api';
export type StageOpenMode = 'tab' | 'split';

export interface RetuneExtensionConfig {
  daemonPort: number;
  sandboxPort: number;
  openMode: StageOpenMode;
  defaultViewport: ViewportPreset;
  showGrid: boolean;
  autoSyncActiveEditor: boolean;
  scalarLayout: 'modern' | 'classic';
}

export interface ComponentMetadata {
  componentName: string;
  filePath: string;
  cva: CvaMetadata;
  props: PropDefinition[];
  rawSource: string;
}

export interface StageState {
  selectedVariants: Record<string, string>;
  propValues: Record<string, string | boolean | number>;
  harmonicsClass: string;
  viewport: ViewportPreset;
  showGrid: boolean;
  activeTab: StageTabId;
}

export type WebviewMessage =
  | { type: 'READY' }
  | { type: 'MUTATE_CLASSES'; payload: { componentName: string; className: string } }
  | { type: 'MUTATE_VARIANT'; payload: { variantGroup: string; variantValue: string } }
  | { type: 'UPDATE_PROP_VALUE'; payload: { propName: string; value: string | boolean | number } }
  | { type: 'UPDATE_STAGE_STATE'; payload: Partial<StageState> }
  | { type: 'UPDATE_CONFIG'; payload: Partial<RetuneExtensionConfig> }
  | { type: 'OPEN_STAGE_TAB'; payload?: { openMode?: StageOpenMode; tab?: StageTabId } }
  | { type: 'SWITCH_TAB'; payload: { tab: StageTabId } };

export type HostMessage =
  | { type: 'SYNC_COMPONENT'; payload: ComponentMetadata }
  | { type: 'SYNC_STAGE_STATE'; payload: StageState }
  | { type: 'SYNC_CONFIG'; payload: RetuneExtensionConfig }
  | { type: 'THEME_CHANGED'; payload: { isDark: boolean; highContrast: boolean } }
  | { type: 'MUTATION_SUCCESS'; payload: { updatedCode: string } };
