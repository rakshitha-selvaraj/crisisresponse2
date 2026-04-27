import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, Sparkles } from 'lucide-react';
import { getChatResponse } from '../services/aiService';
import { cn } from '../lib/utils';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([
    { role: 'ai', text: 'I am Aegis AI. How can I assist you in this emergency situation?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const resp = await getChatResponse(userMsg, "Global Emergency Coordination System");
      setMessages(prev => [...prev, { role: 'ai', text: resp }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Service temporarily unavailable. Please stay safe." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      {isOpen ? (
        <div className="bg-[#0F1115] w-80 md:w-96 h-[560px] rounded-2xl shadow-2xl border border-gray-800 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
          {/* Header */}
          <div className="bg-[#0A0B0D] p-6 text-white flex items-center justify-between border-b border-gray-800 relative group/header">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                 <Bot size={24} />
              </div>
              <div>
                <h4 className="font-black text-[11px] tracking-[0.2em] uppercase">Gemma Assistant</h4>
                <div className="flex items-center gap-2 mt-1">
                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"></div>
                   <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest leading-none">Logic_Stable</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="w-8 h-8 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 transition-all duration-300"
              title="Close System Link"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/20 custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={cn(
                "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}>
                <div className={cn(
                  "p-4 rounded-xl text-[11px] font-mono leading-relaxed",
                  m.role === 'user' 
                    ? "bg-red-600 text-white rounded-tr-none shadow-xl shadow-red-900/10" 
                    : "bg-gray-900 text-gray-300 border border-gray-800 rounded-tl-none shadow-sm"
                )}>
                  {m.role === 'ai' && <span className="text-red-500 mr-2 font-black tracking-tighter">[GEMMA_CORE]:</span>}
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
               <div className="flex items-center gap-2 text-[8px] font-mono text-gray-600 uppercase tracking-widest animate-pulse">
                  <Sparkles size={12} className="text-red-500" /> Computing_Response...
               </div>
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-800 bg-[#0F1115] flex items-center justify-between">
             <button 
               onClick={() => setIsOpen(false)}
               className="text-[9px] font-mono text-gray-500 hover:text-red-500 uppercase tracking-widest flex items-center gap-1 transition-colors"
             >
               <X size={12} /> [ TERMINATE_LINK ]
             </button>
             <span className="text-[8px] font-mono text-gray-700 italic">E2E_ENCRYPTED</span>
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 bg-[#0A0B0D] border-t border-gray-800">

            <div className="flex items-center gap-2 bg-black border border-gray-800 rounded-lg px-4 py-1 focus-within:border-red-500 transition-colors">
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="INPUT COMMAND..."
                className="flex-1 h-10 bg-transparent text-[11px] font-mono text-gray-300 focus:outline-none placeholder:text-gray-800"
              />
              <button disabled={isLoading} className="text-red-600 disabled:opacity-10 hover:scale-110 transition-transform">
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-red-600 text-white w-16 h-16 rounded flex items-center justify-center shadow-[0_10px_30px_rgba(220,38,38,0.4)] hover:scale-105 transition-transform group relative"
        >
          <div className="absolute -top-1 -right-1 bg-white w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
             <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
          </div>
          <Bot size={28} className="group-hover:rotate-12 transition-transform" />
        </button>
      )}
    </div>
  );
}
