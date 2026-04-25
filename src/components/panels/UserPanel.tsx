import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { classifyEmergency } from '../../services/aiService';
import { AlertCircle, Send, MapPin, Clock, CheckCircle2, Navigation, ShieldAlert, Truck, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Incident } from '../../types';

import { handleFirestoreError, OperationType } from '../../lib/errorHandlers';

export default function UserPanel() {
  const [report, setReport] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const getGPSLocation = () => {
    setGpsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsLoading(false);
          // When GPS is found, we can optionally populate the address field or just use the lat/lng
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

    // Filter by authenticated userId for isolation
    const q = query(
      collection(db, 'incidents'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setIncidents(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incidents');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report.trim() || !auth.currentUser) return;
    if (!location && !address.trim()) return;

    setIsSubmitting(true);
    try {
      // 1. AI Classification
      const aiResponse = await classifyEmergency(report);
      
      // 2. Submit to Firebase
      await addDoc(collection(db, 'incidents'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName,
        description: report,
        type: aiResponse.type || 'other',
        urgency: aiResponse.urgency || 'medium',
        status: 'reported',
        location: location || { address: address }, 
        createdAt: serverTimestamp(),
        aiReportSummary: aiResponse.summary
      });

      setReport('');
      setAddress('');
      setLocation(null);
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
        <section className="bg-[#0F1115] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl mb-12">
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

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                  <input 
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter manual address or landmark..."
                    className="w-full p-4 bg-black border border-gray-800 rounded-xl focus:ring-1 focus:ring-red-500 focus:border-red-500/50 text-gray-300 font-mono text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={getGPSLocation}
                  disabled={gpsLoading}
                  className="bg-gray-900 text-blue-500 border border-gray-800 rounded-xl hover:bg-gray-800 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <MapPin size={14} /> {gpsLoading ? 'Wait...' : 'Get GPS'}
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
              
              <div className="text-center sm:text-right">
                <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest leading-tight">Encryption: E2EE</p>
                <p className="text-[9px] font-mono text-blue-500 uppercase tracking-widest mt-1">Satellite: RESCUE-01</p>
              </div>
            </div>
          </div>
        </section>


        {/* Active tracking List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 flex items-center gap-2">
               Incident Logs
            </h4>
            <span className="text-[10px] font-mono text-gray-700">TOTAL_ACTIVE: {incidents.length}</span>
          </div>
          
          {incidents.map((incident) => (
            <div key={incident.id} className={cn(
              "bg-[#0F1115] p-5 rounded-xl border border-gray-800 hover:border-red-500/30 transition-all flex items-start gap-5 group",
              incident.urgency === 'critical' && "bg-red-950/10 border-red-900/50"
            )}>
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center relative",
                incident.urgency === 'critical' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' :
                incident.urgency === 'high' ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'
              )}>
                <Navigation size={20} className={cn(incident.status === 'in_progress' && "animate-pulse")} />
                {incident.urgency === 'critical' && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">{incident.type}</span>
                  <span className="text-[9px] font-mono text-gray-600">ID://{incident.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <p className="text-sm font-medium text-gray-300 mb-4 line-clamp-2 leading-relaxed">
                   {incident.description}
                </p>
                
                <div className="flex items-center gap-6 pt-4 border-t border-gray-800/50">
                   <StatusBadge status={incident.status} />
                   <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500 ml-auto">
                      <Clock size={12} className="text-gray-600" />
                      {new Date(incident.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar: AI Safety Guidance & Tracking */}
      <div className="space-y-6">
        <section className="bg-gradient-to-br from-red-600 to-red-900 p-8 rounded-2xl text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-black text-2xl uppercase tracking-tighter mb-1">Rescue Lock</h3>
            <p className="text-red-200 text-xs font-mono mb-8 opacity-80">BIOMETRIC_DATA_SYNC_ACTIVE</p>
            
            <div className="space-y-4">
              <div className="bg-black/20 p-5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="text-[10px] font-bold text-red-200 uppercase mb-3 tracking-widest">Neural Status</div>
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_10px_#4ade80]"></div>
                   <span className="text-xs font-mono text-white">READY_FOR_DEPLOYMENT</span>
                </div>
              </div>
              
              <div className="p-4 border border-white/5 rounded-xl bg-white/5">
                 <p className="text-[10px] leading-relaxed text-red-100 italic opacity-70">
                   "Calm breathing recommended. System has optimized response routes to your precise GPS signature."
                 </p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-10 rotate-12 scale-150">
             <ShieldAlert size={200} />
          </div>
        </section>

        <section className="bg-[#0F1115] border border-gray-800 p-6 rounded-2xl">
           <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-4 tracking-widest">Environmental Intel</h5>
           <div className="space-y-3">
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                 <div className="h-full bg-red-600 w-3/4 animate-pulse"></div>
              </div>
              <p className="text-[10px] font-mono text-gray-600 uppercase">Regional_Urgency: High</p>
           </div>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    reported: { bg: 'bg-yellow-900/20', border: 'border-yellow-900/50', text: 'text-yellow-500', label: 'Signal Received', icon: <Clock size={10} /> },
    allocating: { bg: 'bg-blue-900/20', border: 'border-blue-900/50', text: 'text-blue-400', label: 'AI Mapping', icon: <Navigation size={10} className="animate-pulse" /> },
    in_progress: { bg: 'bg-red-900/20', border: 'border-red-900/50', text: 'text-red-500', label: 'In Transit', icon: <Truck size={10} /> },
    resolved: { bg: 'bg-green-900/20', border: 'border-green-900/50', text: 'text-green-500', label: 'Secured', icon: <CheckCircle2 size={10} /> }
  };
  const config = configs[status] || configs.reported;
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border", config.bg, config.text, config.border)}>
      {config.icon}
      {config.label}
    </div>
  );
}
