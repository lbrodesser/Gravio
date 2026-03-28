export default function Loading(): React.JSX.Element {
  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
        </div>
        <ul>
          {[1, 2, 3].map((i) => (
            <li key={i} className="px-4 py-3 border-b border-border space-y-1">
              <div className="h-4 bg-muted rounded animate-pulse w-32" />
              <div className="h-3 bg-muted rounded animate-pulse w-20" />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1" />
    </div>
  )
}
