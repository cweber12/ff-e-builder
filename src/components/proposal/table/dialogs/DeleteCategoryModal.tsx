import { useEffect, useState } from 'react';
import { Button, Modal } from '../../../primitives';
import type { ProposalCategoryWithItems } from '../../../../types';

type DeleteCategoryModalProps = {
  category: ProposalCategoryWithItems | null;
  allCategories: ProposalCategoryWithItems[];
  open: boolean;
  onClose: () => void;
  onConfirm: (targetCategoryId: string | null) => Promise<void> | void;
};

export function DeleteCategoryModal({
  category,
  allCategories,
  open,
  onClose,
  onConfirm,
}: DeleteCategoryModalProps) {
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [deleteAll, setDeleteAll] = useState(false);
  const otherCategories = allCategories.filter((c) => c.id !== category?.id);
  const itemCount = category?.items.length ?? 0;
  const hasItems = itemCount > 0;
  const canDelete = !hasItems || deleteAll || targetCategoryId.length > 0;

  useEffect(() => {
    if (open) {
      setTargetCategoryId('');
      setDeleteAll(false);
    }
  }, [open, category?.id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? `Delete ${category.name}?` : 'Delete category'}
    >
      <div className="flex flex-col gap-4">
        {hasItems ? (
          <>
            <p className="text-sm text-neutral-600">
              <strong>{category?.name}</strong> has {itemCount} {itemCount === 1 ? 'item' : 'items'}
              . Choose what to do with them before deleting.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-neutral-200 p-3 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/40">
                <input
                  type="radio"
                  name="delete-category-action"
                  className="mt-0.5 accent-brand-500"
                  checked={!deleteAll}
                  onChange={() => setDeleteAll(false)}
                />
                <span className="text-sm font-medium text-neutral-800">
                  Move items to another category
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-neutral-200 p-3 transition has-[:checked]:border-danger-500 has-[:checked]:bg-danger-500/5">
                <input
                  type="radio"
                  name="delete-category-action"
                  className="mt-0.5 accent-brand-500"
                  checked={deleteAll}
                  onChange={() => setDeleteAll(true)}
                />
                <span className="text-sm font-medium text-neutral-800">
                  Delete category and all {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
              </label>
            </div>
            {!deleteAll && (
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Move items to...
                <select
                  value={targetCategoryId}
                  onChange={(event) => setTargetCategoryId(event.target.value)}
                  className="select-base font-normal"
                >
                  <option value="">Choose a category</option>
                  {otherCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-600">This category is empty and can be deleted.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!canDelete}
            onClick={() => {
              void Promise.resolve(
                onConfirm(hasItems && !deleteAll ? targetCategoryId : null),
              ).then(() => {
                setTargetCategoryId('');
                setDeleteAll(false);
                onClose();
              });
            }}
          >
            Delete category
          </Button>
        </div>
      </div>
    </Modal>
  );
}
