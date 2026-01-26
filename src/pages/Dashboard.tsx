import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthContext";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { SupervisorView } from "@/components/dashboard/SupervisorView";
import { Button } from "@/components/ui/button";
import { LogOut, Terminal } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, userRole, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Supervisor gets fullscreen view
  if (userRole === "supervisor") {
    return <SupervisorView />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-xl tracking-wider">
              CODE<span className="text-primary">WARS</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-muted-foreground hidden md:block">
              {user?.email}
            </span>
            <span className={`px-2 py-1 rounded text-xs font-mono uppercase ${
              userRole === "admin" 
                ? "bg-destructive/20 text-destructive" 
                : "bg-primary/20 text-primary"
            }`}>
              {userRole}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {userRole === "admin" ? <AdminDashboard /> : <UserDashboard />}
      </main>
    </div>
  );
};

export default Dashboard;
