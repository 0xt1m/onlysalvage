'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Check, ImagePlus, Loader2, Wand2, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dropzone } from '@/components/ui/Dropzone'
import { DocUploadSlot } from '@/components/listing/DocUploadSlot'
import { VehicleOptionsPicker } from '@/components/sell/VehicleOptionsPicker'
import { RequestMakeModelModal } from '@/components/sell/RequestMakeModelModal'
import { Link, useRouter } from '@/i18n/navigation'
import { cn, translateOptions, normalizeUrl } from '@/lib/utils'
import { useDragReorder } from '@/lib/useDragReorder'
import { useAuth } from '@/lib/auth-context'
import {
  checkVinAvailability,
  createListing,
  updateListing,
  decodeVin,
  getMakes,
  getModels,
  getVehicleOptions,
  presignListingImage,
  uploadImageToS3,
  registerListingImage,
  deleteListingImage,
  deleteListingBeacon,
  uploadCarfaxReport,
  uploadAlignmentReport,
  uploadInspectionReport,
} from '@/lib/api'
import {
  VEHICLE_TYPES,
  FILTER_TRANSMISSIONS,
  FILTER_DRIVES,
  FUEL_TYPES,
  TITLE_DOCUMENTS,
  COLORS,
  type Make,
  type VehicleModel,
  type VehicleOption,
} from '@/lib/types'

interface Photo {
  id: string
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  // Set once `registerListingImage` succeeds -- lets removePhoto tell a
  // photo that's already saved server-side (needs a DELETE call) apart
  // from one that's merely staged locally (just drop it from state).
  imageId?: number
}

type DocKind = 'carfax' | 'alignment' | 'inspection'
type DocStatus = 'idle' | 'uploading' | 'done' | 'error'

// Every listing only ever gets one of VEHICLE_TYPES' four body styles (see
// its own comment in lib/types.ts) -- NHTSA's decoded BodyClass is a much
// finer-grained taxonomy (Coupe, Wagon, Hatchback, Convertible, Minivan,
// "Multipurpose Passenger Vehicle (MPV)", etc.), so this always folds it
// down onto one of the four rather than passing anything else through.
function mapBodyClassToVehicleType(bodyClass: string): string | null {
  const b = bodyClass.toLowerCase()
  if (b.includes('pickup')) return 'TK'
  if (b.includes('van') || b.includes('minivan')) return 'VAN'
  if (b.includes('sport utility') || b.includes('suv') || b.includes('crossover') || b.includes('mpv') || b.includes('multi-purpose') || b.includes('multipurpose')) return 'SUV'
  if (b.includes('sedan') || b.includes('coupe') || b.includes('hatchback') || b.includes('convertible') || b.includes('wagon')) return 'SDN'
  return null
}

function mapDriveType(driveType: string): string | null {
  const d = driveType.toUpperCase()
  if (d.includes('4WD') || d.includes('4X4') || d.includes('FOUR-WHEEL')) return '4WD'
  if (d.includes('AWD') || d.includes('ALL-WHEEL')) return 'AWD'
  if (d.includes('FWD') || d.includes('FRONT-WHEEL')) return 'FWD'
  if (d.includes('RWD') || d.includes('REAR-WHEEL')) return 'RWD'
  return null
}

function mapFuelType(primary: string, secondary: string): string | null {
  const p = primary.toLowerCase()
  const s = secondary.toLowerCase()
  if ((p.includes('gasoline') || p.includes('flex')) && (s.includes('electric') || p.includes('hybrid'))) return 'HYB'
  if (p.includes('electric')) return 'ELC'
  if (p.includes('diesel')) return 'DIS'
  if (p.includes('gasoline') || p.includes('flex')) return 'GAS'
  return null
}

function mapTransmission(style: string): string | null {
  const t = style.toLowerCase()
  if (t.includes('manual')) return 'MAN'
  // CVT and dual-clutch (DCT) are both automatic-family transmissions, and
  // no longer their own selectable option (see FILTER_TRANSMISSIONS, which
  // narrowed the dropdown to just Automatic/Manual to match the inventory
  // filters) -- decoding one now selects Automatic instead of a code that
  // wouldn't actually appear as a choice in the dropdown.
  if (t.includes('cvt') || t.includes('dual') || t.includes('dct') || t.includes('automatic')) return 'ATM'
  return null
}

// Shown in place of every photo/document Dropzone until a draft listing
// exists (see SellForm's auto-draft-creation effect) -- uploads need a
// real listing_id to attach to, which only exists once vin/year/make/model
// are filled in.
function UploadsLockedNotice({ creatingDraft, t }: { creatingDraft: boolean; t: (key: string) => string }) {
  return (
    <div className="flex items-center gap-2 border border-dashed border-border rounded-lg p-4 text-sm text-muted">
      {creatingDraft && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      <span>{creatingDraft ? t('creatingDraft') : t('uploadsLocked')}</span>
    </div>
  )
}

const initialForm = {
  vin: '',
  year: '',
  make: '',
  model: '',
  trim: '',
  vehicle_type: 'SDN',
  mileage: '',
  price: '',
  retail_price: '',
  transmission: 'ATM',
  drive: 'FWD',
  fuel_type: 'GAS',
  title_document: 'SA',
  engine: '',
  exterior_color: '',
  interior_color: '',
  owners: '',
  city_mpg: '',
  hwy_mpg: '',
  description: '',
  video_url: '',
}

interface SellFormProps {
  offersWarranty?: boolean
}

export function SellForm({ offersWarranty = false }: SellFormProps) {
  const t = useTranslations('SellForm')
  const tAttr = useTranslations('VehicleAttributes')
  const router = useRouter()
  const { user } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [hasWarranty, setHasWarranty] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [beforePhotos, setBeforePhotos] = useState<Photo[]>([])
  const [carfaxFile, setCarfaxFile] = useState<File | null>(null)
  const [alignmentFile, setAlignmentFile] = useState<File | null>(null)
  const [inspectionFile, setInspectionFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [decoding, setDecoding] = useState(false)
  // Only guards the pagehide/unmount abandon-delete below (see
  // abandonRef) -- publishing navigates straight to the listing page
  // instead of an in-place success screen, so nothing else reads this.
  const [published, setPublished] = useState(false)
  // True once "Save Draft" has succeeded at least once -- see abandonRef
  // below, this is what turns the auto-created draft from disposable into
  // a real, resumable one the pagehide/unmount handler should leave alone.
  const [draftSaved, setDraftSaved] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  const [makes, setMakes] = useState<Make[]>([])
  const [models, setModels] = useState<VehicleModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [requestModal, setRequestModal] = useState<
    null | { kind: 'MAKE' } | { kind: 'MODEL'; makeId: number; makeName: string }
  >(null)
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])

  // A draft listing (see backend Listing.Status.DRAFT) exists purely so
  // there's a real listing_id to upload photos/documents against as soon
  // as they're picked, instead of only after the whole form is submitted.
  // It's invisible everywhere except to its own seller until publish
  // (handleSubmit) flips its status to AVAILABLE.
  const [draftListing, setDraftListing] = useState<{ id: number; slug: string } | null>(null)
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [docStatus, setDocStatus] = useState<Record<DocKind, DocStatus>>({
    carfax: 'idle', alignment: 'idle', inspection: 'idle',
  })

  // Lets validate() below scroll straight to whichever required field is
  // still missing on Publish, rather than leaving the error text sitting
  // off-screen with no indication anything needs attention.
  const vinRef = useRef<HTMLDivElement>(null)
  const yearRef = useRef<HTMLDivElement>(null)
  const makeRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const priceRef = useRef<HTMLDivElement>(null)
  const photosRef = useRef<HTMLHeadingElement>(null)
  const fieldRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    vin: vinRef, year: yearRef, make: makeRef, model: modelRef, price: priceRef, photos: photosRef,
  }

  useEffect(() => {
    getMakes().then(setMakes)
    getVehicleOptions().then(setVehicleOptions)
  }, [])

  // Fires the moment the VIN alone is valid, creating the draft that
  // unlocks photo/document uploads below -- year/make/model/trim are all
  // still nullable on the draft (see Listing.year on the backend) and get
  // filled in and resent at publish time (handleSubmit), same as trim
  // already was. Deliberately not tied to a button -- the point is uploads
  // become possible as soon as possible, not after one more click.
  useEffect(() => {
    if (draftListing || creatingDraft) return

    const vin = form.vin.trim().toUpperCase()
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return

    let cancelled = false
    setCreatingDraft(true)

    ;(async () => {
      const vinCheck = await checkVinAvailability(vin)
      if (cancelled) return
      if (vinCheck && !vinCheck.available && vinCheck.listing) {
        setCreatingDraft(false)
        setErrors(prev => ({ ...prev, vin: t('errors.vinTaken') }))
        return
      }

      const { ok, data } = await createListing({ vin, status: 'DR' })
      if (cancelled) return
      setCreatingDraft(false)

      if (!ok || !data) {
        toast.error(t('toasts.fixErrors'))
        return
      }
      setDraftListing({ id: data.id, slug: data.slug })
    })()

    return () => { cancelled = true }
    // draftListing/creatingDraft deliberately aren't dependencies -- they're
    // read here as guard conditions (via closure), not meant to retrigger
    // this effect. Including them was a real bug: setCreatingDraft(true)
    // above changes one of its own "dependencies", which reruns the effect
    // immediately -- React tears down the still-in-flight previous run
    // first, and that cleanup sets `cancelled = true` on it, so the async
    // work aborts right after checkVinAvailability/createListing resolves,
    // *before* it ever reaches setCreatingDraft(false). The draft never
    // gets created and "Setting up your listing..." spins forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vin])

  // Deletes the draft (see above) if the page is closed/navigated away from
  // before it's actually published -- otherwise every VIN someone typed in
  // and then abandoned leaves a permanent, never-visible-to-anyone row (plus
  // its uploaded photos) sitting in the DB forever.
  //
  // Kept in a ref (updated after every render, no dependency array) rather
  // than read directly from `draftListing`/`published` in the effect below --
  // that effect registers its `pagehide` listener and unmount cleanup only
  // once (empty deps, so it isn't torn down and re-created every time the
  // draft or published state changes), so it needs a way to see the *current*
  // values without those being part of its own dependency array.
  const abandonRef = useRef({ draftListing, published, draftSaved })
  useEffect(() => {
    abandonRef.current = { draftListing, published, draftSaved }
  })

  useEffect(() => {
    const abandonDraftIfUnpublished = () => {
      const { draftListing, published, draftSaved } = abandonRef.current
      if (draftListing && !published && !draftSaved) deleteListingBeacon(draftListing.slug)
    }
    window.addEventListener('pagehide', abandonDraftIfUnpublished)
    return () => {
      window.removeEventListener('pagehide', abandonDraftIfUnpublished)
      // Covers navigating away within the app (no full page unload, so
      // pagehide never fires) -- this runs on unmount either way.
      abandonDraftIfUnpublished()
    }
  }, [])

  const toggleOption = (id: number, checked: boolean) => {
    setSelectedOptions(prev => (checked ? [...prev, id] : prev.filter(o => o !== id)))
  }

  const setField = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setErrors(prev => ({ ...prev, [field]: '' }))
    }

  const handleMakeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const makeId = e.target.value
    setForm(prev => ({ ...prev, make: makeId, model: '' }))
    setErrors(prev => ({ ...prev, make: '', model: '' }))
    setModels([])
    if (!makeId) return

    setLoadingModels(true)
    setModels(await getModels(Number(makeId)))
    setLoadingModels(false)
  }

  // Presigns, uploads to S3, and registers one photo against the draft --
  // called right when a file is added (not batched at final submit) now
  // that a draft listing_id exists as soon as vin/year/make/model do. Drag
  // reordering still only updates local state (see dragHandlers below);
  // the final order is written back at publish time via the same
  // `images: [{id, order}]` payload EditListingForm already uses, so an
  // approximate order here (append position) is fine.
  const uploadOnePhoto = async (photo: Photo, order: number, photoType?: 'before_repair') => {
    if (!draftListing) return
    const setPhotoState = photoType === 'before_repair' ? setBeforePhotos : setPhotos
    setPhotoState(prev => prev.map(p => (p.id === photo.id ? { ...p, status: 'uploading' } : p)))

    try {
      const presign = await presignListingImage(draftListing.id, photo.file.type || 'image/jpeg')
      if (!presign) throw new Error('presign failed')

      const uploaded = await uploadImageToS3(presign.upload.url, presign.upload.fields, photo.file)
      if (!uploaded) throw new Error('s3 upload failed')

      const registered = await registerListingImage(draftListing.id, presign.s3_key, order, photoType)
      if (!registered) throw new Error('register failed')

      setPhotoState(prev => prev.map(p => (p.id === photo.id ? { ...p, status: 'done', imageId: registered.id } : p)))
    } catch {
      setPhotoState(prev => prev.map(p => (p.id === photo.id ? { ...p, status: 'error' } : p)))
    }
  }

  const addPhotos = (files: FileList) => {
    const added = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f), status: 'pending' as const }))
    const startIndex = photos.length
    setPhotos(prev => [...prev, ...added])
    added.forEach((photo, i) => uploadOnePhoto(photo, startIndex + i))
  }

  const removePhoto = async (index: number) => {
    const photo = photos[index]
    if (!photo) return
    setPhotos(prev => prev.filter((_, i) => i !== index))
    // Already saved server-side (as opposed to still uploading, or having
    // failed before ever registering) -- needs an actual delete, not just
    // dropping it from local state.
    if (photo.imageId && draftListing) await deleteListingImage(draftListing.id, photo.imageId)
  }

  const { dragIndex, dragHandlers } = useDragReorder(photos, setPhotos)

  const addBeforePhotos = (files: FileList) => {
    const added = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f), status: 'pending' as const }))
    const startIndex = beforePhotos.length
    setBeforePhotos(prev => [...prev, ...added])
    added.forEach((photo, i) => uploadOnePhoto(photo, startIndex + i, 'before_repair'))
  }

  const removeBeforePhoto = async (index: number) => {
    const photo = beforePhotos[index]
    if (!photo) return
    setBeforePhotos(prev => prev.filter((_, i) => i !== index))
    if (photo.imageId && draftListing) await deleteListingImage(draftListing.id, photo.imageId)
  }

  const validate = () => {
    const next: Record<string, string> = {}

    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(form.vin.trim())) {
      next.vin = t('errors.vinFormat')
    }
    const yearNum = Number(form.year)
    if (!form.year || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      next.year = t('errors.yearInvalid')
    }
    if (!form.make) next.make = t('errors.makeRequired')
    if (!form.model) next.model = t('errors.modelRequired')
    if (!form.price || Number(form.price) <= 0) next.price = t('errors.priceRequired')
    // "Before repair" photos don't count -- they're damage documentation,
    // not photos of the car as it's actually being sold. Same rule the
    // backend enforces (see ListingUpdateSerializer.validate).
    if (photos.length === 0) next.photos = t('errors.photosRequired')

    setErrors(next)

    // Same order the fields appear in the form -- scrolls to whichever
    // invalid one comes first rather than just the first key Object.keys
    // happens to return (insertion order above already matches, but this
    // doesn't depend on that staying true).
    const firstInvalid = ['vin', 'year', 'make', 'model', 'price', 'photos'].find((f) => next[f])
    if (firstInvalid) {
      fieldRefs[firstInvalid].current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    return Object.keys(next).length === 0
  }

  const DOC_UPLOADERS: Record<DocKind, (slug: string, file: File) => Promise<unknown>> = {
    carfax: uploadCarfaxReport,
    alignment: uploadAlignmentReport,
    inspection: uploadInspectionReport,
  }

  const uploadDoc = async (kind: DocKind, file: File) => {
    if (!draftListing) return
    setDocStatus(prev => ({ ...prev, [kind]: 'uploading' }))
    const result = await DOC_UPLOADERS[kind](draftListing.slug, file)
    setDocStatus(prev => ({ ...prev, [kind]: result ? 'done' : 'error' }))
  }

  const handleDecodeVin = async () => {
    const vin = form.vin.trim().toUpperCase()
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      setErrors(prev => ({ ...prev, vin: t('errors.vinRequiredFirst') }))
      return
    }

    setDecoding(true)
    const result = await decodeVin(vin)

    if (!result || (!result.Make && !result.Model)) {
      setDecoding(false)
      toast.error(t('toasts.vinDecodeFailed'))
      return
    }

    const makeMatch = makes.find(m => m.name.toUpperCase() === (result.Make || '').toUpperCase())
    let modelMatch: VehicleModel | undefined

    if (makeMatch) {
      const makeModels = await getModels(makeMatch.id)
      setModels(makeModels)
      modelMatch = makeModels.find(m => m.name.toUpperCase() === (result.Model || '').toUpperCase())
    }

    setDecoding(false)

    setForm(prev => ({
      ...prev,
      vin,
      year: result.ModelYear || prev.year,
      make: makeMatch ? String(makeMatch.id) : prev.make,
      model: modelMatch ? String(modelMatch.id) : '',
      trim: result.Trim || prev.trim,
      vehicle_type: mapBodyClassToVehicleType(result.BodyClass || '') || prev.vehicle_type,
      drive: mapDriveType(result.DriveType || '') || prev.drive,
      fuel_type: mapFuelType(result.FuelTypePrimary || '', result.FuelTypeSecondary || '') || prev.fuel_type,
      transmission: mapTransmission(result.TransmissionStyle || '') || prev.transmission,
      engine: [result.DisplacementL && `${result.DisplacementL}L`, result.EngineCylinders && `${result.EngineCylinders}-cyl`]
        .filter(Boolean)
        .join(' ') || prev.engine,
    }))

    setErrors(prev => ({ ...prev, vin: '', make: '', model: '' }))

    if (result.Make && !makeMatch) {
      toast.warning(t('toasts.makeNotSupported', { make: result.Make }))
    } else if (result.Model && !modelMatch) {
      toast.warning(t('toasts.modelNotListed', { model: result.Model, make: result.Make }))
    } else {
      toast.success(t('toasts.vinDecoded'))
    }
  }

  // Shared by handleSubmit (publish) and handleSaveDraft -- every field
  // here is genuinely optional on the model regardless of draft/published
  // status, so both send it the same way: present only if actually filled.
  const buildOptionalFieldsPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {}
    if (form.mileage) payload.mileage = Number(form.mileage)
    if (form.retail_price) payload.retail_price = Number(form.retail_price)
    if (form.engine.trim()) payload.engine = form.engine.trim()
    if (form.exterior_color) payload.exterior_color = form.exterior_color
    if (form.interior_color) payload.interior_color = form.interior_color
    if (form.owners) payload.owners = Number(form.owners)
    if (form.city_mpg) payload.city_mpg = Number(form.city_mpg)
    if (form.hwy_mpg) payload.hwy_mpg = Number(form.hwy_mpg)
    if (form.description.trim()) payload.description = form.description.trim()
    if (form.video_url.trim()) payload.video_url = normalizeUrl(form.video_url.trim())
    if (selectedOptions.length > 0) payload.options = selectedOptions
    return payload
  }

  // Saves whatever's been filled in so far without requiring any of it --
  // unlike publishing (handleSubmit), there's nothing to validate here, the
  // whole point is letting an incomplete listing sit safely until the
  // seller comes back to it (see Listing.draft_saved on the backend, which
  // is what actually makes it show up in their profile's Drafts section and
  // exempts it from the stale-draft cleanup sweep).
  const handleSaveDraft = async () => {
    if (!draftListing) return
    setSavingDraft(true)

    const makeObj = makes.find(m => String(m.id) === form.make)
    const modelObj = models.find(m => String(m.id) === form.model)
    const titleParts = [form.year, makeObj?.name, modelObj?.name, form.trim].filter(Boolean)

    const payload: Record<string, unknown> = {
      status: 'DR',
      vehicle_type: form.vehicle_type,
      transmission: form.transmission,
      drive: form.drive,
      fuel_type: form.fuel_type,
      title_document: form.title_document,
      has_warranty: offersWarranty && hasWarranty,
      images: [
        ...photos.filter(p => p.imageId).map((p, i) => ({ id: p.imageId, order: i })),
        ...beforePhotos.filter(p => p.imageId).map((p, i) => ({ id: p.imageId, order: i })),
      ],
      ...buildOptionalFieldsPayload(),
    }
    if (titleParts.length > 0) payload.title = titleParts.join(' ')
    const vin = form.vin.trim().toUpperCase()
    if (vin) payload.vin = vin
    if (form.year) payload.year = Number(form.year)
    if (form.make) payload.make = Number(form.make)
    if (form.model) payload.model = Number(form.model)
    if (form.trim.trim()) payload.trim = form.trim.trim()
    if (form.price) payload.price = Number(form.price)

    const { ok } = await updateListing(draftListing.slug, payload)
    setSavingDraft(false)

    if (!ok) {
      toast.error(t('toasts.draftSaveFailed'))
      return
    }

    setDraftSaved(true)
    toast.success(t('toasts.draftSaved'))
    if (user) router.push(`/profile/${user.username}#drafts`)
  }

  // Everything up through vin/year/make/model is already saved (it's what
  // created the draft), and every photo/document already uploaded the
  // moment it was added -- this just fills in the rest of the fields and
  // flips status from DRAFT to AVAILABLE, publishing it.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (!draftListing) return

    const stillUploading = photos.some(p => p.status === 'uploading') || beforePhotos.some(p => p.status === 'uploading')
    if (stillUploading) {
      toast.error(t('toasts.uploadsInProgress'))
      return
    }

    const vin = form.vin.trim().toUpperCase()
    const vinCheck = await checkVinAvailability(vin, draftListing.slug)
    if (vinCheck && !vinCheck.available && vinCheck.listing) {
      const conflict = vinCheck.listing
      setErrors(prev => ({ ...prev, vin: t('errors.vinTaken') }))
      toast.error(
        t.rich('toasts.vinTaken', {
          link: (chunks) => (
            <Link href={`/inventory/${conflict.slug}`} className="underline font-medium">
              {chunks}
            </Link>
          ),
        })
      )
      return
    }

    setSubmitting(true)

    // The draft only ever committed the VIN it was created with (see the
    // auto-draft-creation effect above) -- year/make/model/trim were left
    // null and are only being set for real here, same as trim already
    // needed to be resent for (it was always editable). The VIN field itself
    // stays editable after the draft exists too (fixing a typo, or a bad VIN
    // decode, shouldn't mean starting over), so it needs resending here as
    // well in case it changed since the draft was created. The title needs
    // recomputing to match.
    const makeObj = makes.find(m => String(m.id) === form.make)
    const modelObj = models.find(m => String(m.id) === form.model)
    const title = [form.year, makeObj?.name, modelObj?.name, form.trim].filter(Boolean).join(' ')

    const payload: Record<string, unknown> = {
      title,
      vin,
      year: Number(form.year),
      make: Number(form.make),
      model: Number(form.model),
      trim: form.trim.trim(),
      vehicle_type: form.vehicle_type,
      transmission: form.transmission,
      drive: form.drive,
      fuel_type: form.fuel_type,
      title_document: form.title_document,
      price: Number(form.price),
      status: 'AV',
      has_warranty: offersWarranty && hasWarranty,
      // Drag-reordering only ever touched local state -- this is what
      // actually persists the final order, same mechanism EditListingForm
      // uses for its existing images.
      images: [
        ...photos.filter(p => p.imageId).map((p, i) => ({ id: p.imageId, order: i })),
        ...beforePhotos.filter(p => p.imageId).map((p, i) => ({ id: p.imageId, order: i })),
      ],
      ...buildOptionalFieldsPayload(),
    }

    const { ok, data } = await updateListing(draftListing.slug, payload)

    if (!ok || !data) {
      if (data && typeof data === 'object') {
        const fieldErrors: Record<string, string> = {}
        for (const [key, value] of Object.entries(data)) {
          fieldErrors[key] = Array.isArray(value) ? String(value[0]) : String(value)
        }
        setErrors(prev => ({ ...prev, ...fieldErrors }))
      }
      toast.error(t('toasts.fixErrors'))
      setSubmitting(false)
      return
    }

    toast.success(t('toasts.listingLive'))
    // Marks it published so the pagehide/unmount abandon-delete above
    // leaves it alone -- the draft is now a real listing, not something to
    // clean up. router.push happens before setSubmitting(false) since this
    // component is about to unmount anyway.
    setPublished(true)
    // Not draftListing.slug -- publishing is exactly when the model
    // re-slugs off the real title for the first time (it was only ever
    // "draft-{vin}" before now), so the pre-publish slug this component
    // has cached would 404. The response reflects whatever it actually is now.
    router.push(`/inventory/${data.slug}`)
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Card>
        <h2 className="text-lg font-semibold">{t('vehicleDetails')}</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[140px]" ref={vinRef}>
            <Input label={t('vin')} value={form.vin} onChange={setField('vin')} error={errors.vin} placeholder={t('vinPlaceholder')} />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDecodeVin}
            disabled={decoding}
            className="flex items-center gap-2 shrink-0"
          >
            {decoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {decoding ? t('decoding') : t('decodeVin')}
          </Button>
          <div className="w-28" ref={yearRef}>
            <Input label={t('year')} value={form.year} onChange={setField('year')} error={errors.year} type="number" />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]" ref={makeRef}>
            <Select
              label={t('make')}
              value={form.make}
              onChange={handleMakeChange}
              options={makes.map(m => ({ value: String(m.id), label: m.name }))}
              placeholder={t('selectMake')}
              error={errors.make}
              footerLabel={t('requestNewMake')}
              onFooterClick={() => setRequestModal({ kind: 'MAKE' })}
            />
          </div>
          <div className="flex-1 min-w-[160px]" ref={modelRef}>
            <Select
              label={t('model')}
              value={form.model}
              onChange={setField('model')}
              options={models.map(m => ({ value: String(m.id), label: m.name }))}
              placeholder={
                !form.make
                  ? t('selectMakeFirst')
                  : loadingModels
                  ? t('loading')
                  : models.length === 0
                  ? t('noModelsYet')
                  : t('selectModel')
              }
              error={errors.model}
              disabled={!form.make || loadingModels}
              footerLabel={t('requestNewModel')}
              onFooterClick={() => {
                const make = makes.find(m => String(m.id) === form.make)
                if (make) setRequestModal({ kind: 'MODEL', makeId: make.id, makeName: make.name })
              }}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Input label={t('trim')} value={form.trim} onChange={setField('trim')} placeholder={t('trimPlaceholder')} />
          </div>
        </div>
        <Select label={t('vehicleType')} value={form.vehicle_type} onChange={setField('vehicle_type')} options={translateOptions(VEHICLE_TYPES, (code) => tAttr(`vehicleType.${code}`))} />
        {creatingDraft && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('creatingDraft')}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('specs')}</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Input label={t('mileage')} value={form.mileage} onChange={setField('mileage')} type="number" placeholder={t('optional')} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Input label={t('engine')} value={form.engine} onChange={setField('engine')} placeholder={t('enginePlaceholder')} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Select label={t('transmission')} value={form.transmission} onChange={setField('transmission')} options={translateOptions(FILTER_TRANSMISSIONS, (code) => tAttr(`transmission.${code}`))} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select label={t('drivetrain')} value={form.drive} onChange={setField('drive')} options={translateOptions(FILTER_DRIVES, (code) => tAttr(`drive.${code}`))} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select label={t('fuelType')} value={form.fuel_type} onChange={setField('fuel_type')} options={translateOptions(FUEL_TYPES, (code) => tAttr(`fuelType.${code}`))} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <Input label={t('cityMpg')} value={form.city_mpg} onChange={setField('city_mpg')} type="number" placeholder={t('optional')} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <Input label={t('highwayMpg')} value={form.hwy_mpg} onChange={setField('hwy_mpg')} type="number" placeholder={t('optional')} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('conditionAndPricing')}</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Select label={t('titleStatus')} value={form.title_document} onChange={setField('title_document')} options={translateOptions(TITLE_DOCUMENTS, (code) => tAttr(`titleDocument.${code}`))} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <Input label={t('owners')} value={form.owners} onChange={setField('owners')} type="number" placeholder={t('optional')} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Select label={t('exteriorColor')} value={form.exterior_color} onChange={setField('exterior_color')} options={translateOptions(COLORS, (code) => tAttr(`color.${code}`))} placeholder={t('optional')} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select label={t('interiorColor')} value={form.interior_color} onChange={setField('interior_color')} options={translateOptions(COLORS, (code) => tAttr(`color.${code}`))} placeholder={t('optional')} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]" ref={priceRef}>
            <Input label={t('askingPrice')} value={form.price} onChange={setField('price')} error={errors.price} type="number" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Input label={t('retailPrice')} value={form.retail_price} onChange={setField('retail_price')} type="number" placeholder={t('optional')} />
          </div>
        </div>
        {offersWarranty && (
          <Checkbox
            label={t('includeWarranty')}
            defaultChecked={hasWarranty}
            onChange={setHasWarranty}
          />
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('description')}</h2>
        <textarea
          value={form.description}
          onChange={setField('description')}
          rows={5}
          placeholder={t('descriptionPlaceholder')}
          className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
        />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('video')}</h2>
        <p className="text-sm text-muted -mt-1">{t('videoDescription')}</p>
        <Input
          label={t('videoUrl')}
          value={form.video_url}
          onChange={setField('video_url')}
          placeholder={t('videoUrlPlaceholder')}
        />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('featuresAndOptions')}</h2>
        <p className="text-sm text-muted -mt-1">{t('featuresAndOptionsDescription')}</p>
        <VehicleOptionsPicker options={vehicleOptions} selected={selectedOptions} onToggle={toggleOption} tAttr={tAttr} />
      </Card>

      <Card>
        <h2 ref={photosRef} className="text-lg font-semibold">{t('photos')}</h2>
        {draftListing ? (
          <Dropzone inputId="sell-photo-input" onFiles={addPhotos} multiple accept="image/*">
            <ImagePlus className="w-6 h-6 text-muted" />
            <p className="text-muted text-sm">{t('clickToSelectPhotos')}</p>
          </Dropzone>
        ) : (
          <UploadsLockedNotice creatingDraft={creatingDraft} t={t} />
        )}
        {errors.photos && <p className="text-xs text-error">{errors.photos}</p>}

        {photos.length > 0 && (
          <>
            <p className="text-xs text-muted -mt-1">{t('dragToReorder')}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {photos.map((p, i) => (
                <div
                  key={p.id}
                  {...(submitting ? {} : dragHandlers(i))}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border border-border transition-opacity',
                    !submitting && 'cursor-grab active:cursor-grabbing',
                    dragIndex === i && 'opacity-40'
                  )}
                >
                  <Image src={p.preview} alt={t('previewAlt', { index: i })} fill className="object-cover pointer-events-none" />
                  {i === 0 && (
                    <Badge label={t('cover')} variant="primary" className="absolute left-1 bottom-1" />
                  )}
                  {p.status !== 'pending' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium">
                      {p.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin" />}
                      {p.status === 'done' && <Check className="w-5 h-5" />}
                      {p.status === 'error' && t('failed')}
                    </div>
                  )}
                  {p.status === 'pending' && !submitting && (
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white cursor-pointer"
                      aria-label={t('removePhoto')}
                      title={t('removePhoto')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('beforeRepairPhotos')}</h2>
        <p className="text-sm text-muted -mt-1">{t('beforeRepairPhotosDescription')}</p>
        {draftListing ? (
          <Dropzone inputId="sell-before-photo-input" onFiles={addBeforePhotos} multiple accept="image/*">
            <ImagePlus className="w-6 h-6 text-muted" />
            <p className="text-muted text-sm">{t('clickToSelectPhotos')}</p>
          </Dropzone>
        ) : (
          <UploadsLockedNotice creatingDraft={creatingDraft} t={t} />
        )}

        {beforePhotos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {beforePhotos.map((p, i) => (
              <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                <Image src={p.preview} alt={t('beforeRepairPreviewAlt', { index: i })} fill className="object-cover pointer-events-none" />
                {p.status !== 'pending' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium">
                    {p.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin" />}
                    {p.status === 'done' && <Check className="w-5 h-5" />}
                    {p.status === 'error' && t('failed')}
                  </div>
                )}
                {p.status === 'pending' && !submitting && (
                  <button
                    type="button"
                    onClick={() => removeBeforePhoto(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white cursor-pointer"
                    aria-label={t('removePhoto')}
                    title={t('removePhoto')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('documentsTitle')}</h2>
        <p className="text-sm text-muted -mt-1">{t('reportDescription')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DocUploadSlot
            inputId="sell-carfax-input"
            label={t('carfaxReport')}
            file={carfaxFile}
            status={docStatus.carfax}
            locked={!draftListing}
            lockedMessage={creatingDraft ? t('creatingDraft') : t('uploadsLocked')}
            onSelectFile={(file) => { setCarfaxFile(file); uploadDoc('carfax', file) }}
            onRemoveFile={() => setCarfaxFile(null)}
            clickToSelectLabel={t('clickToSelectPdf')}
            removeLabel={t('removeCarfaxReport')}
            uploadingLabel={t('uploading')}
            uploadedLabel={t('uploaded')}
            uploadFailedLabel={t('uploadFailed')}
          />
          <DocUploadSlot
            inputId="sell-alignment-input"
            label={t('alignmentReport')}
            file={alignmentFile}
            status={docStatus.alignment}
            locked={!draftListing}
            lockedMessage={creatingDraft ? t('creatingDraft') : t('uploadsLocked')}
            onSelectFile={(file) => { setAlignmentFile(file); uploadDoc('alignment', file) }}
            onRemoveFile={() => setAlignmentFile(null)}
            clickToSelectLabel={t('clickToSelectPdf')}
            removeLabel={t('removeAlignmentReport')}
            uploadingLabel={t('uploading')}
            uploadedLabel={t('uploaded')}
            uploadFailedLabel={t('uploadFailed')}
          />
          <DocUploadSlot
            inputId="sell-inspection-input"
            label={t('inspectionReport')}
            file={inspectionFile}
            status={docStatus.inspection}
            locked={!draftListing}
            lockedMessage={creatingDraft ? t('creatingDraft') : t('uploadsLocked')}
            onSelectFile={(file) => { setInspectionFile(file); uploadDoc('inspection', file) }}
            onRemoveFile={() => setInspectionFile(null)}
            clickToSelectLabel={t('clickToSelectPdf')}
            removeLabel={t('removeInspectionReport')}
            uploadingLabel={t('uploading')}
            uploadedLabel={t('uploaded')}
            uploadFailedLabel={t('uploadFailed')}
          />
        </div>
      </Card>

      <div className="self-end flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleSaveDraft}
          disabled={submitting || savingDraft || !draftListing}
          className={cn(savingDraft && 'flex items-center gap-2')}
        >
          {savingDraft && <Loader2 className="w-4 h-4 animate-spin" />}
          {savingDraft ? t('savingDraft') : t('saveDraft')}
        </Button>
        <Button type="submit" size="lg" disabled={submitting || savingDraft || !draftListing} className={cn(submitting && 'flex items-center gap-2')}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? t('publishing') : t('publishListing')}
        </Button>
      </div>
    </form>

    {requestModal?.kind === 'MAKE' && (
      <RequestMakeModelModal kind="MAKE" onClose={() => setRequestModal(null)} />
    )}
    {requestModal?.kind === 'MODEL' && (
      <RequestMakeModelModal
        kind="MODEL"
        makeId={requestModal.makeId}
        makeName={requestModal.makeName}
        onClose={() => setRequestModal(null)}
      />
    )}
    </>
  )
}
