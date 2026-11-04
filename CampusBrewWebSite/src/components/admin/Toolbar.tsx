type Props = {
  statuses?: string[];
  status?: string;
  onStatus?: (s: string) => void;
  query: string;
  onQuery: (q: string) => void;
  placeholder?: string;
  onRefresh: () => void;
  refreshing: boolean;
};

const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Status filters, a search box (reference number or name) and a refresh button, above each admin list. */
export default function Toolbar({
  statuses, status, onStatus, query, onQuery, placeholder, onRefresh, refreshing,
}: Props) {
  return (
    <div className="admin-toolbar">
      {statuses && (
        <div className="admin-filters">
          {statuses.map((s) => (
            <button key={s} className={s === status ? "active" : ""} onClick={() => onStatus?.(s)}>
              {pretty(s)}
            </button>
          ))}
        </div>
      )}
      <div className="admin-toolbar-right">
        <input
          type="search"
          className="admin-search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder ?? "Search by ID or name"}
          aria-label="Search"
        />
        <button
          className="admin-refresh"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh"
          title="Refresh"
        >
          <span className={refreshing ? "admin-refresh-icon spinning" : "admin-refresh-icon"} aria-hidden="true">↻</span>
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}

