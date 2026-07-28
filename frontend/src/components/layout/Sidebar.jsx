import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAV_SECTIONS, NAV_FOOTER_ITEMS } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../ui/Avatar';
import Tooltip from '../ui/Tooltip';
import Logo from './Logo';

function NavItem({ item, collapsed, onNavigate }) {
  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `focus-ring group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-ink-500 hover:bg-ink-400/10 hover:text-ink-900'
        } ${collapsed ? 'justify-center' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={17}
            className={isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-700'}
            aria-hidden="true"
          />
          {!collapsed && <span>{item.label}</span>}
        </>
      )}
    </NavLink>
  );

  return collapsed ? (
    <Tooltip label={item.label} className="w-full [&>span[role=tooltip]]:left-full [&>span[role=tooltip]]:bottom-auto [&>span[role=tooltip]]:top-1/2 [&>span[role=tooltip]]:mb-0 [&>span[role=tooltip]]:ml-2 [&>span[role=tooltip]]:-translate-y-1/2 [&>span[role=tooltip]]:translate-x-0">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { user } = useAuth();

  const content = (isMobile) => (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-16 shrink-0 items-center border-b border-line px-4 ${
          collapsed && !isMobile ? 'justify-center' : 'justify-between'
        }`}
      >
        <Logo collapsed={collapsed && !isMobile} />
        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-ink-400/10 hover:text-ink-700"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            {(!collapsed || isMobile) && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavItem
                    item={item}
                    collapsed={collapsed && !isMobile}
                    onNavigate={isMobile ? onCloseMobile : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line px-3 py-3">
        <ul className="space-y-0.5">
          {NAV_FOOTER_ITEMS.map((item) => (
            <li key={item.to}>
              <NavItem
                item={item}
                collapsed={collapsed && !isMobile}
                onNavigate={isMobile ? onCloseMobile : undefined}
              />
            </li>
          ))}
        </ul>

        <div
          className={`mt-3 flex items-center gap-2.5 rounded-lg border border-line bg-canvas p-2 ${
            collapsed && !isMobile ? 'justify-center border-0 bg-transparent p-0' : ''
          }`}
        >
          <Avatar name={user?.name} size="sm" />
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink-900">{user?.name}</p>
              <p className="truncate text-[11px] text-ink-500">{user?.role}</p>
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`focus-ring mt-3 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-400/10 hover:text-ink-900 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-surface transition-[width] duration-200 lg:block ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        {content(false)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="animate-fade-in-up absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-surface shadow-modal">
            {content(true)}
          </aside>
        </div>
      )}
    </>
  );
}
