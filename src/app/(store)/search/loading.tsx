export default function Loading() {
  return (
    <div className="container-page py-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-48" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="card p-3">
            <div className="skeleton aspect-square w-full rounded-xl" />
            <div className="skeleton mt-3 h-3 w-16" />
            <div className="skeleton mt-2 h-4 w-full" />
            <div className="skeleton mt-2 h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
