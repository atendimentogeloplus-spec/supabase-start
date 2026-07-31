import { toPng } from "html-to-image";
import { toast } from "sonner";

/**
 * Normaliza um número de WhatsApp para o formato internacional sem símbolos.
 * Assume Brasil (+55) quando o número não inclui código de país.
 */
export function normalizeWhatsApp(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

async function waitForCloneAssets(root: HTMLElement) {
  await document.fonts?.ready?.catch(() => undefined);

  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );
}

function createCleanCaptureClone(source: HTMLElement) {
  const sourceWidth = source.offsetWidth || Math.round(source.getBoundingClientRect().width) || 768;
  const captureWidth = Math.min(Math.max(sourceWidth, 640), 900);
  const container = document.createElement("div");
  const clone = source.cloneNode(true) as HTMLElement;

  clone.removeAttribute("id");
  clone.querySelectorAll(".no-print").forEach((node) => node.remove());

  Object.assign(container.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${captureWidth}px`,
    margin: "0",
    padding: "0",
    background: "#ffffff",
    overflow: "visible",
    pointerEvents: "none",
    transform: "none",
  });

  Object.assign(clone.style, {
    width: `${captureWidth}px`,
    maxWidth: "none",
    margin: "0",
    background: "#ffffff",
    color: "#111111",
    overflow: "visible",
    transform: "none",
    transformOrigin: "top left",
  });

  clone.querySelectorAll<HTMLElement>("table").forEach((table) => {
    table.style.width = "100%";
    table.style.tableLayout = "fixed";
    table.style.borderCollapse = "collapse";
  });

  clone.querySelectorAll<HTMLElement>("th, td").forEach((cell) => {
    cell.style.whiteSpace = "normal";
    cell.style.overflowWrap = "anywhere";
    cell.style.wordBreak = "break-word";
    cell.style.verticalAlign = "top";
  });

  container.appendChild(clone);
  document.body.appendChild(container);

  return { clone, container, width: captureWidth };
}

/**
 * Captura um elemento DOM como PNG e tenta compartilhar diretamente
 * via Web Share API (ideal em mobile, abre o WhatsApp do cliente já com o arquivo).
 * No desktop, faz fallback: baixa a imagem e abre a conversa no WhatsApp Web.
 */
export async function shareReportOnWhatsApp(opts: {
  elementId: string;
  fileName: string;
  whatsapp?: string | null;
  message: string;
}) {
  const { elementId, fileName, whatsapp, message } = opts;
  const phone = normalizeWhatsApp(whatsapp);

  if (!phone) {
    toast.error("Cliente sem WhatsApp cadastrado.");
    return;
  }

  const el = document.getElementById(elementId);
  if (!el) {
    toast.error("Não foi possível localizar o relatório.");
    return;
  }

  const loadingId = toast.loading("Gerando imagem do relatório...");

  try {
    const { clone, container, width } = createCleanCaptureClone(el);
    let dataUrl = "";
    try {
      await waitForCloneAssets(clone);
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      dataUrl = await toPng(clone, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        width,
        height: clone.scrollHeight,
        style: {
          width: `${width}px`,
          maxWidth: "none",
          margin: "0",
          transform: "none",
          transformOrigin: "top left",
          overflow: "visible",
        },
      });
    } finally {
      container.remove();
    }

    const file = await dataUrlToFile(dataUrl, `${fileName}.png`);

    // Tenta compartilhamento nativo com arquivo (mobile principalmente)
    const navAny = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };

    const canShareFile =
      typeof navAny.canShare === "function" &&
      typeof navAny.share === "function" &&
      navAny.canShare({ files: [file] });

    if (canShareFile) {
      try {
        await navAny.share!({
          files: [file],
          title: fileName,
          text: message,
        });
        toast.dismiss(loadingId);
        toast.success("Relatório compartilhado!");
        return;
      } catch (err: unknown) {
        // Usuário cancelou — não cai no fallback
        const e = err as { name?: string };
        if (e?.name === "AbortError") {
          toast.dismiss(loadingId);
          return;
        }
        // Outros erros: segue para o fallback abaixo
        console.warn("Web Share falhou, usando fallback:", err);
      }
    }

    // Fallback (desktop ou navegador sem suporte): baixa imagem + abre conversa
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    toast.dismiss(loadingId);
    toast.success("Imagem baixada! Anexe no WhatsApp que será aberto.");

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isMobile
      ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
      : `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (err) {
    console.error("Erro ao gerar imagem do relatório:", err);
    toast.dismiss(loadingId);
    toast.error("Falha ao gerar imagem do relatório.");
  }
}
