import { useQuery } from '@tanstack/react-query';
import { seriesApi } from '../api/series';
import { BracketView } from '../components/bracket/BracketView';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function BracketPage() {
  const { data: series = [], isLoading, error } = useQuery({
    queryKey: ['series'],
    queryFn: () => seriesApi.getAll().then((r) => r.data),
  });

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (error) return <p className="text-red-600 text-center py-10">Failed to load bracket.</p>;

  return (
    <div className="min-w-0">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">NBA Playoff Bracket</h1>
        <p className="text-gray-500 mt-1 text-sm leading-snug">
          Tap or click a series to submit or view your prediction.
        </p>
      </div>
      <BracketView series={series} />
    </div>
  );
}
