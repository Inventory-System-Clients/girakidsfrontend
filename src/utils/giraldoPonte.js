// Ponte entre o Giraldo e a tela do carrinho (checkout).
// - O checkout publica o que está na tela (entrega, pagamento, frete, dados
//   que faltam) para o Giraldo saber onde o cliente está.
// - O Giraldo manda comandos (escolher entrega, pagamento, parcelas, CEP,
//   preencher dados, finalizar). Se o carrinho ainda não está aberto, o
//   comando espera e é aplicado assim que a tela abrir.
const alvo = new EventTarget();
let estadoCheckout = null;
let pendentes = [];
let ouvintes = 0;

export const publicarCheckout = (estado) => {
  estadoCheckout = estado;
};

export const lerCheckout = () => estadoCheckout;

export const pedirAoCheckout = (comando) => {
  if (!ouvintes) {
    pendentes.push(comando);
    return;
  }
  alvo.dispatchEvent(new CustomEvent("comando", { detail: comando }));
};

export const ouvirComandosGiraldo = (fn) => {
  const handler = (e) => fn(e.detail);
  alvo.addEventListener("comando", handler);
  ouvintes += 1;
  const fila = pendentes;
  pendentes = [];
  // Aplica na ordem os comandos que chegaram antes da tela abrir.
  setTimeout(() => fila.forEach((c) => fn(c)), 0);
  return () => {
    alvo.removeEventListener("comando", handler);
    ouvintes -= 1;
    estadoCheckout = null;
  };
};
