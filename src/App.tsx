import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Map as MapIcon, 
  LayoutDashboard, 
  Bell, 
  UserCircle,
  Truck,
  LogIn,
  LogOut
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import UserPanel from './components/panels/UserPanel';
import VolunteerPanel from './components/panels/VolunteerPanel';
import ResponderPanel from './components/panels/ResponderPanel';
import AIAssistant from './components/AIAssistant';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/errorHandlers';

type UserRole = 'user' | 'volunteer' | 'admin';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role as UserRole);
          } else {
            // Default to user for new logins
            const defaultRole: UserRole = 'user';
            try {
              await setDoc(doc(db, 'users', currentUser.uid), {
                email: currentUser.email,
                role: defaultRole,
                name: currentUser.displayName,
                createdAt: new Date()
              });
              setRole(defaultRole);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}`);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          setRole('user'); // Fallback
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (requestedRole: UserRole) => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, 'users', user.uid);
      let userDoc;
      try {
        userDoc = await getDoc(userDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (!userDoc?.exists()) {
        try {
          await setDoc(userDocRef, {
            email: user.email,
            role: requestedRole,
            name: user.displayName,
            createdAt: new Date()
          });
          setRole(requestedRole);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
      } else {
        // Update role to the portal they just logged into
        try {
          await setDoc(userDocRef, { role: requestedRole }, { merge: true });
          setRole(requestedRole);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
    } catch (error: any) {
      // Handle user cancellation silently
      if (error.code === 'auth/user-cancelled' || error.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error("Login failed:", error);
    }
  };

  const logout = () => {
    signOut(auth);
    setRole(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(220,38,38,0.2)]"></div>
          <div className="text-center">
            <span className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] animate-pulse mb-1">AEGIS_CORE_BOOT</span>
            <span className="text-[8px] font-mono text-gray-700 uppercase">Synchronizing Neural Layers...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(220,38,38,0.1),_transparent)] pointer-events-none"></div>
        
        <div className="max-w-4xl w-full relative z-10">
          <div className="text-center mb-12">
             <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <ShieldAlert size={32} className="text-white" />
             </div>
             <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-2">Emergency Response</h1>
             <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Select your login portal</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <LoginCard 
              title="Help"
              description="Click here if you need emergency assistance."
              icon={<UserCircle size={28} />}
              color="text-red-500"
              bgColor="bg-red-950/20"
              buttonLabel="Login"
              onClick={() => login('user')}
            />

            <LoginCard 
              title="Volunteer"
              description="Click here to help with nearby requests."
              icon={<Truck size={28} />}
              color="text-blue-500"
              bgColor="bg-blue-950/20"
              buttonLabel="Login"
              onClick={() => login('volunteer')}
            />

            <LoginCard 
              title="Official"
              description="Official command center for responders."
              icon={<ShieldAlert size={28} />}
              color="text-purple-500"
              bgColor="bg-purple-950/20"
              buttonLabel="Login"
              onClick={() => login('admin')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-gray-200 font-sans">
      {/* Sidebar Navigation - Strictly Isolated */}
      <nav className="fixed left-0 top-0 h-full w-20 md:w-64 bg-[#0F1115] border-r border-gray-800 z-50 flex flex-col">
        <div className="p-6 flex items-center gap-4">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
            <ShieldAlert size={18} className="text-white" />
          </div>
          <span className="hidden md:block font-black text-lg tracking-tight text-white uppercase">RESCUE LINK</span>
        </div>

        <div className="flex-1 px-4 py-8 space-y-2">
          {role === 'user' && (
            <NavItem 
              id="nav-user"
              icon={<LayoutDashboard size={20} />} 
              label="My Reports" 
              active={true} 
              onClick={() => {}} 
            />
          )}
          {role === 'volunteer' && (
            <NavItem 
              id="nav-volunteer"
              icon={<Truck size={20} />} 
              label="Available Tasks" 
              active={true} 
              onClick={() => {}} 
            />
          )}
          {role === 'admin' && (
            <NavItem 
              id="nav-admin"
              icon={<MapIcon size={20} />} 
              label="Official Hub" 
              active={true} 
              onClick={() => {}} 
            />
          )}
        </div>

        <div className="p-6 border-t border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-800">
            {user.photoURL ? <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" /> : <UserCircle size={24} />}
          </div>
          <div className="hidden md:block flex-1 min-w-0">
            <p className="text-[10px] font-bold text-white uppercase truncate">{user.displayName || 'User'}</p>
            <p className="text-[10px] text-gray-600 uppercase tracking-tighter">{role} Portal</p>
          </div>
          <button onClick={logout} className="text-gray-600 hover:text-red-500 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20 md:pl-64 min-h-screen relative">
        <header className="h-14 bg-[#0F1115]/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-8 sticky top-0 z-40">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {role} Portal / <span className="text-white">Active Session</span>
          </h2>
          <div className="flex items-center gap-4">
             <div className="px-3 py-1 bg-green-950/20 text-green-500 rounded-full text-[10px] font-bold border border-green-900/50 uppercase">Connection Stable</div>
             <button onClick={logout} className="text-[10px] uppercase font-bold text-gray-500 hover:text-white transition-colors">Logout</button>
          </div>
        </header>

        <div className="p-6 max-w-[1400px] mx-auto">
          {role === 'user' && <UserPanel />}
          {role === 'volunteer' && <VolunteerPanel />}
          {role === 'admin' && <ResponderPanel />}
        </div>
        <AIAssistant />
      </main>
    </div>
  );
}

function NavItem({ id, icon, label, active, onClick }: { id: string, icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      id={id}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 relative group overflow-hidden border border-transparent",
        active 
          ? "bg-red-600/10 text-red-500 border-red-500/20" 
          : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className={cn("transition-transform group-hover:scale-110", active && "text-red-500")}>
        {icon}
      </div>
      <span className="hidden md:block font-bold text-[11px] uppercase tracking-wider">{label}</span>
      {active && <div className="absolute left-0 w-1 h-4 bg-red-600 rounded-r-full shadow-[0_0_8px_red]"></div>}
    </div>
  );
}

function LoginCard({ title, description, icon, color, bgColor, buttonLabel, onClick }: { title: string, description: string, icon: React.ReactNode, color: string, bgColor: string, buttonLabel: string, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="bg-[#0F1115] border border-gray-800 p-8 rounded-2xl hover:border-gray-500 transition-all duration-300 cursor-pointer group flex flex-col items-center text-center hover:translate-y-[-4px] shadow-2xl relative overflow-hidden h-full"
    >
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none", bgColor)}></div>
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-xl transition-all group-hover:scale-110", bgColor, color)}>
        {icon}
      </div>
      <h2 className={cn("text-lg font-black uppercase tracking-widest mb-3", color)}>{title}</h2>
      <p className="text-gray-500 text-xs leading-relaxed mb-8">{description}</p>
      
      <div className="mt-auto w-full">
        <button className={cn(
          "w-full py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2",
          "bg-gray-800 text-white group-hover:bg-white group-hover:text-black"
        )}>
          {buttonLabel} <LogIn size={14} />
        </button>
      </div>
    </div>
  );
}
