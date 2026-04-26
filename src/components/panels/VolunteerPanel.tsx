import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { Incident } from '../../types';
import { MapPin, Navigation, CheckCircle2, AlertCircle, Clock, X, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { handleFirestoreError, OperationType } from '../../lib/errorHandlers';

export default function VolunteerPanel() {
  const [tasks, setTasks] = useState<Incident[]>([]);
  const [acceptedTask, setAcceptedTask] = useState<Incident | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // Sync availability
    const syncAvailability = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), { isAvailable });
      } catch (err) {
        console.error("Failed to sync availability", err);
      }
    };
    syncAvailability();

    if (!isAvailable) {
      setTasks([]);
      return;
    }

    const q = collection(db, 'incidents');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      const filtered = data.filter(t => 
        (t.type === 'volunteer' && t.status !== 'resolved')
      );
      setTasks(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incidents');
    });

    return () => unsubscribe();
  }, [user, isAvailable]);

  const handleAction = async (task: Incident, newStatus: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'incidents', task.id);
      const updateData: any = {
        status: newStatus,
        assignedResponderId: user.uid,
        responderType: 'volunteer',
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'assigned') {
        updateData.responderLocation = { lat: 12.9716, lng: 77.5946 }; // Default start
      }

      await updateDoc(docRef, updateData);
      if (newStatus === 'assigned' || newStatus === 'in_progress') {
        setAcceptedTask(task);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${task.id}`);
    }
  };

  // Simulation: Move responder vehicle when on_the_way
  useEffect(() => {
    const activeTasks = tasks.filter(t => t.status === 'on_the_way' && t.assignedResponderId === user?.uid);
    if (activeTasks.length === 0) return;

    const interval = setInterval(() => {
      activeTasks.forEach(async (task) => {
        if (!task.responderLocation || !task.location.lat) return;

        // Move slightly towards target
        const dLat = (task.location.lat - task.responderLocation.lat) * 0.1;
        const dLng = (task.location.lng - task.responderLocation.lng) * 0.1;

        const newLat = task.responderLocation.lat + dLat;
        const newLng = task.responderLocation.lng + dLng;

        try {
          await updateDoc(doc(db, 'incidents', task.id), {
            responderLocation: { lat: newLat, lng: newLng }
          });
        } catch (e) {
          console.error("Simulation error", e);
        }
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [tasks, user]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Volunteer <span className="text-blue-500">Mission Hub</span></h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mt-1">Status: {isAvailable ? "Online" : "Off Duty"} // Tasks: {tasks.length}</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={() => setIsAvailable(!isAvailable)}
             className={cn(
               "px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest border transition-all",
               isAvailable 
                 ? "bg-blue-600/10 border-blue-500 text-blue-500 hover:bg-blue-600/20" 
                 : "bg-red-600/10 border-red-500 text-red-500 hover:bg-red-600/20"
             )}
           >
             {isAvailable ? "Go Off Duty" : "Go On Duty"}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
        {tasks.length === 0 ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-700 bg-[#0F1115] rounded-3xl border border-dashed border-gray-800">
            <AlertCircle size={48} className="mb-4 opacity-10" />
            <p className="font-black text-lg uppercase tracking-tight text-gray-500">No Active Tasks</p>
          </div>
        ) : tasks.map((task) => (
          <div key={task.id} className={cn(
            "bg-[#0F1115] p-8 rounded-xl border transition-all duration-500 overflow-hidden relative group hover:border-blue-500/50",
            task.assignedResponderId === user?.uid ? "border-blue-500/50 ring-1 ring-blue-500/10" : "border-gray-800"
          )}>
            <div className="flex justify-between items-start mb-6">
               <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 block mb-2">{task.type}</span>
                  <h3 className="font-bold text-white text-lg leading-tight group-hover:text-blue-400 transition-colors">{task.location?.address || 'Community Center'}</h3>
               </div>
               <div className="px-2 py-1 bg-gray-900 border border-gray-800 rounded text-[9px] font-black uppercase tracking-widest text-gray-500">
                 {task.urgency}
               </div>
            </div>

            <p className="text-xs text-gray-400 font-mono leading-relaxed italic mb-8 bg-black/40 p-4 rounded-lg border-l-2 border-l-blue-600">
              "{task.description}"
            </p>

            <div className="space-y-3 mb-10">
              <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                <MapPin size={12} className="text-blue-500" />
                <span>GPS: {task.location?.lat?.toFixed(4)}, {task.location?.lng?.toFixed(4)}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                 <Clock size={12} className="text-blue-500" />
                 <span>Received: {new Date(task.createdAt?.seconds * 1000).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {task.status === 'assigned' && (
                <div className="space-y-2">
                  <button 
                    onClick={() => setAcceptedTask(task)}
                    className="w-full bg-gray-800 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-700 transition-all"
                  >
                    View Address Info
                  </button>
                  <button 
                    onClick={() => handleAction(task, 'on_the_way')}
                    className="w-full bg-orange-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all"
                  >
                    Mark as En Route
                  </button>
                </div>
              )}
              
              {task.status === 'on_the_way' && (
                <button 
                  onClick={() => handleAction(task, 'reached')}
                  className="w-full bg-orange-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all"
                >
                  Confirm Arrival
                </button>
              )}

              {task.status === 'reached' && (
                <button 
                  onClick={() => handleAction(task, 'resolved')}
                  className="w-full bg-green-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition-all"
                >
                  Task Completed
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pop-up Detail Modal */}
      {acceptedTask && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0F1115] border border-gray-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-blue-600/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <Navigation size={20} />
                </div>
                <div>
                  <h3 className="font-black text-white uppercase tracking-tighter">Emergency Details</h3>
                  <p className="text-[9px] text-blue-400 font-mono tracking-widest uppercase">Immediate Action Required</p>
                </div>
              </div>
              <button 
                onClick={() => setAcceptedTask(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-black/40 p-6 rounded-xl border border-gray-800">
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.2em] mb-4">Target Address</p>
                <h4 className="text-xl font-bold text-white mb-2 leading-tight">
                  {acceptedTask.location?.address || 'Precise GPS Location'}
                </h4>
                {acceptedTask.location?.doorInfo && (
                  <p className="text-blue-500 font-black text-xs uppercase tracking-widest mt-2">
                    Floor/Door: {acceptedTask.location.doorInfo}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-4">
                  <div className="px-3 py-1 bg-gray-950 rounded border border-gray-800 text-[10px] font-mono text-gray-400">
                    LAT: {acceptedTask.location?.lat?.toFixed(6)}
                  </div>
                  <div className="px-3 py-1 bg-gray-950 rounded border border-gray-800 text-[10px] font-mono text-gray-400">
                    LNG: {acceptedTask.location?.lng?.toFixed(6)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                 <Info className="text-blue-500 shrink-0" size={20} />
                 <div className="text-xs text-gray-300 italic leading-relaxed">
                   "{acceptedTask.description}"
                 </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setAcceptedTask(null)}
                  className="w-full bg-white text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all font-mono"
                >
                  I am on my way
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
