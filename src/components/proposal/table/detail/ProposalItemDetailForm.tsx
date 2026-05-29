import { cents, formatMoney } from '../../../../types';
import type { ReactNode } from 'react';
import type { ProposalItem } from '../../../../types';
import { GeneratedItemEditableTextControl } from '../../../shared/table/GeneratedItemEditableTextCell';
import {
  GeneratedItemEditableMoneyControl,
  GeneratedItemEditableQuantityControl,
} from '../../../shared/table/GeneratedItemEditableNumberCell';
import { GeneratedItemSizeControl } from '../../../shared/table/GeneratedItemSizeModal';
import { GeneratedItemMaterialsControl } from '../../../shared/table/GeneratedItemMaterialsCell';
import type { UpdateProposalItemInput } from '../../../../lib/api';

const PROPOSAL_QUANTITY_UNITS = ['unit', 'sq ft', 'ln ft', 'sq yd', 'cu yd', 'each'] as const;

type ProposalItemDetailFormProps = {
  item: ProposalItem;
  lineTotalCents: number;
  onSave: (patch: Omit<UpdateProposalItemInput, 'version'>) => void;
  onOpenMaterials: () => void;
};

export function ProposalItemDetailForm({
  item,
  lineTotalCents,
  onSave,
  onOpenMaterials,
}: ProposalItemDetailFormProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-5">
        <FormField label="Product tag">
          <GeneratedItemEditableTextControl
            value={item.productTag}
            onSave={(productTag) => onSave({ productTag })}
            ariaLabel="Product tag"
          />
        </FormField>
        <FormField label="Item name">
          <GeneratedItemEditableTextControl
            value={item.itemName}
            onSave={(itemName) => onSave({ itemName })}
            ariaLabel="Item name"
          />
        </FormField>
        <FormField label="Location">
          <GeneratedItemEditableTextControl
            value={item.location}
            onSave={(location) => onSave({ location })}
            ariaLabel="Location"
            multiline
          />
        </FormField>
        <FormField label="Drawings">
          <GeneratedItemEditableTextControl
            value={item.drawings}
            onSave={(drawings) => onSave({ drawings })}
            ariaLabel="Drawings"
            multiline
          />
        </FormField>
        <FormField label="Plan reference">
          <GeneratedItemEditableTextControl
            value={item.plan}
            onSave={(plan) => onSave({ plan })}
            ariaLabel="Plan reference"
            multiline
          />
        </FormField>
        <FormField label="Size">
          <GeneratedItemSizeControl
            value={item.sizeLabel}
            triggerVariant="inline"
            initial={{
              mode: item.sizeMode,
              unit: item.sizeUnit,
              w: item.sizeW,
              d: item.sizeD,
              h: item.sizeH,
            }}
            onSave={({ label, mode, unit, w, d, h }) =>
              onSave({
                sizeMode: mode,
                sizeUnit: unit,
                sizeW: w,
                sizeD: d,
                sizeH: h,
                sizeLabel: label,
              })
            }
          />
        </FormField>
        <FormField label="Description" wide>
          <GeneratedItemEditableTextControl
            value={item.description}
            onSave={(description) => onSave({ description })}
            ariaLabel="Description"
            multiline
          />
        </FormField>
        <FormField label="Notes" wide>
          <GeneratedItemEditableTextControl
            value={item.notes}
            onSave={(notes) => onSave({ notes })}
            ariaLabel="Notes"
            multiline
          />
        </FormField>
      </div>

      <div className="mt-6">
        <p className="eyebrow mb-2">Materials</p>
        <GeneratedItemMaterialsControl materials={item.materials} onOpen={onOpenMaterials} />
      </div>

      <div className="mt-7 border-t border-neutral-200 pt-5">
        <dl className="grid grid-cols-3 gap-6">
          <div className="border-l border-neutral-200 pl-3">
            <dt className="eyebrow">Quantity</dt>
            <dd className="mt-1">
              <GeneratedItemEditableQuantityControl
                quantity={item.quantity}
                quantityUnit={item.quantityUnit}
                quantityUnits={PROPOSAL_QUANTITY_UNITS}
                onSaveQuantity={(quantity) => onSave({ quantity })}
                onSaveUnit={(quantityUnit) => onSave({ quantityUnit })}
              />
            </dd>
          </div>
          <div className="border-l border-neutral-200 pl-3">
            <dt className="eyebrow">Unit cost</dt>
            <dd className="mt-1">
              <GeneratedItemEditableMoneyControl
                valueCents={item.unitCostCents}
                onSave={(unitCostCents) => onSave({ unitCostCents })}
                ariaLabel="Unit cost"
              />
            </dd>
          </div>
          <div className="border-l border-brand-600/40 pl-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Total
            </dt>
            <dd className="num mt-1 text-base font-semibold tracking-tight text-brand-700">
              {formatMoney(cents(lineTotalCents))}
            </dd>
          </div>
        </dl>
        {item.cbm > 0 && (
          <p className="num mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            CBM <span className="text-neutral-950">{item.cbm}</span>
          </p>
        )}
      </div>
    </>
  );
}

function FormField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? 'col-span-2 flex flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}
