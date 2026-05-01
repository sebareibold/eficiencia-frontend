import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import ToastContainer from '../ui/Toast'

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#EFEFEF] p-2 sm:p-4 flex flex-col items-center">
      <div className="w-full h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] rounded-2xl xl:rounded-[20px] flex flex-col relative overflow-hidden ">
        <Navbar />
        <main className="flex-1 p-6 overflow-auto text-gray-800">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
