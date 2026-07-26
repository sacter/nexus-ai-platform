import { Card, CardHeader, CardContent, CardFooter } from '@heroui/react';

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-1 pb-0">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-foreground/60">{description}</p>
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer && (
          <CardFooter className="justify-center">{footer}</CardFooter>
        )}
      </Card>
    </div>
  );
}
