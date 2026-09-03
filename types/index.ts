export type UserRole = 'reporter' | 'finder';

export type CaseStatus = 'active' | 'resolved';

export type SightingStatus = 'pending' | 'matched' | 'expired';

export type MatchTier = 'strong' | 'notify' | 'possible' | 'discarded';

export type FamilyAction = 'none' | 'different_person' | 'resolved';

export interface User {
  id: string;
  emailOrPhone: string;
  role: UserRole;
  createdAt: string;
}

export interface MissingCase {
  id: string;
  reporterId: string;
  name: string;
  age: number;
  description: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  photoUrl: string;
  contactShareEnabled: boolean;
  status: CaseStatus;
  createdAt: string;
}

export interface Sighting {
  id: string;
  finderId: string;
  photoUrl: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  notes?: string;
  status: SightingStatus;
  createdAt: string;
}

export interface Match {
  id: string;
  caseId: string;
  sightingId: string;
  confidenceScore: number;
  tier: MatchTier;
  contactShared: boolean;
  familyAction: FamilyAction;
  reviewedAt?: string;
}
