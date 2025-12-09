import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ActiveSession from "@/pages/active-session";
import Dashboard from "@/pages/dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Brain, LayoutDashboard, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
// import ParentDashboard from "@/pages/parent-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ActiveSession} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/parent-dashboard" component={ParentDashboard} />
      <Route component={ActiveSession} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Navigation Header */}
          <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2">
                  <div className="p-2 bg-primary rounded-lg">
                    <Brain className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-lg text-foreground hidden sm:inline">
                    Attention Analyzer
                  </span>
                </Link>
                
                <nav className="flex items-center gap-2">
                  <Link href="/">
                    <Button variant="ghost" size="sm" data-testid="link-session">
                      <Activity className="w-4 h-4 mr-2" />
                      Session
                    </Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm" data-testid="link-dashboard">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/parent-dashboard">
                    <Button variant="ghost" size="sm">
                      Parent Dashboard
                    </Button>
                  </Link>

                </nav>
              </div>

              <ThemeToggle />
            </div>
          </header>

          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
