import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Content } from "./Content";

export function Layout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <Content />
      </div>
    </div>
  );
}
