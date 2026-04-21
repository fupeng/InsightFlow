import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TEMPLATES = [
  { id: 'concept', name: 'Concept Test', desc: 'Test a new product idea or feature' },
  { id: 'page', name: 'Landing Page Test', desc: 'Test website clarity and conversion' },
  { id: 'prototype', name: 'Prototype/Flow', desc: 'Test UX flow and usability' },
  { id: 'creative', name: 'Copy/Creative Test', desc: 'Test ads, images, or messaging' }
];

export function CreateProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    templateType: 'page',
    objective: '',
    targetAudience: '',
    expectedSamples: 50,
    questionPrompt: 'You are helping evaluate a product. Please answer questions based on your honest impression.',
    stimulusType: 'url',
    stimulusContent: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const projectId = uuidv4();
      const now = new Date().toISOString();
      await setDoc(doc(db, 'projects', projectId), {
        ownerId: user.uid,
        name: formData.name,
        templateType: formData.templateType,
        objective: formData.objective,
        status: 'draft',
        targetAudience: formData.targetAudience,
        expectedSamples: Number(formData.expectedSamples),
        stimulusType: formData.stimulusType,
        stimulusContent: formData.stimulusContent,
        questionPrompt: formData.questionPrompt,
        createdAt: now,
        updatedAt: now
      });
      navigate(`/projects/${projectId}`);
    } catch (err) {
      console.error(err);
      alert("Error creating project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="templateType">Project Template</Label>
              <Select 
                value={formData.templateType} 
                onValueChange={(v) => setFormData({...formData, templateType: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input 
                id="name" 
                required 
                placeholder="e.g., Homepage V2 Test"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective">Testing Objective</Label>
              <Textarea 
                id="objective" 
                placeholder="What exactly do you want to find out?" 
                value={formData.objective}
                onChange={e => setFormData({...formData, objective: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target Audience</Label>
              <Input 
                id="targetAudience" 
                placeholder="e.g., Small business owners needing bookkeeping"
                value={formData.targetAudience}
                onChange={e => setFormData({...formData, targetAudience: e.target.value})}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium">Stimulus Setup</h3>
              <div className="space-y-2">
                <Label htmlFor="stimulusType">Input Type</Label>
                <Select 
                  value={formData.stimulusType} 
                  onValueChange={(v) => setFormData({...formData, stimulusType: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">Website URL / Link</SelectItem>
                    <SelectItem value="text">Text / Copy</SelectItem>
                    <SelectItem value="image">Image URL (Public)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stimulusContent">
                  {formData.stimulusType === 'url' ? 'Link URL' : 
                   formData.stimulusType === 'image' ? 'Image URL' : 'Content Text'}
                </Label>
                {formData.stimulusType === 'text' ? (
                  <Textarea 
                    required 
                    value={formData.stimulusContent}
                    onChange={e => setFormData({...formData, stimulusContent: e.target.value})}
                  />
                ) : (
                  <Input 
                    required 
                    type={formData.stimulusType === 'url' ? 'url' : 'text'}
                    placeholder="https://..."
                    value={formData.stimulusContent}
                    onChange={e => setFormData({...formData, stimulusContent: e.target.value})}
                  />
                )}
              </div>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
