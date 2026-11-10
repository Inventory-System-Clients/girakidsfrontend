import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CheckCircle2, Clock, LogOut, Package, Plus, Truck } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, Spinner, Textarea, useToast } from "../components/ui";
import { data, dataHora, hojeISO, numero } from "../utils/format";

// Portal do fornecedor (login FORNECEDOR): só os pré-recebimentos dele e os
// itens que a Gira Kids liberou. Sem nenhum valor (preço ou custo).

const COR = { AGUARDANDO_FORNECEDOR: "warning", FORNECEDOR_RESPONDEU: "info", RECEBIDO: "success", RECEBIDO_PARCIAL: "success", CANCELADO: "default" };

const Foto = ({ src }) => (
  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
    {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
  </div>
);

// Primeiro acesso: troca a senha provisória.
function TrocarSenha() {
  const { usuario, atualizarUsuario } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const salvar = async (e) => {
    e.preventDefault();
    if (senha !== confirmacao) return toast({ titulo: "As senhas não coincidem", tipo: "erro" });
    setEnviando(true);
    try {
      const { data: r } = await api.put("/auth/senha", { novaSenha: senha });
      if (r?.token) localStorage.setItem("token", r.token);
      atualizarUsuario({ ...usuario, trocarSenha: false });
      toast({ titulo: "Senha criada" });
    } catch (error) {
      toast({ titulo: "Erro ao salvar a senha", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Card className="mx-auto max-w-md p-6">
      <h2 className="text-lg font-semibold">Crie sua senha</h2>
      <p className="mb-4 text-sm text-muted-foreground">Você entrou com uma senha provisória. Escolha uma senha nova (mínimo 8 caracteres).</p>
      <form onSubmit={salvar} className="space-y-3">
        <Field label="Nova senha">
          <Input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} />
        </Field>
        <Field label="Repita a senha">
          <Input type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required minLength={8} />
        </Field>
        <Button type="submit" className="w-full" loading={enviando} disabled={senha.length < 8}>
          Salvar senha
        </Button>
      </form>
    </Card>
  );
}

// Novo pré-recebimento: quantidade de cada item que vai trazer, data e observação.
function NovoPreRecebimento({ produtos, onFechar, onCriado }) {
  const [quantidades, setQuantidades] = useState({});
  const [previsao, setPrevisao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const escolhidos = produtos.filter((p) => Number(quantidades[p.id]) > 0);
  const visiveis = produtos.filter((p) => !busca || `${p.nome} ${p.sku}`.toLowerCase().includes(busca.toLowerCase()));

  const enviar = async () => {
    setEnviando(true);
    try {
      await api.post("/portal-fornecedor/pre-recebimentos", {
        itens: escolhidos.map((p) => ({ produtoId: p.id, quantidade: Number(quantidades[p.id]) })),
        previsaoEntrega: previsao,
        observacao,
      });
      toast({ titulo: "Pré-recebimento enviado para a Gira Kids" });
      onCriado();
    } catch (error) {
      toast({ titulo: "Não foi possível enviar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo="Novo pré-recebimento"
      descricao="Informe quanto vai trazer de cada item, a data prevista e, se precisar, uma observação."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button variant="success" loading={enviando} disabled={!escolhidos.length || !previsao} onClick={enviar}>
            Enviar ({numero(escolhidos.reduce((s, p) => s + Number(quantidades[p.id]), 0))} un.)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {produtos.length > 8 && <Input placeholder="Buscar item..." value={busca} onChange={(e) => setBusca(e.target.value)} />}
        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {visiveis.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
              <Foto src={p.imagemUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.nome}</p>
                <p className="text-xs text-muted-foreground">código {p.sku}</p>
              </div>
              <Input
                className="w-28 text-right"
                inputMode="numeric"
                placeholder="0"
                aria-label={`Quantidade de ${p.nome}`}
                value={quantidades[p.id] ?? ""}
                onChange={(e) => setQuantidades({ ...quantidades, [p.id]: e.target.value.replace(/\D/g, "") })}
              />
              <span className="text-xs text-muted-foreground">un.</span>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data prevista de entrega" obrigatorio>
            <Input type="date" min={hojeISO()} value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </Field>
        </div>
        <Field label="Observação (opcional)">
          <Textarea maxLength={2000} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: entrega pela transportadora X, 12 caixas" />
        </Field>
      </div>
    </Dialog>
  );
}

// Confirmar/corrigir o que vai trazer de um pré-recebimento em aberto.
function Responder({ pre, onFechar, onSalvo }) {
  const [respostas, setRespostas] = useState(() => Object.fromEntries(pre.itens.map((i) => [i.id, { quantidade: String(i.quantidadeFornecedor ?? i.quantidadeSolicitada), observacao: i.observacao || "" }])));
  const [previsao, setPrevisao] = useState(pre.previsaoFornecedor || pre.previsaoEntrega || "");
  const [observacao, setObservacao] = useState(pre.observacaoFornecedor || "");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const enviar = async () => {
    setEnviando(true);
    try {
      await api.put(`/portal-fornecedor/pre-recebimentos/${pre.id}`, {
        itens: pre.itens.map((i) => ({ id: i.id, ...respostas[i.id] })),
        previsaoEntrega: previsao,
        observacao,
      });
      toast({ titulo: "Enviado para a Gira Kids" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Não foi possível enviar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={`Pré-recebimento nº ${pre.numero}`}
      descricao="Confirme quanto vai entregar de cada item (0 se não for entregar)."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button variant="success" loading={enviando} onClick={enviar}>Enviar</Button>
        </>
      }
    >
      <div className="space-y-3">
        {pre.itens.map((i) => (
          <div key={i.id} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_8rem_1fr] sm:items-end">
            <div className="flex items-center gap-2">
              <Foto src={i.imagemUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{i.nome}</p>
                <p className="text-xs text-muted-foreground">Pedido: {numero(i.quantidadeSolicitada)} un.</p>
              </div>
            </div>
            <Field label="Vou entregar">
              <Input inputMode="numeric" value={respostas[i.id].quantidade} onChange={(e) => setRespostas({ ...respostas, [i.id]: { ...respostas[i.id], quantidade: e.target.value.replace(/\D/g, "") } })} />
            </Field>
            <Field label="Observação">
              <Input maxLength={500} value={respostas[i.id].observacao} onChange={(e) => setRespostas({ ...respostas, [i.id]: { ...respostas[i.id], observacao: e.target.value } })} />
            </Field>
          </div>
        ))}
        <Field label="Data prevista de entrega">
          <Input type="date" min={hojeISO()} value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
        </Field>
        <Field label="Observação geral (opcional)">
          <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function CartaoPre({ pre, onResponder }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Pré-recebimento nº {pre.numero}</p>
          <p className="text-xs text-muted-foreground">
            {pre.criadoPeloFornecedor ? "Criado por você" : "A Gira Kids criou este pré-recebimento para você trazer os itens"} · {dataHora(pre.criadoEm)}
          </p>
        </div>
        <Badge variant={COR[pre.status] || "default"}>
          {pre.recebido ? <CheckCircle2 className="h-3 w-3" /> : pre.aberto ? <Clock className="h-3 w-3" /> : null} {pre.situacao}
        </Badge>
      </div>
      {pre.observacao && <p className="mt-2 rounded-md bg-sky-50 p-2 text-sm text-sky-900">Gira Kids: {pre.observacao}</p>}
      {pre.recebido && (
        <p className="mt-2 rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">
          Entrega concluída em {dataHora(pre.recebidoEm)} · {numero(pre.totais.recebido)} unidades recebidas.
          {pre.totais.faltou > 0 && ` Faltaram ${numero(pre.totais.faltou)} unidades do combinado (veja abaixo).`}
        </p>
      )}
      <div className="mt-3 divide-y divide-border">
        {pre.itens.map((i) => (
          <div key={i.id} className="flex items-center gap-3 py-2">
            <Foto src={i.imagemUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.nome}</p>
              <p className="text-xs text-muted-foreground">
                {pre.criadoPeloFornecedor ? "Você vai trazer" : "Pedido"}: {numero(i.quantidadeSolicitada)} un.
                {!pre.criadoPeloFornecedor && i.quantidadeFornecedor != null && ` · você confirmou ${numero(i.quantidadeFornecedor)} un.`}
                {i.observacao && ` · ${i.observacao}`}
              </p>
            </div>
            {pre.recebido && (
              <div className="text-right text-sm">
                <p className="font-semibold text-emerald-700">{numero(i.quantidadeRecebida ?? 0)} recebidas</p>
                {i.faltou > 0 && <p className="text-xs text-amber-700">faltaram {numero(i.faltou)}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {(pre.previsaoFornecedor || pre.previsaoEntrega) && `Entrega prevista: ${data(pre.previsaoFornecedor || pre.previsaoEntrega)}`}
          {pre.observacaoFornecedor && ` · Sua observação: ${pre.observacaoFornecedor}`}
        </span>
        {pre.aberto && (
          <Button size="sm" variant={pre.status === "AGUARDANDO_FORNECEDOR" ? "success" : "outline"} onClick={() => onResponder(pre)}>
            {pre.status === "AGUARDANDO_FORNECEDOR" ? "Confirmar quantidades" : "Corrigir quantidades"}
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function PortalFornecedor() {
  const { usuario, carregando, logout } = useAuth();
  const [dados, setDados] = useState(null);
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState("abertos");
  const [novo, setNovo] = useState(false);
  const [respondendo, setRespondendo] = useState(null);
  const ativo = usuario?.role === "FORNECEDOR" && !usuario.trocarSenha;

  const carregar = useCallback(() => {
    api.get("/portal-fornecedor/dados").then(({ data: d }) => setDados(d)).catch(() => setDados({ fornecedor: { nome: "" }, produtos: [] }));
    api.get("/portal-fornecedor/pre-recebimentos").then(({ data: d }) => setLista(d)).catch(() => setLista([]));
  }, []);
  useEffect(() => {
    document.title = "Portal do fornecedor · Gira Kids";
    if (ativo) carregar();
  }, [ativo, carregar]);

  if (carregando) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  if (usuario?.role !== "FORNECEDOR") return <Navigate to="/login" replace />;

  const filtrados = (lista || []).filter((p) => (filtro === "abertos" ? p.aberto : filtro === "concluidos" ? p.recebido : true));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-border bg-white">
        <div className="container-app flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.webp" alt="Gira Kids" className="h-10 w-10 object-contain" />
            <div>
              <p className="font-semibold">Portal do fornecedor</p>
              <p className="text-xs text-muted-foreground">{dados?.fornecedor?.nome || usuario.nome}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="container-app space-y-4 py-6">
        {usuario.trocarSenha ? (
          <TrocarSenha />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-border bg-white p-1 shadow-sm">
                {[["abertos", "Em andamento"], ["concluidos", "Entregas concluídas"], ["todos", "Todos"]].map(([v, l]) => (
                  <button key={v} className={`rounded-md px-3 py-1.5 text-sm ${filtro === v ? "bg-primary text-white" : "hover:bg-muted"}`} onClick={() => setFiltro(v)}>
                    {l}
                  </button>
                ))}
              </div>
              <Button onClick={() => setNovo(true)} disabled={!dados?.produtos?.length}>
                <Plus className="h-4 w-4" /> Novo pré-recebimento
              </Button>
            </div>
            {dados && !dados.produtos.length && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">A Gira Kids ainda não liberou itens para você. Fale com a equipe para liberar os produtos que você entrega.</p>
            )}
            {!lista ? (
              <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
            ) : !filtrados.length ? (
              <EmptyState icon={Truck} titulo="Nenhum pré-recebimento aqui" descricao={filtro === "abertos" ? "Crie um novo pré-recebimento quando for trazer mercadoria." : "Nada por enquanto."} />
            ) : (
              <div className="space-y-3">
                {filtrados.map((p) => (
                  <CartaoPre key={p.id} pre={p} onResponder={setRespondendo} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      {novo && dados && <NovoPreRecebimento produtos={dados.produtos} onFechar={() => setNovo(false)} onCriado={() => { setNovo(false); carregar(); }} />}
      {respondendo && <Responder pre={respondendo} onFechar={() => setRespondendo(null)} onSalvo={() => { setRespondendo(null); carregar(); }} />}
    </div>
  );
}
