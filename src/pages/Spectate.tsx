import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SupervisorView } from "@/components/dashboard/SupervisorView";
import { useAuth } from "@/components/auth/AuthContext";
import { motion } from "framer-motion";

const Spectate = () => {
  const { user, userRole, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is logged in and not a supervisor, redirect to dashboard
    if (!isLoading && user && userRole !== "supervisor") {
      navigate("/dashboard");
    }
  }, [user, userRole, isLoading, navigate]);

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

  return <SupervisorView />;
};

export default Spectate;
