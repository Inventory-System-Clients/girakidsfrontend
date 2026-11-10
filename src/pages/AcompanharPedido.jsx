import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { Button, Card, Spinner } from "../components/ui";
import { CartaoAcompanhamento } from "../components/pedido/Acompanhamento";
import { BotaoWhatsapp, useWhatsappComercial } from "../components/Whatsapp";

// Link de acompanhamento enviado pela equipe ao cliente: abre sem login e
// mostra só o andamento daquele pedido (sem valores nem dados pessoais).
export default function AcompanharPedido() {
  const { id, assinatura } = useParams();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState("");
  const whatsapp = useWhatsappComercial();
  const base = `/acompanhamento/${id}/${assinatura}`;

  useEffect(() => {
    const carregar = () =>
      api
        .get(base)
        .then(({ data }) => setPedido(data))
        .catch((e) => setErro(mensagemErro(e)));
    carregar();
    const t = setInterval(() => document.visibilityState === "visible" && carregar(), 2 * 60_000);
    return () => clearInterval(t);
  }, [base]);

  return (
    <div className="container-app max-w-2xl py-8">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <PackageSearch className="h-6 w-6 text-primary" /> Acompanhamento do pedido
      </h1>
      {pedido && <p className="mb-4 text-muted-foreground">Olá{pedido.clienteNome ? `, ${pedido.clienteNome}` : ""}! Veja como está o seu pedido.</p>}
      {erro ? (
        <Card className="p-6 text-center text-red-700">{erro}</Card>
      ) : !pedido ? (
        <Spinner className="mx-auto mt-10 h-8 w-8" />
      ) : (
        <div className="space-y-4">
          <CartaoAcompanhamento
            pedido={pedido}
            urlRastreio={`${base}/rastreio`}
            extra={
              pedido.itens?.length > 0 && (
                <details className="rounded-md border border-border p-2 text-sm">
                  <summary className="cursor-pointer font-medium">Itens do pedido ({pedido.itens.length})</summary>
                  <ul className="mt-2 divide-y divide-border">
                    {pedido.itens.map((i) => (
                      <li key={i.id} className="flex items-center gap-2 py-1.5">
                        {i.imagemUrl ? <img src={i.imagemUrl} alt="" className="h-9 w-9 rounded object-cover" loading="lazy" /> : <span className="h-9 w-9 rounded bg-muted" />}
                        <span className="min-w-0 flex-1 truncate">{i.nome}</span>
                        <span className="text-muted-foreground">{i.quantidade} un.</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )
            }
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/meus-pedidos" className="flex-1">
              <Button variant="outline" className="w-full">Ver todos os meus pedidos</Button>
            </Link>
            <BotaoWhatsapp telefone={whatsapp} className="flex-1" texto={`Olá! Gostaria de falar sobre o meu pedido nº ${pedido.numeroFormatado}.`}>
              Falar com a Gira Kids
            </BotaoWhatsapp>
          </div>
        </div>
      )}
    </div>
  );
}
