import { useAuth } from '@/hooks/useAuth';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import PortfolioSummary from '@/components/portfolio/PortfolioSummary';
import PositionsTable from '@/components/portfolio/PositionsTable';





export default function Portfolio() {
  const { isAuthenticated, isLoading } = useAuth();


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TopNavigation />
      
      <div className="flex pt-16">
        <SidebarNavigation />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Portfolio Overview</h1>
            
            <PortfolioSummary />
            
            <div className="grid grid-cols-1 gap-6 mb-6">
              <PositionsTable />
            </div>
            
            <div className="text-center text-gray-400 py-8">
              Recent trades component ready for integration
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}