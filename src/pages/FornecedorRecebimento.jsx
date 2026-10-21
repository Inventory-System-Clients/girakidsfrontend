import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CheckCircle2, Lock, Package } from "lucide-react";
import api from "../services/api";
import { Button, Card, Field, Input, Spinner, Textarea } from "../components/ui";
import { data, dataHora, hojeISO, numero } from "../utils/format";

// Página que o fornecedor abre pelo link (sem login e sem o resto do site).
// O token fica depois do "#" e vai num cabeçalho; a sessão de quem estiver
// logado no navegador não é enviada.
const apiPublica = axios.create({ baseURL: api.defaults.baseURL, headers: { "Content-Type": "application/json" } });

const TIPOS = { SEM_CAPSULA: "Brinquedo sem cápsula", CAPSULA: "Cápsula", PRONTO: "Produto" };

export default function FornecedorRecebimento() {
  const token = useMemo(() => window.location.hash.replace(/^#/, "").trim(), []);
  const [pre, setPre] = useState(null);
  const [erro, setErro] = useState(token ? "" : "Link incompleto. Abra o link exatamente como recebeu.");
  const [respostas, setRespostas] = useState({});
  const [form, setForm] = useState({ responsavel: "", previsaoEntrega: "", observacao: "" });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    document.title = "Pré-recebimento · Gira Kids";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const aplicar = (d) => {
    setPre(d);
    setRespostas(Object.fromEntries(d.itens.map((i) => [i.id, { quantidade: String(i.quantidadeFornecedor ?? i.quantidadeSolicitada), observacao: i.observacao || "" }])));
    setForm({ responsavel: d.respondidoPor || "", previsaoEntrega: d.previsaoFornecedor || d.previsaoEntrega || "", observacao: d.observacaoFornecedor || "" });
  };

  useEffect(() => {
    if (!token) return;
    apiPublica
      .get("/publico/pre-recebimento", { headers: { "x-acesso-fornecedor": token } })
      .then(({ data: d }) => aplicar(d))
      .catch((e) => setErro(e.response?.data?.error || "Não foi possível abrir o link. Tente de novo em instantes."));
  }, [token]);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const { data: d } = await apiPublica.put(
        "/publico/pre-recebimento",
        {
          ...form,
          itens: pre.itens.map((i) => ({ id: i.id, quantidade: respostas[i.id]?.quantidade, observacao: respostas[i.id]?.observacao })),
        },
        { headers: { "x-acesso-fornecedor": token } },
      );
      aplicar(d);
      setEnviado(true);
      setEditando(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e2) {
      setErro(e2.response?.data?.error || "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const respondido = pre?.respondidoEm && !editando;
  const total = pre ? pre.itens.reduce((s, i) => s + (Number(respostas[i.id]?.quantidade) || 0), 0) : 0;

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src="/logo.webp" alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="font-semibold leading-tight">Gira Kids</p>
            <p className="text-xs text-muted-foreground">Pré-recebimento de mercadoria</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Link exclusivo
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {!pre && !erro && (
          <div className="flex justify-center py-20">
            <Spinner className="h-8 w-8" />
          </div>
        )}
        {erro && !pre && (
          <Card className="p-6 text-center">
            <p className="font-semibold">{erro}</p>
          </Card>
        )}
        {pre && (
          <>
            <h1 className="text-xl font-bold">Pré-recebimento nº {pre.numero}</h1>
            <p className="text-sm text-muted-foreground">
              {pre.fornecedorNome ? `${pre.fornecedorNome} · ` : ""}
              {pre.previsaoEntrega ? `Previsão pedida pela Gira Kids: ${data(pre.previsaoEntrega)}` : "Informe abaixo o que você vai entregar."}
            </p>
            {pre.observacao && <p className="mt-2 rounded-lg bg-white p-3 text-sm shadow-sm">{pre.observacao}</p>}

            {pre.recebido && (
              <Card className="mt-4 border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" /> A Gira Kids já recebeu esta mercadoria. Obrigado!
                </p>
              </Card>
            )}
            {!pre.aberto && !pre.recebido && <Card className="mt-4 p-4 text-sm">Este pré-recebimento não está mais aberto para respostas.</Card>}

            {enviado && (
              <Card className="mt-4 border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" /> Resposta enviada! A equipe da Gira Kids já pode ver as quantidades.
                </p>
              </Card>
            )}

            {respondido && pre.aberto && (
              <Card className="mt-4 p-4 text-sm">
                Respondido por <strong>{pre.respondidoPor}</strong> em {dataHora(pre.respondidoEm)}
                {pre.previsaoFornecedor && <> · entrega prevista para <strong>{data(pre.previsaoFornecedor)}</strong></>}.
                <Button size="sm" variant="outline" className="mt-2 block" onClick={() => setEditando(true)}>
                  Alterar resposta
                </Button>
              </Card>
            )}

            <form onSubmit={enviar} className="mt-4 space-y-3">
              {pre.itens.map((i) => (
                <Card key={i.id} className="p-3">
                  <div className="flex gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {i.imagemUrl ? <img src={i.imagemUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{i.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {TIPOS[i.tipo]} · código {i.sku}
                      </p>
                      <p className="mt-1 text-sm">
                        Pedido: <strong>{numero(i.quantidadeSolicitada)} unidades</strong>
                        {i.quantidadeRecebida != null && <span className="ml-2 text-emerald-700">Recebido: {numero(i.quantidadeRecebida)}</span>}
                      </p>
                    </div>
                  </div>
                  {pre.aberto && !respondido ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
                      <Field label="Vou entregar (unidades)" obrigatorio>
                        <Input
                          inputMode="numeric"
                          required
                          value={respostas[i.id]?.quantidade ?? ""}
                          onChange={(e) => setRespostas({ ...respostas, [i.id]: { ...respostas[i.id], quantidade: e.target.value.replace(/\D/g, "") } })}
                        />
                      </Field>
                      <Field label="Observação (opcional)">
                        <Input
                          maxLength={500}
                          value={respostas[i.id]?.observacao ?? ""}
                          onChange={(e) => setRespostas({ ...respostas, [i.id]: { ...respostas[i.id], observacao: e.target.value } })}
                          placeholder="Ex.: só tenho 10 mil agora"
                        />
                      </Field>
                    </div>
                  ) : (
                    i.quantidadeFornecedor != null && (
                      <p className="mt-2 text-sm">
                        Vai entregar: <strong>{numero(i.quantidadeFornecedor)}</strong>
                        {i.observacao && <span className="text-muted-foreground"> — {i.observacao}</span>}
                      </p>
                    )
                  )}
                </Card>
              ))}

              {pre.aberto && !respondido && (
                <Card className="space-y-3 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Seu nome" obrigatorio>
                      <Input required maxLength={150} value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                    </Field>
                    <Field label="Data prevista de entrega">
                      <Input type="date" min={hojeISO()} value={form.previsaoEntrega} onChange={(e) => setForm({ ...form, previsaoEntrega: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Observação geral (opcional)">
                    <Textarea maxLength={2000} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Ex.: entrega pela transportadora X, 12 caixas" />
                  </Field>
                  {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">Total a entregar: {numero(total)} unidades</p>
                    <Button type="submit" variant="success" size="lg" loading={enviando}>
                      Enviar para a Gira Kids
                    </Button>
                  </div>
                </Card>
              )}
            </form>
          </>
        )}
      </main>
    </div>
  );
}
