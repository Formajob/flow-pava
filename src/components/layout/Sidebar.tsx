'use client';

/**
 * Menu latéral ACX Flow — portable (habillage Glassy V22).
 * Le menu est passé en prop : aucune dépendance à lib/menu ni lib/workflow-store.
 * Les icônes sont des SVG inline. Suspense inclus (useSearchParams).
 */

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { FlowLogo, FlowTag } from '@/components/brand/FlowBrand';

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  subitems?: MenuItem[];
  count?: number;
}

interface SidebarProps {
  items: MenuItem[];
  spaceLabel: string;
  userName: string;
  userMeta: string;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  ),
  reception: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  ),
  analyse: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  ),
  regles: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </svg>
  ),
  controle: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  validation: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3 2 21h20L12 3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  ),
  facture: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </svg>
  ),
};

function hrefMatches(currentPath: string, currentSearch: string, href: string) {
  const [path, query = ''] = href.split('?');
  if (currentPath !== path) return false;
  const current = new URLSearchParams(currentSearch);
  const target = new URLSearchParams(query);
  for (const [key, value] of target.entries()) {
    if (current.get(key) !== value) return false;
  }
  if (query === '' && current.toString() !== '') return false;
  return true;
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase();
}

function SidebarInner({ items, spaceLabel, userName, userMeta }: SidebarProps) {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of items) {
      if (!item.subitems?.length) continue;
      const childActive = item.subitems.some((sub) => hrefMatches(pathname, search, sub.href));
      initial[item.id] = childActive;
    }
    return initial;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (!item.subitems?.length) continue;
        const childActive = item.subitems.some((sub) => hrefMatches(pathname, search, sub.href));
        if (childActive) next[item.id] = true;
      }
      return next;
    });
  }, [items, pathname, search]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside className={`g-side g-glass${mobileOpen ? ' is-open' : ''}`}>
      <div className="g-brand">
        <FlowLogo variant="dark" height={30} />
        <button
          type="button"
          className="g-icon-btn g-nav-toggle"
          aria-label="Menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      <FlowTag variant="dark" />
      <div className="g-space"><i /> {spaceLabel}</div>

      <nav className="g-nav" aria-label="Navigation principale">
        {items.map((item) => {
          const hasSub = !!item.subitems?.length;
          const parentActive = hrefMatches(pathname, search, item.href);
          const open = openGroups[item.id] ?? false;
          const childActive = hasSub && item.subitems!.some((sub) => hrefMatches(pathname, search, sub.href));
          const icon = ICONS[item.id] ?? ICONS.dashboard;

          if (!hasSub) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`g-nav-item${parentActive ? ' is-active' : ''}`}
                aria-current={parentActive ? 'page' : undefined}
              >
                {icon}
                {item.label}
                {item.count ? <span className="g-nav-count">{item.count}</span> : null}
              </Link>
            );
          }

          return (
            <div key={item.id} className={`g-nav-group${open ? ' is-open' : ''}`}>
              <button
                type="button"
                aria-expanded={open}
                className={childActive || parentActive ? 'is-active-parent' : undefined}
                onClick={() => setOpenGroups((prev) => ({ ...prev, [item.id]: !open }))}
                style={childActive ? { color: 'var(--g-text)' } : undefined}
              >
                {icon}
                {item.label}
                {item.count ? <span className="g-nav-count">{item.count}</span> : null}
                <span className="g-chev" aria-hidden="true">›</span>
              </button>
              <div className="g-nav-sub">
                {item.subitems!.map((sub) => {
                  const active = hrefMatches(pathname, search, sub.href);
                  return (
                    <Link
                      key={sub.id}
                      href={sub.href}
                      className={active ? 'is-active' : undefined}
                      aria-current={active ? 'page' : undefined}
                    >
                      {sub.label}
                      {sub.count ? <span className="g-nav-count">{sub.count}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="g-who">
        <div className="g-session">
          <span className="g-avatar" aria-hidden="true">{initials(userName)}</span>
          <span className="g-session-meta">
            <b>{userName}</b>
            <span>{userMeta}</span>
          </span>
        </div>
        <div className="g-side-foot">
          Espace VL PAVA · Facturation PAV Affaire
        </div>
      </div>
    </aside>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<div className="g-side g-glass" />}>
      <SidebarInner {...props} />
    </Suspense>
  );
}
