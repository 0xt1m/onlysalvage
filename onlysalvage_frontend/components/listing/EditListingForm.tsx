'use client'

import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Check, Eye, EyeOff, ImagePlus, Loader2, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Checkbox } from '@/components/ui/Checkbox'
import { Switch } from '@/components/ui/Switch'
import { Dropzone } from '@/components/ui/Dropzone'
import { DocUploadSlot } from '@/components/listing/DocUploadSlot'
import { VehicleOptionsPicker } from '@/components/sell/VehicleOptionsPicker'
import { RequestMakeModelModal } from '@/components/sell/RequestMakeModelModal'
import { cn, safeImageUrl, translateOptions, normalizeUrl } from '@/lib/utils'
import { useDragReorder } from '@/lib/useDragReorder'
import {
  checkVinAvailability,
  updateListing,
  getMakes,
  getModels,
  getVehicleOptions,
  presignListingImage,
  uploadImageToS3,
  registerListingImage,
  deleteListingImage,
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
  type Listing,
  type ListingImage,
} from '@/lib/types'

interface Photo {
  id: string
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  // Set once `registerListingImage` succeeds -- lets removeNewPhoto tell a
  // photo that's already saved server-side (needs a DELETE call) apart
  // from one that's merely staged locally (just drop it from state).
  imageId?: number
}

type DocKind = 'carfax' | 'alignment' | 'inspection'
type DocStatus = 'idle' | 'uploading' | 'done' | 'error'

function buildInitialForm(listing: Listing) {
  return {
    vin: listing.vin,
    // The shared Listing type says these are never null -- true for every
    // published listing, but not for a still-in-progress draft being
    // resumed here (see Listing.year on the backend), so this stays
    // defensive despite what the type claims.
    year: listing.year != null ? String(listing.year) : '',
    make: listing.make ? String(listing.make.id) : '',
    model: listing.model ? String(listing.model.id) : '',
    trim: listing.trim ?? '',
    vehicle_type: listing.vehicle_type,
    mileage: listing.mileage != null ? String(listing.mileage) : '',
    price: listing.price != null ? String(listing.price) : '',
    retail_price: listing.retail_price != null ? String(listing.retail_price) : '',
    transmission: listing.transmission,
    drive: listing.drive,
    fuel_type: listing.fuel_type,
    title_document: listing.title_document,
    engine: listing.engine ?? '',
    exterior_color: listing.exterior_color ?? '',
    interior_color: listing.interior_color ?? '',
    owners: listing.owners != null ? String(listing.owners) : '',
    city_mpg: listing.city_mpg != null ? String(listing.city_mpg) : '',
    hwy_mpg: listing.hwy_mpg != null ? String(listing.hwy_mpg) : '',
    description: listing.description ?? '',
    video_url: listing.video_url ?? '',
    status: listing.status,
    is_active: listing.is_active,
  }
}

export function EditListingForm({ listing }: { listing: Listing }) {
  const t = useTranslations()
  const tAttr = useTranslations('VehicleAttributes')
  const router = useRouter()
  const [form, setForm] = useState(() => buildInitialForm(listing))
  const [existingImages, setExistingImages] = useState<ListingImage[]>(listing.images.filter(img => img.photo_type !== 'before_repair'))
  const [existingBeforeImages, setExistingBeforeImages] = useState<ListingImage[]>(listing.images.filter(img => img.photo_type === 'before_repair'))
  const [newPhotos, setNewPhotos] = useState<Photo[]>([])
  const [newBeforePhotos, setNewBeforePhotos] = useState<Photo[]>([])
  const [carfaxFile, setCarfaxFile] = useState<File | null>(null)
  const [alignmentFile, setAlignmentFile] = useState<File | null>(null)
  const [inspectionFile, setInspectionFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
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

  // A draft resumed from the profile page's Drafts section (see
  // Listing.draft_saved on the backend) -- still missing some of what a
  // real listing needs, so the Status/Published controls (which assume a
  // real listing) stay hidden and "Save Changes" becomes two actions:
  // "Save Draft" (no validation, stays a draft) and "Publish Listing"
  // (validate() below, flips it to AVAILABLE for real).
  const isDraft = listing.status === 'DR'

  const [makes, setMakes] = useState<Make[]>([])
  const [models, setModels] = useState<VehicleModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [requestModal, setRequestModal] = useState<
    null | { kind: 'MAKE' } | { kind: 'MODEL'; makeId: number; makeName: string }
  >(null)
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<number[]>(() => listing.options.map(o => o.id))
  const [hasWarranty, setHasWarranty] = useState(listing.has_warranty)

  const STATUS_OPTIONS = [
    { value: 'AV', label: t('EditListingForm.statusAvailable') },
    { value: 'PE', label: t('EditListingForm.statusPending') },
    { value: 'SO', label: t('EditListingForm.statusSold') },
  ]

  useEffect(() => {
    getMakes().then(setMakes)
    getVehicleOptions().then(setVehicleOptions)
    if (!listing.make) return
    setLoadingModels(true)
    getModels(listing.make.id).then((m) => {
      setModels(m)
      setLoadingModels(false)
    })
  }, [listing.make?.id])

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

  // The listing already exists here (unlike SellForm, which needs a draft
  // created first) -- so a newly added photo can presign/upload/register
  // immediately, rather than waiting for Save Changes.
  const uploadOnePhoto = async (photo: Photo, order: number, photoType?: 'before_repair') => {
    const setPhotoState = photoType === 'before_repair' ? setNewBeforePhotos : setNewPhotos
    setPhotoState(prev => prev.map(p => (p.id === photo.id ? { ...p, status: 'uploading' } : p)))

    try {
      const presign = await presignListingImage(listing.id, photo.file.type || 'image/jpeg')
      if (!presign) throw new Error('presign failed')

      const uploaded = await uploadImageToS3(presign.upload.url, presign.upload.fields, photo.file)
      if (!uploaded) throw new Error('s3 upload failed')

      const registered = await registerListingImage(listing.id, presign.s3_key, order, photoType)
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
    const startIndex = existingImages.length + newPhotos.length
    setNewPhotos(prev => [...prev, ...added])
    added.forEach((photo, i) => uploadOnePhoto(photo, startIndex + i))
  }

  const removeNewPhoto = async (index: number) => {
    const photo = newPhotos[index]
    if (!photo) return
    setNewPhotos(prev => prev.filter((_, i) => i !== index))
    if (photo.imageId) await deleteListingImage(listing.id, photo.imageId)
  }

  const addBeforePhotos = (files: FileList) => {
    const added = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f), status: 'pending' as const }))
    const startIndex = existingBeforeImages.length + newBeforePhotos.length
    setNewBeforePhotos(prev => [...prev, ...added])
    added.forEach((photo, i) => uploadOnePhoto(photo, startIndex + i, 'before_repair'))
  }

  const removeNewBeforePhoto = async (index: number) => {
    const photo = newBeforePhotos[index]
    if (!photo) return
    setNewBeforePhotos(prev => prev.filter((_, i) => i !== index))
    if (photo.imageId) await deleteListingImage(listing.id, photo.imageId)
  }

  const { dragIndex: existingDragIndex, dragHandlers: existingDragHandlers } = useDragReorder(existingImages, setExistingImages)
  const { dragIndex: newDragIndex, dragHandlers: newDragHandlers } = useDragReorder(newPhotos, setNewPhotos)

  const handleDeleteExistingImage = async (imageId: number) => {
    const ok = await deleteListingImage(listing.id, imageId)
    if (ok) {
      setExistingImages(prev => prev.filter(img => img.id !== imageId))
      setExistingBeforeImages(prev => prev.filter(img => img.id !== imageId))
      toast.success(t('EditListingForm.photoRemoved'))
    } else {
      toast.error(t('EditListingForm.photoRemoveFailed'))
    }
  }

  const validate = () => {
    const next: Record<string, string> = {}

    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(form.vin.trim())) {
      next.vin = t('SellForm.errors.vinFormat')
    }
    const yearNum = Number(form.year)
    if (!form.year || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      next.year = t('SellForm.errors.yearInvalid')
    }
    if (!form.make) next.make = t('SellForm.errors.makeRequired')
    if (!form.model) next.model = t('SellForm.errors.modelRequired')
    if (!form.price || Number(form.price) <= 0) next.price = t('SellForm.errors.priceRequired')
    // "Before repair" photos don't count -- same rule the backend enforces
    // (see ListingUpdateSerializer.validate).
    if (existingImages.length + newPhotos.length === 0) next.photos = t('SellForm.errors.photosRequired')

    setErrors(next)

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
    setDocStatus(prev => ({ ...prev, [kind]: 'uploading' }))
    const result = await DOC_UPLOADERS[kind](listing.slug, file)
    setDocStatus(prev => ({ ...prev, [kind]: result ? 'done' : 'error' }))
  }

  // Shared by handleSubmit (publish/save changes) and handleSaveDraft --
  // every field here is genuinely optional on the model regardless of
  // draft/published status, so both send it the same way: present only if
  // actually filled.
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
    return payload
  }

  const buildImagesPayload = () => [
    ...existingImages.map((img, i) => ({ id: img.id, order: i })),
    ...newPhotos.filter(p => p.imageId).map((p, i) => ({ id: p.imageId, order: existingImages.length + i })),
    ...existingBeforeImages.map((img, i) => ({ id: img.id, order: i })),
    ...newBeforePhotos.filter(p => p.imageId).map((p, i) => ({ id: p.imageId, order: existingBeforeImages.length + i })),
  ]

  // Saves whatever's been filled in so far without requiring any of it --
  // unlike publishing (handleSubmit), there's nothing to validate here, the
  // whole point is letting an incomplete draft sit safely until the seller
  // comes back to it. Only reachable while isDraft (see the button below).
  const handleSaveDraft = async () => {
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
      has_warranty: listing.seller.offers_warranty && hasWarranty,
      options: selectedOptions,
      images: buildImagesPayload(),
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

    const { ok } = await updateListing(listing.slug, payload)
    setSavingDraft(false)

    if (!ok) {
      toast.error(t('SellForm.toasts.draftSaveFailed'))
      return
    }

    toast.success(t('SellForm.toasts.draftSaved'))
    router.push(`/profile/${listing.seller.username}#drafts`)
  }

  // "Save Changes" -- is_active isn't editable here at all anymore (see
  // PublishToggleButton in the action bar below, an instant, independent
  // toggle), so this always just carries forward whatever it currently is.
  const submitListing = async () => {
    if (!validate()) return

    const stillUploading = newPhotos.some(p => p.status === 'uploading') || newBeforePhotos.some(p => p.status === 'uploading')
    if (stillUploading) {
      toast.error(t('SellForm.toasts.uploadsInProgress'))
      return
    }

    // A draft resumed here has no Status control (see isDraft above), so
    // "publish" always means AV + active rather than reading
    // form.status/form.is_active, which for a draft are still just
    // whatever buildInitialForm seeded them with ('DR' / listing.is_active).
    const publishStatus = isDraft ? 'AV' : form.status
    const publishIsActive = isDraft ? true : form.is_active

    const vin = form.vin.trim().toUpperCase()
    if (publishStatus === 'AV' && publishIsActive) {
      const vinCheck = await checkVinAvailability(vin, listing.slug)
      if (vinCheck && !vinCheck.available && vinCheck.listing) {
        const conflict = vinCheck.listing
        setErrors(prev => ({ ...prev, vin: t('SellForm.errors.vinTaken') }))
        toast.error(
          t.rich('SellForm.toasts.vinTaken', {
            link: (chunks) => (
              <Link href={`/inventory/${conflict.slug}`} className="underline font-medium">
                {chunks}
              </Link>
            ),
          })
        )
        return
      }
    }

    setSubmitting(true)

    const makeObj = makes.find(m => String(m.id) === form.make)
    const modelObj = models.find(m => String(m.id) === form.model)
    const title = [form.year, makeObj?.name, modelObj?.name, form.trim].filter(Boolean).join(' ')

    const payload: Record<string, unknown> = {
      title,
      vin,
      year: Number(form.year),
      make: Number(form.make),
      model: Number(form.model),
      vehicle_type: form.vehicle_type,
      transmission: form.transmission,
      drive: form.drive,
      fuel_type: form.fuel_type,
      title_document: form.title_document,
      price: Number(form.price),
      status: publishStatus,
      is_active: publishIsActive,
      has_warranty: listing.seller.offers_warranty && hasWarranty,
      options: selectedOptions,
      images: buildImagesPayload(),
      ...buildOptionalFieldsPayload(),
    }
    if (form.trim.trim()) payload.trim = form.trim.trim()

    const { ok, data } = await updateListing(listing.slug, payload)

    if (!ok || !data) {
      if (data && typeof data === 'object') {
        const fieldErrors: Record<string, string> = {}
        for (const [key, value] of Object.entries(data)) {
          fieldErrors[key] = Array.isArray(value) ? String(value[0]) : String(value)
        }
        setErrors(prev => ({ ...prev, ...fieldErrors }))
      }
      toast.error(t('EditListingForm.fixErrorsAndRetry'))
      setSubmitting(false)
      return
    }

    toast.success(t('EditListingForm.listingUpdated'))
    // Not listing.slug -- publishing a resumed draft here is exactly when
    // the model re-slugs off the real title for the first time (it was
    // only ever "draft-{vin}" before now, see isDraft above), so the stale
    // prop this component was given would 404. The response reflects
    // whatever it actually is now (unchanged for a listing that was
    // already published, since its slug never moves again after that).
    router.push(`/inventory/${data.slug}`)
    router.refresh()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitListing()
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 pb-20">
      {isDraft && (
        <Card className="border-warning/40 bg-warning/5">
          <p className="text-sm text-foreground">{t('EditListingForm.draftNotice')}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold">{t('SellForm.vehicleDetails')}</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]" ref={vinRef}>
            <Input label={t('SellForm.vin')} value={form.vin} onChange={setField('vin')} error={errors.vin} placeholder={t('SellForm.vinPlaceholder')} />
          </div>
          <div className="w-28" ref={yearRef}>
            <Input label={t('SellForm.year')} value={form.year} onChange={setField('year')} error={errors.year} type="number" />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]" ref={makeRef}>
            <Select
              label={t('SellForm.make')}
              value={form.make}
              onChange={handleMakeChange}
              options={makes.map(m => ({ value: String(m.id), label: m.name }))}
              placeholder={t('SellForm.selectMake')}
              error={errors.make}
              footerLabel={t('SellForm.requestNewMake')}
              onFooterClick={() => setRequestModal({ kind: 'MAKE' })}
            />
          </div>
          <div className="flex-1 min-w-[160px]" ref={modelRef}>
            <Select
              label={t('SellForm.model')}
              value={form.model}
              onChange={setField('model')}
              options={models.map(m => ({ value: String(m.id), label: m.name }))}
              placeholder={
                !form.make
                  ? t('SellForm.selectMakeFirst')
                  : loadingModels
                  ? t('SellForm.loading')
                  : models.length === 0
                  ? t('SellForm.noModelsYet')
                  : t('SellForm.selectModel')
              }
              error={errors.model}
              disabled={!form.make || loadingModels}
              footerLabel={t('SellForm.requestNewModel')}
              onFooterClick={() => {
                const make = makes.find(m => String(m.id) === form.make)
                if (make) setRequestModal({ kind: 'MODEL', makeId: make.id, makeName: make.name })
              }}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Input label={t('SellForm.trim')} value={form.trim} onChange={setField('trim')} placeholder={t('SellForm.trimPlaceholder')} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Select label={t('SellForm.vehicleType')} value={form.vehicle_type} onChange={setField('vehicle_type')} options={translateOptions(VEHICLE_TYPES, (code) => tAttr(`vehicleType.${code}`))} />
          </div>
          {!isDraft && (
            <div className="flex-1 min-w-[160px]">
              <Select label={t('EditListingForm.status')} value={form.status} onChange={setField('status')} options={STATUS_OPTIONS} />
            </div>
          )}
        </div>
        {!isDraft && (
          <div className={cn(
            'flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors',
            form.is_active ? 'border-border' : 'border-warning/40 bg-warning/5'
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              {form.is_active ? (
                <Eye className="w-4 h-4 text-success shrink-0" />
              ) : (
                <EyeOff className="w-4 h-4 text-warning shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t('EditListingForm.published')}</p>
                <p className="text-xs text-muted">
                  {form.is_active ? t('EditListingForm.publishedDescription') : t('EditListingForm.unpublishedNotice')}
                </p>
              </div>
            </div>
            <Switch
              defaultChecked={form.is_active}
              onChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              aria-label={t('EditListingForm.published')}
            />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('SellForm.specs')}</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Input label={t('SellForm.mileage')} value={form.mileage} onChange={setField('mileage')} type="number" placeholder={t('SellForm.optional')} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Input label={t('SellForm.engine')} value={form.engine} onChange={setField('engine')} placeholder={t('SellForm.enginePlaceholder')} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Select label={t('SellForm.transmission')} value={form.transmission} onChange={setField('transmission')} options={translateOptions(FILTER_TRANSMISSIONS, (code) => tAttr(`transmission.${code}`))} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select label={t('SellForm.drivetrain')} value={form.drive} onChange={setField('drive')} options={translateOptions(FILTER_DRIVES, (code) => tAttr(`drive.${code}`))} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select label={t('SellForm.fuelType')} value={form.fuel_type} onChange={setField('fuel_type')} options={translateOptions(FUEL_TYPES, (code) => tAttr(`fuelType.${code}`))} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <Input label={t('SellForm.cityMpg')} value={form.city_mpg} onChange={setField('city_mpg')} type="number" placeholder={t('SellForm.optional')} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <Input label={t('SellForm.highwayMpg')} value={form.hwy_mpg} onChange={setField('hwy_mpg')} type="number" placeholder={t('SellForm.optional')} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('SellForm.conditionAndPricing')}</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Select label={t('SellForm.titleStatus')} value={form.title_document} onChange={setField('title_document')} options={translateOptions(TITLE_DOCUMENTS, (code) => tAttr(`titleDocument.${code}`))} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <Input label={t('SellForm.owners')} value={form.owners} onChange={setField('owners')} type="number" placeholder={t('SellForm.optional')} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Select label={t('SellForm.exteriorColor')} value={form.exterior_color} onChange={setField('exterior_color')} options={translateOptions(COLORS, (code) => tAttr(`color.${code}`))} placeholder={t('SellForm.optional')} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select label={t('SellForm.interiorColor')} value={form.interior_color} onChange={setField('interior_color')} options={translateOptions(COLORS, (code) => tAttr(`color.${code}`))} placeholder={t('SellForm.optional')} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]" ref={priceRef}>
            <Input label={t('SellForm.askingPrice')} value={form.price} onChange={setField('price')} error={errors.price} type="number" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Input label={t('SellForm.retailPrice')} value={form.retail_price} onChange={setField('retail_price')} type="number" placeholder={t('SellForm.optional')} />
          </div>
        </div>
        {listing.seller.offers_warranty && (
          <Checkbox
            label={t('SellForm.includeWarranty')}
            defaultChecked={hasWarranty}
            onChange={setHasWarranty}
          />
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('SellForm.description')}</h2>
        <textarea
          value={form.description}
          onChange={setField('description')}
          rows={5}
          placeholder={t('SellForm.descriptionPlaceholder')}
          className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
        />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('SellForm.video')}</h2>
        <p className="text-sm text-muted -mt-1">{t('SellForm.videoDescription')}</p>
        <Input
          label={t('SellForm.videoUrl')}
          value={form.video_url}
          onChange={setField('video_url')}
          placeholder={t('SellForm.videoUrlPlaceholder')}
        />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('SellForm.featuresAndOptions')}</h2>
        <p className="text-sm text-muted -mt-1">{t('SellForm.featuresAndOptionsDescription')}</p>
        <VehicleOptionsPicker options={vehicleOptions} selected={selectedOptions} onToggle={toggleOption} tAttr={tAttr} />
      </Card>

      <Card>
        <h2 ref={photosRef} className="text-lg font-semibold">{t('SellForm.photos')}</h2>
        {errors.photos && <p className="text-xs text-error -mt-1">{errors.photos}</p>}

        {existingImages.length > 0 && (
          <>
            <p className="text-xs text-muted -mt-1">{t('SellForm.dragToReorder')}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {existingImages.map((img, i) => (
                <div
                  key={img.id}
                  {...existingDragHandlers(i)}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border border-border cursor-grab active:cursor-grabbing transition-opacity',
                    existingDragIndex === i && 'opacity-40'
                  )}
                >
                  <Image src={safeImageUrl(img.thumb_url, img.image_url)} alt={t('SellForm.photos')} fill sizes="(min-width: 768px) 16vw, (min-width: 640px) 25vw, 33vw" className="object-cover pointer-events-none" />
                  {i === 0 && (
                    <Badge label={t('SellForm.cover')} variant="primary" className="absolute left-1 bottom-1" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteExistingImage(img.id)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white cursor-pointer"
                    aria-label={t('SellForm.removePhoto')}
                    title={t('SellForm.removePhoto')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <Dropzone inputId="edit-photo-input" onFiles={addPhotos} multiple accept="image/*">
          <ImagePlus className="w-6 h-6 text-muted" />
          <p className="text-muted text-sm">{t('EditListingForm.clickToAddMorePhotos')}</p>
        </Dropzone>

        {newPhotos.length > 0 && (
          <>
            <p className="text-xs text-muted -mt-1">{t('EditListingForm.dragToReorderNewPhotos')}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {newPhotos.map((p, i) => (
                <div
                  key={p.id}
                  {...(submitting ? {} : newDragHandlers(i))}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border border-border transition-opacity',
                    !submitting && 'cursor-grab active:cursor-grabbing',
                    newDragIndex === i && 'opacity-40'
                  )}
                >
                  <Image src={p.preview} alt={t('SellForm.previewAlt', { index: i })} fill className="object-cover pointer-events-none" />
                  {p.status !== 'pending' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium">
                      {p.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin" />}
                      {p.status === 'done' && <Check className="w-5 h-5" />}
                      {p.status === 'error' && t('SellForm.failed')}
                    </div>
                  )}
                  {p.status === 'pending' && !submitting && (
                    <button
                      type="button"
                      onClick={() => removeNewPhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white cursor-pointer"
                      aria-label={t('SellForm.removePhoto')}
                      title={t('SellForm.removePhoto')}
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
        <h2 className="text-lg font-semibold">{t('SellForm.beforeRepairPhotos')}</h2>
        <p className="text-sm text-muted -mt-1">{t('SellForm.beforeRepairPhotosDescription')}</p>

        {existingBeforeImages.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {existingBeforeImages.map((img) => (
              <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                <Image src={safeImageUrl(img.thumb_url, img.image_url)} alt={t('SellForm.beforeRepairPhotos')} fill sizes="(min-width: 768px) 16vw, (min-width: 640px) 25vw, 33vw" className="object-cover pointer-events-none" />
                <button
                  type="button"
                  onClick={() => handleDeleteExistingImage(img.id)}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white cursor-pointer"
                  aria-label={t('SellForm.removePhoto')}
                  title={t('SellForm.removePhoto')}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Dropzone inputId="edit-before-photo-input" onFiles={addBeforePhotos} multiple accept="image/*">
          <ImagePlus className="w-6 h-6 text-muted" />
          <p className="text-muted text-sm">{t('EditListingForm.clickToAddMorePhotos')}</p>
        </Dropzone>

        {newBeforePhotos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {newBeforePhotos.map((p, i) => (
              <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                <Image src={p.preview} alt={t('SellForm.beforeRepairPreviewAlt', { index: i })} fill className="object-cover pointer-events-none" />
                {p.status !== 'pending' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium">
                    {p.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin" />}
                    {p.status === 'done' && <Check className="w-5 h-5" />}
                    {p.status === 'error' && t('SellForm.failed')}
                  </div>
                )}
                {p.status === 'pending' && !submitting && (
                  <button
                    type="button"
                    onClick={() => removeNewBeforePhoto(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white cursor-pointer"
                    aria-label={t('SellForm.removePhoto')}
                    title={t('SellForm.removePhoto')}
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
        <h2 className="text-lg font-semibold">{t('SellForm.documentsTitle')}</h2>
        <p className="text-sm text-muted -mt-1">{t('SellForm.reportDescription')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DocUploadSlot
            inputId="edit-carfax-input"
            label={t('SellForm.carfaxReport')}
            file={carfaxFile}
            existingUrl={listing.carfax_pdf}
            status={docStatus.carfax}
            onSelectFile={(file) => { setCarfaxFile(file); uploadDoc('carfax', file) }}
            onRemoveFile={() => setCarfaxFile(null)}
            clickToSelectLabel={t('SellForm.clickToSelectPdf')}
            removeLabel={t('SellForm.removeCarfaxReport')}
            viewCurrentLabel={t('EditListingForm.viewCurrentReport')}
            replaceLabel={t('EditListingForm.replace')}
            uploadingLabel={t('SellForm.uploading')}
            uploadedLabel={t('SellForm.uploaded')}
            uploadFailedLabel={t('SellForm.uploadFailed')}
          />
          <DocUploadSlot
            inputId="edit-alignment-input"
            label={t('SellForm.alignmentReport')}
            file={alignmentFile}
            existingUrl={listing.alignment_report}
            status={docStatus.alignment}
            onSelectFile={(file) => { setAlignmentFile(file); uploadDoc('alignment', file) }}
            onRemoveFile={() => setAlignmentFile(null)}
            clickToSelectLabel={t('SellForm.clickToSelectPdf')}
            removeLabel={t('SellForm.removeAlignmentReport')}
            viewCurrentLabel={t('EditListingForm.viewCurrentReport')}
            replaceLabel={t('EditListingForm.replace')}
            uploadingLabel={t('SellForm.uploading')}
            uploadedLabel={t('SellForm.uploaded')}
            uploadFailedLabel={t('SellForm.uploadFailed')}
          />
          <DocUploadSlot
            inputId="edit-inspection-input"
            label={t('SellForm.inspectionReport')}
            file={inspectionFile}
            existingUrl={listing.inspection_report}
            status={docStatus.inspection}
            onSelectFile={(file) => { setInspectionFile(file); uploadDoc('inspection', file) }}
            onRemoveFile={() => setInspectionFile(null)}
            clickToSelectLabel={t('SellForm.clickToSelectPdf')}
            removeLabel={t('SellForm.removeInspectionReport')}
            viewCurrentLabel={t('EditListingForm.viewCurrentReport')}
            replaceLabel={t('EditListingForm.replace')}
            uploadingLabel={t('SellForm.uploading')}
            uploadedLabel={t('SellForm.uploaded')}
            uploadFailedLabel={t('SellForm.uploadFailed')}
          />
        </div>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border py-3">
        <div className="max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 flex justify-end gap-2">
          {isDraft && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleSaveDraft}
              disabled={submitting || savingDraft}
              className={cn(savingDraft && 'flex items-center gap-2')}
            >
              {savingDraft && <Loader2 className="w-4 h-4 animate-spin" />}
              {savingDraft ? t('SellForm.savingDraft') : t('SellForm.saveDraft')}
            </Button>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={submitting || savingDraft}
            className={cn(submitting && 'flex items-center gap-2')}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting
              ? (isDraft ? t('SellForm.publishing') : t('EditListingForm.saving'))
              : (isDraft ? t('SellForm.publishListing') : t('EditListingForm.saveChanges'))}
          </Button>
        </div>
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
