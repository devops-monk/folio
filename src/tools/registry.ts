import type { LucideIcon } from 'lucide-react'
import {
  Combine,
  Crop,
  Droplets,
  Eraser,
  FileImage,
  FileOutput,
  GitCompare,
  Hash,
  Image,
  LayoutGrid,
  Lock,
  LockOpen,
  Minimize2,
  RotateCw,
  ScanLine,
  ScanText,
  Scissors,
  Signature,
  SquarePen,
  TextCursorInput,
  Trash2,
  Wrench,
} from 'lucide-react'

export type CategoryId = 'sign' | 'organize' | 'optimize' | 'convert' | 'edit' | 'security'

export interface Category {
  id: CategoryId
  name: string
  /** CSS color token used to tint the category's tiles. */
  tint: string
}

export const categories: Category[] = [
  { id: 'sign', name: 'Sign & Fill', tint: 'var(--indigo)' },
  { id: 'organize', name: 'Organize', tint: 'var(--orange)' },
  { id: 'optimize', name: 'Optimize', tint: 'var(--green)' },
  { id: 'convert', name: 'Convert', tint: 'var(--purple)' },
  { id: 'edit', name: 'Edit', tint: 'var(--blue)' },
  { id: 'security', name: 'Security', tint: 'var(--red)' },
]

export interface ToolDef {
  /** URL slug, e.g. #/sign-pdf */
  id: string
  name: string
  description: string
  category: CategoryId
  icon: LucideIcon
  /** Extra search terms. */
  keywords: string[]
  /** Value for the file input's accept attribute. */
  accept: string
  multiple: boolean
  /** Roadmap phase from PLAN.md. */
  phase: 1 | 2 | 3
  /** Flipped to true once the tool's workspace is implemented. */
  ready: boolean
  /** Opens the page editor workspace once a file is chosen. */
  workspace?: boolean
}

const PDF = 'application/pdf,.pdf'
const IMAGES = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

export const tools: ToolDef[] = [
  // Sign & Fill
  {
    id: 'sign-pdf',
    name: 'Sign PDF',
    description: 'Draw, type or upload your signature, add initials, dates and stamps.',
    category: 'sign',
    icon: Signature,
    keywords: ['signature', 'esign', 'initials', 'stamp', 'autograph'],
    accept: PDF,
    multiple: false,
    phase: 1,
    ready: true,
    workspace: true,
  },
  {
    id: 'fill-form',
    name: 'Fill PDF Form',
    description: 'Type into form fields, tick checkboxes and flatten when done.',
    category: 'sign',
    icon: TextCursorInput,
    keywords: ['form', 'acroform', 'fields', 'application', 'type'],
    accept: PDF,
    multiple: false,
    phase: 1,
    ready: false,
  },

  // Organize
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine several PDFs into one, in the order you choose.',
    category: 'organize',
    icon: Combine,
    keywords: ['combine', 'join', 'append'],
    accept: PDF,
    multiple: true,
    phase: 1,
    ready: false,
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    description: 'Split by page ranges or every N pages into separate files.',
    category: 'organize',
    icon: Scissors,
    keywords: ['separate', 'divide', 'cut', 'ranges'],
    accept: PDF,
    multiple: false,
    phase: 1,
    ready: false,
  },
  {
    id: 'organize-pdf',
    name: 'Organize Pages',
    description: 'Drag to reorder, rotate, duplicate or delete pages visually.',
    category: 'organize',
    icon: LayoutGrid,
    keywords: ['reorder', 'sort', 'arrange', 'move pages'],
    accept: PDF,
    multiple: true,
    phase: 1,
    ready: false,
  },
  {
    id: 'remove-pages',
    name: 'Remove Pages',
    description: 'Select and delete the pages you don’t need.',
    category: 'organize',
    icon: Trash2,
    keywords: ['delete', 'drop pages'],
    accept: PDF,
    multiple: false,
    phase: 1,
    ready: false,
  },
  {
    id: 'extract-pages',
    name: 'Extract Pages',
    description: 'Pull selected pages out into a new PDF.',
    category: 'organize',
    icon: FileOutput,
    keywords: ['select pages', 'pick'],
    accept: PDF,
    multiple: false,
    phase: 1,
    ready: false,
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    description: 'Rotate all pages or just the ones that are sideways.',
    category: 'organize',
    icon: RotateCw,
    keywords: ['turn', 'orientation', 'landscape', 'portrait'],
    accept: PDF,
    multiple: true,
    phase: 1,
    ready: false,
  },

  // Optimize
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Shrink file size for email and uploads, with quality you control.',
    category: 'optimize',
    icon: Minimize2,
    keywords: ['reduce', 'smaller', 'optimize', 'size', 'shrink'],
    accept: PDF,
    multiple: true,
    phase: 2,
    ready: false,
  },
  {
    id: 'ocr-pdf',
    name: 'OCR PDF',
    description: 'Make scanned documents searchable and selectable.',
    category: 'optimize',
    icon: ScanText,
    keywords: ['text recognition', 'scan', 'searchable'],
    accept: PDF,
    multiple: false,
    phase: 2,
    ready: false,
  },
  {
    id: 'repair-pdf',
    name: 'Repair PDF',
    description: 'Try to recover damaged or corrupted PDF files.',
    category: 'optimize',
    icon: Wrench,
    keywords: ['fix', 'broken', 'corrupt', 'recover'],
    accept: PDF,
    multiple: false,
    phase: 3,
    ready: false,
  },

  // Convert
  {
    id: 'jpg-to-pdf',
    name: 'Image to PDF',
    description: 'Turn JPG, PNG or WebP images into a PDF.',
    category: 'convert',
    icon: Image,
    keywords: ['jpg', 'jpeg', 'png', 'photo', 'picture', 'convert'],
    accept: IMAGES,
    multiple: true,
    phase: 1,
    ready: false,
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF to Image',
    description: 'Export every page as a high-quality JPG or PNG.',
    category: 'convert',
    icon: FileImage,
    keywords: ['jpg', 'jpeg', 'png', 'export', 'convert'],
    accept: PDF,
    multiple: false,
    phase: 1,
    ready: false,
  },
  {
    id: 'scan-to-pdf',
    name: 'Scan to PDF',
    description: 'Use your camera to capture documents with auto crop.',
    category: 'convert',
    icon: ScanLine,
    keywords: ['camera', 'photo', 'document scanner'],
    accept: IMAGES,
    multiple: true,
    phase: 3,
    ready: false,
  },

  // Edit
  {
    id: 'edit-pdf',
    name: 'Edit PDF',
    description: 'Add text, images, highlights and whiteout boxes to any page.',
    category: 'edit',
    icon: SquarePen,
    keywords: ['annotate', 'text', 'draw', 'highlight', 'comment', 'whiteout'],
    accept: PDF,
    multiple: false,
    phase: 2,
    ready: true,
    workspace: true,
  },
  {
    id: 'watermark-pdf',
    name: 'Watermark',
    description: 'Stamp text or an image over your pages.',
    category: 'edit',
    icon: Droplets,
    keywords: ['stamp', 'confidential', 'draft', 'logo'],
    accept: PDF,
    multiple: true,
    phase: 2,
    ready: false,
  },
  {
    id: 'page-numbers',
    name: 'Page Numbers',
    description: 'Number your pages with the position and style you like.',
    category: 'edit',
    icon: Hash,
    keywords: ['numbering', 'pagination', 'footer'],
    accept: PDF,
    multiple: false,
    phase: 2,
    ready: false,
  },
  {
    id: 'crop-pdf',
    name: 'Crop PDF',
    description: 'Trim margins or select an area to keep.',
    category: 'edit',
    icon: Crop,
    keywords: ['trim', 'margins', 'cut'],
    accept: PDF,
    multiple: false,
    phase: 2,
    ready: false,
  },

  // Security
  {
    id: 'protect-pdf',
    name: 'Protect PDF',
    description: 'Encrypt with a password so only you can open it.',
    category: 'security',
    icon: Lock,
    keywords: ['password', 'encrypt', 'secure'],
    accept: PDF,
    multiple: false,
    phase: 3,
    ready: false,
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    description: 'Remove the password from a PDF you can open.',
    category: 'security',
    icon: LockOpen,
    keywords: ['decrypt', 'remove password'],
    accept: PDF,
    multiple: false,
    phase: 3,
    ready: false,
  },
  {
    id: 'redact-pdf',
    name: 'Redact PDF',
    description: 'Permanently black out sensitive text and images.',
    category: 'security',
    icon: Eraser,
    keywords: ['black out', 'hide', 'censor', 'privacy'],
    accept: PDF,
    multiple: false,
    phase: 3,
    ready: false,
  },
  {
    id: 'compare-pdf',
    name: 'Compare PDF',
    description: 'See what changed between two versions side by side.',
    category: 'security',
    icon: GitCompare,
    keywords: ['diff', 'difference', 'versions', 'changes'],
    accept: PDF,
    multiple: true,
    phase: 3,
    ready: false,
  },
]

export function getTool(id: string | undefined): ToolDef | undefined {
  return tools.find((t) => t.id === id)
}

export function getCategory(id: CategoryId): Category {
  return categories.find((c) => c.id === id)!
}

export function searchTools(query: string): ToolDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter((t) =>
    [t.name, t.description, ...t.keywords].some((s) => s.toLowerCase().includes(q)),
  )
}
