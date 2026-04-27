export type UserRole = 'user' | 'volunteer' | 'admin' | 'fire_station' | 'ambulance';

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
  userName?: string;
  description: string;
  type: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'allocating' | 'assigned' | 'on_the_way' | 'reached' | 'resolved';
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  responderLocation?: {
    lat: number;
    lng: number;
  };
  responderType?: 'fire' | 'ambulance' | 'volunteer';
  createdAt: any;
  updatedAt?: any;
  aiReportSummary?: string;
  aiPrioritization?: string;
  escalatedAt?: any;
  assignedVolunteerId?: string;
  assignedResponderId?: string;
  autoAssignedAt?: any;
}
