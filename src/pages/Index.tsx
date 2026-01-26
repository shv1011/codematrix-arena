import { HeroSection } from "@/components/landing/HeroSection";
import { RoundsSection } from "@/components/landing/RoundsSection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <RoundsSection />
      <Footer />
    </div>
  );
};

export default Index;
