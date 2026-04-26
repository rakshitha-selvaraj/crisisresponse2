import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, serverTimestamp, getDocs, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ShieldAlert, Activity, Users, Map as MapIcon, Siren, TrendingUp, Target, Truck, Clock, Navigation, CheckCircle2, MapPin, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Incident, UserProfile } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/errorHandlers';

// Custom icons
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

const vehicleIcon = (type: string) => {
  let icon = '🚑';
  let color = '#22c55e';
  
  if (type === 'fire') {
    icon = '🔥';
    color = '#f97316';
  } else if (type === 'volunteer' || type === 'other') {
    icon = '🤝';
    color = '#3b82f6';
  }

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; border: 1px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5); font-size: 10px; color: white;">
      ${icon}
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
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
  const [volunteers, setVolunteers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    critical: 0,
    resolved: 0,
    unhandled: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setIncidents(data);

      setStats({
        active: data.filter(i => i.status !== 'resolved').length,
        critical: data.filter(i => i.urgency === 'critical' && i.status !== 'resolved').length,
        resolved: data.filter(i => i.status === 'resolved').length,
        unhandled: data.filter(i => i.status === 'reported').length
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'incidents');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'volunteer'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UserProfile);
      setVolunteers(data);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = async (id: string, updates: Partial<Incident>) => {
    try {
      await updateDoc(doc(db, 'incidents', id), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Permanently delete this incident record?")) {
      try {
        await deleteDoc(doc(db, 'incidents', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `incidents/${id}`);
      }
    }
  };

  return (
    <div className="space-y-8 h-full animate-in fade-in duration-700">
      {/* Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-4">
        <StatCard 
          icon={<ShieldAlert className="text-red-500" />} 
          label="Critical Active" 
          value={stats.critical} 
          isAlert={stats.critical > 0}
        />
        <StatCard 
          icon={<AlertCircle className="text-yellow-500" />} 
          label="Unhandled Alerts" 
          value={stats.unhandled} 
          isAlert={stats.unhandled > 3}
          trend="ACTION REQ"
        />
        <StatCard 
          icon={<Users className="text-blue-500" />} 
          label="Available Units" 
          value={volunteers.length} 
        />
        <StatCard 
          icon={<CheckCircle2 className="text-green-500" />} 
          label="Resolved Today" 
          value={stats.resolved} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 px-4">
        {/* Incident Monitoring List */}
        <div className="lg:col-span-1 space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex items-center justify-between sticky top-0 bg-[#0A0B0D] py-4 z-10 border-b border-gray-800">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
               <Siren size={12} className="text-red-500" /> Command Ops
            </h3>
            <span className="text-[9px] font-mono text-gray-700">{incidents.length} ENTRIES</span>
          </div>
          
          {incidents.map((incident) => (
            <div key={incident.id} className={cn(
              "p-5 rounded-xl bg-[#0F1115] border border-gray-800 hover:border-gray-700 transition-all group",
              incident.urgency === 'critical' && incident.status !== 'resolved' && "ring-1 ring-red-500/50 bg-red-950/10",
              incident.status === 'reported' && "border-yellow-500/30"
            )}>
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2">
                   <span className={cn(
                     "text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest",
                     incident.urgency === 'critical' ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' :
                     incident.urgency === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                   )}>
                     {incident.urgency}
                   </span>
                   {incident.status === 'reported' && (Date.now() - (incident.createdAt?.seconds * 1000 || 0)) > 120000 && (
                     <AlertTriangle size={12} className="text-yellow-500 animate-bounce" />
                   )}
                 </div>
                 <StatusBadge status={incident.status} />
              </div>
              <h4 className="text-[12px] font-bold text-white mb-2 uppercase tracking-tight">{incident.location.address || "Unknown Point"}</h4>
              <p className="text-[10px] text-gray-500 mb-6 leading-relaxed italic line-clamp-2">"{incident.description}"</p>
              
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                  onClick={() => handleUpdate(incident.id, { status: 'resolved' })}
                  className="flex-1 py-2 bg-green-900/20 text-green-500 border border-green-900/50 rounded-lg text-[8px] font-black uppercase hover:bg-green-600 hover:text-white transition-all"
                 >
                   Resolve
                 </button>
                 {incident.status === 'reported' && (
                   <button 
                    onClick={() => handleUpdate(incident.id, { urgency: 'critical', status: 'allocating' })}
                    className="flex-1 py-2 bg-red-900/20 text-red-500 border border-red-900/50 rounded-lg text-[8px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"
                   >
                     Force Allocate
                   </button>
                 )}
              </div>
            </div>
          ))}
        </div>

        {/* Tactical Map */}
        <div className="lg:col-span-3 bg-[#0F1115] rounded-2xl p-6 shadow-2xl border border-gray-800 flex flex-col h-[800px] relative">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <div className="bg-red-600/10 p-2 rounded-lg border border-red-500/20">
                   <Target className="text-red-500" size={18} />
                </div>
                <div>
                  <h3 className="font-black text-white uppercase tracking-widest text-xs">Tactical Response Overlay</h3>
                  <p className="text-[8px] text-gray-600 font-mono mt-0.5 uppercase tracking-widest">Global Coordination Matrix</p>
                </div>
             </div>
          </div>
          
          <div className="flex-1 rounded-xl overflow-hidden border border-gray-800 relative shadow-inner">
             <MapContainer 
              center={[12.9716, 77.5946]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
              className="h-full w-full"
             >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
                          <div className="font-mono text-[10px] p-2 text-white bg-[#0F1115] border border-gray-800 rounded-lg shadow-2xl min-w-[200px]">
                            <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
                               <span className="font-black text-red-500 uppercase tracking-widest">{incident.type}</span>
                               <span className="text-[8px] text-gray-600">#{incident.id.slice(0,6)}</span>
                            </div>
                            <p className="text-gray-300 font-bold mb-1">{incident.location.address}</p>
                            {incident.location.doorInfo && (
                               <p className="text-blue-500 font-black text-[9px] uppercase mb-2">Unit: {incident.location.doorInfo}</p>
                            )}
                            <p className="text-gray-500 italic mb-4">"{incident.description}"</p>
                            
                            <div className="grid grid-cols-2 gap-2 mt-2">
                               <button 
                                 onClick={() => handleUpdate(incident.id, { status: 'resolved' })}
                                 className="py-2 bg-green-600 text-white rounded text-[8px] font-black uppercase hover:bg-green-700"
                               >
                                 Resolve
                               </button>
                               <button 
                                 onClick={() => handleDelete(incident.id)}
                                 className="py-2 bg-gray-800 text-gray-400 rounded text-[8px] font-black uppercase hover:bg-red-600 hover:text-white"
                               >
                                 Delete
                               </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                      
                      {incident.responderLocation && (
                        <Marker 
                          position={[incident.responderLocation.lat, incident.responderLocation.lng]} 
                          icon={vehicleIcon(incident.responderType || 'fire')}
                        >
                          <Popup className="dark-popup">
                            <div className="p-2 text-white bg-black/60 rounded">
                               <p className="text-[10px] font-black uppercase mb-1">Unit {incident.responderType}</p>
                               <StatusBadge status={incident.status} />
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </React.Fragment>
                  );
                })}
             </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    reported: { bg: 'bg-yellow-900/20', border: 'border-yellow-900/50', text: 'text-yellow-500', label: 'Reported', icon: <Clock size={10} /> },
    allocating: { bg: 'bg-blue-900/20', border: 'border-blue-900/50', text: 'text-blue-400', label: 'Allocating', icon: <Navigation size={10} className="animate-pulse" /> },
    assigned: { bg: 'bg-purple-900/20', border: 'border-purple-900/50', text: 'text-purple-400', label: 'Assigned', icon: <CheckCircle2 size={10} /> },
    on_the_way: { bg: 'bg-orange-900/20', border: 'border-orange-900/50', text: 'text-orange-500', label: 'On Way', icon: <Truck size={10} className="animate-bounce" /> },
    reached: { bg: 'bg-blue-600/20', border: 'border-blue-500/50', text: 'text-blue-400', label: 'Reached', icon: <MapPin size={10} /> },
    resolved: { bg: 'bg-green-900/20', border: 'border-green-900/50', text: 'text-green-500', label: 'Resolved', icon: <CheckCircle2 size={10} /> }
  };
  const config = configs[status] || configs.reported;
  return (
    <div className={cn("flex items-center gap-2 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border w-fit", config.bg, config.text, config.border)}>
      {config.icon}
      {config.label}
    </div>
  );
}

function StatCard({ icon, label, value, trend, isAlert }: any) {
  return (
    <div className={cn(
      "bg-[#0F1115] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between group transition-all duration-300",
      isAlert && "border-red-900/50 bg-red-950/5 ring-1 ring-red-900/20"
    )}>
      <div className="flex items-center justify-between mb-6">
        <div className={cn("p-2 rounded-lg bg-black/40 border border-gray-800 transition-transform group-hover:scale-110", isAlert && "border-red-900/50 bg-red-900/20 shadow-[0_0_10px_rgba(220,38,38,0.2)]")}>
          {icon}
        </div>
        {trend && <span className={cn("text-[8px] font-black uppercase tracking-widest", isAlert ? "text-red-500" : "text-gray-600")}>{trend}</span>}
      </div>
      <div>
        <div className="text-3xl font-black text-white leading-none mb-1 tabular-nums tracking-tighter">{value}</div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">{label}</div>
      </div>
    </div>
  );
}
