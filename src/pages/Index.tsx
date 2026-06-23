import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import InfraMap from "@/components/InfraMap";
import DashboardPreview from "@/components/DashboardPreview";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <div id="features">
        <Features />
      </div>
      <div id="map">
        <InfraMap />
      </div>
      <div id="dashboard">
        <DashboardPreview />
      </div>
      <Footer />
    </div>
  );
};

export default Index;
