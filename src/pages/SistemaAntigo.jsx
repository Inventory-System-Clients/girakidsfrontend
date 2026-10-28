import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDownToLine, CheckCircle2, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Skeleton, cx, useToast } from "../components/ui";
import { dataHora, moeda } from "../utils/format";

// Sincronização com o sistema antigo (Krion): pedidos, estoque, clientes e
// produtos novos de lá entram aqui automaticamente.

const STATUS_VENDAS = {
  AGUARDANDO: { label: "Aguardando", variant: "warning" },
  LIBERADO: { label: "Liberado", variant: "success" },
  CANCELADO: { label: "Cancelado", variant: "danger" },
};
const STATUS_EXPEDICAO = { NAO_INICIADO: "Não iniciado", MONTAGEM: "Em montagem", EXPEDIDO: "Expedido" };

const resumoCiclo = (c) =>
  [
    c.pedidosNovos?.length && `${c.pedidosNovos.length} pedido(s) novo(s)`,
    c.orcamentosNovos?.length && `${c.orcamentosNovos.length} orçamento(s)`,
    c.pedidosAtualizados?.length && `${c.pedidosAtualizados.length} pedido(s) atualizado(s)`,
    c.estoqueAjustadoTotal && `estoque de ${c.estoqueAjustadoTotal} produto(s)`,
    c.produtosNovos && `${c.produtosNovos} produto(s) novo(s)`,
    c.usuariosNovos && `${c.usuariosNovos} cliente(s)/usuário(s) novo(s)`,
    c.parceirosNovos && `${c.parceirosNovos} parceiro(s)`,
  ]
    .filter(Boolean)
    .join(" · ") || "Nada novo";

export default function SistemaAntigo() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [edicao, setEdicao] = useState({});
  const [ocupado, setOcupado] = useState("");
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(
    () =>
      api
        .get("/sistema-antigo/sincronizacao")
        .then(({ data }) => setDados(data))
        .catch((e) => toast({ titulo: "Erro ao carregar", descricao: mensagemErro(e), tipo: "erro" })),
    [toast],
  );

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 15000);
    return () => clearInterval(id);
  }, [carregar]);

  if (usuario?.role !== "ADMIN") return <p className="p-10 text-center text-muted-foreground">Só o administrador configura a sincronização com o sistema antigo.</p>;
  if (!dados) return <Skeleton className="m-6 h-96" />;

  const { config, ultima, historico, ultimosPedidos } = dados;
  const form = { email: config.email || "", senha: "", intervaloSegundos: config.intervaloSegundos, ...edicao };
  const editar = (mudanca) => setEdicao((e) => ({ ...e, ...mudanca }));
  const alterado = Object.keys(edicao).length > 0;

  const executar = async (chave, acao, sucesso) => {
    setOcupado(chave);
    try {
      const resultado = await acao();
      if (sucesso) toast(typeof sucesso === "function" ? sucesso(resultado) : { titulo: sucesso });
      return resultado;
    } catch (error) {
      toast({ titulo: "Não foi possível concluir", descricao: mensagemErro(error), tipo: "erro" });
      return null;
    } finally {
      setOcupado("");
    }
  };

  const salvar = () =>
    executar(
      "salvar",
      async () => {
        await api.put("/sistema-antigo/sincronizacao", {
          email: form.email,
          intervaloSegundos: Number(form.intervaloSegundos),
          ...(form.senha.trim() ? { senha: form.senha } : {}),
        });
        setEdicao({});
        await carregar();
      },
      "Configuração salva",
    );

  const alternarAtivo = () =>
    executar(
      "ativo",
      async () => {
        await api.put("/sistema-antigo/sincronizacao", { ativo: !config.ativo });
        await carregar();
      },
      config.ativo ? "Sincronização desligada" : "Sincronização ligada",
    );

  const sincronizarAgora = () =>
    executar(
      "agora",
      async () => {
        const { data } = await api.post("/sistema-antigo/sincronizacao/executar", null, { timeout: 10 * 60 * 1000 });
        await carregar();
        return data;
      },
      (r) => ({ titulo: r?.ok ? "Sincronizado" : "Sincronizado com avisos", descricao: r ? resumoCiclo(r) : "", tipo: r?.ok ? undefined : "erro" }),
    );

  return (
    <div className="container-app max-w-6xl space-y-5 py-6">
      <PageHeader titulo="Sistema antigo (Krion)" subtitulo="Traz para cá, automaticamente, os pedidos, o estoque e os cadastros feitos no sistema antigo." />

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className={cx("flex h-11 w-11 items-center justify-center rounded-xl", config.ativo ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
            <ArrowDownToLine className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-semibold">{config.ativo ? "Sincronização ligada" : "Sincronização desligada"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {config.ativo && <Badge variant="success">A cada {config.intervaloSegundos} s</Badge>}
              {config.senhaConfigurada && <Badge variant="outline">Login salvo ✓</Badge>}
              {dados.executando && <Badge variant="info">Sincronizando agora…</Badge>}
              {!config.baseRealizada && <Badge variant="warning">Primeira sincronização pendente</Badge>}
            </div>
            {ultima && (
              <p className={cx("mt-2 flex items-center gap-1.5 text-sm", ultima.ok ? "text-muted-foreground" : "font-medium text-red-600")}>
                {ultima.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4" />}
                Última leitura {dataHora(ultima.inicio)} — {ultima.ok ? resumoCiclo(ultima) : ultima.erros?.[0]}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={ocupado === "agora"} disabled={!config.senhaConfigurada || dados.executando} onClick={sincronizarAgora}>
            <RefreshCw className="h-4 w-4" /> Sincronizar agora
          </Button>
          <Button variant={config.ativo ? "danger-outline" : "success"} loading={ocupado === "ativo"} disabled={!config.senhaConfigurada} onClick={alternarAtivo}>
            {config.ativo ? "Desligar" : "Ligar sincronização"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Acesso ao sistema antigo</h2>
            <p className="text-sm text-muted-foreground">Login de um administrador de lá. O sistema só lê os dados; nada é alterado no antigo.</p>
          </div>
          <Field label="E-mail do administrador">
            <Input type="email" value={form.email} onChange={(e) => editar({ email: e.target.value })} placeholder="admin@girakids.com" />
          </Field>
          <Field label="Senha" dica={config.senhaConfigurada ? "Já existe uma senha salva. Preencha só para trocar." : undefined}>
            <Input type="password" autoComplete="new-password" value={form.senha} onChange={(e) => editar({ senha: e.target.value })} placeholder={config.senhaConfigurada ? "••••••••" : "Senha do sistema antigo"} />
          </Field>
          <Field label="Intervalo entre leituras (segundos)" dica="Mínimo 30 s. Pedido feito lá aparece aqui em até esse tempo.">
            <Input type="number" min={30} max={3600} value={form.intervaloSegundos} onChange={(e) => editar({ intervaloSegundos: e.target.value })} />
          </Field>
          <Button loading={ocupado === "salvar"} disabled={!alterado} onClick={salvar}>
            Salvar (testa o login)
          </Button>
          <div className="space-y-1.5 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">O que é trazido</p>
            <p>• Pedidos e orçamentos novos de lá, com o mesmo número. Se o número já existir aqui, o de lá aparece como “63127-ANT”.</p>
            <p>• Andamento dos pedidos de lá (pagamento, liberação, expedição, nota, cancelamento) — só para a frente, nunca desfaz o que foi feito aqui.</p>
            <p>• Estoque: as vendas e ajustes feitos lá entram como movimentação aqui. O que foi movimentado no sistema novo continua valendo.</p>
            <p>• Clientes, usuários, produtos e parceiros criados lá. Nome, imagens, descrição e preço de produtos que já existem aqui não são alterados.</p>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              A senha fica criptografada no cofre do servidor e nunca volta para a tela. <ShieldCheck className="inline h-3.5 w-3.5" /> Só o administrador vê esta página.
            </span>
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Pedidos vindos do sistema antigo</h2>
            <Badge variant="outline">{dados.pedidosLegado} no total</Badge>
          </div>
          {ultimosPedidos.length === 0 ? (
            <EmptyState titulo="Nenhum pedido sincronizado ainda" descricao="Depois da primeira sincronização, os pedidos novos de lá aparecem aqui." />
          ) : (
            <ul className="divide-y">
              {ultimosPedidos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      #{p.codigoLegado || p.numero} · {p.clienteNome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dataHora(p.createdAt)} · {STATUS_EXPEDICAO[p.statusExpedicao] || p.statusExpedicao}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{moeda(p.total)}</span>
                    <Badge variant={STATUS_VENDAS[p.statusVendas]?.variant || "default"}>{STATUS_VENDAS[p.statusVendas]?.label || p.statusVendas}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Histórico das sincronizações</h2>
        {historico.length === 0 ? (
          <EmptyState titulo="Ainda não sincronizou" descricao="Clique em “Sincronizar agora” para trazer tudo do sistema antigo." />
        ) : (
          <ul className="divide-y">
            {historico.map((c, i) => (
              <li key={`${c.inicio}-${i}`} className="py-2 text-sm">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setAberto(aberto === i ? null : i)}>
                  <span className="flex min-w-0 items-center gap-2">
                    {c.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
                    <span className="min-w-0">
                      <span className="font-medium">{dataHora(c.inicio)}</span>
                      {c.inicial && " · primeira"}
                      {c.manual && " · manual"} — {c.ok ? resumoCiclo(c) : c.erros?.[0]}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{Math.round((c.duracaoMs || 0) / 1000)} s</span>
                </button>
                {aberto === i && (
                  <div className="mt-2 space-y-1.5 rounded-xl bg-muted/60 p-3 text-xs">
                    {c.pedidosNovos?.length > 0 && <p><strong>Pedidos novos:</strong> {c.pedidosNovos.join(", ")}</p>}
                    {c.orcamentosNovos?.length > 0 && <p><strong>Orçamentos novos:</strong> {c.orcamentosNovos.join(", ")}</p>}
                    {c.pedidosAtualizados?.length > 0 && <p><strong>Pedidos atualizados:</strong> {c.pedidosAtualizados.join(", ")}</p>}
                    {c.estoqueAjustado?.length > 0 && (
                      <p>
                        <strong>Estoque:</strong> {c.estoqueAjustado.map((e) => `${e.nome} (${e.delta > 0 ? "+" : ""}${e.delta})`).join(", ")}
                        {c.estoqueAjustadoTotal > c.estoqueAjustado.length && ` e mais ${c.estoqueAjustadoTotal - c.estoqueAjustado.length}`}
                      </p>
                    )}
                    {c.erros?.length > 0 && (
                      <div className="text-red-600">
                        {c.erros.map((e) => (
                          <p key={e}>{e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
