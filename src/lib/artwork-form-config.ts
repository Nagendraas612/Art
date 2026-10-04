/**
 * Static registry of artwork-form fields that the admin can customize.
 *
 * The artwork DATA SHAPE never changes (same columns, same specifications
 * JSON keys, same submit payload). What the admin manages per field, in the
 * DB (ArtworkFormField / ArtworkFormFieldOption):
 *   - label, required (*), visible, order (position)
 *   - dropdown options (for select fields)
 *   - input type flip between text <-> select (spec fields only)
 *
 * Fields NOT in this registry (stock, editionSize, images, checkboxes,
 * processingDays, provenanceNote) stay hardcoded — they carry conditional
 * logic or infra requirements that must not be admin-toggleable.
 */

export type FormFieldSection = "essentials" | "craft" | "dimensions";
export type FormFieldInputType = "text" | "textarea" | "number" | "price" | "select";

/** Where a select field's options come from. */
export type FieldOptionsSource =
  | "category" // ArtworkCategory table (isActive, sortOrder)
  | "field-options" // ArtworkFormFieldOption rows
  | "enum-productType"; // Prisma ArtworkProductType enum (values locked)

export interface FormFieldDefinition {
  key: string;
  section: FormFieldSection;
  inputType: FormFieldInputType;
  /** inputTypes the admin may switch between (spec fields: text <-> select). */
  allowedInputTypes?: FormFieldInputType[];
  defaultLabel: string;
  defaultRequired: boolean;
  defaultVisible: boolean;
  defaultPosition: number;
  /** When true, only the label is editable (required/visible/order locked). */
  systemLocked: boolean;
  optionsSource?: FieldOptionsSource;
  /** Placeholder shown in the input. */
  placeholder?: string;
}

export const FORM_FIELD_REGISTRY: FormFieldDefinition[] = [
  // ── Piece Essentials ──────────────────────────────────────────────
  {
    key: "title",
    section: "essentials",
    inputType: "text",
    defaultLabel: "Artwork Title",
    defaultRequired: true,
    defaultVisible: true,
    defaultPosition: 0,
    systemLocked: true,
    placeholder: "e.g. Whispers of Indigo Mist",
  },
  {
    key: "categoryId",
    section: "essentials",
    inputType: "select",
    defaultLabel: "Curated Category",
    defaultRequired: true,
    defaultVisible: true,
    defaultPosition: 1,
    systemLocked: true,
    optionsSource: "category",
  },
  {
    key: "productType",
    section: "essentials",
    inputType: "select",
    defaultLabel: "Edition / Type",
    defaultRequired: true,
    defaultVisible: true,
    defaultPosition: 2,
    systemLocked: true,
    optionsSource: "enum-productType",
  },
  {
    key: "price",
    section: "essentials",
    inputType: "price",
    defaultLabel: "Price (INR ₹)",
    defaultRequired: true,
    defaultVisible: true,
    defaultPosition: 3,
    systemLocked: true,
    placeholder: "e.g. 24000",
  },
  {
    key: "description",
    section: "essentials",
    inputType: "textarea",
    defaultLabel: "Artisanal Narrative & Description",
    defaultRequired: true,
    defaultVisible: true,
    defaultPosition: 4,
    systemLocked: true,
    placeholder:
      "Describe the conceptual background, technique, materials, and emotional resonance of this work...",
  },
  // ── Craft & Material Specifications ───────────────────────────────
  {
    key: "medium",
    section: "craft",
    inputType: "select",
    allowedInputTypes: ["select", "text"],
    defaultLabel: "Primary Medium",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 0,
    systemLocked: false,
    optionsSource: "field-options",
    placeholder: "e.g. Oil on Canvas, High-Fire Ceramic",
  },
  {
    key: "surface",
    section: "craft",
    inputType: "select",
    allowedInputTypes: ["select", "text"],
    defaultLabel: "Surface / Base",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 1,
    systemLocked: false,
    optionsSource: "field-options",
    placeholder: "e.g. Stretched Belgian Linen, Teak Board",
  },
  {
    key: "clayBody",
    section: "craft",
    inputType: "select",
    allowedInputTypes: ["select", "text"],
    defaultLabel: "Clay Body / Glaze (Ceramics)",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 2,
    systemLocked: false,
    optionsSource: "field-options",
    placeholder: "e.g. Iron-rich stoneware, Celadon glaze",
  },
  {
    key: "timber",
    section: "craft",
    inputType: "select",
    allowedInputTypes: ["select", "text"],
    defaultLabel: "Timber Species (Woodwork)",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 3,
    systemLocked: false,
    optionsSource: "field-options",
    placeholder: "e.g. Black Walnut, Reclaimed Rosewood",
  },
  {
    key: "fibers",
    section: "craft",
    inputType: "select",
    allowedInputTypes: ["select", "text"],
    defaultLabel: "Fibers & Dyes (Textiles)",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 4,
    systemLocked: false,
    optionsSource: "field-options",
    placeholder: "e.g. Hand-spun tussar silk, Indigo dye",
  },
  {
    key: "paper",
    section: "craft",
    inputType: "select",
    allowedInputTypes: ["select", "text"],
    defaultLabel: "Archival Paper & Printing",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 5,
    systemLocked: false,
    optionsSource: "field-options",
    placeholder: "e.g. 310gsm Hahnemühle Rag, Linocut print",
  },
  // ── Physical Dimensions & Weight ──────────────────────────────────
  {
    key: "heightCm",
    section: "dimensions",
    inputType: "number",
    defaultLabel: "Height (cm)",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 0,
    systemLocked: false,
    placeholder: "e.g. 60",
  },
  {
    key: "widthCm",
    section: "dimensions",
    inputType: "number",
    defaultLabel: "Width (cm)",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 1,
    systemLocked: false,
    placeholder: "e.g. 45",
  },
  {
    key: "depthCm",
    section: "dimensions",
    inputType: "number",
    defaultLabel: "Depth (cm)",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 2,
    systemLocked: false,
    placeholder: "e.g. 5",
  },
  {
    key: "weightGrams",
    section: "dimensions",
    inputType: "number",
    defaultLabel: "Weight (Grams)",
    defaultRequired: false,
    defaultVisible: true,
    defaultPosition: 3,
    systemLocked: false,
    placeholder: "e.g. 1500",
  },
];

export const FORM_SECTIONS: { key: FormFieldSection; title: string }[] = [
  { key: "essentials", title: "Piece Essentials" },
  { key: "craft", title: "Craft & Material Specifications" },
  { key: "dimensions", title: "Physical Dimensions & Weight" },
];

/** System-locked edition options: values map to the Prisma enum, labels editable. */
export const PRODUCT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ORIGINAL", label: "Unique 1/1 Original" },
  { value: "LIMITED_EDITION", label: "Limited Edition" },
  { value: "OPEN_EDITION", label: "Open Edition" },
  { value: "PRINT", label: "Made to Order" },
];
