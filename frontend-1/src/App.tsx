import { useState } from 'react';
import { AppDataProvider } from '@/context/AppDataContext';
import { MapProvider } from '@/context/MapContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SelectionProvider } from '@/context/SelectionContext';
import { TimeRangeProvider } from '@/context/TimeRangeContext';
import { Sidebar, type PageId } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { FloatingQueryAssistant } from '@/components/FloatingQueryAssistant';
import { CommandCenter } from '@/pages/CommandCenter';
import { TrafficAnalytics } from '@/pages/TrafficAnalytics';
import { VehicleInvestigation } from '@/pages/VehicleInvestigation';
import { RouteOD } from '@/pages/RouteOD';
import { Alerts } from '@/pages/Alerts';
import { SystemHealth } from '@/pages/SystemHealth';
import { Settings } from '@/pages/Settings';

function App() {
  const [activePage, setActivePage] = useState<PageId>('command');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'command':
        return <CommandCenter onNavigate={setActivePage} />;
      case 'analytics':
        return <TrafficAnalytics onNavigate={setActivePage} />;
      case 'vehicles':
        return <VehicleInvestigation />;
      case 'routes':
        return <RouteOD onNavigate={setActivePage} />;
      case 'alerts':
        return <Alerts onNavigate={setActivePage} />;
      case 'health':
        return <SystemHealth />;
      case 'settings':
        return <Settings />;
    }
  };

  return (
    <ThemeProvider>
      <TimeRangeProvider>
        <AppDataProvider>
          <SelectionProvider>
            <MapProvider>
              <div className="flex h-screen w-screen overflow-hidden bg-base">
                <Sidebar
                  activePage={activePage}
                  onNavigate={setActivePage}
                  collapsed={sidebarCollapsed}
                  onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
                <div className="flex-1 flex flex-col min-w-0">
                  <TopBar
                    activePage={activePage}
                    sidebarCollapsed={sidebarCollapsed}
                    onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                    onNavigate={setActivePage}
                  />
                  <main className="flex-1 min-h-0 overflow-hidden">{renderPage()}</main>
                </div>
                <FloatingQueryAssistant onNavigate={setActivePage} />
              </div>
            </MapProvider>
          </SelectionProvider>
        </AppDataProvider>
      </TimeRangeProvider>
    </ThemeProvider>
  );
}

export default App;
