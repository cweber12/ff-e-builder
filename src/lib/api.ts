import { imagesApi } from './api/images';
import { itemsApi } from './api/items';
import { materialsApi } from './api/materials';
import { plansApi } from './api/plans';
import { proposalApi } from './api/proposal';
import { projectsApi } from './api/projects';
import { roomsApi } from './api/rooms';
import { usersApi } from './api/users';

// Compatibility export
export { ApiError } from './api/transport';
export type { ImageEntityRef, UploadImageInput } from './api/images';
export type { CreateItemInput, UpdateItemInput } from './api/items';
export type { CreateMaterialInput, UpdateMaterialInput } from './api/materials';
export type { CreateMeasuredPlanInput, UpdatePlanCalibrationInput } from './api/plans';
export type {
  CreateProposalCategoryInput,
  CreateProposalItemInput,
  UpdateProposalCategoryInput,
  UpdateProposalItemInput,
} from './api/proposal';
export type { CreateProjectInput, UpdateProjectInput } from './api/projects';
export type { CreateRoomInput, UpdateRoomInput } from './api/rooms';
export type { UpsertUserProfileInput } from './api/users';

// API namespace

export const api = {
  projects: projectsApi,
  users: usersApi,
  proposal: proposalApi,
  rooms: roomsApi,
  items: itemsApi,
  images: imagesApi,
  materials: materialsApi,
  plans: plansApi,
};
