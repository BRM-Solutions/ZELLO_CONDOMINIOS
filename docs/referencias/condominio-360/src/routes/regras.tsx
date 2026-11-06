import { createFileRoute } from "@tanstack/react-router";
import { ListPage, type Row } from "@/components/vg/ListPage";
import { pageHead } from "@/lib/store";

const rows: Row[] = [
    { title: 'Silêncio', sub: '22h às 7h em todos os dias', badge: ['Obrigatório', 'warning'] },
    { title: 'Piscina', sub: '7h às 22h • Proibido vidro', badge: ['Áreas comuns', 'info'] },
    { title: 'Animais', sub: 'Sempre com guia nas áreas comuns', badge: ['Pets', 'neutral'] },
    { title: 'Mudanças', sub: 'Seg a sáb, 8h às 18h, com agendamento', badge: ['Agendar', 'info'] },
];

export const Route = createFileRoute("/regras")({
  head: pageHead('Regras de Convivência', 'Regimento interno resumido.'),
  component: () => <ListPage title='Regras de Convivência' subtitle='Regimento interno resumido.' rows={rows} />,
});
