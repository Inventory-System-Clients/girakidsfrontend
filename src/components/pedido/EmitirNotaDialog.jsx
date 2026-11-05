import { useEffect, useState } from "react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Dialog, Field, Input, Select, Spinner, Textarea, useConfirm, useToast } from "../ui";
import { moeda } from "../../utils/format";

const MOD_FRETE = { 0: "CIF (por conta do remetente)", 1: "FOB (por conta do destinatário)", 9: "Sem transporte (retirada)" };
// Dados do cliente que a tela deixa completar quando faltam no pedido.
const CAMPOS_CLIENTE = [
  { campo: "documento", rotulo: "CPF/CNPJ" },
  { campo: "nome", rotulo: "Nome / Razão social", largo: true },
  { campo: "cep", rotulo: "CEP" },
  { campo: "logradouro", rotulo: "Rua", largo: true },
  { campo: "numero", rotulo: "Número" },
  { campo: "complemento", rotulo: "Complemento" },
  { campo: "bairro", rotulo: "Bairro" },
  { campo: "cidade", rotulo: "Cidade" },
  { campo: "uf", rotulo: "UF" },
];

const PAGAMENTOS = { "03": "Cartão de crédito (a prazo)", 20: "PIX (à vista)", 15: "Boleto bancário (a prazo)", 21: "Crédito em loja (a prazo / a definir)" };

const baixarPdf = (base64, nome) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

// Emissão automática da NF-e do pedido pela NFeMail: prévia com as regras da
// Gira Kids (CFOP, ICMS, frete, pagamento), ajustes e emissão com DANFE.
export default function EmitirNotaDialog({ pedidoId, onFechar, onEmitida }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [opcoes, setOpcoes] = useState({ vinculos: {} });
  const [nota, setNota] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState(null);
  // Depois que faltou algo, os campos do cliente continuam abertos para editar.
  const [completarCliente, setCompletarCliente] = useState(false);

  const chaveOpcoes = JSON.stringify(opcoes);
  useEffect(() => {
    let ativo = true;
    const t = setTimeout(() => {
      setCarregando(true);
      api
        .post(`/pedidos/${pedidoId}/nfe/previa`, JSON.parse(chaveOpcoes))
        .then(({ data }) => {
          if (!ativo) return;
          setNota(data);
          if (data.faltando?.length) setCompletarCliente(true);
          setErro("");
        })
        .catch((e) => ativo && setErro(mensagemErro(e)))
        .finally(() => ativo && setCarregando(false));
    }, 400);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [pedidoId, chaveOpcoes]);

  const alterar = (campo, valor) => setOpcoes((atual) => ({ ...atual, [campo]: valor }));
  const alterarCliente = (campo, valor) => setOpcoes((atual) => ({ ...atual, cliente: { ...atual.cliente, [campo]: valor } }));
  const vincular = (produtoId, codigo) => setOpcoes((atual) => ({ ...atual, vinculos: { ...atual.vinculos, [produtoId]: codigo } }));

  const emitir = async () => {
    const ok = await confirmar({
      titulo: "Emitir a nota fiscal?",
      mensagem: "A NFeMail grava, assina e transmite a nota para a SEFAZ. Depois de autorizada, só dá para cancelar pela NFeMail.",
      confirmar: "Emitir nota",
    });
    if (!ok) return;
    setEmitindo(true);
    try {
      const { data } = await api.post(`/pedidos/${pedidoId}/nfe/emitir`, opcoes, { timeout: 180000 });
      setResultado(data);
      if (data.emitida) {
        if (data.danfe) baixarPdf(data.danfe, `DANFE-${data.numero}.pdf`);
        toast({ titulo: `Nota ${data.numero} autorizada`, descricao: data.danfe ? "A DANFE foi baixada." : data.erroDanfe || "Baixe a DANFE pela NFeMail." });
        onEmitida?.(data);
      } else {
        toast({ titulo: "Nota enviada à NFeMail", descricao: data.status, tipo: "aviso" });
      }
    } catch (e) {
      toast({ titulo: "Erro ao emitir a nota", descricao: mensagemErro(e), tipo: "erro" });
    } finally {
      setEmitindo(false);
    }
  };

  const d = nota?.destino;
  const bloqueada = !nota || nota.bloqueios.length > 0 || carregando;

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={`Emitir nota fiscal${nota ? ` · Pedido ${nota.pedido.numeroFormatado}` : ""}`}
      descricao="Montada com os dados do pedido e as regras fiscais da Gira Kids."
      rodape={
        resultado?.emitida ? (
          <>
            {resultado.danfe && (
              <Button variant="outline" onClick={() => baixarPdf(resultado.danfe, `DANFE-${resultado.numero}.pdf`)}>
                Baixar DANFE de novo
              </Button>
            )}
            <Button onClick={onFechar}>Fechar</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button loading={emitindo} disabled={bloqueada} onClick={emitir}>
              {emitindo ? "Emitindo e aguardando a SEFAZ..." : "Gravar, assinar e transmitir"}
            </Button>
          </>
        )
      }
    >
      {erro && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {!nota && !erro && <Spinner />}
      {resultado && (
        <div className={`mb-4 rounded-md p-3 text-sm ${resultado.emitida ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
          {resultado.emitida ? (
            <>
              ✅ Nota <b>{resultado.numero}</b> autorizada. Chave {resultado.chave}.
              {resultado.erroDanfe && <span className="block">DANFE: {resultado.erroDanfe}</span>}
            </>
          ) : (
            <>⏳ {resultado.status}. Acompanhe na NFeMail (Emissão NFe › Importar mostra erros do arquivo, se houver).</>
          )}
        </div>
      )}
      {nota && !resultado?.emitida && (
        <div className="space-y-5 text-sm">
          {nota.bloqueios.length > 0 && (
            <ul className="space-y-1 rounded-md bg-red-50 p-3 text-red-700">
              {nota.bloqueios.map((b) => (
                <li key={b}>⛔ {b}</li>
              ))}
            </ul>
          )}
          {nota.avisos.length > 0 && (
            <ul className="space-y-1 rounded-md bg-amber-50 p-3 text-amber-800">
              {nota.avisos.map((a) => (
                <li key={a}>⚠️ {a}</li>
              ))}
            </ul>
          )}

          {completarCliente && (
            <section className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <h3 className="mb-1 font-semibold text-amber-900">Complete os dados do cliente</h3>
              <p className="mb-3 text-amber-800">O que você preencher aqui vai na nota e fica salvo no pedido ao emitir.</p>
              <div className="grid gap-3 sm:grid-cols-4">
                {CAMPOS_CLIENTE.map(({ campo, rotulo, largo }) => {
                  const falta = nota.faltando?.includes(campo);
                  const valor = opcoes.cliente?.[campo] ?? d[campo] ?? "";
                  return (
                    <Field key={campo} label={`${rotulo}${falta ? " *" : ""}`} className={largo ? "sm:col-span-2" : ""} erro={falta ? "Obrigatório" : undefined}>
                      <Input
                        value={valor}
                        maxLength={campo === "uf" ? 2 : undefined}
                        onChange={(e) => alterarCliente(campo, campo === "uf" ? e.target.value.toUpperCase() : e.target.value)}
                      />
                    </Field>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 font-semibold">Cliente</h3>
            <p className="font-medium">{d.nome}</p>
            <p className="text-muted-foreground">
              {d.ehCnpj ? "CNPJ" : "CPF"} {d.documento} · {d.cidade}/{d.uf} · CEP {d.cep}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant={d.contribuinte ? "info" : "outline"}>{d.contribuinte ? `Contribuinte · IE ${d.ie}` : "Não contribuinte"}</Badge>
              <Badge variant={d.cadastradoNFeMail ? "success" : "outline"}>{d.cadastradoNFeMail ? "Cadastrado na NFeMail" : "Sem cadastro na NFeMail (vai com os dados do pedido)"}</Badge>
              <Badge variant="outline">CFOP {nota.cfop}</Badge>
              <Badge variant="outline">CSOSN {nota.csosn}</Badge>
            </div>
            {nota.csosn === "101" && (
              <Field label="Alíquota do crédito de ICMS (%)" className="mt-3 w-56">
                <Input value={opcoes.aliquota ?? String(nota.aliquota).replace(".", ",")} onChange={(e) => alterar("aliquota", e.target.value.replace(",", "."))} />
              </Field>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-semibold">Produtos da nota</h3>
            {nota.semVinculo.length > 0 && (
              <div className="mb-3 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-amber-900">Escolha o produto da NFeMail para cada item (fica salvo para as próximas notas):</p>
                {nota.semVinculo.map((p) => (
                  <div key={p.produtoId} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                    <span className="font-medium">{p.nome}</span>
                    <Select value={opcoes.vinculos[p.produtoId] || ""} onChange={(e) => vincular(p.produtoId, e.target.value)}>
                      <option value="">Selecione...</option>
                      {nota.produtosNFeMail.map((n) => (
                        <option key={n.codigo} value={n.codigo}>
                          {n.nome} · NCM {n.ncm}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            )}
            <table className="w-full">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-1 text-left">Descrição</th>
                  <th>NCM</th>
                  <th className="text-right">Qtd</th>
                  <th className="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {nota.itens.map((l) => (
                  <tr key={l.cProd} className="border-b border-border/60">
                    <td className="py-1.5">
                      {l.xProd}
                      <span className="block text-xs text-muted-foreground">{l.produtosSite.join(", ")}</span>
                    </td>
                    <td className="text-center">{l.ncm}</td>
                    <td className="text-right">
                      {l.qCom} {l.unidade}
                    </td>
                    <td className="text-right">{moeda(l.vProd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-right text-muted-foreground">
              Produtos {moeda(nota.totais.vProd)}
              {nota.totais.vDesc > 0 && ` · desconto ${moeda(nota.totais.vDesc)}`}
              {nota.totais.vFrete > 0 && ` · frete ${moeda(nota.totais.vFrete)}`}
              {nota.totais.vOutro > 0 && ` · outras ${moeda(nota.totais.vOutro)}`} · <b className="text-foreground">Total {moeda(nota.totais.vNF)}</b>
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <h3 className="font-semibold sm:col-span-3">Transporte</h3>
            <p className="sm:col-span-3 text-muted-foreground">Transportadora: {nota.transporte.transportadora?.nome || "—"}</p>
            <Field label="Frete">
              <Select value={opcoes.modFrete ?? nota.transporte.modFrete} onChange={(e) => alterar("modFrete", e.target.value)}>
                {Object.entries(MOD_FRETE).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Volumes">
              <Input inputMode="numeric" value={opcoes.qVol ?? String(nota.transporte.qVol)} onChange={(e) => alterar("qVol", e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Peso (kg)">
              <Input value={opcoes.pesoKg ?? String(nota.transporte.pesoB).replace(".", ",")} onChange={(e) => alterar("pesoKg", e.target.value.replace(",", "."))} />
            </Field>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <h3 className="font-semibold sm:col-span-2">Pagamento</h3>
            <Field label="Forma na nota">
              <Select value={opcoes.tPag ?? nota.pagamento.tPag} onChange={(e) => alterar("tPag", e.target.value)}>
                {Object.entries(PAGAMENTOS).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor pago">
              <Input value={moeda(nota.pagamento.vPag)} disabled />
            </Field>
          </section>

          <Field label="Informações adicionais (observações do pedido)">
            <Textarea rows={3} value={opcoes.infCpl ?? nota.infCpl} onChange={(e) => alterar("infCpl", e.target.value)} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
