export default function Template({ children }) {
  // Re-mounts on every navigation, so the entrance animation replays per page.
  return <div className="page-enter">{children}</div>;
}
