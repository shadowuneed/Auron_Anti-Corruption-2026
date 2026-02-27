import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Search,
  Database,
  BarChart3,
  Info,
  Shield,
  Network,
  Map,
  Building2,
  User,
  FolderOpen,
  Sun,
  Moon,
  Mic,
} from 'lucide-react'
import clsx from 'clsx'
import type { ReactNode } from 'react'

const languages = [
  { code: 'ru', label: 'РУ', flag: '🇷🇺' },
  { code: 'kz', label: 'ҚЗ', flag: '🇰🇿' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const location = useLocation()

  // Theme toggle - persisted to localStorage
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('theme-light')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.add('theme-light')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/network', icon: Network, label: t('nav.network') },
    { path: '/map', icon: Map, label: t('nav.map') },
    { path: '/entities', icon: Building2, label: t('nav.entities') },
    { path: '/persons', icon: User, label: t('nav.persons') },
    { path: '/investigations', icon: FolderOpen, label: t('nav.investigations') },
    { path: '/voice', icon: Mic, label: t('nav.voice') },
    { path: '/analyze', icon: Search, label: t('nav.analyze') },
    { path: '/tenders', icon: Database, label: t('nav.tenders') },
    { path: '/analytics', icon: BarChart3, label: t('nav.analytics') },
    { path: '/about', icon: Info, label: t('nav.about') },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-kz-navy border-r border-kz-border flex flex-col fixed h-full z-20">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-kz-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', boxShadow: '0 0 24px #6366f140' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <h1 className="text-[22px] font-black text-white tracking-[0.2em] leading-tight">AURON</h1>
                <span className="text-[8px] text-indigo-400 font-black uppercase tracking-widest opacity-60 mt-0.5">AI</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight truncate">{t('app.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium',
                  isActive
                    ? 'bg-kz-blue/20 text-kz-blue border border-kz-blue/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom Controls — compact glass pill */}
        <div className="px-4 py-3 border-t border-kz-border">
          <div className="flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-2xl p-1.5">
            {/* Language pills */}
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                title={lang.flag + ' ' + lang.label}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all duration-200',
                  i18n.language === lang.code
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/8'
                )}
              >
                <span className="text-[15px] leading-none">{lang.flag}</span>
                <span className="text-[8px] font-bold tracking-wide">{lang.label}</span>
              </button>
            ))}

            {/* Vertical divider */}
            <div className="w-px h-8 bg-white/10 mx-0.5 flex-shrink-0" />

            {/* Theme icon button */}
            <button
              onClick={() => setIsDark((v) => !v)}
              title={isDark ? t('settings.lightMode', 'Светлая тема') : t('settings.darkMode', 'Тёмная тема')}
              className={clsx(
                'w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200',
                isDark
                  ? 'text-amber-400 hover:bg-amber-400/12 hover:text-amber-300'
                  : 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
              )}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
