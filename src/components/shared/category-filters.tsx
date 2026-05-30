'use client';

import { useFilters } from '@/hooks/use-filters';

interface Category {
  id: string;
  name: string;
  icon?: React.ElementType;
}

interface CategoryFiltersProps {
  categories: Category[];
  allLabel?: string;
  className?: string;
}

export function CategoryFilters({ categories, allLabel = 'الكل', className = '' }: CategoryFiltersProps) {
  const { category: activeCategory, setCategory } = useFilters();

  return (
    <div className={`flex gap-3 overflow-x-auto hide-scrollbar snap-x px-4 pb-2 ${className}`}>
      <button
        onClick={() => setCategory('all')}
        className={`whitespace-nowrap px-6 py-2.5 rounded-[1.5rem] text-sm font-bold transition-all active:scale-95 snap-center ${
          activeCategory === 'all'
            ? 'bg-primary text-white shadow-md shadow-primary/20'
            : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
        }`}
      >
        {allLabel}
      </button>
      
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => setCategory(cat.id)}
          className={`whitespace-nowrap px-5 py-2.5 rounded-[1.5rem] text-sm font-bold transition-all flex items-center gap-2 active:scale-95 snap-center ${
            activeCategory === cat.id
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
          }`}
        >
          {cat.icon && <cat.icon className="w-4 h-4" />}
          {cat.name}
        </button>
      ))}
    </div>
  );
}
