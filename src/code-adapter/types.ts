/**
 * Code adapter types — intermediate representation from AST extraction.
 */

export interface ExtractedComponent {
  /** Component name (from export name or function name) */
  name: string;
  /** File path relative to project root */
  filePath: string;
  /** Props interface/type name, e.g. "ButtonProps" */
  propsTypeName?: string;
  /** Extracted props */
  props: ExtractedProp[];
  /** Whether the component uses forwardRef */
  isForwardRef: boolean;
  /** Whether the component is wrapped in memo */
  isMemo: boolean;
  /** JSDoc or leading comment */
  description?: string;
}

export interface ExtractedProp {
  name: string;
  /** Raw TypeScript type as string */
  rawType: string;
  /** Whether the prop is optional (has ?) */
  optional: boolean;
  /** Default value from destructuring, if present */
  defaultValue?: string;
  /** JSDoc comment for this prop */
  description?: string;
  /** Parsed union literal values for enums, e.g. ["sm", "md", "lg"] */
  unionValues?: string[];
  /** Whether this type represents a slot (renderable child content) */
  isSlot: boolean;
  /** Whether this is a function/callback type */
  isCallback: boolean;
}
