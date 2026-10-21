/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { cx } from "./ui";
import { somenteDigitos } from "../utils/format";

let numeroComercialCache = null;

// WhatsApp do comercial (configurável; padrão 11 94205-8445).
export function useWhatsappComercial() {
  const [numero, setNumero] = useState(numeroComercialCache || "5511942058445");
  useEffect(() => {
    if (numeroComercialCache) return;
    api
      .get("/config/publica")
      .then(({ data }) => {
        numeroComercialCache = data.whatsappComercial;
        setNumero(data.whatsappComercial);
      })
      .catch(() => {});
  }, []);
  return numero;
}

export const linkWhatsapp = (telefone, texto = "") => {
  let d = somenteDigitos(telefone);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
};

export function IconeWhatsapp({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.42-9.44 9.42m8.03-17.45A11.33 11.33 0 0 0 12.05.7C5.8.7.7 5.79.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.3l5.7-1.5a11.32 11.32 0 0 0 5.75 1.47h.01c6.26 0 11.36-5.09 11.36-11.36 0-3.04-1.18-5.89-3.33-8.04" />
    </svg>
  );
}

export function BotaoWhatsapp({ telefone, texto, children, className, variante = "verde" }) {
  return (
    <a
      href={linkWhatsapp(telefone, texto)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
        variante === "verde" ? "bg-[#25D366] text-white hover:brightness-95" : "border border-[#25D366] text-[#128C7E] hover:bg-emerald-50",
        className,
      )}
    >
      <IconeWhatsapp className="h-4 w-4" />
      {children}
    </a>
  );
}

// Botão flutuante para clientes e visitantes falarem com o comercial.
export function WhatsappFlutuante() {
  const { interno, usuario } = useAuth();
  const numero = useWhatsappComercial();
  if (interno) return null;
  const texto = `Olá! Vim pelo catálogo da Gira Kids${usuario ? ` (${usuario.nome})` : ""} e gostaria de falar com o comercial.`;
  return (
    <a
      href={linkWhatsapp(numero, texto)}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com o comercial no WhatsApp"
      className="no-print fixed right-5 bottom-28 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
    >
      <IconeWhatsapp className="h-7 w-7" />
    </a>
  );
}
