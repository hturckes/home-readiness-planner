import InputPanel from '@/components/InputPanel';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Left sidebar — fixed width, independently scrollable */}
      <InputPanel />

      {/* Right content area — fills remaining space, scrollable */}
      <main className="flex flex-1 overflow-hidden">
        <Dashboard />
      </main>
    </div>
  );
}
