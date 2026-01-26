import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Code, Gamepad2, ChevronRight } from "lucide-react";

const rounds = [
  {
    number: "01",
    name: "Aptitude Arena",
    description: "MCQ-based quiz challenge. Test your knowledge under pressure with timer-based questions.",
    icon: Brain,
    color: "primary",
    features: ["MCQ Questions", "Timer-based", "Auto-evaluation", "Instant Scoring"],
  },
  {
    number: "02",
    name: "Constraint Paradox",
    description: "Solve coding challenges with constraints. No loops? No keywords? Can you adapt?",
    icon: Code,
    color: "secondary",
    features: ["Coding Challenges", "Unique Constraints", "AI Evaluation", "Creative Solutions"],
  },
  {
    number: "03",
    name: "Code Jeopardy",
    description: "The final showdown. Pick your category, choose your risk. First to answer wins.",
    icon: Gamepad2,
    color: "accent",
    features: ["7×5 Grid", "FCFS Rules", "Category Picks", "High Stakes"],
  },
];

export const RoundsSection = () => {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-radial from-secondary/5 via-transparent to-transparent" />
      
      <div className="container px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            <span className="text-muted-foreground">//</span> BATTLE{" "}
            <span className="text-gradient-primary">ROUNDS</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto font-mono">
            Three rounds of elimination. Each one more intense than the last.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {rounds.map((round, index) => (
            <motion.div
              key={round.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
            >
              <Card variant="neon" className="h-full group hover:scale-[1.02] transition-transform duration-300">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-6xl font-display font-bold text-muted-foreground/30 group-hover:text-primary/30 transition-colors">
                      {round.number}
                    </span>
                    <round.icon className="w-10 h-10 text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="text-2xl group-hover:text-primary transition-colors">
                    {round.name}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {round.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {round.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-muted-foreground font-mono"
                      >
                        <ChevronRight className="w-4 h-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
