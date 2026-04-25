export type UserRole = 'user' | 'volunteer' | 'admin';

export interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
  photoURL: string | null;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  serviceType?: string;
  isAvailable?: boolean;
}

export interface Incident {
  id: string;
  userId: string;
  description: string;
  type: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'allocating' | 'in_progress' | 'resolved';
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  createdAt: any;
  aiReportSummary?: string;
  aiPrioritization?: string;
  escalatedAt?: any;
  assignedVolunteerId?: string;
  autoAssignedAt?: any;
}
