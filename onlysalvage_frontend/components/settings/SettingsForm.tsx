'use client'

import { useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Camera } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'
import { CityAutocomplete } from '@/components/ui/CityAutocomplete'
import { Avatar } from '@/components/ui/Avatar'
import { Checkbox } from '@/components/ui/Checkbox'
import { ImageCropModal } from '@/components/profile/ImageCropModal'
import { RequestVerificationButton } from '@/components/profile/RequestVerificationButton'
import { WarrantyListingsCard } from '@/components/settings/WarrantyListingsCard'
import { usePhoneVerification } from '@/components/settings/PhoneVerification'
import { updateProfile } from '@/lib/api'
import { cn, formatPhoneDigits, formatPhoneNumber, isPhoneNumberComplete, normalizeUrl, phoneDigitsOnly, sellerDisplayName } from '@/lib/utils'
import { US_STATES } from '@/lib/types'
import type { Profile, ListingSummary } from '@/lib/types'

// Mirrors the backend's PHONE_VERIFICATION_ENABLED (see settings.py) and
// SignUpForm's identical constant -- all three need to be flipped together.
const PHONE_VERIFICATION_ENABLED = process.env.NEXT_PUBLIC_PHONE_VERIFICATION_ENABLED === 'true';

type VerificationStatus = 'verified' | 'pending' | 'rejected' | 'none'

interface SettingsFormProps {
  profile: Profile
  email?: string
  verificationStatus: VerificationStatus
  warrantyListings: ListingSummary[]
}

export function SettingsForm({ profile, email, verificationStatus, warrantyListings }: SettingsFormProps) {
  const t = useTranslations('EditProfileModal')
  const tSettings = useTranslations('Settings')
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(profile.profile_picture ?? null)
  // Street/city start locked (read-only, no autocomplete search) whenever
  // there's already a saved value -- otherwise the address/city autocomplete
  // effects fire on mount for the pre-filled value and immediately pop their
  // suggestions dropdown open. An empty field has nothing to protect (it's
  // below the autocomplete's minimum query length anyway), so it starts
  // unlocked and ready to type into right away.
  const [streetEditing, setStreetEditing] = useState(!profile.street_address)
  const [cityEditing, setCityEditing] = useState(!profile.city)
  const [emailError, setEmailError] = useState('')
  const [businessNameError, setBusinessNameError] = useState('')
  const [streetAddressError, setStreetAddressError] = useState('')
  const [warrantyDurationError, setWarrantyDurationError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [pendingCropFile, setPendingCropFile] = useState<{ src: string; name: string; type: string } | null>(null)
  // Tracks what's actually saved server-side, separately from form.offers_warranty
  // (which also drives the checkbox's own UI) -- the per-listing checkboxes
  // below need to know this specifically, since the backend rejects
  // has_warranty=true on a listing until this is true in the database (see
  // ListingUpdateSerializer.validate), not just checked-but-unsaved locally.
  const [offersWarrantySaved, setOffersWarrantySaved] = useState(profile.offers_warranty ?? false)

  const [form, setForm] = useState({
    email: email ?? '',
    business_name: profile.business_name ?? '',
    phone: formatPhoneNumber(profile.phone),
    website: profile.website ?? '',
    street_address: profile.street_address ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    zip_code: profile.zip_code ?? '',
    description: profile.description ?? '',
    is_dealer: profile.is_dealer ?? false,
    offers_financing: profile.offers_financing ?? false,
    offers_warranty: profile.offers_warranty ?? false,
    warranty_duration: profile.warranty_duration ?? '',
    warranty_description: profile.warranty_description ?? '',
    show_email: profile.show_email ?? true,
  })

  const setField = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      if (field === 'email') setEmailError('')
      if (field === 'business_name') setBusinessNameError('')
      if (field === 'street_address') setStreetAddressError('')
    }

  const phoneVerification = usePhoneVerification({
    liveInputPhone: form.phone,
    initialPhone: formatPhoneNumber(profile.phone),
    initialVerified: profile.phone_verified ?? false,
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Don't use the raw file yet -- open the cropper first so the user can
    // pick the square region to actually upload as their profile picture.
    setPendingCropFile({ src: URL.createObjectURL(file), name: file.name, type: file.type || 'image/jpeg' })
    e.target.value = ''
  }

  const handleCropCancel = () => {
    if (pendingCropFile) URL.revokeObjectURL(pendingCropFile.src)
    setPendingCropFile(null)
  }

  const handleCropConfirm = (croppedFile: File) => {
    if (pendingCropFile) URL.revokeObjectURL(pendingCropFile.src)
    setPendingCropFile(null)
    setImageFile(croppedFile)
    setPreview(URL.createObjectURL(croppedFile))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.email.trim()) {
      setEmailError(t('emailRequired'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setEmailError(t('emailInvalid'))
      return
    }
    if (form.is_dealer && !form.business_name.trim()) {
      setBusinessNameError(t('businessNameRequired'))
      return
    }
    if (form.is_dealer && !form.street_address.trim()) {
      setStreetAddressError(t('streetAddressRequired'))
      return
    }
    if (form.is_dealer && form.offers_warranty && !form.warranty_duration.trim()) {
      setWarrantyDurationError(t('warrantyDurationRequired'))
      return
    }
    if (form.phone.trim() && !isPhoneNumberComplete(form.phone)) {
      setPhoneError(t('phoneInvalid'))
      return
    }
    if (PHONE_VERIFICATION_ENABLED && form.phone.trim() && !phoneVerification.verified) {
      setPhoneError(t('phoneNotVerified'))
      return
    }

    setSubmitting(true)

    const data = new FormData()
    data.append('email', form.email.trim())
    data.append('business_name', form.business_name)
    data.append('phone', form.phone)
    data.append('website', normalizeUrl(form.website))
    data.append('street_address', form.street_address)
    data.append('city', form.city)
    data.append('state', form.state)
    data.append('zip_code', form.zip_code)
    data.append('description', form.description)
    data.append('is_dealer', String(form.is_dealer))
    data.append('offers_financing', String(form.is_dealer && form.offers_financing))
    data.append('offers_warranty', String(form.is_dealer && form.offers_warranty))
    data.append('warranty_duration', form.is_dealer && form.offers_warranty ? form.warranty_duration : '')
    data.append('warranty_description', form.is_dealer && form.offers_warranty ? form.warranty_description : '')
    data.append('show_email', String(form.show_email))
    if (imageFile) data.append('profile_picture', imageFile)

    const result = await updateProfile(data)
    setSubmitting(false)

    if (!result) {
      toast.error(t('updateFailed'))
      return
    }

    toast.success(t('updateSucceeded'))
    router.push(`/profile/${profile.username}`)
    // Without this, the profile page can still render from the Router
    // Cache as it looked before this save (same staleness issue fixed for
    // the login flows) -- refresh forces it to pick up what was just saved.
    router.refresh()
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Card id="profile" className="scroll-mt-26">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-lg font-semibold">{tSettings('navProfile')}</h3>
            <RequestVerificationButton initialStatus={verificationStatus} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer"
                aria-label={t('changeProfilePicture')}
              >
                <Avatar src={preview ?? undefined} name={sellerDisplayName({ ...profile, is_dealer: form.is_dealer, business_name: form.business_name })} size="lg" className="w-24 h-24 text-2xl" />
                <div className={cn(
                  'absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'
                )}>
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {t('changeProfilePicture')}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Input label={t('email')} type="email" value={form.email} onChange={setField('email')} error={emailError} placeholder={t('emailPlaceholder')} />
            {form.is_dealer && (
              <Input
                label={t('businessName')}
                value={form.business_name}
                onChange={setField('business_name')}
                error={businessNameError}
              />
            )}
            <Input
              label={t('phoneNumber')}
              type="tel"
              value={form.phone}
              onChange={(e) => {
                const input = e.target
                const formatted = formatPhoneNumber(input.value)
                setForm(prev => ({ ...prev, phone: formatted }))
                setPhoneError('')
                requestAnimationFrame(() => input.setSelectionRange(formatted.length, formatted.length))
              }}
              onKeyDown={(e) => {
                // See SignUpForm's phone input for why backspace needs to
                // be handled explicitly rather than left to the browser.
                if (e.key !== 'Backspace') return
                e.preventDefault()
                const input = e.currentTarget
                const digits = phoneDigitsOnly(form.phone)
                const formatted = formatPhoneDigits(digits.slice(0, -1))
                setForm(prev => ({ ...prev, phone: formatted }))
                setPhoneError('')
                requestAnimationFrame(() => input.setSelectionRange(formatted.length, formatted.length))
              }}
              placeholder={t('phonePlaceholder')}
              error={phoneError}
              endButton={PHONE_VERIFICATION_ENABLED ? phoneVerification.verifyButton : undefined}
            />
            {PHONE_VERIFICATION_ENABLED && phoneVerification.panel}
            <Input label={t('website')} value={form.website} onChange={setField('website')} placeholder={t('websitePlaceholder')} />
            {/* Exact street address is only ever shown/settable for dealers --
                private sellers only appear at city/state granularity on their
                page (see the backend, which also silently clears this field for
                any non-dealer regardless of what a request sends). */}
            {form.is_dealer && (
              <AddressAutocomplete
                label={t('streetAddress')}
                value={form.street_address}
                onChange={(value) => {
                  setForm(prev => ({ ...prev, street_address: value }))
                  setStreetAddressError('')
                }}
                onAddressSelect={(address) => {
                  setForm(prev => ({
                    ...prev,
                    street_address: address.street_address,
                    city: address.city || prev.city,
                    state: address.state || prev.state,
                    zip_code: address.zip_code || prev.zip_code,
                  }))
                  setStreetAddressError('')
                }}
                placeholder={t('streetAddressPlaceholder')}
                error={streetAddressError}
                locked={!streetEditing}
                onUnlock={() => setStreetEditing(true)}
                editAriaLabel={t('editField')}
              />
            )}

            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <CityAutocomplete
                  label={t('city')}
                  value={form.city}
                  onChange={(value) => setForm(prev => ({ ...prev, city: value }))}
                  onCitySelect={({ city, state }) => setForm(prev => ({ ...prev, city, state: state || prev.state }))}
                  locked={!cityEditing}
                  onUnlock={() => setCityEditing(true)}
                  editAriaLabel={t('editField')}
                />
              </div>
              <div className="w-20 min-w-0">
                <Select label={t('state')} value={form.state} onChange={setField('state')} options={US_STATES} />
              </div>
              <div className="w-28 min-w-0">
                <Input label={t('zipCode')} value={form.zip_code} onChange={setField('zip_code')} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-foreground">{t('description')}</label>
              <textarea
                value={form.description}
                onChange={setField('description')}
                rows={4}
                placeholder={t('descriptionPlaceholder')}
                className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
              />
            </div>

            <Checkbox
              label={t('dealerCheckbox')}
              defaultChecked={form.is_dealer}
              onChange={(checked) => {
                setForm(prev => ({ ...prev, is_dealer: checked, street_address: checked ? prev.street_address : '' }))
                if (!checked) {
                  setBusinessNameError('')
                  setStreetAddressError('')
                }
              }}
            />

            {form.is_dealer && (
              <Checkbox
                label={t('financingCheckbox')}
                defaultChecked={form.offers_financing}
                onChange={(checked) => setForm(prev => ({ ...prev, offers_financing: checked }))}
              />
            )}

            <Checkbox
              label={t('showEmailCheckbox')}
              defaultChecked={form.show_email}
              onChange={(checked) => setForm(prev => ({ ...prev, show_email: checked }))}
            />
          </div>
        </Card>

        {/* Subscriptions hidden for now -- SubscriptionTiers preview stays
            in the codebase, just not rendered, until this is ready to ship. */}

        {form.is_dealer && (
          <Card id="warranty" className="scroll-mt-26">
            <h3 className="text-lg font-semibold">{tSettings('warrantyTitle')}</h3>
            <p className="text-sm text-muted -mt-1">{tSettings('warrantyDescription')}</p>

            <div className="flex flex-col gap-4">
              <Checkbox
                label={t('warrantyCheckbox')}
                defaultChecked={form.offers_warranty}
                onChange={async (checked) => {
                  setForm(prev => ({ ...prev, offers_warranty: checked }))
                  if (!checked) setWarrantyDurationError('')

                  // Saved immediately (separately from the big Save Changes
                  // button below) so the per-listing checkboxes unlock right
                  // away instead of staying disabled until a full form submit.
                  setOffersWarrantySaved(checked)
                  const data = new FormData()
                  data.append('offers_warranty', String(checked))
                  const result = await updateProfile(data)
                  if (!result) {
                    setOffersWarrantySaved(!checked)
                    toast.error(t('updateFailed'))
                  }
                }}
              />

              {form.offers_warranty && (
                <>
                  <Input
                    label={t('warrantyDuration')}
                    value={form.warranty_duration}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, warranty_duration: e.target.value }))
                      setWarrantyDurationError('')
                    }}
                    placeholder={t('warrantyDurationPlaceholder')}
                    error={warrantyDurationError}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-foreground">{t('warrantyDescription')}</label>
                    <textarea
                      value={form.warranty_description}
                      onChange={setField('warranty_description')}
                      rows={3}
                      placeholder={t('warrantyDescriptionPlaceholder')}
                      className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
                    />
                  </div>
                </>
              )}

              {form.offers_warranty && warrantyListings.length > 0 && (
                <div className="border-t border-border pt-4 flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{tSettings('warrantyListingsTitle')}</h4>
                  <WarrantyListingsCard listings={warrantyListings} canToggle={offersWarrantySaved} />
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border py-3">
          <div className="max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? t('saving') : t('saveChanges')}
            </Button>
          </div>
        </div>
      </form>

      {pendingCropFile && (
        <ImageCropModal
          imageSrc={pendingCropFile.src}
          fileName={pendingCropFile.name}
          mimeType={pendingCropFile.type}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  )
}
