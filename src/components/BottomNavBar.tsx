"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, CheckSquare, Trophy, User, Users, ClipboardList, BarChart2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { icon: LayoutGrid, label: 'Home', path: '/dashboard' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: Trophy, label: 'Stats', path: '/leaderboard' },
  { icon: User, label: 'Profile', path: '/profile' },
];

const adminItems = [
  { icon: LayoutGrid, label: 'Home', path: '/admin/dashboard' },
  { icon: Users, label: 'Interns', path: '/admin/interns' },
  { icon: ClipboardList, label: 'Tasks', path: '/admin/tasks' },
  { icon: BarChart2, label: 'Stats', path: '/admin/leaderboard' },
  { icon: User, label: 'Profile', path: '/admin/profile' },
];

export const BottomNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { userData, loading } = useAuth();

  const isAdminPath = pathname.startsWith('/admin');
  const items = isAdminPath ? adminItems : navItems;

  const hideNavBar =
    pathname.startsWith('/auth') ||
    pathname === '/' ||
    pathname === '/sign-in' ||
    pathname === '/create-account' ||
    pathname === '/admin/login' ||
    pathname === '/vault' ||
    pathname === '/performance' ||
    pathname === '/performance-overview' ||
    pathname === '/notifications' ||
    pathname === '/task-completed' ||
    pathname.startsWith('/phase') ||
    pathname.startsWith('/phase-detail') ||
    pathname.startsWith('/task/submit') ||
    pathname.startsWith('/admin/intern/') ||
    pathname.startsWith('/admin/submissions') ||
    pathname.startsWith('/admin/review');
  if (hideNavBar) return null;
  if (loading || !userData) return null;
  if (isAdminPath && userData.role !== 'Admin') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] px-5 pb-7 flex justify-center pointer-events-none">
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
        className={cn(
          "w-full max-w-[380px] bg-nav/95 backdrop-blur-2xl rounded-[32px] border border-onSurface/10",
          "px-2 py-2.5 flex justify-around items-center pointer-events-auto",
          "shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
        )}
      >
        {items.map((item) => {
          const aliasActive =
            (item.path === '/tasks' && pathname === '/task') ||
            (item.path === '/admin/interns' && pathname === '/admin/directory');
          const isActive = pathname === item.path || aliasActive || (item.path !== '/admin/dashboard' && item.path !== '/dashboard' && pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className="relative flex-1 flex flex-col items-center group transition-all"
            >
              <div className="relative flex flex-col items-center">
                <motion.div
                   animate={{ backgroundColor: isActive ? 'rgba(0, 93, 167, 0.2)' : 'transparent' }}
                   className="px-4 py-2 rounded-[20px] flex items-center justify-center mb-1"
                >
                  <item.icon
                    size={isAdminPath ? 20 : 22}
                    className={cn(
                        "transition-all duration-300",
                        isActive ? "text-primary" : "text-onSurfaceVariant"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </motion.div>

                <span
                  className={cn(
                    "font-bold transition-all duration-300",
                    isAdminPath ? "text-[9px]" : "text-[10px]",
                    isActive ? "text-primary" : "text-onSurfaceVariant"
                  )}
                >
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
};
