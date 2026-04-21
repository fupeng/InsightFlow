import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Copy, ExternalLink, Loader2, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';
import ai from '../lib/gemini';
import { Type } from '@google/genai';

export function ProjectDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Note: For MVP, Insights are regenerated on demand or stored in component state to save complexity.
  // In a robust solution we'd save them to `/projects/{id}/insights`.

  const fetchProject = async () => {
    if (!id || !user) return;
    try {
      const docSnap = await getDoc(doc(db, 'projects', id));
      if (docSnap.exists()) {
        setProject({ id: docSnap.id, ...docSnap.data() });
      }
      
      // Fetch sessions
      const sQuery = query(collection(db, 'projects', id, 'sessions'));
      const sSnap = await getDocs(sQuery);
      setSessions(sSnap.docs.map(d => ({id: d.id, ...d.data()})));
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id, user]);

  const handleLaunch = async () => {
    if (!project) return;
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        status: 'active',
        updatedAt: new Date().toISOString()
      });
      setProject({ ...project, status: 'active' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/s/${project.id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const generateInsights = async () => {
    setAnalyzing(true);
    setInsights([]);
    try {
      // 1. Fetch all messages
      const msgsData: any[] = [];
      for (const s of sessions) {
        if (s.status === 'completed') {
           const mQuery = query(collection(db, 'projects', project.id, 'sessions', s.id, 'messages'));
           const mSnap = await getDocs(mQuery);
           const history = mSnap.docs.map(m => m.data()).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
           msgsData.push({
             sessionId: s.id,
             transcript: history.map(m => `${m.role}: ${m.content}`).join('\n')
           });
        }
      }

      if (msgsData.length === 0) {
        alert("No completed sessions yet to analyze!");
        setAnalyzing(false);
        return;
      }

      const allTranscripts = msgsData.map((s, i) => `--- Session ${i+1} ---\n${s.transcript}`).join('\n\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `You are an expert UX Researcher analyzing feedback transcripts for a product test.
Project Objective: ${project.objective}
Target Audience: ${project.targetAudience}

Analyze the following transcripts and extract structured insights. We are looking for: themes (general feedback), risks (blockers or serious issues), drivers (why they like it), and confusion (what they didn't understand).

Transcripts:
${allTranscripts}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "One of: theme, risk, driver, confusion" },
                title: { type: Type.STRING, description: "Short descriptive title" },
                summary: { type: Type.STRING, description: "Detailed explanation of the finding based on the transcripts" }
              },
              required: ["type", "title", "summary"]
            }
          }
        }
      });

      const parsed = JSON.parse(response.text?.trim() || "[]");
      setInsights(parsed);

    } catch (e) {
      console.error(e);
      alert("Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading project...</div>;
  if (!project) return <div className="p-12 text-center">Project not found.</div>;

  const completedSessions = sessions.filter(s => s.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold">{project.name}</h1>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>{project.status}</Badge>
          </div>
          <p className="text-xs text-slate-500">{project.objective}</p>
        </div>
        <div className="flex items-center gap-3">
          {project.status === 'draft' && (
            <Button onClick={handleLaunch} className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200">
              <Play className="h-4 w-4 mr-2" /> Launch Project
            </Button>
          )}
          {project.status === 'active' && (
             <Button onClick={handleCopyLink} variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-700">
               <Copy className="h-4 w-4 mr-2" /> Copy Test Link
             </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-2">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-tight mb-1">Total Participants</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold">{completedSessions}</span>
            <span className="text-xs text-slate-400 mb-1 font-medium">/ {project.expectedSamples} target</span>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-tight mb-1">Completion Rate</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold">{completedSessions > 0 ? '100%' : '0%'}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2">
           <p className="text-xs text-slate-500 uppercase font-bold tracking-tight mb-1">Target Audience</p>
           <div className="flex items-end gap-2">
             <span className="text-lg font-bold truncate">{project.targetAudience}</span>
           </div>
        </div>
      </div>

      <Tabs defaultValue="insights" className="mt-8">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="insights">AI Insights & Report</TabsTrigger>
          <TabsTrigger value="sessions">Session Transcripts</TabsTrigger>
          <TabsTrigger value="setup">Project Setup</TabsTrigger>
        </TabsList>
        
        <TabsContent value="insights" className="pt-4 space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Key Findings</h2>
            <Button onClick={generateInsights} disabled={analyzing || completedSessions === 0} variant="secondary">
               {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
               {analyzing ? "Analyzing Transcripts..." : "Generate Insights"}
            </Button>
          </div>

          {!analyzing && insights.length === 0 && (
             <div className="p-12 text-center border-dashed border-2 rounded-xl bg-slate-50 text-slate-500">
               Click "Generate Insights" to let AI analyze your completed sessions.
             </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {insights.map((insight, idx) => (
               <div key={idx} className="space-y-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between">
                   <h3 className="font-semibold text-slate-800">{insight.title}</h3>
                   <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                     insight.type === 'risk' ? 'bg-red-50 text-red-600' :
                     insight.type === 'driver' ? 'bg-green-50 text-green-600' :
                     insight.type === 'confusion' ? 'bg-amber-50 text-amber-600' :
                     'bg-indigo-50 text-indigo-600'
                   }`}>
                     {insight.type}
                   </span>
                 </div>
                 <p className="text-sm text-slate-600">{insight.summary}</p>
               </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="pt-4">
          <div className="space-y-4">
             {sessions.length === 0 && <p className="text-slate-500">No sessions yet.</p>}
             {sessions.map((s, i) => (
                <Card key={s.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">Session {i + 1}</div>
                    <div className="text-sm text-slate-500">{new Date(s.startedAt).toLocaleString()}</div>
                  </div>
                  <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>{s.status}</Badge>
                </Card>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="setup" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Stimulus Content</CardTitle>
              <CardDescription>What participants see during the session.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 p-4 rounded-md border text-sm text-slate-700 font-mono overflow-auto max-h-64">
                 {project.stimulusContent}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
