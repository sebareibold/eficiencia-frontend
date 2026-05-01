import { RefreshCw, Filter, Plus } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Top Actions */}
      <div className="flex justify-end items-center gap-2 sm:gap-3">
        <button className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-sm font-semibold text-gray-700 shadow-md hover:bg-white/80 transition-all border border-white/80">
          <RefreshCw size={16} />
          Refresh
        </button>
        <button className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-sm font-semibold text-gray-700 shadow-md hover:bg-white/80 transition-all border border-white/80">
          <Filter size={16} />
          Filter
        </button>
        <button className="flex items-center gap-2 bg-gradient-to-r from-[#F5A623] to-[#F1C40F] px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-sm font-semibold text-gray-900 shadow-lg hover:shadow-xl hover:brightness-105 transition-all border border-[#F5A623]/30">
          <Plus size={16} />
          Create Agent
        </button>
      </div>

      <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
      {/* Main Content goes here */}
    </div>
  )
}
