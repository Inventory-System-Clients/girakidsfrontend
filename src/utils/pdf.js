import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { data, moeda, moedaUnitaria, mascaraDocumento, pesoKg } from "./format";
import { METODOS_ENVIO, nomeForma } from "./status";

const ROSA = [244, 63, 94];

const carregarLogo = () =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = "/logo.webp";
  });

// PDF de pedido ou orçamento (Baixar PDF / Salvar orçamento e gerar PDF).
export const gerarPdfPedido = async (pedido) => {
  const doc = new jsPDF();
  const orcamento = pedido.tipo === "ORCAMENTO";
  const logo = await carregarLogo();
  if (logo) doc.addImage(logo, "PNG", 14, 10, 18, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Gira Kids", 36, 18);
  doc.setFontSize(11);
  doc.setTextColor(...ROSA);
  doc.text(`${orcamento ? "Orçamento" : "Pedido"} ${pedido.numeroFormatado}`, 36, 25);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Emitido em ${data(pedido.createdAt)}`, 196, 18, { align: "right" });

  const endereco = [pedido.rua, pedido.numeroEndereco, pedido.complemento].filter(Boolean).join(", ");
  const linhasCliente = [
    `Cliente: ${pedido.clienteNome}`,
    pedido.documento ? `${pedido.documentoTipo || "Documento"}: ${mascaraDocumento(pedido.documento)}` : null,
    [pedido.clienteEmail, pedido.clienteTelefone].filter(Boolean).join(" • "),
    endereco ? `${endereco} - ${pedido.bairro || ""} - ${pedido.cidade || ""}/${pedido.estado || ""} - CEP ${pedido.cep || ""}` : null,
    `Entrega: ${METODOS_ENVIO[pedido.metodoEnvio] || "A definir"}${pedido.prazoEntregaDias ? ` (${pedido.prazoEntregaDias} dias úteis)` : ""} • Peso: ${pesoKg(pedido.pesoTotalGramas)}`,
    `Pagamento: ${nomeForma(pedido.formaPagamento)}${pedido.parcelasCartao ? ` em ${pedido.parcelasCartao}x` : ""}`,
  ].filter(Boolean);
  doc.setFontSize(10);
  linhasCliente.forEach((l, i) => doc.text(doc.splitTextToSize(l, 180), 14, 38 + i * 6));

  autoTable(doc, {
    startY: 40 + linhasCliente.length * 6,
    head: [["Produto", "SKU", "Emb.", "Qtd (un)", "Preço un.", "Subtotal"]],
    body: pedido.itens.map((i) => [
      `${i.nome}${i.categoria ? `\n${i.categoria}` : ""}`,
      i.sku || "-",
      i.quantidade,
      i.quantidade * i.unidadesPacote,
      moedaUnitaria(i.precoUnitario),
      moeda(i.total),
    ]),
    headStyles: { fillColor: ROSA },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  let y = doc.lastAutoTable.finalY + 8;
  const totais = [
    ["Subtotal dos produtos", moeda(pedido.subtotal)],
    pedido.desconto > 0 && ["Desconto", `- ${moeda(pedido.desconto)}`],
    pedido.creditoUsado > 0 && ["Crédito utilizado", `- ${moeda(pedido.creditoUsado)}`],
    ["Frete", pedido.frete > 0 ? moeda(pedido.frete) : pedido.metodoEnvio === "RETIRAR_LOCAL" ? "Grátis" : "A definir"],
    pedido.freteAdicional > 0 && ["Custo adicional", moeda(pedido.freteAdicional)],
    pedido.taxas > 0 && ["Taxas", moeda(pedido.taxas)],
    ["Total", moeda(pedido.total)],
  ].filter(Boolean);
  totais.forEach(([rotulo, valor], i) => {
    const ultimo = i === totais.length - 1;
    doc.setFont("helvetica", ultimo ? "bold" : "normal");
    doc.setFontSize(ultimo ? 12 : 10);
    doc.text(rotulo, 140, y, { align: "right" });
    doc.text(valor, 196, y, { align: "right" });
    y += ultimo ? 8 : 6;
  });
  if (pedido.observacoes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(`Observações: ${pedido.observacoes}`, 180), 14, y + 4);
  }
  if (orcamento) {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Orçamento sujeito à disponibilidade de estoque. Valores podem ser alterados sem aviso prévio.", 105, 287, { align: "center" });
  }
  doc.save(`${orcamento ? "orcamento" : "pedido"}-${pedido.numeroFormatado}.pdf`);
};
