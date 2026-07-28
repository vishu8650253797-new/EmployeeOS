import { Outlet } from 'react-router-dom';
import { Users, CalendarCheck, TrendingUp } from 'lucide-react';
import Logo from './Logo';

const HIGHLIGHTS = [
  { icon: Users, text: 'Manage your entire workforce from one place' },
  { icon: CalendarCheck, text: 'Track attendance and leave effortlessly' },
  { icon: TrendingUp, text: 'Understand your people with HR analytics' },
];

export default function AuthLayout() {
  return (
    <div className="flex min-h-dvh">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand-950 p-10 lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgb(61 108 239 / 0.35) 0%, transparent 45%), radial-gradient(circle at 85% 75%, rgb(61 108 239 / 0.25) 0%, transparent 45%)',
          }}
        />
        <div className="relative">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-base font-bold text-brand-700">
              E
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              Employee<span className="text-brand-300">OS</span>
            </span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            The operating system for modern HR teams.
          </h1>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-brand-100">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={16} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-300/70">
          © {new Date().getFullYear()} EmployeeOS. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 lg:hidden">
          <Logo to="/login" />
        </div>
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
