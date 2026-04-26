import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { classifyEmergency } from '../../services/aiService';
import { AlertCircle, Send, MapPin, Clock, CheckCircle2, Navigation, ShieldAlert, Truck, Bot, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Incident } from '../../types';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { handleFirestoreError, OperationType } from '../../lib/errorHandlers';

// Custom icons for map
const personIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(59,130,246,0.5);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

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
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.5); color: white; font-size: 14px;">
      ${icon}
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

export default function UserPanel() {
  const [report, setReport] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const getGPSLocation = () => {
    setGpsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsLoading(false);
          setAddress(`GPS Fix: ${pos.coords.latitude?.toFixed(4) || '0.0000'}, ${pos.coords.longitude?.toFixed(4) || '0.0000'}`);
        },
        (err) => {
          console.error("GPS Error:", err);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const q = query(
      collection(db, 'incidents'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setIncidents(data);
      if (data.length > 0 && !selectedIncident) {
        setSelectedIncident(data[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incidents');
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report.trim() || !auth.currentUser) return;
    if (!location && !address.trim()) return;

    setIsSubmitting(true);
    try {
      const aiResponse = await classifyEmergency(report);
      const doorInfo = (document.getElementById('door-info') as HTMLInputElement)?.value || '';
      
      await addDoc(collection(db, 'incidents'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName,
        description: report,
        type: aiResponse.type || 'other',
        urgency: aiResponse.urgency || 'medium',
        status: 'reported',
        location: location ? 
          { lat: location.lat, lng: location.lng, address: address, doorInfo } : 
          { address: address, doorInfo }, 
        createdAt: serverTimestamp(),
        aiReportSummary: aiResponse.summary
      });

      setReport('');
      setAddress('');
      setLocation(null);
      if (document.getElementById('door-info')) (document.getElementById('door-info') as HTMLInputElement).value = '';
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'incidents');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* AI Reporting Section */}
      <div className="lg:col-span-2 space-y-6">
        <section className="bg-[#0F1115] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                <Bot size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white uppercase tracking-tight">AI Emergency Assistant</h3>
                <p className="text-[10px] text-gray-500 font-mono italic">Gemma Core // Ready to Help</p>
              </div>
            </div>
            <div className={cn(
              "px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase transition-all flex items-center gap-2",
              gpsLoading ? "bg-yellow-950/20 border-yellow-900/50 text-yellow-500" : 
              location ? "bg-green-950/20 border-green-900/50 text-green-500" : 
              "bg-black border-gray-800 text-gray-600"
            )}>
              <MapPin size={12} className={cn(location && "animate-pulse")} />
              {gpsLoading ? "Acquiring GPS..." : location ? "GPS Fixed" : "GPS Status: Idle"}
            </div>
          </div>

          <div className="p-8">
            <div className="space-y-6 mb-8">
              <div>
                <p className="text-gray-400 text-sm leading-relaxed mb-4 italic opacity-75">
                  "Hello, I am Gemma. Describe your emergency below."
                </p>
                <textarea
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  placeholder="Type your emergency details here..."
                  className="w-full h-32 p-6 bg-black border border-gray-800 rounded-xl focus:ring-1 focus:ring-red-500 focus:border-red-500/50 resize-none transition-all placeholder:text-gray-700 text-gray-300 font-mono text-sm leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input 
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street Address / Landmark"
                  className="w-full p-4 bg-black border border-gray-800 rounded-xl focus:ring-1 focus:ring-red-500 focus:border-red-500/50 text-gray-300 font-mono text-sm"
                />
                <input 
                  type="text"
                  id="door-info"
                  placeholder="Floor / Door Number / Flat Details"
                  className="w-full p-4 bg-black border border-gray-800 rounded-xl focus:ring-1 focus:ring-red-500 focus:border-red-500/50 text-gray-300 font-mono text-sm"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={getGPSLocation}
                  disabled={gpsLoading}
                  className="flex-1 bg-gray-900 text-blue-500 border border-gray-800 py-4 rounded-xl hover:bg-gray-800 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <MapPin size={14} /> {gpsLoading ? 'Acquiring...' : 'Use My GPS Position'}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                disabled={isSubmitting || !report.trim() || (!location && !address.trim())}
                onClick={handleSubmit}
                className="w-full sm:w-auto flex-1 bg-red-600 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_25px_rgba(220,38,38,0.3)]"
              >
                {isSubmitting ? "Processing..." : "Send Help Signal"}
              </button>
            </div>
          </div>
        </section>

        {/* Live Tracking Map for Selected Incident */}
        {selectedIncident && selectedIncident.location?.lat && (
          <section className="bg-[#0F1115] border border-gray-800 rounded-2xl overflow-hidden h-[500px] relative shadow-2xl group">
            <MapContainer 
              center={[selectedIncident.location.lat, selectedIncident.location.lng]} 
              zoom={15} 
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Marker position={[selectedIncident.location.lat, selectedIncident.location.lng]} icon={personIcon}>
                <Popup className="dark-popup">You are here</Popup>
              </Marker>
              
              {selectedIncident.responderLocation && (
                <Marker position={[selectedIncident.responderLocation.lat, selectedIncident.responderLocation.lng]} icon={vehicleIcon(selectedIncident.responderType || 'fire')}>
                  <Popup className="dark-popup">
                    <span className="text-white font-bold">Responder is {selectedIncident.status.replace('_', ' ')}</span>
                  </Popup>
                </Marker>
              )}
              
              <MapUpdater center={[selectedIncident.location.lat, selectedIncident.location.lng]} />
            </MapContainer>
            
            {/* Tracking Overlay UI */}
            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent z-[1000]">
               <div className="bg-[#1A1D23]/90 backdrop-blur-xl border border-gray-800 p-6 rounded-2xl shadow-2xl flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg animate-pulse">
                    {selectedIncident.responderType === 'ambulance' ? <Activity size={32} /> : <ShieldAlert size={32} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                       <h4 className="text-xl font-black text-white uppercase tracking-tighter">
                         {selectedIncident.status === 'on_the_way' ? "Rescue En Route" : 
                          selectedIncident.status === 'assigned' ? "Rescue Assigned" :
                          selectedIncident.status === 'reached' ? "Rescue Arrived" : "Processing Signal"}
                       </h4>
                       <StatusBadge status={selectedIncident.status} />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div className={cn(
                            "h-full bg-blue-500 transition-all duration-1000",
                            selectedIncident.status === 'reported' ? "w-1/4" :
                            selectedIncident.status === 'assigned' ? "w-1/2" :
                            selectedIncident.status === 'on_the_way' ? "w-3/4" : "w-full"
                          )}></div>
                        </div>
                        <p className="text-[10px] font-mono text-gray-500 uppercase">ETA: {selectedIncident.status === 'on_the_way' ? "~4 MINS" : "--"}</p>
                    </div>
                  </div>
               </div>
            </div>

            <div className="absolute top-4 left-4 z-[1000]">
               <div className="bg-[#0F1115]/80 backdrop-blur-md p-4 rounded-xl border border-gray-800 shadow-2xl">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Satellite Link</p>
                  <p className="text-white text-xs font-mono">FIX_STRENGTH: 98%</p>
               </div>
            </div>
          </section>
        )}
      </div>

      {/* Sidebar: Incident Logs */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
             <Activity size={12} className="text-red-500" /> My Reports
          </h4>
        </div>
        
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
          {incidents.length === 0 ? (
            <div className="text-center py-12 bg-black/20 rounded-xl border border-dashed border-gray-800">
               <p className="text-[10px] text-gray-600 uppercase font-mono">No active logs</p>
            </div>
          ) : incidents.map((incident) => (
            <div 
              key={incident.id} 
              onClick={() => setSelectedIncident(incident)}
              className={cn(
                "bg-[#0F1115] p-5 rounded-xl border transition-all cursor-pointer group relative overflow-hidden",
                selectedIncident?.id === incident.id ? "border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]" : "border-gray-800 hover:border-gray-700"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest",
                  incident.status === 'resolved' ? "text-green-500" : "text-orange-500"
                )}>{incident.type}</span>
                <span className="text-[8px] font-mono text-gray-700">{new Date(incident.createdAt?.seconds * 1000).toLocaleTimeString()}</span>
              </div>
              <p className="text-xs text-gray-400 mb-4 line-clamp-2 italic">"{incident.description}"</p>
              <StatusBadge status={incident.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    reported: { bg: 'bg-yellow-900/20', border: 'border-yellow-900/50', text: 'text-yellow-500', label: 'Pending Response', icon: <Clock size={10} /> },
    allocating: { bg: 'bg-blue-900/20', border: 'border-blue-900/50', text: 'text-blue-400', label: 'AI Processing', icon: <Navigation size={10} className="animate-pulse" /> },
    assigned: { bg: 'bg-purple-900/20', border: 'border-purple-900/50', text: 'text-purple-400', label: 'Accepted', icon: <CheckCircle2 size={10} /> },
    on_the_way: { bg: 'bg-orange-900/20', border: 'border-orange-900/50', text: 'text-orange-500', label: 'On The Way', icon: <Truck size={10} className="animate-bounce" /> },
    reached: { bg: 'bg-blue-600/20', border: 'border-blue-500/50', text: 'text-blue-400', label: 'Reached Location', icon: <MapPin size={10} /> },
    resolved: { bg: 'bg-green-900/20', border: 'border-green-900/50', text: 'text-green-500', label: 'Task Secured', icon: <CheckCircle2 size={10} /> }
  };
  const config = configs[status] || configs.reported;
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border w-fit", config.bg, config.text, config.border)}>
      {config.icon}
      {config.label}
    </div>
  );
}
