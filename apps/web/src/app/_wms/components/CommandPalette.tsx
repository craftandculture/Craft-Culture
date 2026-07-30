'use client';

import { IconArrowRight, IconMapPin, IconSearch, IconUser } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

/** Curated jump-to pages, matched by label + hidden keyword hints. */
const PAGES: { label: string; href: string; hint: string }[] = [
  { label: 'Stock Explorer', href: '/platform/admin/stock-explorer', hint: 'inventory wine cases' },
  { label: 'Pricing Manager', href: '/platform/admin/pricing-manager', hint: 'price margin cost' },
  { label: 'WMS Dashboard', href: '/platform/admin/wms', hint: 'warehouse' },
  { label: 'Receive', href: '/platform/admin/wms/receive', hint: 'goods inbound' },
  { label: 'Pick', href: '/platform/admin/wms/pick', hint: 'order fulfil' },
  { label: 'New Pick List', href: '/platform/admin/wms/pick/new', hint: 'pick create' },
  { label: 'Dispatch', href: '/platform/admin/wms/dispatch', hint: 'ship truck deliver' },
  { label: 'Transfer', href: '/platform/admin/wms/transfer', hint: 'move location' },
  { label: 'Repack', href: '/platform/admin/wms/repack', hint: 'split combine pack' },
  { label: 'Movements', href: '/platform/admin/wms/movements', hint: 'audit history log' },
  { label: 'Cycle Count', href: '/platform/admin/wms/cycle-count', hint: 'count stocktake' },
  { label: 'Locations', href: '/platform/admin/wms/locations', hint: 'bay bin shelf' },
  { label: 'Reconcile Stock', href: '/platform/admin/wms/stock/reconcile', hint: 'reconciliation discrepancy' },
  { label: 'Private Orders', href: '/platform/admin/private-orders', hint: 'pco client' },
  { label: 'Zoho Sales Orders', href: '/platform/admin/zoho-sales-orders', hint: 'orders so' },
  { label: 'Logistics', href: '/platform/admin/logistics', hint: 'shipment freight' },
  { label: 'Shipments', href: '/platform/admin/logistics/shipments', hint: 'logistics' },
  { label: 'Partners', href: '/platform/admin/partners', hint: 'supplier owner' },
  { label: 'Quote Approvals', href: '/platform/admin/quote-approvals', hint: 'quote' },
  { label: 'Users', href: '/platform/admin/users', hint: 'accounts team' },
  { label: 'Settings', href: '/platform/admin/settings', hint: 'config' },
];

type PaletteItem =
  | { kind: 'page'; label: string; href: string }
  | { kind: 'entity'; label: string; sub: string; meta: string; type: string; id: string };

/**
 * Global command palette (⌘K / Ctrl+K) — jump to any admin page or search live
 * for a wine / location / owner (via the existing stock search). Purely additive
 * navigation; mounted once in the admin layout.
 */
const CommandPalette = () => {
  const router = useRouter();
  const api = useTRPC();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K toggles; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  const { data: search } = useQuery({
    ...api.wms.admin.stock.search.queryOptions({ query: debounced || 'x', limit: 6 }),
    enabled: open && debounced.length >= 2,
  });

  const items = useMemo<PaletteItem[]>(() => {
    const s = debounced.toLowerCase();
    const pages = (
      s ? PAGES.filter((p) => `${p.label} ${p.hint}`.toLowerCase().includes(s)) : PAGES.slice(0, 8)
    ).map((p): PaletteItem => ({ kind: 'page', label: p.label, href: p.href }));
    const entities = (search?.results ?? []).map(
      (r): PaletteItem => ({
        kind: 'entity',
        label: r.title,
        sub: r.subtitle,
        meta: r.meta,
        type: r.type,
        id: r.id,
      }),
    );
    return [...pages, ...entities];
  }, [debounced, search]);

  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(0, items.length - 1)));
  }, [items.length]);

  const go = (item: PaletteItem) => {
    setOpen(false);
    if (item.kind === 'page') {
      router.push(item.href);
    } else if (item.type === 'location') {
      router.push(`/platform/admin/wms/locations/${item.id}`);
    } else {
      router.push(`/platform/admin/stock-explorer?q=${encodeURIComponent(item.label)}`);
    }
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[activeIdx];
      if (it) go(it);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border-primary bg-surface-primary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border-muted px-3">
          <IconSearch className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search wines, locations, or jump to a page…"
            className="w-full bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="shrink-0 rounded bg-fill-secondary px-1.5 py-0.5 text-[10px] text-text-muted">
            ESC
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">No matches</p>
          ) : (
            items.map((it, idx) => (
              <button
                key={`${it.kind}-${idx}-${it.label}`}
                type="button"
                onClick={() => go(it)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${
                  idx === activeIdx ? 'bg-fill-secondary' : ''
                }`}
              >
                {it.kind === 'page' ? (
                  <IconArrowRight className="h-4 w-4 shrink-0 text-text-muted" />
                ) : it.type === 'location' ? (
                  <IconMapPin className="h-4 w-4 shrink-0 text-blue-500" />
                ) : it.type === 'owner' ? (
                  <IconUser className="h-4 w-4 shrink-0 text-violet-500" />
                ) : (
                  <IconSearch className="h-4 w-4 shrink-0 text-emerald-500" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                  {it.label}
                  {it.kind === 'entity' && it.sub && (
                    <span className="ml-1.5 text-xs text-text-muted">{it.sub}</span>
                  )}
                </span>
                {it.kind === 'entity' ? (
                  <span className="shrink-0 text-[11px] text-text-muted">{it.meta}</span>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-muted/60">
                    Page
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
