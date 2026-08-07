import { Checkbox } from '@/components/ui/Checkbox'
import { vehicleOptionIcon } from '@/lib/vehicleOptionIcons'
import type { VehicleOption, VehicleOptionCategory } from '@/lib/types'

// Fixed display order -- independent of whatever order the API returns
// options in, so the sections don't jump around between renders/loads.
const CATEGORY_ORDER: VehicleOptionCategory[] = ['CMF', 'TEC', 'SAF', 'EXT', 'PRF']

interface VehicleOptionsPickerProps {
  options: VehicleOption[]
  selected: number[]
  onToggle: (id: number, checked: boolean) => void
  tAttr: (key: string) => string
}

export function VehicleOptionsPicker({ options, selected, onToggle, tAttr }: VehicleOptionsPickerProps) {
  const grouped = CATEGORY_ORDER
    .map(category => ({ category, items: options.filter(o => o.category === category) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="max-h-96 overflow-y-auto pr-1 space-y-4">
      {grouped.map(({ category, items }) => (
        <div key={category}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
            {tAttr(`optionCategory.${category}`)}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            {items.map(opt => (
              <Checkbox
                key={opt.id}
                label={opt.label}
                icon={vehicleOptionIcon(opt.icon)}
                defaultChecked={selected.includes(opt.id)}
                onChange={(checked) => onToggle(opt.id, checked)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
