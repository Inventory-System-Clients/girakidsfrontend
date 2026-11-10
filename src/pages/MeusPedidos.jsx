import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import api from "../services/api";
import { Button, Card, EmptyState, PageHeader, Skeleton, Tabs } from "../components/ui";
import PedidoDetalhes from "../components/pedido/PedidoDetalhes";
import { CartaoAcompanhamento } from "../components/pedido/Acompanhamento";
import { WHATSAPP_LINK_REDE, aceitaLinkRede, mensagemPedirLinkRede } from "../components/pedido/LinkRedeDialog";
import { BotaoWhatsapp } from "../components/Whatsapp";
import { moeda } from "../utils/format";

const POR_PAGINA = 20;
const ABAS = [
  { value: "andamento", label: "Em andamento" },
  { value: "concluidos", label: "Concluídos" },
];
// Rastreio carregado sozinho só dos envios recentes (os antigos, no botão).
const recente = (p) => p.expedidoEm && Date.now() - new Date(p.expedidoEm).getTime() < 30 * 86_400_000;

export default function MeusPedidos() {
  const [aba, setAba] = useState("andamento");
  const [pedidos, setPedidos] = useState(null);
  const [temMais, setTemMais] = useState(false);
  const [ver, setVer] = useState(null);

  const carregar = useCallback(
    (offset = 0) =>
      api.get("/pedidos/meus", { params: { offset, limite: POR_PAGINA, situacao: aba } }).then(({ data: d }) => {
        setPedidos((atual) => (offset ? [...(atual || []), ...d] : d));
        setTemMais(d.length === POR_PAGINA);
      }),
    [aba],
  );
  useEffect(() => {
    carregar();
  }, [carregar]);

  const trocarAba = (nova) => {
    setPedidos(null);
    setAba(nova);
  };

  return (
    <div className="container-app py-6">
      <PageHeader titulo="Meus Pedidos" subtitulo="Acompanhe o pagamento, a separação e o envio dos seus pedidos." />
      <Tabs abas={ABAS} ativa={aba} onChange={trocarAba} className="mb-4" />
      {!pedidos && <Skeleton className="h-40" />}
      {pedidos?.length === 0 && (
        <Card>
          <EmptyState
            icon={Package}
            titulo={aba === "andamento" ? "Nenhum pedido em andamento" : "Nenhum pedido concluído"}
            descricao={aba === "andamento" ? "Quando você fizer um pedido, o andamento dele aparece aqui." : "Os pedidos enviados ficam guardados aqui."}
          >
            <Link to="/">
              <Button className="mt-3">Ver catálogo</Button>
            </Link>
          </EmptyState>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {pedidos?.map((p) => (
          <CartaoAcompanhamento key={p.id} pedido={p} urlRastreio={`/pedidos/${p.id}/rastreio`} rastreioAutomatico={recente(p)}>
            <span className="mr-auto text-lg font-bold text-primary">{moeda(p.total)}</span>
            {p.statusFinanceiro !== "PAGO" && p.statusVendas !== "CANCELADO" && aceitaLinkRede(p) && (
              <BotaoWhatsapp telefone={WHATSAPP_LINK_REDE} texto={mensagemPedirLinkRede(p)}>
                Solicitar link de pagamento
              </BotaoWhatsapp>
            )}
            <Button variant="outline" size="sm" onClick={() => setVer(p.id)}>
              Ver detalhes
            </Button>
          </CartaoAcompanhamento>
        ))}
      </div>
      {temMais && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => carregar(pedidos.length)}>
            Carregar mais pedidos
          </Button>
        </div>
      )}
      <PedidoDetalhes pedidoId={ver} onFechar={() => setVer(null)} />
    </div>
  );
}
