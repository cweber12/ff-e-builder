import type { UpdateProposalItemInput } from '../../../../lib/api';
import {
  proposalPatchToGeneratedItemChangeInfo,
  type GeneratedItemChangeInfo,
} from '../../../../lib/table/generatedItemChangeInfo';
import type { CustomColumnDef, ProposalItem, ProposalStatus } from '../../../../types';
import type { ChangeConfirmResult } from '../../../shared/modals/ChangeConfirmModal';

export type ProposalCategoryItemPatch = Omit<UpdateProposalItemInput, 'version'>;

export type PendingProposalCategoryChange = GeneratedItemChangeInfo & {
  item: ProposalItem;
  patch: ProposalCategoryItemPatch;
};

export type ProposalCategoryItemSaveDecision =
  | { kind: 'save'; patch: UpdateProposalItemInput }
  | { kind: 'confirm'; pendingChange: PendingProposalCategoryChange };

export function prepareProposalCategoryItemSave(input: {
  item: ProposalItem;
  patch: ProposalCategoryItemPatch;
  proposalStatus: ProposalStatus;
  hasOpenRevision: boolean;
  customColumnDefs: CustomColumnDef[];
}): ProposalCategoryItemSaveDecision {
  const { item, patch, proposalStatus, hasOpenRevision, customColumnDefs } = input;

  if (proposalStatus === 'in_progress' && !hasOpenRevision) {
    return { kind: 'save', patch: { ...patch, version: item.version } };
  }

  const changeInfo = proposalPatchToGeneratedItemChangeInfo(patch, item, customColumnDefs);
  if (!changeInfo) {
    return { kind: 'save', patch: { ...patch, version: item.version } };
  }

  if (!changeInfo.isPriceAffecting) {
    return {
      kind: 'save',
      patch: {
        ...patch,
        version: item.version,
        changeLog: {
          columnKey: changeInfo.columnKey,
          previousValue: changeInfo.previousValue,
          newValue: changeInfo.newValue,
          proposalStatus,
          isPriceAffecting: false,
        },
      },
    };
  }

  return {
    kind: 'confirm',
    pendingChange: { ...changeInfo, item, patch },
  };
}

export function buildProposalCategoryConfirmedSave(input: {
  pendingChange: PendingProposalCategoryChange;
  result: ChangeConfirmResult;
  proposalStatus: ProposalStatus;
}): UpdateProposalItemInput {
  const { pendingChange, result, proposalStatus } = input;
  const { item, patch, columnKey, previousValue, newValue } = pendingChange;
  const changeLog: NonNullable<UpdateProposalItemInput['changeLog']> = {
    columnKey,
    previousValue,
    newValue,
    proposalStatus,
    isPriceAffecting: result.isPriceAffecting,
  };

  if (result.notes) changeLog.notes = result.notes;

  return {
    ...patch,
    version: item.version,
    changeLog,
  };
}
