import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, Info, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch, getDocs, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success';
    read: boolean;
    createdAt: Timestamp;
}

export default function Notifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "notifications"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notes: Notification[] = [];
            snapshot.forEach((doc) => {
                notes.push({ id: doc.id, ...doc.data() } as Notification);
            });
            setNotifications(notes);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const markAsRead = async (id: string) => {
        try {
            const noteRef = doc(db, "notifications", id);
            await updateDoc(noteRef, { read: true });
        } catch (error) {
            console.error("Error marking read:", error);
        }
    };

    const markAllRead = async () => {
        if (!user) return;
        try {
            const batch = writeBatch(db);
            const unread = notifications.filter(n => !n.read);

            unread.forEach(n => {
                const ref = doc(db, "notifications", n.id);
                batch.update(ref, { read: true });
            });

            await batch.commit();
            toast.success("All marked as read");
        } catch (error) {
            console.error("Error batch update:", error);
            toast.error("Failed to mark all as read");
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
            default: return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Bell className="h-6 w-6 text-primary" />
                            Notifications
                        </h1>
                        <p className="text-muted-foreground">Stay updated with your farm activities</p>
                    </div>
                    {notifications.some(n => !n.read) && (
                        <Button variant="outline" size="sm" onClick={markAllRead}>
                            <Check className="h-4 w-4 mr-2" />
                            Mark all read
                        </Button>
                    )}
                </div>

                <Card className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-8 text-center text-muted-foreground">Loading updates...</div>
                            ) : notifications.length === 0 ? (
                                <div className="p-12 text-center flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                        <Bell className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <h3 className="font-semibold text-lg">All caught up!</h3>
                                    <p className="text-muted-foreground">No new notifications at the moment.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {notifications.map((note) => (
                                        <div
                                            key={note.id}
                                            className={`p-4 hover:bg-muted/50 transition-colors flex gap-4 ${!note.read ? 'bg-primary/5' : ''}`}
                                            onClick={() => !note.read && markAsRead(note.id)}
                                        >
                                            <div className="mt-1">
                                                {getIcon(note.type)}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-start justify-between">
                                                    <h4 className={`text-sm font-medium ${!note.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {note.title}
                                                    </h4>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap ml-2">
                                                        <Clock className="h-3 w-3" />
                                                        {note.createdAt?.toDate ? format(note.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                                                    </span>
                                                </div>
                                                <p className={`text-sm ${!note.read ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                                                    {note.message}
                                                </p>
                                            </div>
                                            {!note.read && (
                                                <div className="flex items-center self-center">
                                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </ScrollArea>
                </Card>
            </div>
        </DashboardLayout>
    );
}
