import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, FileText, BarChart, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      if (!user) {
        setFetching(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'projects'),
          where('ownerId', '==', user.uid),
          // Note: Needs composite index if ordered, might remove orderBy locally if index not built
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort manually to avoid immediate indexing errors
        docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setProjects(docs);
      } catch (err) {
        console.error("Failed to fetch projects", err);
      } finally {
        setFetching(false);
      }
    }
    fetchProjects();
  }, [user]);

  if (loading || fetching) return <div className="p-12 text-center text-slate-500">Loading Dashboard...</div>;

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
          Validate Product Ideas at <span className="text-indigo-600">Speed</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          The AI-powered user feedback validation platform. Turn landing pages, concepts, and prototypes into actionable insights in hours, not weeks.
        </p>
        <Button size="lg" className="text-lg px-8 py-6 rounded-full" onClick={() => navigate('/')}>
          Sign in to get started
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold">Projects</h1>
          <p className="text-xs text-slate-500 mt-1">Manage your active research and validations.</p>
        </div>
        <Link to="/projects/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-slate-200">
          <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mb-2 font-bold text-xl">No projects yet</h2>
          <p className="max-w-md mx-auto mb-6 text-slate-500">
            Get started by creating your first concept test or landing page validation.
          </p>
          <Link to="/projects/new">
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700">Create Project</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="hover:border-indigo-300 transition-colors cursor-pointer h-full flex flex-col group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="mb-2">
                      {project.status.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {project.templateType}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="mt-auto">
                  <div className="text-sm text-slate-500 flex justify-between items-center">
                    <span>{format(new Date(project.createdAt), 'MMM d, yyyy')}</span>
                    <BarChart className="h-4 w-4 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
