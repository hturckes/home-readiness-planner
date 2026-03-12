import InputPanel from '@/components/InputPanel';

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Left sidebar — fixed width, independently scrollable */}
      <InputPanel />

      {/* Right content area — fills remaining space, scrollable */}
      <main className="flex flex-1 items-center justify-center overflow-y-auto">
        <p className="text-sm font-medium text-gray-400">Dashboard coming soon</p>
      </main>
    </div>
  );
}
