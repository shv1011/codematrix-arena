import { motion } from "framer-motion";
import { Terminal } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="py-12 border-t border-border/50">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-xl tracking-wider">
              CODE<span className="text-primary">WARS</span> 2.0
            </span>
          </div>

          <p className="text-sm text-muted-foreground font-mono">
            &copy; {new Date().getFullYear()} CodeWars 2.0 • Built for Champions
          </p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              System Online
            </span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};
