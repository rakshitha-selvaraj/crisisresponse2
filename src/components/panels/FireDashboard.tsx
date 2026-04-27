import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { Incident, UserProfile } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/errorHandlers';
import { ShieldAlert, MapPin, Clock, CheckCircle, Navigation } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function FireDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // Listen for incidents that are 'fire' type or assigned to this responder
    const q = query(
      collection(db, 'incidents'),
      where('status', 'in', ['reported', 'allocating', 'assigned', 'on_the_way', 'reached'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      // Filter for fire-related or already assigned to this station
      const filtered = data.filter(i => 
        i.type === 'fire' || 
        i.assignedResponderId === user.uid
      );
      setIncidents(filtered.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'incidents');
    });

    return () => unsubscribe();
  }, [user]);

  const handleUpdateStatus = async (incidentId: string, status: Incident['status']) => {
    try {
      const docRef = doc(db, 'incidents', incidentId);
      const updateData: any = { 
        status, 
        updatedAt: serverTimestamp(),
        assignedResponderId: user?.uid,
        responderType: 'fire'
      };

      // Simulation: Set initial vehicle location when accepted
      if (status === 'assigned') {
        updateData.responderLocation = { lat: 12.9716, lng: 77.5946 }; // Mock start
      }

      await updateDoc(docRef, updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
    }
  };

  // Simulation: Move responder vehicle when on_the_way
  useEffect(() => {
    const activeIncidents = incidents.filter(i => i.status === 'on_the_way' && i.assignedResponderId === user?.uid);
    if (activeIncidents.length === 0) return;

    const interval = setInterval(() => {
      activeIncidents.forEach(async (incident) => {
        if (!incident.responderLocation || !incident.location.lat) return;

        // Move slightly towards target
        const dLat = (incident.location.lat - incident.responderLocation.lat) * 0.1;
        const dLng = (incident.location.lng - incident.responderLocation.lng) * 0.1;

        const newLat = incident.responderLocation.lat + dLat;
        const newLng = incident.responderLocation.lng + dLng;

        try {
          await updateDoc(doc(db, 'incidents', incident.id), {
            responderLocation: { lat: newLat, lng: newLng }
          });
        } catch (e) {
          console.error("Simulation error", e);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [incidents, user]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Fire Dept <span className="text-orange-500">Dispatch</span></h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mt-1">Station: Active // Monitoring for Alerts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
        {incidents.length === 0 ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-700 bg-[#0F1115] rounded-3xl border border-dashed border-gray-800">
            <ShieldAlert size={48} className="mb-4 opacity-10" />
            <p className="font-black text-lg uppercase tracking-tight text-gray-500">No Active Fire Calls</p>
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className={cn(
              "bg-[#0F1115] rounded-xl border transition-all duration-300 overflow-hidden relative group",
              incident.status === 'reported' ? "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]" : "border-gray-800"
            )}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">{incident.type} Emergency</span>
                  <span className={cn(
                    "px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest",
                    incident.status === 'reported' ? "bg-red-500 text-white" : "bg-gray-800 text-gray-400"
                  )}>{incident.status}</span>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2">{incident.location?.address || 'Geolocation Fix'}</h3>
                <p className="text-gray-500 text-xs mb-6 line-clamp-2 italic">"{incident.description}"</p>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                    <Clock size={12} className="text-orange-500" />
                    <span>Reported: {incident.createdAt?.toDate ? incident.createdAt.toDate().toLocaleTimeString() : 'Just now'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                    <Navigation size={12} className="text-orange-500" />
                    <span>Location: {incident.location?.lat?.toFixed(4)}, {incident.location?.lng?.toFixed(4)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {incident.status === 'reported' && (
                    <button 
                      onClick={() => handleUpdateStatus(incident.id, 'assigned')}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Accept Call / Dispatch Truck
                    </button>
                  )}
                  {incident.status === 'assigned' && (
                    <button 
                      onClick={() => handleUpdateStatus(incident.id, 'on_the_way')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Mark as On The Way
                    </button>
                  )}
                  {incident.status === 'on_the_way' && (
                    <button 
                      onClick={() => handleUpdateStatus(incident.id, 'reached')}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Arrived at Location
                    </button>
                  )}
                  {incident.status === 'reached' && (
                    <button 
                      onClick={() => handleUpdateStatus(incident.id, 'resolved')}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Complete / Resolve Incident
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
