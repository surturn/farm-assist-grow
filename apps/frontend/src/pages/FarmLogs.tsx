import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiClient } from "@/api/client";
import { useFarm } from "@/contexts/FarmContext";

interface FarmNote {
  id: string;
  content: string;
  createdAt: string;
  farmId: string;
}

export default function FarmLogs() {
  const [notes, setNotes] = useState<FarmNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { activeFarmId } = useFarm();

  useEffect(() => {
    fetchNotes();
  }, [activeFarmId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/farm-notes', { params: { farmId: activeFarmId } });
      setNotes(data || []);
    } catch (error) {
      console.error("Failed to fetch farm notes", error);
      // Fallback for mockup if backend route is not ready
      setNotes([
        { id: '1', content: 'Planted 50 maize seeds in Sector A.', createdAt: new Date().toISOString(), farmId: 'mock' },
        { id: '2', content: 'Observed slight yellowing on tomato leaves. Need to check for blight tomorrow.', createdAt: new Date(Date.now() - 86400000).toISOString(), farmId: 'mock' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!newNote.trim()) {
      toast.error("Note cannot be empty");
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await apiClient.post('/farm-notes', {
        note: newNote,
        farmId: activeFarmId
      });
      setNotes([data, ...notes]);
      setNewNote("");
      toast.success("Farm note saved");
    } catch (error) {
      console.error("Failed to save note", error);
      // Fallback for mockup
      const mockNewNote = { id: Date.now().toString(), content: newNote, createdAt: new Date().toISOString(), farmId: 'mock' };
      setNotes([mockNewNote, ...notes]);
      setNewNote("");
      toast.success("Farm note saved (mock)");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-green-900 flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Farm Logs
          </h1>
          <p className="text-muted-foreground">Keep a plain text journal of your daily farm activities, observations, and yields.</p>
        </div>

        <Card className="border-green-100 shadow-sm">
          <CardHeader>
            <CardTitle>Add New Log</CardTitle>
            <CardDescription>What happened on the farm today?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="e.g., Harvested 20kg of tomatoes from Greenhouse 1..." 
              className="min-h-[120px] resize-y"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              disabled={submitting}
            />
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleSaveNote} disabled={submitting || !newNote.trim()} className="bg-green-700 hover:bg-green-800">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Save Note
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold mt-8 mb-4">Previous Logs</h3>
          
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-green-700" /></div>
          ) : notes.length === 0 ? (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p>No logs found. Start journaling your farm activities above.</p>
              </CardContent>
            </Card>
          ) : (
            notes.map((note) => (
              <Card key={note.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="py-3 px-4 bg-secondary/20 border-b flex flex-row items-center justify-between">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    {format(new Date(note.createdAt), 'MMMM do, yyyy - h:mm a')}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{note.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
