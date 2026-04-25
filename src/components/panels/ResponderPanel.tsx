import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ShieldAlert, Activity, Users, Map as MapIcon, Siren, TrendingUp, Target, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Incident, UserProfile } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/errorHandlers';

// Custom Marker Icons based on Urgency
const createUrgencyIcon = (urgency: string) => {
  const color = 
    urgency === 'critical' ? '#dc2626' : 
    urgency === 'high' ? '#ea580c' : 
    '#2563eb';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

function MapRefocuser({ incidents }: { incidents: Incident[] }) {
  const map = useMap();
  useEffect(() => {
    const critical = incidents.find(i => i.urgency === 'critical' && typeof i.location?.lat === 'number' && typeof i.location?.lng === 'number');
    if (critical && typeof critical.location.lat === 'number' && typeof critical.location.lng === 'number') {
      map.setView([critical.location.lat, critical.location.lng], 14, { animate: true });
    }
  }, [incidents, map]);
  return null;
}

export default function ResponderPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    critical: 0,
    resolved: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setIncidents(data);

      setStats({
        active: data.filter(i => i.status !== 'resolved').length,
        critical: data.filter(i => i.urgency === 'critical').length,
        resolved: data.filter(i => i.status === 'resolved').length
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'incidents');
    });

    return () => unsubscribe();
  }, []);

  // Helper to calculate distance (Haversine formula simplified)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Automated System Tasks: Escalation and Assignment
  useEffect(() => {
    const automationInterval = setInterval(async () => {
      const now = Date.now();
      const ESCALATION_LIMIT = 15 * 60 * 1000;
      const ASSIGNMENT_LIMIT = 5 * 60 * 1000;

      // Fetch available volunteers
      const volunteerQuery = query(collection(db, 'users'), where('role', '==', 'volunteer'));
      let volunteers: UserProfile[] = [];
      try {
        const vSnapshot = await getDocs(volunteerQuery);
        volunteers = vSnapshot.docs.map(doc => doc.data() as UserProfile).filter(v => v.currentLocation);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }

      for (const incident of incidents) {
        if (!incident.createdAt?.seconds) continue;
        const creationMs = incident.createdAt.seconds * 1000;
        const elapsed = now - creationMs;

        // 1. Auto-Escalation (15 mins)
        if (
          (incident.status === 'reported' || incident.status === 'allocating') &&
          incident.urgency !== 'critical' &&
          elapsed > ESCALATION_LIMIT
        ) {
          try {
            await updateDoc(doc(db, 'incidents', incident.id), {
              urgency: 'critical',
              aiPrioritization: 'RE-ASSIGNED_OVERRIDE',
              escalatedAt: serverTimestamp()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `incidents/${incident.id}`);
          }
        }

        // 2. Auto-Assignment (5 mins)
        if (
          (incident.status === 'reported' || incident.status === 'allocating') &&
          !incident.assignedVolunteerId &&
          elapsed > ASSIGNMENT_LIMIT
        ) {
          let closestVolunteer: UserProfile | null = null;
          let minDistance = Infinity;

          volunteers.forEach(v => {
            if (v.currentLocation && typeof incident.location?.lat === 'number' && typeof incident.location?.lng === 'number') {
              const dist = calculateDistance(
                incident.location.lat, 
                incident.location.lng, 
                v.currentLocation.lat, 
                v.currentLocation.lng
              );
              if (dist < minDistance) {
                minDistance = dist;
                closestVolunteer = v;
              }
            }
          });

          if (closestVolunteer) {
            try {
              await updateDoc(doc(db, 'incidents', incident.id), {
                assignedVolunteerId: (closestVolunteer as UserProfile).uid,
                status: 'allocating',
                autoAssignedAt: serverTimestamp(),
                aiPrioritization: `AUTO_ROUTED_CLOSEST_${minDistance?.toFixed(1) || '0'}KM`
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `incidents/${incident.id}`);
            }
          }
        }
      }
    }, 60000);

    return () => clearInterval(automationInterval);
  }, [incidents]);

  return (
    <div className="space-y-8 h-full animate-in fade-in duration-700">
      {/* Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          icon={<ShieldAlert className="text-red-500" />} 
          label="Active Emergencies" 
          value={stats.active} 
          trend="+2 in 1hr" 
        />
        <StatCard 
          icon={<Siren className="text-orange-500" />} 
          label="High Priority" 
          value={stats.critical} 
          isAlert 
        />
        <StatCard 
          icon={<Activity className="text-blue-500" />} 
          label="System Status" 
          value="Online" 
          trend="ACTIVE" 
        />
        <StatCard 
          icon={<TrendingUp className="text-green-500" />} 
          label="Resolved Cases" 
          value={stats.resolved} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Incident List */}
        <div className="lg:col-span-1 space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex items-center justify-between sticky top-0 bg-[#0A0B0D] py-4 z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
               Live Reports
            </h3>
            <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
               <span className="text-[9px] font-mono text-gray-600 uppercase">Updating</span>
            </div>
          </div>
          
          {incidents.map((incident) => (
            <div key={incident.id} className={cn(
              "p-5 rounded-xl bg-[#0F1115] border border-gray-800 hover:border-red-500/50 transition-all cursor-pointer group",
              incident.urgency === 'critical' && "border-red-900 ring-1 ring-red-900/50 bg-red-950/10"
            )}>
              <div className="flex justify-between items-center mb-4">
                 <span className={cn(
                   "text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest",
                   incident.urgency === 'critical' ? 'bg-red-500 text-white' :
                   incident.urgency === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                 )}>
                   {incident.urgency}
                 </span>
                 <span className="text-[9px] text-gray-700 font-mono text-[8px] opacity-40">ID: {incident.id.slice(0, 6)}</span>
              </div>
              <p className="text-[11px] font-bold text-white mb-2 uppercase tracking-tight group-hover:text-red-400 transition-colors truncate">{incident.type.replace(/_/g, ' ')}</p>
              <p className="text-[10px] text-gray-400 line-clamp-2 mb-6 leading-relaxed italic opacity-80">"{incident.description}"</p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
                 <div className="text-[9px] font-black text-red-500 uppercase tracking-widest">{incident.status}</div>
                 <div className="text-[9px] font-mono text-gray-700">{new Date(incident.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Global Overview Map */}
        <div className="lg:col-span-3 bg-[#0F1115] rounded-2xl p-6 shadow-2xl border border-gray-800 flex flex-col min-h-[600px] relative">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <div className="bg-red-600/10 p-2 rounded-lg border border-red-500/20">
                   <MapIcon className="text-red-500" size={18} />
                </div>
                <h3 className="font-black text-white uppercase tracking-widest text-sm">Emergency Map</h3>
             </div>
             <div className="flex items-center gap-6 text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_8px_red]"></span> High Risk</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-orange-600 rounded-full"></span> Elevated</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-600 rounded-full"></span> Safe Area</div>
             </div>
          </div>
          
          <div className="flex-1 rounded-xl overflow-hidden border border-gray-800 relative group/map">
             <MapContainer 
              center={[12.9716, 77.5946]} 
              zoom={12} 
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
             >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <MapRefocuser incidents={incidents} />
                {incidents.map((incident) => {
                  if (typeof incident.location?.lat !== 'number' || typeof incident.location?.lng !== 'number') return null;
                  return (
                    <React.Fragment key={incident.id}>
                      <Marker 
                        position={[incident.location.lat, incident.location.lng]}
                        icon={createUrgencyIcon(incident.urgency)}
                      >
                        <Popup className="dark-popup">
                          <div className="font-mono text-[10px] p-2 text-white bg-[#0F1115] border border-gray-800 rounded-lg shadow-2xl">
                            <p className="font-black text-red-500 mb-2 uppercase tracking-widest border-b border-gray-800 pb-1">{incident.type}</p>
                            <p className="text-gray-400 italic mb-3">"{incident.description}"</p>
                            <div className="flex items-center justify-between text-[8px] font-mono text-gray-600 border-t border-gray-800 pt-2">
                               <span>FIX: {incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}</span>
                               <span className="text-red-500 font-bold uppercase tracking-tighter">{incident.status}</span>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                      {incident.urgency === 'critical' && (
                        <Circle 
                          center={[incident.location.lat, incident.location.lng]}
                          radius={1000}
                          pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.1, weight: 1, dashArray: '5, 10' }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
             </MapContainer>

             {/* Map Controls */}
             <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                <button className="bg-black/60 backdrop-blur-md p-2 rounded border border-gray-800 text-gray-400 hover:text-white transition-colors" title="Lock GPS On Target">
                   <Target size={18} />
                </button>
             </div>
          </div>


          {/* Map Overlay Stats */}
          <div className="absolute bottom-10 left-10 z-[1000] flex gap-4 pointer-events-none">
             <div className="bg-black/80 backdrop-blur-md border border-gray-800 p-4 rounded-lg">
                <div className="text-[9px] font-bold text-gray-500 uppercase mb-2">Saturation Level</div>
                <div className="flex items-end gap-1 h-8">
                   {[40, 70, 50, 90, 60, 80].map((h, i) => (
                      <div key={i} className="w-1.5 bg-red-600/50 rounded-t" style={{ height: `${h}%` }}></div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, isAlert }: any) {
  return (
    <div className={cn(
      "bg-[#0F1115] p-6 rounded-2xl shadow-xl border border-gray-800 flex flex-col justify-between group transition-all duration-300 hover:border-red-500/30",
      isAlert && "border-red-900/50 bg-red-950/5 ring-1 ring-red-900/20"
    )}>
      <div className="flex items-center justify-between mb-8">
        <div className="p-2 transition-transform group-hover:scale-125 duration-500">
          {icon}
        </div>
        {trend && <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{trend}</span>}
      </div>
      <div>
        <div className="text-4xl font-black text-white leading-none mb-2 tabular-nums tracking-tighter">{value}</div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">{label}</div>
      </div>
    </div>
  );
}
