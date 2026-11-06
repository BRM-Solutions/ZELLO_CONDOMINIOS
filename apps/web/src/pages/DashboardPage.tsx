import { workspaceSchema, paginatedSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";
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
      <div className="page-head">
        <h1>Workspaces</h1>
      </div>
      {workspaces.isPending && <p className="state" role="status">Carregando...</p>}
      {workspaces.isError && (
        <p className="state state-error" role="alert">Não foi possível carregar os workspaces.</p>
      )}
      {workspaces.data && workspaces.data.data.length === 0 && (
        <p className="state">Nenhum workspace cadastrado.</p>
      )}
      {workspaces.data && workspaces.data.data.length > 0 && (
        <ul className="grid">
          {workspaces.data.data.map((workspace) => (
            <li key={workspace.id} className="card">
              <h2>{workspace.name}</h2>
              <p className="muted">{[workspace.city, workspace.state].filter(Boolean).join(" / ") || "Sem localização"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
