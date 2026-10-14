'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { StorefrontChannel } from '@/lib/channel-routes';

/**
 * The search box on both home screens.
 *
 * It was an `<input>` with a placeholder and nothing else — no `onChange`, no
 * `onKeyDown`, no form. Typing into it did nothing and pressing Enter did
 * nothing, on the main home and on the سند home alike, while a complete search
 * screen sat at `/search` with no route into it from anywhere in the app.
 *
 * One component so the two homes cannot drift apart again. A `<form>`, not a
 * key handler, so a phone keyboard's own "go" key submits it.
 */
export function HomeSearchBox({
  placeholder,
  channel = 'DIRECT',
}: {
  placeholder: string;
  /**
   * Which storefront the search was started from. Without it a search typed on
   * the سند home landed on `/search`, which was hardcoded to the DIRECT
   * channel — so the patient was shown the public pool at public prices after
   * searching inside سند.
   */
  channel?: StorefrontChannel;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;
        const channelParam = channel === 'DIRECT' ? '' : `&channel=${channel}`;
        router.push(`/search?q=${encodeURIComponent(q)}${channelParam}`);
      }}
      className="relative"
    >
      <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
        <Search className="w-5 h-5 text-gray-400" />
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={placeholder}
        className="w-full bg-white text-gray-900 rounded-2xl py-3.5 ps-11 pe-4 border border-gray-100 outline-none focus:ring-2 focus:ring-primary/50 shadow-sm text-sm"
        placeholder={placeholder}
      />
      {/* Submits the form on Enter even where the browser needs a button to do
          it; visually hidden because the field already carries the icon. */}
      <button type="submit" className="sr-only">
        ابحث
      </button>
    </form>
  );
}
