// Utility to generate authentic, multi-page valid PDF-1.4 documents client-side
// Completely standalone without third-party heavy dependencies

interface PageContent {
  headerTitle: string;
  sections: Array<{
    heading?: string;
    paragraphs: string[];
  }>;
}

function escapePdfText(str: string): string {
  // Replace characters not in standard ASCII or PDF standard encoding
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents for clean standard PDF Type 1 font encoding
}

export function buildStandardPdf(
  docTitle: string,
  docAuthor: string,
  pages: PageContent[]
): Blob {
  // We will construct objects:
  // 1 0 obj: Catalog
  // 2 0 obj: Pages
  // Font F1 (Helvetica-Bold)
  // Font F2 (Helvetica)
  // Page objects & Content stream objects

  const objects: string[] = [];
  const pageObjectIndices: number[] = [];
  
  // Placeholder for catalog and pages
  // We'll calculate object IDs:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica-Bold)
  // 4: Font F2 (Helvetica)
  // Next objects: pairs of (Page object, Content stream) for each page

  const fontBoldId = 3;
  const fontRegularId = 4;
  let nextId = 5;

  const pageEntries: Array<{ pageId: number; contentId: number; contentStream: string }> = [];

  for (let i = 0; i < pages.length; i++) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjectIndices.push(pageId);

    const pageData = pages[i];
    const streamCommands: string[] = [];

    // Page dimensions: A4 (595.28 x 841.89 pt)
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;

    // Header bar decoration
    streamCommands.push('0.92 0.94 0.96 rg'); // light gray background for top header accent
    streamCommands.push(`0 ${pageHeight - 45} ${pageWidth} 45 re f`);
    streamCommands.push('0.15 0.23 0.35 rg'); // deep slate blue line
    streamCommands.push(`0 ${pageHeight - 47} ${pageWidth} 2 re f`);

    // Header text
    streamCommands.push('BT');
    streamCommands.push(`/${'F1'} 10 Tf`);
    streamCommands.push('0.3 0.35 0.45 rg');
    streamCommands.push(`${margin} ${pageHeight - 28} Td`);
    streamCommands.push(`(${escapePdfText(docTitle.toUpperCase())} - ${escapePdfText(pageData.headerTitle)}) Tj`);
    streamCommands.push('ET');

    // Footer decoration & page number
    streamCommands.push('0.85 0.88 0.92 RG');
    streamCommands.push(`0.5 w`);
    streamCommands.push(`${margin} 45 m ${pageWidth - margin} 45 l S`);

    streamCommands.push('BT');
    streamCommands.push(`/${'F2'} 9 Tf`);
    streamCommands.push('0.4 0.45 0.5 rg');
    streamCommands.push(`${margin} 30 Td`);
    streamCommands.push(`(${escapePdfText(`Autor: ${docAuthor}  |  Biblioteca Digital de PDFs`)}) Tj`);
    streamCommands.push('ET');

    streamCommands.push('BT');
    streamCommands.push(`/${'F1'} 9 Tf`);
    streamCommands.push('0.2 0.25 0.35 rg');
    streamCommands.push(`${pageWidth - margin - 55} 30 Td`);
    streamCommands.push(`(${escapePdfText(`Pagina ${i + 1} de ${pages.length}`)}) Tj`);
    streamCommands.push('ET');

    // Page body contents
    let currentY = pageHeight - 90;

    for (const section of pageData.sections) {
      if (section.heading) {
        currentY -= 16;
        streamCommands.push('BT');
        streamCommands.push(`/${'F1'} 15 Tf`);
        streamCommands.push('0.08 0.12 0.2 rg');
        streamCommands.push(`${margin} ${currentY} Td`);
        streamCommands.push(`(${escapePdfText(section.heading)}) Tj`);
        streamCommands.push('ET');
        currentY -= 14;

        // Accent line under heading
        streamCommands.push('0.2 0.4 0.8 RG');
        streamCommands.push('1.5 w');
        streamCommands.push(`${margin} ${currentY + 6} m ${margin + 120} ${currentY + 6} l S`);
        currentY -= 10;
      }

      for (const p of section.paragraphs) {
        currentY -= 10;
        // Word wrap simulation into lines of approx 75 chars
        const words = p.split(' ');
        let line = '';

        for (const w of words) {
          if ((line + ' ' + w).length > 74) {
            streamCommands.push('BT');
            streamCommands.push(`/${'F2'} 11 Tf`);
            streamCommands.push('0.2 0.22 0.26 rg');
            streamCommands.push(`${margin} ${currentY} Td`);
            streamCommands.push(`(${escapePdfText(line.trim())}) Tj`);
            streamCommands.push('ET');
            currentY -= 15;
            line = w;
          } else {
            line = line ? line + ' ' + w : w;
          }
        }

        if (line.trim()) {
          streamCommands.push('BT');
          streamCommands.push(`/${'F2'} 11 Tf`);
          streamCommands.push('0.2 0.22 0.26 rg');
          streamCommands.push(`${margin} ${currentY} Td`);
          streamCommands.push(`(${escapePdfText(line.trim())}) Tj`);
          streamCommands.push('ET');
          currentY -= 15;
        }

        currentY -= 6;
      }
      currentY -= 10;
    }

    const streamData = streamCommands.join('\n');
    pageEntries.push({
      pageId,
      contentId,
      contentStream: streamData,
    });
  }

  // Construct standard PDF objects
  // 1: Catalog
  const catalogObj = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  // 2: Pages
  const kidsStr = pageObjectIndices.map((id) => `${id} 0 R`).join(' ');
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>\nendobj\n`;
  // 3: Font F1 (Helvetica-Bold)
  const font1Obj = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;
  // 4: Font F2 (Helvetica)
  const font2Obj = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  const bodyParts: string[] = [catalogObj, pagesObj, font1Obj, font2Obj];

  for (const entry of pageEntries) {
    // Page obj
    const pageObj = `${entry.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${entry.contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n`;
    // Content obj
    const streamBytes = entry.contentStream.length;
    const contentObj = `${entry.contentId} 0 obj\n<< /Length ${streamBytes} >>\nstream\n${entry.contentStream}\nendstream\nendobj\n`;

    bodyParts.push(pageObj);
    bodyParts.push(contentObj);
  }

  // Assemble full PDF with offsets
  const header = `%PDF-1.4\n%âãÏÓ\n`;
  let currentOffset = header.length;
  const offsets: number[] = [0]; // object 0 is dummy

  for (let i = 0; i < bodyParts.length; i++) {
    offsets.push(currentOffset);
    currentOffset += bodyParts[i].length;
  }

  // Xref table
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    const padded = String(offsets[i]).padStart(10, '0');
    xref += `${padded} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${currentOffset}\n%%EOF`;

  const fullPdfString = header + bodyParts.join('') + xref + trailer;

  return new Blob([fullPdfString], { type: 'application/pdf' });
}

// Pre-defined sample documents for instant exploration
export function getSampleDocumentsData() {
  return [
    {
      id: 'doc-manual-plataforma',
      title: 'Guia Rapido da Biblioteca de PDFs',
      author: 'Equipe de Documentacao',
      category: 'Manuais',
      description: 'Aprenda a consultar o catalogo, ler documentos em tela cheia, adicionar anotacoes e disponibilizar novos arquivos PDF na plataforma.',
      tags: ['Manual', 'Tutorial', 'Ajuda', 'Produtividade'],
      pages: [
        {
          headerTitle: 'Visao Geral do Sistema',
          sections: [
            {
              heading: '1. Bem-vindo a Plataforma de PDFs',
              paragraphs: [
                'Esta aplicacao foi projetada para oferecer uma experiencia agil, moderna e confortavel para a publicacao, gestao e leitura de documentos no formato PDF.',
                'Todos os documentos cadastrados ficam organizados em um catalogo intuitivo, permitindo busca textual imediata, filtros por categorias e marcacao de favoritos.',
                'O leitor integrado permite visualizar o conteudo diretamente no seu navegador, sem necessidade de softwares externos adicionais.'
              ]
            },
            {
              heading: '2. Como Disponibilizar Novos Documentos',
              paragraphs: [
                'Para adicionar um novo arquivo a plataforma, basta clicar no botao "Disponibilizar PDF" localizado no topo da pagina.',
                'Voce pode arrastar um arquivo PDF do seu computador ou seleciona-lo manualmente. Em seguida, preencha o titulo, autor, categoria e uma descricao resumida.',
                'Seus documentos enviados sao armazenados de forma persistente e segura no banco de dados local do seu navegador (IndexedDB), garantindo total privacidade e funcionamento offline.'
              ]
            }
          ]
        },
        {
          headerTitle: 'Recursos do Leitor',
          sections: [
            {
              heading: '3. Funcionalidades do Leitor Integrado',
              paragraphs: [
                'O leitor de PDFs inclui ferramentas dedicadas para facilitar sua sessao de leitura:',
                'Controles de zoom (aumentar, diminuir, ajuste automatico de largura)',
                'Alternador de visualizacao em tela cheia para evitar distracoes visuais',
                'Navegacao rapida entre outros documentos da lista sem precisar fechar o leitor',
                'Opcao de download do arquivo PDF e visualizacao embed com alta resolucao no proprio app.'
              ]
            },
            {
              heading: '4. Dicas para Melhor Experiencia',
              paragraphs: [
                'Voce pode alternar entre a exibicao em Grade (Cards) e Lista detalhada atraves do icone de visualizacao no cabecalho.',
                'Utilize o campo de busca no topo para encontrar documentos rapidamente por palavras-chave presentes no titulo ou nas etiquetas (tags).'
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'doc-design-interfaces',
      title: 'Principios de Design e Tipografia Digital',
      author: 'Mariana Duarte - Designer de Produto',
      category: 'Design',
      description: 'Fundamentos de hierarquia visual, contraste, espacamento modular e escolha de fontes para aplicacoes modernas.',
      tags: ['Design', 'UI/UX', 'Tipografia', 'Boas Praticas'],
      pages: [
        {
          headerTitle: 'Hierarquia e Espaco',
          sections: [
            {
              heading: '1. O Papel do Espaco em Branco',
              paragraphs: [
                'O espaco em branco (ou espaco negativo) nao e apenas uma area vazia; e um elemento de composicao fundamental. Ele define grupos de afinidade, reduz a carga cognitiva do leitor e guia o fluxo natural dos olhos.',
                'Ao diagramar documentos e interfaces digitais, evite preencher cada pixel com elementos decorativos desnecessarios. Respeite o respiro tipografico.'
              ]
            },
            {
              heading: '2. Escala Tipografica Modular',
              paragraphs: [
                'Utilizar relacoes matematicas fixas entre o tamanho do corpo de texto e os subtitulos (como a proporcao Major Second 1.125 ou Perfect Fourth 1.333) cria harmonia e autoridade visual automatica.',
                'Mantenha sempre contraste de cor acessivel (WCAG AA minimo de 4.5:1 para leitura confortavel).'
              ]
            }
          ]
        },
        {
          headerTitle: 'Contraste e Legibilidade',
          sections: [
            {
              heading: '3. Escolha de Fontes e Largura de Coluna',
              paragraphs: [
                'Para blocos longos de texto, limite a largura das linhas entre 60 e 75 caracteres. Linhas excessivamente longas cansam a visao durante a mudanca de linha.',
                'A altura de linha (line-height) ideal para textos em tela varia entre 1.5 e 1.7 vezes o tamanho da fonte.'
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'doc-seguranca-digital',
      title: 'Manual de Seguranca Digital e Privacidade',
      author: 'Carlos Andrade - Especialista em Seguranca',
      category: 'Seguranca',
      description: 'Diretrizes essenciais sobre autenticacao forte, gestao de credenciais, criptografia e protecao de dados corporativos.',
      tags: ['Seguranca', 'Tecnologia', 'Privacidade', 'LGPD'],
      pages: [
        {
          headerTitle: 'Protecao de Acessos',
          sections: [
            {
              heading: '1. Autenticacao Multifator (MFA)',
              paragraphs: [
                'Senhas isoladas nao oferecem protecao suficiente contra ataques ciberneticos modernos. A adocao de um segundo fator de autenticacao (como chaves de seguranca FIDO2 ou aplicativos de codigo temporal) reduz em mais de 99% o risco de comprometimento de contas.',
                'Nunca compartilhe codigos de verificacao recebidos por mensagem ou email com terceiros.'
              ]
            },
            {
              heading: '2. Politica de Armazenamento e Backups',
              paragraphs: [
                'Documentos sensiveis e relatorios confidenciais devem ser mantidos em locais com criptografia em repouso e durante o transito (HTTPS/TLS 1.3).',
                'Realize backups periodicos seguindo a regra 3-2-1: tres copias dos dados, em duas midias distintas, sendo uma delas em local geograficamente isolado.'
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'doc-gestao-tempo',
      title: 'Metodos Ageis de Produtividade e Foco',
      author: 'Renato Silveira - Consultor de Gestao',
      category: 'Produtividade',
      description: 'Tecnicas comprovadas como Pomodoro, Matriz de Eisenhower e Time Blocking para otimizar a rotina de trabalho.',
      tags: ['Foco', 'Gestao', 'Carreira', 'Organizacao'],
      pages: [
        {
          headerTitle: 'Priorizacao Eficaz',
          sections: [
            {
              heading: '1. A Matriz de Decisao Urgente vs. Importante',
              paragraphs: [
                'A maioria dos profissionais gasta o dia reagindo a demandas que sao urgentes, mas de baixo impacto estrategico. O verdadeiro progresso ocorre quando dedicamos blocos consistentes de foco a tarefas importantes e nao urgentes.',
                'Planeje as atividades do dia seguinte no final do expediente anterior para iniciar cada manha com clareza imediata.'
              ]
            },
            {
              heading: '2. Blocos de Foco Imersivo (Deep Work)',
              paragraphs: [
                'Desative notificacoes de mensagens e redes sociais durante ciclos de trabalho profundo de 45 a 90 minutos. O cérebro humano necessita de ate 20 minutos para recuperar o nivel otimo de concentracao apos uma simples interrupcao.'
              ]
            }
          ]
        }
      ]
    }
  ];
}
