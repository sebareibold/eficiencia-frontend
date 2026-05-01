import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import SettingsDrawer from './SettingsDrawer'
import ToastContainer from '../ui/Toast'

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#EFEFEF] dark:bg-[#0f0f0f] p-2 sm:p-4 flex flex-col items-center transition-colors duration-300">
      <div className="w-full h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] rounded-2xl xl:rounded-[20px] flex flex-col relative overflow-hidden dark:bg-[#111111]">
        <Navbar />
        <main className="flex-1 p-6 overflow-auto text-gray-800 dark:text-gray-100">
          <Outlet />
        </main>
      </div>
      <SettingsDrawer />
      <ToastContainer />
    </div>
  )
}
