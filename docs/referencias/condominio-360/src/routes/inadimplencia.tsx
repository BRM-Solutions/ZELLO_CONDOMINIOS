import { createFileRoute } from "@tanstack/react-router";
import { ListPage, type Row } from "@/components/vg/ListPage";
import { pageHead } from "@/lib/store";

const rows: Row[] = [
    { title: 'Bl 2 • 2.108', sub: '3 cotas em atraso', right: 'R$ 2.670,00', badge: ['Notificado', 'warning'] },
    { title: 'Bl 1 • 1.405', sub: '1 cota em atraso', right: 'R$ 890,00', badge: ['Em aberto', 'danger'] },
    { title: 'Bl 3 • 3.301', sub: 'Acordo em 6x', right: 'R$ 4.450,00', badge: ['Acordo', 'info'] },
];

export const Route = createFileRoute("/inadimplencia")({
  head: pageHead('Inadimplência', 'Unidades com cotas em atraso.'),
  component: () => <ListPage title='Inadimplência' subtitle='Unidades com cotas em atraso.' rows={rows}
  stats={[['Taxa', '6,8%'], ['Em aberto', 'R$ 34.230'], ['Unidades', '17'], ['Acordos', '5']]} />,
});
