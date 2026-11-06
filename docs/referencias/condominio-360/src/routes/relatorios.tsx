import { createFileRoute } from "@tanstack/react-router";
import { ListPage, type Row } from "@/components/vg/ListPage";
import { pageHead } from "@/lib/store";

const rows: Row[] = [
    { title: 'Prestação de contas - Agosto', sub: 'Gerado em 01/09', badge: ['PDF', 'info'] },
    { title: 'Ocorrências por categoria', sub: 'Últimos 90 dias', badge: ['XLSX', 'neutral'] },
    { title: 'Uso das áreas comuns', sub: 'Reservas por área', badge: ['PDF', 'info'] },
];

export const Route = createFileRoute("/relatorios")({
  head: pageHead('Relatórios', 'Exportações e indicadores.'),
  component: () => <ListPage title='Relatórios' subtitle='Exportações e indicadores.' rows={rows} />,
});
