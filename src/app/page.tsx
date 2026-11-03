'use client';

import dynamic from 'next/dynamic';
import { Store } from 'lucide-react';

const Dashboard = dynamic(() => import('../components/Dashboard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shadow-md">
          <Store className="w-6 h-6 text-white" />
        </div>
        <span className="text-emerald-800 font-black text-sm tracking-widest">TALAAN</span>
      </div>
    </div>
  ),
});

export default function TalaanPage() {
  return <Dashboard />;
}
