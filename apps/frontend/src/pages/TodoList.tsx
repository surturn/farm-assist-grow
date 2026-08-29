import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, Plus, Loader2, CheckSquare, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiClient } from "@/api/client";
import { useFarm } from "@/contexts/FarmContext";

interface ToDo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export default function Planning() {
  const [todos, setTodos] = useState<ToDo[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { activeFarmId } = useFarm();

  useEffect(() => {
    fetchTodos();
  }, [activeFarmId]);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/tasks', { params: { farmId: activeFarmId } });
      setTodos(data || []);
    } catch (error) {
      console.error("Failed to fetch tasks", error);
      toast.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setSubmitting(true);
      const { data } = await apiClient.post('/tasks', {
        title: newTitle,
        farmId: activeFarmId
      });
      setTodos([data, ...todos]);
      setNewTitle("");
      toast.success("Task added");
    } catch (error) {
      console.error("Failed to add task", error);
      toast.error("Failed to add task");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTodoStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    
    // Optimistic update
    setTodos(todos.map(t => t.id === id ? { ...t, status: newStatus } : t));

    try {
      await apiClient.patch(`/tasks/${id}`, { status: newStatus });
    } catch (error) {
      // Revert on failure
      setTodos(todos.map(t => t.id === id ? { ...t, status: currentStatus } : t));
      console.error("Failed to update status", error);
      toast.error("Failed to update task status");
    }
  };

  const pendingTodos = todos.filter(t => t.status !== 'COMPLETED');
  const completedTodos = todos.filter(t => t.status === 'COMPLETED');

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-green-900 flex items-center gap-2">
            <CheckSquare className="h-8 w-8" />
            Planning & Tasks
          </h1>
          <p className="text-muted-foreground">Manage your farm's to-do list, scheduling, and upcoming activities.</p>
        </div>

        <Card className="border-green-100 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Add New Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTodo} className="flex gap-2">
              <Input 
                placeholder="e.g., Water the crops in greenhouse 2..." 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1"
                disabled={submitting}
              />
              <Button type="submit" disabled={submitting || !newTitle.trim()} className="bg-green-700 hover:bg-green-800">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-green-700" /></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pending Tasks */}
            <Card>
              <CardHeader className="bg-orange-50/50 border-b pb-3">
                <CardTitle className="text-orange-900 text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" /> Pending ({pendingTodos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {pendingTodos.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">All caught up!</div>
                ) : (
                  <ul className="divide-y">
                    {pendingTodos.map(todo => (
                      <li key={todo.id} className="p-4 flex items-start gap-3 hover:bg-secondary/20 transition-colors">
                        <Checkbox 
                          checked={false} 
                          onCheckedChange={() => toggleTodoStatus(todo.id, todo.status)}
                          className="mt-1 border-orange-300 data-[state=checked]:bg-orange-600"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm leading-tight">{todo.title}</p>
                          {todo.dueDate && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" /> Due: {format(new Date(todo.dueDate), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Completed Tasks */}
            <Card>
              <CardHeader className="bg-green-50/50 border-b pb-3">
                <CardTitle className="text-green-900 text-lg flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-green-600" /> Completed ({completedTodos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {completedTodos.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No completed tasks yet.</div>
                ) : (
                  <ul className="divide-y opacity-70">
                    {completedTodos.map(todo => (
                      <li key={todo.id} className="p-4 flex items-start gap-3 hover:bg-secondary/20 transition-colors">
                        <Checkbox 
                          checked={true} 
                          onCheckedChange={() => toggleTodoStatus(todo.id, todo.status)}
                          className="mt-1 border-green-500 data-[state=checked]:bg-green-600 data-[state=checked]:text-white"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm leading-tight line-through text-muted-foreground">{todo.title}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
