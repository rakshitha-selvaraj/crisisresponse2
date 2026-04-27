export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  doorInfo?: string;
}

export interface Incident {
  id: string;
  type: 'medical' | 'fire' | 'police' | 'volunteer' | 'other';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'allocating' | 'assigned' | 'on_the_way' | 'reached' | 'resolved';
  description: string;
  location: Location;
  createdAt: any;
  updatedAt: any;
  assignedResponderId?: string;
  responderType?: string;
  responderLocation?: {
    lat: number;
    lng: number;
  };
  isReassigned?: boolean;
  isReassignedFrom?: string;
  systemNote?: string;
  responderVehicleId?: string;
  aiClassification?: string;
  aiPriority?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'user' | 'volunteer' | 'admin' | 'fire_station' | 'ambulance';
  name: string;
  createdAt: any;
  isAvailable?: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  specialties?: string[];
}
