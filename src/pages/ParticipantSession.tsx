import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, setDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import ai from '../lib/gemini';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';

export function ParticipantSession() {
  const { projectId } = useParams();
  const [project, setProject] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatting, setChatting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      if (!projectId) return;
      try {
        const pDoc = await getDoc(doc(db, 'projects', projectId));
        if (pDoc.exists() && pDoc.data().status === 'active') {
          setProject(pDoc.data());
          // Create session
          const sId = uuidv4();
          setSessionId(sId);
          await setDoc(doc(db, 'projects', projectId, 'sessions', sId), {
            projectId,
            status: 'in_progress',
            startedAt: new Date().toISOString(),
          });
          
          // Initial greeting from AI
          const greeting = "Hi! Thanks for helping us out today. Could you start by taking a look at the content and telling me your first impression?";
          await saveMessage(projectId, sId, 'ai', greeting);
        } else {
          setProject(false); // Indicates not found or not active
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !sessionId) return;
    const q = query(collection(db, 'projects', projectId, 'sessions', sessionId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return unsub;
  }, [projectId, sessionId]);

  const saveMessage = async (pId: string, sId: string, role: string, content: string) => {
    const mId = uuidv4();
    await setDoc(doc(db, 'projects', pId, 'sessions', sId, 'messages', mId), {
      role,
      content,
      createdAt: new Date().toISOString()
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !projectId || !sessionId || !project) return;
    
    const userMsg = input.trim();
    setInput('');
    setChatting(true);
    
    await saveMessage(projectId, sessionId, 'user', userMsg);

    try {
      // Build context for Gemini
      const historyText = messages.map(m => `${m.role === 'ai' ? 'Interviewer' : 'Participant'}: ${m.content}`).join('\n');
      
      const systemPrompt = `You are a professional UX researcher / product interviewer conducting a feedback validation session.
Project Objective: ${project.objective}
Stimulus provided to user: ${project.stimulusType === 'url' ? project.stimulusContent : 'Text: ' + project.stimulusContent}
Target Audience: ${project.targetAudience}

Guidelines:
1. Be concise, friendly, and natural.
2. Ask ONE follow-up question at a time to dig into the "why" behind their statements.
3. If they give a vague answer, ask them to clarify or give an example.
4. Keep the interview going for a few turns to gather good insights about clarity, appeal, and friction points. 
5. If the conversation seems complete or they have provided substantial feedback, you can thank them and end the session by saying explicitly: "That's all the questions I have. Thank you for your time!"
      
Current conversation so far:
${historyText}
Participant: ${userMsg}

What should the Interviewer say next? React directly to the participant's last message, and ask a relevant follow-up question.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: systemPrompt
      });

      const aiReply = response.text?.trim() || "Thank you for the feedback.";
      await saveMessage(projectId, sessionId, 'ai', aiReply);
      
      if (aiReply.toLowerCase().includes("thank you for your time") || aiReply.toLowerCase().includes("that's all")) {
         await setDoc(doc(db, 'projects', projectId, 'sessions', sessionId), {
            projectId,
            status: 'completed',
            completedAt: new Date().toISOString(),
            durationMs: 0 // Mock calc
         }, { merge: true });
      }

    } catch (e) {
      console.error(e);
      await saveMessage(projectId, sessionId, 'ai', 'Oops, something went wrong processing that. Can you repeat?');
    } finally {
      setChatting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;
  if (project === false) return <div className="p-12 text-center">Project not found or not currently active.</div>;

  return (
    <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6 h-[calc(100vh-6rem)]">
      {/* Left: Stimulus / Content */}
      <div className="flex flex-col bg-slate-100 rounded-xl overflow-hidden border">
         <div className="p-4 bg-slate-200 font-semibold text-sm border-b">Review Material</div>
         <div className="flex-1 overflow-auto p-4 bg-white">
            {project.stimulusType === 'url' ? (
               <iframe src={project.stimulusContent} className="w-full h-full border-0" title="Project Stimulus" />
            ) : project.stimulusType === 'image' ? (
               <img src={project.stimulusContent} alt="Project Stimulus" className="max-w-full h-auto" />
            ) : (
               <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-serif text-lg">{project.stimulusContent}</div>
            )}
         </div>
      </div>
      
      {/* Right: AI Chat */}
      <div className="flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden p-0">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
           <h2 className="text-white font-bold flex items-center gap-2">InsightFlow AI
           <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
           </h2>
           <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
             <span>LISTENING...</span>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 border-l-2 rounded-r-lg ${msg.role === 'user' ? 'bg-slate-800/50 border-indigo-500' : 'bg-indigo-600/20 border-white'}`}>
                <p className={`mb-1 ${msg.role === 'user' ? 'text-slate-400' : 'text-indigo-300'}`}>
                  {msg.role === 'user' ? 'You' : 'InsightFlow AI'}
                </p>
                <div className={`${msg.role === 'user' ? 'text-slate-100' : 'text-white italic'}`}>
                  "{msg.content}"
                </div>
              </div>
            </div>
          ))}
          {chatting && (
            <div className="flex justify-start">
               <div className="max-w-[85%] p-3 bg-indigo-600/20 border-l-2 border-white rounded-r-lg ml-0 italic flex gap-2 items-center text-indigo-300">
                 <Loader2 className="animate-spin h-4 w-4" /> typing...
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="p-4 pt-4 border-t border-slate-800 flex gap-2 m-2">
          <Input 
             placeholder="Type your feedback here..." 
             value={input} 
             onChange={(e) => setInput(e.target.value)} 
             disabled={chatting}
             className="flex-1 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
          />
          <Button type="submit" variant="secondary" className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={!input.trim() || chatting}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
