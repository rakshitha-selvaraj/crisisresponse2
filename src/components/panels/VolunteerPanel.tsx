import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { MapPin, Navigation, CheckCircle2, XCircle, Truck, PackageCheck, AlertCircle, UserCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Incident } from '../../types';

import { handleFirestoreError, OperationType } from '../../lib/errorHandlers';

export default function VolunteerPanel() {
  const [tasks, setTasks] = useState<Incident[]>([]);
  const [ignoredTaskIds, setIgnoredTaskIds] = useState<Set<string>>(new Set());
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'incidents'),
      where('status', 'in', ['reported', 'allocating', 'in_progress'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setTasks(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incidents');
    });

    return () => unsubscribe();
  }, []);

  const handleAction = async (taskId: string, newStatus: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'incidents', taskId);
      await updateDoc(docRef, {
        status: newStatus,
        assignedVolunteerId: user.uid,
        assignedVolunteerName: user.displayName,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${taskId}`);
    }
  };

  const handleIgnore = (taskId: string) => {
    setIgnoredTaskIds(prev => new Set([...prev, taskId]));
  };

  const visibleTasks = tasks.filter(t => !ignoredTaskIds.has(t.id));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Volunteer <span className="text-red-600">Tasks</span></h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mt-1">Status: Ready to Help // Nearby Emergencies: {visibleTasks.length}</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-[#0F1115] px-4 py-2 rounded-lg border border-gray-800 flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">System Connected</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleTasks.length === 0 ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-700 bg-[#0F1115] rounded-3xl border border-dashed border-gray-800">
            <AlertCircle size={48} className="mb-4 opacity-10" />
            <p className="font-black text-lg uppercase tracking-tight text-gray-500">All Clear</p>
            <p className="text-[10px] font-mono mt-2 lowercase">No active emergencies in your area.</p>
          </div>
        ) : visibleTasks.map((task) => (
          <div key={task.id} className={cn(
            "bg-[#0F1115] rounded-xl border border-gray-800 transition-all duration-500 overflow-hidden relative group hover:border-gray-700",
            task.status === 'in_progress' && 'ring-1 ring-red-500/30 bg-red-900/5'
          )}>
            {/* Urgency indicator */}
            <div className={cn(
              "absolute top-0 left-0 h-full w-1",
              task.urgency === 'critical' ? 'bg-red-600 shadow-[2px_0_10px_red]' :
              task.urgency === 'high' ? 'bg-orange-600' : 'bg-blue-600'
            )}></div>

            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500 block mb-2">{task.type}</span>
                    <h3 className="font-bold text-white text-lg leading-tight group-hover:text-red-400 transition-colors">Location: {task.location?.address || 'Geolocation Fix'}</h3>
                 </div>
                 <div className={cn(
                   "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest bg-gray-900 border",
                   task.urgency === 'critical' ? 'border-red-900/50 text-red-500' : 'border-gray-800 text-gray-500'
                 )}>
                   {task.urgency}
                 </div>
              </div>

              <div className="bg-black/40 p-5 rounded-lg border border-gray-800 mb-8 border-l-2 border-l-gray-700">
                 <p className="text-xs text-gray-400 font-mono leading-relaxed italic">"{task.description}"</p>
              </div>

              <div className="space-y-4 mb-10">
                <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                  <MapPin size={12} className="text-red-500" />
                  <span>{task.location?.lat ? `GPS: ${task.location.lat}, ${task.location.lng}` : 'Address: Recorded'}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                   <PackageCheck size={12} className="text-blue-500" />
                   <span>Status: <span className="font-black text-gray-300 uppercase tracking-tighter">{task.status}</span></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {task.status === 'reported' && (
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleAction(task.id, 'in_progress')}
                      className="w-full bg-red-600 text-white px-6 py-4 rounded font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-[0_4px_20px_rgba(220,38,38,0.3)]"
                    >
                      <Navigation size={14} /> I'll Help
                    </button>
                    <button 
                      onClick={() => handleIgnore(task.id)}
                      className="w-full bg-gray-900 text-gray-500 border border-gray-800 px-6 py-3 rounded font-black text-[10px] uppercase tracking-widest hover:text-white transition-all"
                    >
                      Ignore
                    </button>
                  </div>
                )}

                {task.status === 'in_progress' && (
                  <button 
                    onClick={() => handleAction(task.id, 'resolved')}
                    className="w-full bg-white text-black px-6 py-4 rounded font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-200 shadow-xl transition-all"
                  >
                    <CheckCircle2 size={16} /> Task Completed
                  </button>
                )}

                {task.status === 'resolved' && (
                  <div className="flex items-center justify-center gap-3 text-green-500 font-black text-[10px] uppercase tracking-[0.2em] bg-green-500/5 border border-green-500/20 py-4 rounded">
                    <CheckCircle2 size={16} /> Finished
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
