import { workspaceSchema, paginatedSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";
import { EmptyState, ErrorState, LoadingRows } from "../components/ui/States";
import { ListCard } from "../components/ui/ListCard";
import { PageTitle } from "../components/ui/PageTitle";
import { useAuth } from "../contexts/AuthContext";

const workspacesResponseSchema = paginatedSchema(workspaceSchema);

export function DashboardPage() {
  const { organizationId } = useAuth();

  const workspaces = useQuery({
    queryKey: ["workspaces", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => workspacesResponseSchema.parse(await apiFetch("/workspaces")),
  });

  return (
    <section>
      <PageTitle title="Workspaces" />
      {workspaces.isPending && <LoadingRows />}
      {workspaces.isError && (
        <ErrorState message="Não foi possível carregar os workspaces." onRetry={() => void workspaces.refetch()} />
      )}
      {workspaces.data && workspaces.data.data.length === 0 && <EmptyState message="Nenhum workspace cadastrado." />}
      {workspaces.data && workspaces.data.data.length > 0 && (
        <ListCard
          rows={workspaces.data.data.map((workspace) => ({
            id: workspace.id,
            title: workspace.name,
            subtitle: [workspace.city, workspace.state].filter(Boolean).join(" / ") || "Sem localização",
          }))}
        />
      )}
    </section>
  );
}
