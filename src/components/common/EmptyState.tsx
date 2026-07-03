export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-state">
      <h1>{title}</h1>
      <p>{message}</p>
    </div>
  );
}
