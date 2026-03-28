export default function Loading(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 h-16 flex items-center justify-between">
        <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        <div className="h-10 w-10 bg-muted rounded-md animate-pulse" />
      </header>
      <ul>
        {[1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="flex items-center px-4 min-h-[72px] border-b border-border gap-3"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-40" />
              <div className="h-3 bg-muted rounded animate-pulse w-24" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
