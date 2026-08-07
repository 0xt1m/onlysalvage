// Small, static illustrations for the /guide page -- not real screenshots
// (this environment has no browser/screenshot tooling), but built from the
// same design tokens and a couple of the same components (Switch) as the
// real UI, so they read as "this app" rather than a generic stock graphic.
// Every element here is inert (pointer-events-none) -- purely decorative.

import {
  CheckCircle2, ChevronRight, Eye, EyeOff, KeyRound, Lock, MousePointerClick, Pencil, Trash2, User,
  MessageSquarePlus, Star, Check, Search, GitCompare, CalendarCheck, ListChecks, ChevronDown, Download,
  FileUp, ImagePlus, DollarSign, Rocket, Save, Tag, RotateCcw, Pause, LogIn, Mail, KeySquare,
} from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/utils'

// Same purpose as MockFrame above, but sized/shaped to sit inside a
// walkthrough's numbered step tile (see GuideContent's `STEP_MOCKUPS`)
// instead of next to a regular tip -- fixed height, no max-width cap, and
// meant to show roughly *where* on a real page something lives (e.g. "top
// right of the Reviews card") rather than illustrate a whole feature.
function StepFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'relative w-full h-[140px] rounded-lg border border-border bg-surface-raised p-3 overflow-hidden select-none pointer-events-none',
      className,
    )}>
      {children}
    </div>
  )
}

function MockFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative w-full max-w-[260px] shrink-0 select-none pointer-events-none', className)}>
      {children}
    </div>
  )
}

export function EditListingMockup() {
  return (
    <MockFrame>
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-primary-light rounded-md px-2 py-1.5 w-fit">
          <Pencil className="w-3.5 h-3.5" /> Edit Listing
        </span>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[9px] text-muted uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
          Right-click for quick actions
        </div>
      </div>
    </MockFrame>
  )
}

export function ContextMenuMockup() {
  const items = [
    { icon: Pencil, label: 'Edit Listing' },
    { icon: CheckCircle2, label: 'Mark Sold' },
    { icon: EyeOff, label: 'Unpublish' },
    { icon: Trash2, label: 'Delete Listing', danger: true },
  ]
  return (
    // Explicit height (rather than letting the card's own content size the
    // row) -- the menu below is absolutely positioned, so without this its
    // overflow past the card's bottom edge doesn't count toward this
    // mockup's layout height, and it visually spills into whatever tip
    // renders next instead of staying contained in its own row.
    <MockFrame className="h-[168px]">
      <div className="rounded-lg border border-border bg-surface-raised overflow-hidden opacity-60">
        <div className="h-16 bg-border/60" />
        <div className="p-2 flex flex-col gap-1.5">
          <div className="h-2 w-3/4 rounded bg-border" />
          <div className="h-2 w-1/2 rounded bg-border/70" />
        </div>
      </div>
      <div className="absolute top-4 right-2 min-w-[150px] bg-surface border border-border rounded-lg shadow-lg py-1 flex flex-col">
        {items.map((item) => (
          <div
            key={item.label}
            className={cn('flex items-center gap-2 px-3 py-1.5 text-xs', item.danger ? 'text-error' : 'text-foreground')}
          >
            <item.icon className="w-3.5 h-3.5 shrink-0" />
            {item.label}
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

export function CompareMockup() {
  const cars = [
    { price: '$8,900', highlight: true },
    { price: '$11,200', highlight: false },
  ]
  return (
    <MockFrame>
      <div className="flex items-stretch gap-2">
        {cars.map((car) => (
          <div
            key={car.price}
            className={cn('flex-1 rounded-lg border p-2 flex flex-col gap-1.5', car.highlight ? 'border-success' : 'border-border')}
          >
            <div className="h-10 rounded bg-border" />
            <div className="h-2 w-3/4 rounded bg-border" />
            <span className={cn('text-xs font-semibold', car.highlight ? 'text-success' : 'text-foreground')}>{car.price}</span>
          </div>
        ))}
      </div>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold text-muted bg-background border border-border rounded-full w-6 h-6 flex items-center justify-center">
        VS
      </span>
    </MockFrame>
  )
}

export function PublishToggleMockup() {
  return (
    <MockFrame>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-success shrink-0" />
            <span className="text-xs font-medium text-foreground">Published</span>
          </div>
          <Switch defaultChecked disabled />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 p-2.5">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-warning shrink-0" />
            <span className="text-xs font-medium text-foreground">Published</span>
          </div>
          <Switch defaultChecked={false} disabled />
        </div>
      </div>
    </MockFrame>
  )
}

export function ApiTokenMockup() {
  return (
    <MockFrame>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-background border border-border rounded-md p-2">
          <KeyRound className="w-3.5 h-3.5 text-primary-light shrink-0" />
          <code className="text-[10px] text-foreground truncate">osk_7fK2••••••••••••</code>
        </div>
        <div className="flex gap-1.5">
          <span className="text-[10px] font-medium text-white bg-primary-light rounded-md px-2 py-1">Regenerate</span>
          <span className="text-[10px] font-medium text-error border border-error rounded-md px-2 py-1">Revoke</span>
        </div>
      </div>
    </MockFrame>
  )
}

export function ContactSellerMockup() {
  return (
    <MockFrame>
      <div className="rounded-lg border border-border bg-surface-raised p-3 flex flex-col gap-2">
        <span className="text-xs font-medium text-foreground">Contact the Seller</span>
        <div className="flex items-center justify-between gap-2 bg-background border border-border rounded-md pl-2 pr-1 py-1">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted">
            <Lock className="w-3 h-3 shrink-0" /> +1 (864) •••-••••
          </span>
          <span className="text-[10px] font-medium text-white bg-primary-light rounded px-1.5 py-1 shrink-0">Reveal</span>
        </div>
        {/* A visibly clickable row (icon, underline, trailing chevron) --
            not just plain text -- so it reads as "this navigates to their
            profile", the thing this tip is actually pointing at. */}
        <span className="inline-flex items-center gap-1 text-xs text-primary-light underline underline-offset-2 w-fit">
          <User className="w-3 h-3" /> View Profile <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </MockFrame>
  )
}

export function PhonePrivacyMockup() {
  return (
    <MockFrame>
      <div className="rounded-lg border border-border bg-surface-raised p-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-mono text-muted">
          <Lock className="w-3.5 h-3.5 shrink-0" /> +1 (555) •••-••••
        </span>
        <span className="text-[10px] font-medium text-white bg-primary-light rounded-md px-2 py-1 shrink-0">Reveal</span>
      </div>
    </MockFrame>
  )
}

export function OwnListingBorderMockup() {
  return (
    <MockFrame>
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border-2 border-primary-light p-2 flex flex-col gap-1.5">
          <div className="h-10 rounded bg-border" />
          <div className="h-2 w-3/4 rounded bg-border" />
        </div>
        <div className="flex-1 rounded-lg border border-border p-2 flex flex-col gap-1.5">
          <div className="h-10 rounded bg-border" />
          <div className="h-2 w-3/4 rounded bg-border" />
        </div>
      </div>
    </MockFrame>
  )
}

export function ProfileEditMockup() {
  return (
    <MockFrame>
      <div className="rounded-lg border border-border bg-surface-raised p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-border shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <div className="h-2 w-3/4 rounded bg-border" />
          <div className="h-2 w-1/2 rounded bg-border/70" />
        </div>
        <Pencil className="w-4 h-4 text-primary-light shrink-0" />
      </div>
    </MockFrame>
  )
}

// The 4 step illustrations below walk through "How to leave a review" (see
// GuideContent's STEP_MOCKUPS['0-7']), each showing roughly where the real
// action lives rather than a generic numbered icon -- positions are matched
// to the actual seller profile page layout (app/[locale]/profile/[username]/
// page.tsx): a seller card you click into, the Reviews card's top-right
// button, the review dialog's star row, then its submit button.

export function VisitProfileStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-0.5">
        <div className="h-1.5 w-10 rounded-full bg-border/60" />
        <div className="h-1.5 w-6 rounded-full bg-border/40" />
      </div>
      <div className="flex items-center gap-2.5 rounded-md border-2 border-primary-light bg-surface px-2.5 py-2">
        <div className="w-8 h-8 rounded-full bg-border shrink-0" />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="h-2 w-3/4 rounded-full bg-primary-light/60" />
          <div className="flex items-center gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <Star key={i} className="w-2 h-2 fill-warning text-warning" />
            ))}
            <div className="h-1.5 w-6 rounded-full bg-border ml-1" />
          </div>
        </div>
        <MousePointerClick className="w-4 h-4 text-primary-light shrink-0" />
      </div>
      <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2 opacity-50">
        <div className="w-8 h-8 rounded-full bg-border shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="h-2 w-2/3 rounded-full bg-border" />
          <div className="h-2 w-1/3 rounded-full bg-border" />
        </div>
      </div>
    </StepFrame>
  )
}

export function ReviewsCardStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="h-2.5 w-14 rounded-full bg-border shrink-0" />
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-warning text-warning" />
            <div className="h-1.5 w-4 rounded-full bg-border" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 bg-primary-light ring-2 ring-primary-light/40 shrink-0">
            <MessageSquarePlus className="w-3.5 h-3.5 text-white" />
            <span className="text-[9px] font-medium text-white whitespace-nowrap">Review</span>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-border shrink-0" />
          <div className="flex flex-col gap-1 flex-1">
            <div className="h-1.5 w-1/3 rounded-full bg-border/70" />
            <div className="h-1.5 w-4/5 rounded-full bg-border/50" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-border shrink-0" />
          <div className="flex flex-col gap-1 flex-1">
            <div className="h-1.5 w-1/4 rounded-full bg-border/70" />
            <div className="h-1.5 w-2/3 rounded-full bg-border/50" />
          </div>
        </div>
      </div>
    </StepFrame>
  )
}

export function StarRatingStepMockup() {
  return (
    <StepFrame className="flex flex-col justify-center gap-2.5">
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-14 rounded-full bg-border/60" />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn('w-5 h-5', i < 4 ? 'fill-warning text-warning' : 'text-border')} />
          ))}
        </div>
      </div>
      <div className="rounded-md bg-surface border border-border p-2.5 flex flex-col gap-1.5">
        <div className="h-1.5 w-full rounded-full bg-border/60" />
        <div className="flex items-center gap-0.5">
          <div className="h-1.5 w-1/2 rounded-full bg-border/60" />
          <div className="w-[2px] h-2.5 bg-primary-light/70" />
        </div>
      </div>
    </StepFrame>
  )
}

export function SubmitReviewStepMockup() {
  return (
    <StepFrame className="flex flex-col justify-center gap-2.5">
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-warning text-warning" />
        ))}
      </div>
      <div className="border-t border-border pt-2.5 flex items-center justify-end gap-2">
        <span className="text-[9px] text-muted rounded-md border border-border px-2.5 py-1.5">Cancel</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-primary-light rounded-md px-3.5 py-2">
          <Check className="w-3.5 h-3.5" /> Submit
        </span>
      </div>
      <span className="flex items-center justify-end gap-1.5 text-[10px] text-muted">
        <Lock className="w-3 h-3" /> Once per seller
      </span>
    </StepFrame>
  )
}

// The 4 step illustrations below walk through "How to buy a car" (see
// GuideContent's STEP_MOCKUPS['0-9']): the inventory filters, the Compare
// page, the listing page's Actions card (see app/[locale]/inventory/[slug]/
// page.tsx -- Schedule Test Drive sits in that same button row as Compare
// and Share), and the /checklist page.

export function SearchFiltersStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 rounded-md border-2 border-primary-light bg-surface px-2 py-1.5">
        <Search className="w-3.5 h-3.5 text-primary-light shrink-0" />
        <div className="h-1.5 w-2/3 rounded-full bg-border" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-5 flex-1 rounded-md border border-border bg-surface" />
        <div className="h-5 flex-1 rounded-md border border-border bg-surface" />
      </div>
      <div className="h-5 rounded-md border border-border bg-surface" />
    </StepFrame>
  )
}

export function BuyCompareStepMockup() {
  return (
    <StepFrame className="flex items-center justify-center">
      <div className="flex items-stretch gap-2 w-full">
        <div className="flex-1 rounded-lg border-2 border-primary-light p-2 flex flex-col gap-1.5">
          <div className="h-8 rounded bg-border" />
          <div className="h-1.5 w-3/4 rounded-full bg-border" />
        </div>
        <div className="flex-1 rounded-lg border-2 border-primary-light p-2 flex flex-col gap-1.5">
          <div className="h-8 rounded bg-border" />
          <div className="h-1.5 w-3/4 rounded-full bg-border" />
        </div>
      </div>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-bold text-muted bg-surface-raised border border-border rounded-full w-6 h-6 flex items-center justify-center">
        VS
      </span>
    </StepFrame>
  )
}

export function TestDriveStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2 justify-center">
      <div className="h-2 w-20 rounded-full bg-border/60" />
      <div className="grid grid-cols-2 gap-1.5">
        <div className="h-6 rounded-md border border-border bg-surface" />
        <div className="h-6 rounded-md border border-border bg-surface" />
        <div className="h-6 rounded-md border-2 border-primary-light bg-primary-light/10 flex items-center justify-center gap-1">
          <CalendarCheck className="w-3 h-3 text-primary-light" />
        </div>
        <div className="h-6 rounded-md border border-border bg-surface" />
      </div>
    </StepFrame>
  )
}

export function GoToChecklistStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2 justify-center">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-primary-light/15 flex items-center justify-center shrink-0">
          <ListChecks className="w-3.5 h-3.5 text-primary-light" />
        </div>
        <div className="h-1.5 w-1/2 rounded-full bg-border" />
      </div>
      <div className="flex flex-col gap-1.5">
        {[true, true, false].map((done, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={cn(
              'w-3 h-3 rounded-sm border flex items-center justify-center shrink-0',
              done ? 'bg-primary border-primary' : 'border-border bg-surface',
            )}>
              {done && <Check className="w-2 h-2 text-white" />}
            </div>
            <div className="h-1.5 rounded-full bg-border/60" style={{ width: `${70 - i * 15}%` }} />
          </div>
        ))}
      </div>
    </StepFrame>
  )
}

// The 4 step illustrations below walk through "Bulk Upload" (see
// GuideContent's STEP_MOCKUPS['1-4']), matching components/sell/
// BulkUploadForm.tsx's actual layout: a header row with "Download Template"
// top-right, then a file input + Import button row below it.

export function SellNavStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 w-fit">
        <div className="h-1.5 w-8 rounded-full bg-border" />
        <ChevronDown className="w-3 h-3 text-muted" />
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-1.5 w-fit">
        <div className="h-1.5 w-16 rounded-full bg-border/60 px-1 py-1" />
        <div className="flex items-center gap-1.5 rounded bg-primary-light/15 border border-primary-light px-1.5 py-1">
          <div className="h-1.5 w-16 rounded-full bg-primary-light/70" />
        </div>
      </div>
    </StepFrame>
  )
}

export function DownloadTemplateStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="h-2 w-16 rounded-full bg-border" />
          <div className="h-1.5 w-20 rounded-full bg-border/50" />
        </div>
        <span className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 border-2 border-primary-light bg-surface shrink-0">
          <Download className="w-3.5 h-3.5 text-primary-light" />
        </span>
      </div>
    </StepFrame>
  )
}

export function UploadCsvStepMockup() {
  return (
    <StepFrame className="flex flex-col justify-center gap-2">
      <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border bg-surface px-2 py-1.5">
        <div className="h-1.5 w-4 rounded-full bg-primary-light/60 shrink-0" />
        <div className="h-1.5 w-1/2 rounded-full bg-border" />
      </div>
      <span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-white bg-primary-light rounded-md px-2.5 py-1.5 w-fit">
        <FileUp className="w-3 h-3" /> Import
      </span>
    </StepFrame>
  )
}

export function ReviewDraftsStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-1.5 justify-center">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-border shrink-0" />
          <div className="h-1.5 flex-1 rounded-full bg-border/60" />
          <span className="text-[7px] font-medium text-primary-light border border-primary-light rounded px-1 py-0.5 shrink-0">
            {i === 2 ? 'Publish' : 'Draft'}
          </span>
        </div>
      ))}
    </StepFrame>
  )
}

// The 5 step illustrations below walk through "How to sell a car, step by
// step" (see GuideContent's STEP_MOCKUPS['1-8']), matching components/sell/
// SellForm.tsx's actual field order: VIN first (auto-fills year/make/model),
// then photos, price/description, the publish/draft choice, and finally the
// status controls a listing gets once it's live.

export function VinAutofillStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-1.5 justify-center">
      <div className="flex items-center gap-1.5 rounded-md border-2 border-primary-light bg-surface px-2 py-1.5">
        <div className="h-1.5 w-full rounded-full bg-primary-light/60" />
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-1">
            <Check className="w-2.5 h-2.5 text-success shrink-0" />
            <div className="h-1.5 w-full rounded-full bg-border/60" />
          </div>
        ))}
      </div>
    </StepFrame>
  )
}

export function AddPhotosStepMockup() {
  return (
    <StepFrame className="flex items-center justify-center">
      <div className="grid grid-cols-3 gap-1.5 w-full">
        <div className="aspect-square rounded-md bg-border" />
        <div className="aspect-square rounded-md bg-border" />
        <div className="aspect-square rounded-md border-2 border-dashed border-primary-light bg-primary-light/10 flex items-center justify-center">
          <ImagePlus className="w-3.5 h-3.5 text-primary-light" />
        </div>
      </div>
    </StepFrame>
  )
}

export function PriceDescriptionStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2 justify-center">
      <div className="flex items-center gap-1.5 rounded-md border-2 border-primary-light bg-surface px-2 py-1.5">
        <DollarSign className="w-3.5 h-3.5 text-primary-light shrink-0" />
        <div className="h-1.5 w-1/2 rounded-full bg-border" />
      </div>
      <div className="rounded-md border border-border bg-surface p-2 flex flex-col gap-1.5">
        <div className="h-1.5 w-full rounded-full bg-border/60" />
        <div className="h-1.5 w-2/3 rounded-full bg-border/60" />
      </div>
    </StepFrame>
  )
}

export function PublishOrDraftStepMockup() {
  return (
    <StepFrame className="flex items-center justify-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-white bg-primary-light rounded-md px-3 py-2 ring-2 ring-primary-light/40">
        <Rocket className="w-3.5 h-3.5" /> Publish
      </span>
      <span className="inline-flex items-center gap-1.5 text-[10px] text-muted rounded-md border border-border px-3 py-2">
        <Save className="w-3.5 h-3.5" /> Draft
      </span>
    </StepFrame>
  )
}

export function ManageListingStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-2 justify-center">
      <span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-primary-light rounded-md border-2 border-primary-light px-2.5 py-1.5 w-fit">
        <Tag className="w-3 h-3" /> Pending
        <ChevronDown className="w-2.5 h-2.5" />
      </span>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[8px] text-muted rounded-md border border-border px-2 py-1">
          <Pause className="w-2.5 h-2.5" /> Pause
        </span>
        <span className="inline-flex items-center gap-1 text-[8px] text-muted rounded-md border border-border px-2 py-1">
          <RotateCcw className="w-2.5 h-2.5" /> Renew
        </span>
      </div>
    </StepFrame>
  )
}

// The 4 step illustrations below walk through "Reset your password" (see
// GuideContent's STEP_MOCKUPS['2-2']), matching components/ui/LoginForm.tsx's
// actual field order: username, then password, then the "Forgot password?"
// link right below it, then the Log In button.

export function LoginPageStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-1.5 justify-center">
      <div className="h-2 w-16 rounded-full bg-border/60 mb-0.5" />
      <div className="h-5 rounded-md border border-border bg-surface" />
      <div className="h-5 rounded-md border border-border bg-surface" />
      <span className="inline-flex items-center justify-center text-[9px] font-medium text-white bg-primary-light rounded-md px-2 py-1.5 mt-0.5">
        Log In
      </span>
    </StepFrame>
  )
}

export function ForgotPasswordLinkStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-1.5 justify-center">
      <div className="h-5 rounded-md border border-border bg-surface" />
      <div className="flex items-center gap-1 rounded-md border-2 border-primary-light bg-primary-light/10 px-2 py-1 w-fit">
        <span className="text-[9px] font-medium text-primary-light underline">Forgot password?</span>
      </div>
      <div className="h-5 rounded-md border border-border bg-surface opacity-50" />
    </StepFrame>
  )
}

export function CheckEmailStepMockup() {
  return (
    <StepFrame className="flex items-center justify-center">
      <div className="rounded-md border-2 border-primary-light bg-surface p-2.5 flex items-center gap-2 w-full">
        <Mail className="w-4 h-4 text-primary-light shrink-0" />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="h-1.5 w-3/4 rounded-full bg-border" />
          <div className="h-1.5 w-1/2 rounded-full bg-primary-light/50" />
        </div>
      </div>
    </StepFrame>
  )
}

export function NewPasswordStepMockup() {
  return (
    <StepFrame className="flex flex-col gap-1.5 justify-center">
      <div className="flex items-center gap-1.5 rounded-md border-2 border-primary-light bg-surface px-2 py-1.5">
        <KeySquare className="w-3.5 h-3.5 text-primary-light shrink-0" />
        <div className="h-1.5 w-1/2 rounded-full bg-border" />
      </div>
      <span className="inline-flex items-center justify-center gap-1.5 text-[9px] font-medium text-white bg-primary-light rounded-md px-2.5 py-1.5 w-fit">
        <LogIn className="w-3 h-3" /> Log In
      </span>
    </StepFrame>
  )
}
