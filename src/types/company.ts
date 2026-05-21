export interface Company {
  id: string;
  ownerId: string;
  name: string;
  location: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  markEnabled: boolean;
  markIncludeName: boolean;
  markPlacementH: 'left' | 'center' | 'right';
  markPlacementV: 'header' | 'footer';
  markOpacity: number;
  createdAt: string;
  updatedAt: string;
}
