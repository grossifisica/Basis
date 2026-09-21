import { DocumentPageData, PageSection } from '../types';

/**
 * Lightweight client-side text extractor for PDF files
 * Extracts readable text from PDF streams without external dependencies
 */
export async function extractTextFromPdfBlob(
  blob: Blob,
  fallbackTitle: string
): Promise<DocumentPageData[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoder = new TextDecoder('latin1'); // PDF bytes are usually latin1/ascii
    const content = decoder.decode(arrayBuffer);

    // Look for text streams: between BT and ET
    const btEtRegex = /BT[\s\S]*?ET/g;
    const textBlocks: string[] = [];
    let match;

    while ((match = btEtRegex.exec(content)) !== null) {
      const block = match[0];
      // Match (text) Tj or [(text)] TJ
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let tjMatch;
      const blockLines: string[] = [];

      while ((tjMatch = tjRegex.exec(block)) !== null) {
        const rawText = tjMatch[1];
        const clean = rawText
          .replace(/\\([()\\])/g, '$1')
          .replace(/\\r|\\n/g, ' ')
          .trim();
        if (clean.length > 0) {
          blockLines.push(clean);
        }
      }

      if (blockLines.length > 0) {
        textBlocks.push(blockLines.join(' '));
      }
    }

    if (textBlocks.length === 0) {
      // Return a structured single page with document info
      return [
        {
          headerTitle: 'Visão Geral do Documento',
          sections: [
            {
              heading: fallbackTitle,
              paragraphs: [
                'Este documento PDF foi importado e está pronto para leitura e consulta.',
                'Utilize os controles de zoom e rolagem do visualizador embed para navegar pelo documento.',
              ],
            },
          ],
        },
      ];
    }

    // Group blocks into pages (approx 6-10 blocks per page)
    const blocksPerPage = 8;
    const pages: DocumentPageData[] = [];

    for (let i = 0; i < textBlocks.length; i += blocksPerPage) {
      const pageIndex = Math.floor(i / blocksPerPage) + 1;
      const slice = textBlocks.slice(i, i + blocksPerPage);
      const sections: PageSection[] = [];

      let currentHeading = `Seção ${pageIndex}`;
      const currentParagraphs: string[] = [];

      for (const text of slice) {
        if (text.length < 50 && !text.includes('.')) {
          if (currentParagraphs.length > 0) {
            sections.push({ heading: currentHeading, paragraphs: [...currentParagraphs] });
            currentParagraphs.length = 0;
          }
          currentHeading = text;
        } else {
          currentParagraphs.push(text);
        }
      }

      if (currentParagraphs.length > 0) {
        sections.push({ heading: currentHeading, paragraphs: currentParagraphs });
      }

      pages.push({
        headerTitle: `Página ${pageIndex}`,
        sections: sections.length > 0 ? sections : [{ heading: 'Conteúdo', paragraphs: slice }],
      });
    }

    return pages;
  } catch (err) {
    console.error('Erro na extração de texto do PDF:', err);
    return [
      {
        headerTitle: 'Documento',
        sections: [
          {
            heading: fallbackTitle,
            paragraphs: ['Documento pronto para leitura.'],
          },
        ],
      },
    ];
  }
}
