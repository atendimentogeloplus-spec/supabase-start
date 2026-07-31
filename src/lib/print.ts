export async function printElement(elementId: string, title = "Impressão") {
  const sourceElement = document.getElementById(elementId);

  if (!sourceElement) {
    throw new Error("Elemento de impressão não encontrado.");
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    iframe.remove();
    throw new Error("Não foi possível iniciar a impressão.");
  }

  const printDocument = printWindow.document;
  const markup = sourceElement.outerHTML;
  printDocument.open();
  printDocument.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            width: 210mm;
          }

          body {
            padding: 0;
            overflow: hidden;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          #print-root {
            width: 100%;
          }

          img {
            max-width: 100%;
            height: auto;
            image-rendering: auto;
          }
        </style>
      </head>
      <body>
        <div id="print-root">${markup}</div>
      </body>
    </html>
  `);
  printDocument.close();

  await Promise.all(
    Array.from(printDocument.images).map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
            })
    )
  );

  await new Promise((resolve) => printWindow.requestAnimationFrame(() => resolve(null)));

  const cleanup = () => {
    iframe.remove();
  };

  printWindow.addEventListener("afterprint", cleanup, { once: true });
  printWindow.focus();
  printWindow.print();
  setTimeout(cleanup, 500);
}
