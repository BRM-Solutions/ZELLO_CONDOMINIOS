import type { ReactNode } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Card } from "./Card";

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <Card>
      <p className="empty-state">{message}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </Card>
  );
}

export function LoadingRows({ count = 3, label = "Carregando..." }: { count?: number; label?: string }) {
  return (
    <div className="skeleton-list" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state">
      <Alert tone="danger">{message}</Alert>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
