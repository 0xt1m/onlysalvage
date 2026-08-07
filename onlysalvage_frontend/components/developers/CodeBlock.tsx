export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-background border border-border rounded-md p-3 text-xs overflow-x-auto whitespace-pre">
      <code>{children}</code>
    </pre>
  );
}
