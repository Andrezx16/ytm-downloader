interface PageProps {
  children: React.ReactNode;
  className?: string;
}

export function Page({ children, className = "" }: PageProps) {
  return (
    <div className={`mx-auto w-full max-w-5xl ${className}`}>
      {children}
    </div>
  );
}
