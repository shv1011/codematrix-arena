import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "./AuthContext";
import { LogIn, Terminal, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(email, password);

      if (result.error) {
        setError(result.error.message);
        toast.error(result.error.message);
      } else {
        toast.success("Welcome back!");
        navigate("/dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <Card variant="glass" className="border-primary/20">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Terminal className="w-8 h-8 text-primary" />
            <span className="font-display font-bold text-2xl">
              CODE<span className="text-primary">WARS</span>
            </span>
          </div>
          <CardTitle className="text-2xl">ACCESS TERMINAL</CardTitle>
          <CardDescription>
            Enter your credentials to access the arena
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-mono text-muted-foreground">
                EMAIL
              </label>
              <Input
                type="email"
                placeholder="team@codewars.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-mono text-muted-foreground">
                PASSWORD
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="neon"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    ⟳
                  </motion.span>
                  Processing...
                </span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Login
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};
