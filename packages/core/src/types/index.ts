import type { ElementInfo } from '../ast/jsx-mutator';

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
  elements?: ElementInfo[];
}

export interface StageState {
  targetElement?: string;
  selectedVariants: Record<string, string>;
  propValues: Record<string, string | boolean | number>;
  harmonicsClass: string;
  baselineClass: string;
  targetIndex?: number;
  viewport: ViewportPreset;
  showGrid: boolean;
  activeTab: StageTabId;
}

export interface FileProblem {
  fileName: string;
  message: string;
}

export type WebviewMessage =
  | { type: 'READY' }
  | { type: 'MUTATE_CLASSES'; payload: { className: string } }
  | { type: 'SELECT_ELEMENT'; payload: { name: string; index: number } | null }
  | { type: 'MUTATE_VARIANT'; payload: { variantGroup: string; variantValue: string } }
  | { type: 'UPDATE_PROP_VALUE'; payload: { propName: string; value: string | boolean | number } }
  | { type: 'UPDATE_STAGE_STATE'; payload: Partial<StageState> }
  | { type: 'UPDATE_CONFIG'; payload: Partial<RetuneExtensionConfig> }
  | { type: 'OPEN_STAGE_TAB'; payload?: { openMode?: StageOpenMode; tab?: StageTabId } };

export type HostMessage =
  | { type: 'SYNC_COMPONENT'; payload: ComponentMetadata | null }
  | { type: 'SYNC_STAGE_STATE'; payload: StageState }
  | { type: 'SYNC_CONFIG'; payload: RetuneExtensionConfig }
  /** The active file could not be analysed (e.g. a syntax error); null when it parses. */
  | { type: 'SYNC_PROBLEM'; payload: FileProblem | null }
  | { type: 'MUTATION_RESULT'; payload: { ok: boolean; kind: 'classes' | 'variant'; message: string } };
