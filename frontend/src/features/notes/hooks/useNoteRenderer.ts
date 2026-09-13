import { useEffect, RefObject } from 'react';
import katex from 'katex';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
import mermaid from 'mermaid';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { NOTE_THEMES } from '../../../constants';

// Curated theme palettes with translucent background fills and matching vibrant borders
export const MERMAID_PALETTES: Record<string, { fill: string; stroke: string; text: string }[]> = {
  amber: [
    { fill: 'rgba(254, 243, 199, 0.72)', stroke: '#f59e0b', text: '#78350f' },
    { fill: 'rgba(255, 237, 213, 0.72)', stroke: '#f97316', text: '#7c2d12' },
    { fill: 'rgba(254, 252, 232, 0.72)', stroke: '#eab308', text: '#713f12' },
    { fill: 'rgba(240, 253, 244, 0.72)', stroke: '#10b981', text: '#14532d' },
    { fill: 'rgba(239, 246, 255, 0.72)', stroke: '#3b82f6', text: '#1e3a8a' },
    { fill: 'rgba(250, 245, 255, 0.72)', stroke: '#a855f7', text: '#581c87' },
  ],
  cobalt: [
    { fill: 'rgba(219, 234, 254, 0.72)', stroke: '#3b82f6', text: '#1e3a8a' },
    { fill: 'rgba(224, 242, 254, 0.72)', stroke: '#0284c7', text: '#0c4a6e' },
    { fill: 'rgba(238, 242, 255, 0.72)', stroke: '#6366f1', text: '#312e81' },
    { fill: 'rgba(240, 253, 250, 0.72)', stroke: '#14b8a6', text: '#134e4a' },
    { fill: 'rgba(245, 243, 255, 0.72)', stroke: '#8b5cf6', text: '#4c1d95' },
    { fill: 'rgba(254, 242, 242, 0.72)', stroke: '#f43f5e', text: '#881337' },
  ],
  emerald: [
    { fill: 'rgba(209, 250, 229, 0.72)', stroke: '#10b981', text: '#064e3b' },
    { fill: 'rgba(204, 251, 241, 0.72)', stroke: '#14b8a6', text: '#134e4a' },
    { fill: 'rgba(236, 253, 245, 0.72)', stroke: '#059669', text: '#065f46' },
    { fill: 'rgba(254, 243, 199, 0.72)', stroke: '#f59e0b', text: '#78350f' },
    { fill: 'rgba(224, 242, 254, 0.72)', stroke: '#0284c7', text: '#0c4a6e' },
    { fill: 'rgba(255, 237, 213, 0.72)', stroke: '#f97316', text: '#7c2d12' },
  ],
  coral: [
    { fill: 'rgba(255, 237, 213, 0.72)', stroke: '#f97316', text: '#7c2d12' },
    { fill: 'rgba(254, 243, 199, 0.72)', stroke: '#f59e0b', text: '#78350f' },
    { fill: 'rgba(254, 226, 226, 0.72)', stroke: '#ef4444', text: '#7f1d1d' },
    { fill: 'rgba(255, 228, 230, 0.72)', stroke: '#f43f5e', text: '#881337' },
    { fill: 'rgba(254, 249, 195, 0.72)', stroke: '#eab308', text: '#713f12' },
    { fill: 'rgba(243, 232, 255, 0.72)', stroke: '#a855f7', text: '#581c87' },
  ],
  violet: [
    { fill: 'rgba(243, 232, 255, 0.72)', stroke: '#a855f7', text: '#581c87' },
    { fill: 'rgba(238, 242, 255, 0.72)', stroke: '#818cf8', text: '#312e81' },
    { fill: 'rgba(253, 232, 248, 0.72)', stroke: '#ec4899', text: '#701a75' },
    { fill: 'rgba(219, 234, 254, 0.72)', stroke: '#3b82f6', text: '#1e3a8a' },
    { fill: 'rgba(209, 250, 229, 0.72)', stroke: '#10b981', text: '#064e3b' },
    { fill: 'rgba(255, 237, 213, 0.72)', stroke: '#f97316', text: '#7c2d12' },
  ],
};

export function applyTranslucentColorPaletteToSvg(svgEl: SVGSVGElement | HTMLElement, themeId: string): void {
  if (!svgEl) return;
  const palette = MERMAID_PALETTES[themeId] || MERMAID_PALETTES.amber;
  const nodeGroups = svgEl.querySelectorAll('g.node, g.actor');

  nodeGroups.forEach((nodeGroup, index) => {
    const color = palette[index % palette.length];

    // Apply translucent fill and crisp matching stroke to node shape (rect, polygon, circle, path)
    const shapes = nodeGroup.querySelectorAll('rect, polygon, circle, path');
    shapes.forEach((shape) => {
      if (!shape.closest('.label') && !shape.classList.contains('arrowhead') && !shape.classList.contains('flowchart-link')) {
        const svgShape = shape as SVGElement;
        svgShape.style.fill = color.fill;
        svgShape.style.stroke = color.stroke;
        svgShape.style.strokeWidth = '1.75px';
        svgShape.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.04))';
        if (shape.tagName.toLowerCase() === 'rect') {
          shape.setAttribute('rx', '8');
          shape.setAttribute('ry', '8');
        }
      }
    });

    // Make text readable, bold, high-contrast, and prevent clipping
    const labelElements = nodeGroup.querySelectorAll('.label div, .label span, .label p, text');
    labelElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.color = color.text;
      htmlEl.style.fontWeight = '600';
      htmlEl.style.fontSize = '12px';
      htmlEl.style.lineHeight = '1.35';
      htmlEl.style.textAlign = 'center';
      htmlEl.style.wordBreak = 'normal';
      htmlEl.style.overflowWrap = 'break-word';
    });
  });

  // Ensure all foreignObjects and labels inside SVG have visible overflow
  const foreignObjects = svgEl.querySelectorAll('foreignObject, .label, .node');
  foreignObjects.forEach((fo) => {
    (fo as HTMLElement).style.overflow = 'visible';
  });

  // Style subgraphs / clusters with subtle translucent slate background
  const clusters = svgEl.querySelectorAll('g.cluster rect');
  clusters.forEach((cluster) => {
    const svgCluster = cluster as SVGElement;
    svgCluster.style.fill = 'rgba(248, 250, 252, 0.85)';
    svgCluster.style.stroke = '#cbd5e1';
    svgCluster.style.strokeWidth = '1.5px';
    svgCluster.style.strokeDasharray = '4 4';
    svgCluster.setAttribute('rx', '10');
    svgCluster.setAttribute('ry', '10');
  });
}

export function useNoteRenderer({
  containerRef,
  renderedHtml,
  activeThemeId,
  isStreaming = false,
  selectedChunks = [],
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  renderedHtml: string;
  activeThemeId: string;
  isStreaming?: boolean;
  selectedChunks?: string[];
}): void {
  const selectedTheme = NOTE_THEMES.find((t) => t.id === activeThemeId) || NOTE_THEMES[0];

  // 1. Render Math, Code Highlighting, and Mermaid Flowcharts
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // A. Render inline and display math formulas via KaTeX auto-render
    try {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoredClasses: ['katex', 'no-mathjax'],
      });
    } catch (e) {
      console.warn('KaTeX auto-render error:', e);
    }

    // B. Render explicit math containers
    const mathElements = container.querySelectorAll('.math-block, .math, .equation, [data-latex]');
    mathElements.forEach((el) => {
      try {
        if (!el.querySelector('.katex')) {
          const latex = el.getAttribute('data-latex') || el.textContent || '';
          const isDisplay = el.tagName === 'DIV' || el.classList.contains('math-block') || el.classList.contains('equation');
          el.innerHTML = katex.renderToString(latex, { displayMode: isDisplay, throwOnError: false });
        }
      } catch (e) {
        console.warn('KaTeX explicit rendering error:', e);
      }
    });

    // C. Highlight code snippets
    try {
      Prism.highlightAllUnder(container);
    } catch (e) {
      console.warn('Prism highlighting error:', e);
    }

    // D. Render Mermaid Flowcharts safely with dynamic theme palette support
    if (!isStreaming) {
      const renderMermaidDiagrams = async () => {
        try {
          if (!containerRef.current) return;
          const mermaidNodes = Array.from(
            containerRef.current.querySelectorAll('.mermaid, pre code.language-mermaid, pre.language-mermaid')
          );

          if (mermaidNodes.length > 0) {
            mermaid.initialize({
              startOnLoad: false,
              theme: 'neutral',
              securityLevel: 'loose',
              suppressErrorRendering: true,
              flowchart: {
                curve: 'basis',
                padding: 24,
                nodeSpacing: 45,
                rankSpacing: 40,
                htmlLabels: true,
                useMaxWidth: true,
              },
              themeVariables: {
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontSize: '12.5px',
                primaryColor: '#f8fafc',
                primaryBorderColor: '#cbd5e1',
                primaryTextColor: '#0f172a',
                lineColor: selectedTheme.accent || '#64748b',
                secondaryColor: '#f8fafc',
                secondaryBorderColor: '#cbd5e1',
                secondaryTextColor: '#0f172a',
                tertiaryColor: '#f8fafc',
                tertiaryBorderColor: '#cbd5e1',
                tertiaryTextColor: '#334155',
                clusterBkg: '#f8fafc',
                clusterBorder: '#cbd5e1',
                nodeBorder: '#cbd5e1',
                mainBkg: '#ffffff',
                nodeTextColor: '#0f172a',
                edgeLabelBackground: '#ffffff',
                actorBorder: '#cbd5e1',
                actorBkg: '#f8fafc',
                actorTextColor: '#0f172a',
                signalColor: selectedTheme.accent || '#64748b',
                signalTextColor: '#0f172a',
              },
            });

            // Process sequentially using a for loop to avoid concurrent rendering collisions
            for (let i = 0; i < mermaidNodes.length; i++) {
              const node = mermaidNodes[i];
              if (!containerRef.current || !containerRef.current.contains(node)) continue;
              if (node.getAttribute('data-processed') === 'true') continue;

              const rawText = node.textContent?.trim() || '';
              if (!rawText) continue;

              let targetContainer = node as HTMLElement;
              if (node.tagName === 'CODE' && node.parentElement?.tagName === 'PRE') {
                const div = document.createElement('div');
                div.className = 'mermaid';
                node.parentElement.replaceWith(div);
                targetContainer = div;
              } else if (node.tagName === 'PRE') {
                const div = document.createElement('div');
                div.className = 'mermaid';
                node.replaceWith(div);
                targetContainer = div;
              }

              let cleanDiagram = rawText.replace(/^```mermaid\s*/i, '').replace(/```$/i, '').trim();
              if (
                !cleanDiagram.startsWith('graph') &&
                !cleanDiagram.startsWith('flowchart') &&
                !cleanDiagram.startsWith('sequenceDiagram') &&
                !cleanDiagram.startsWith('classDiagram') &&
                !cleanDiagram.startsWith('stateDiagram') &&
                !cleanDiagram.startsWith('erDiagram') &&
                !cleanDiagram.startsWith('gantt') &&
                !cleanDiagram.startsWith('pie')
              ) {
                cleanDiagram = `graph TD\n${cleanDiagram}`;
              }

              cleanDiagram = cleanDiagram.replace(/([\w-]+)\[([^"\]\n]+)\]/g, (_, id, label) => {
                return `${id}["${label.replace(/"/g, "'")}"]`;
              });

              const renderId = `mermaid-svg-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
              try {
                const { svg } = await mermaid.render(renderId, cleanDiagram);
                if (targetContainer && document.body.contains(targetContainer)) {
                  targetContainer.innerHTML = svg;
                  targetContainer.setAttribute('data-processed', 'true');

                  targetContainer.style.display = 'flex';
                  targetContainer.style.justifyContent = 'center';
                  targetContainer.style.alignItems = 'center';
                  targetContainer.style.margin = '24px auto';
                  targetContainer.style.width = '100%';
                  targetContainer.style.textAlign = 'center';

                  const svgEl = targetContainer.querySelector('svg');
                  if (svgEl) {
                    applyTranslucentColorPaletteToSvg(svgEl, activeThemeId);
                    svgEl.style.display = 'block';
                    svgEl.style.marginLeft = 'auto';
                    svgEl.style.marginRight = 'auto';
                    svgEl.style.maxWidth = '100%';
                    svgEl.style.height = 'auto';
                    svgEl.style.maxHeight = 'none';
                    svgEl.style.overflow = 'visible';
                  }
                }
              } catch (diagramErr) {
                console.warn('Skipping unparseable Mermaid diagram:', diagramErr);
                const errEls = document.querySelectorAll(`[id^="d${renderId}"], [id^="${renderId}"]`);
                errEls.forEach((el) => el.remove());
              }
            }
          }
        } catch (e) {
          console.warn('Mermaid initialization error:', e);
        }
      };

      renderMermaidDiagrams();
    }

    // E. Re-apply color palettes and centering on all rendered SVGs
    try {
      const allSvgs = container.querySelectorAll('.mermaid svg, svg.flowchart, [id^="mermaid-svg"]');
      allSvgs.forEach((svg) => {
        applyTranslucentColorPaletteToSvg(svg as SVGSVGElement, activeThemeId);
        const svgEl = svg as SVGElement;
        if (svgEl.parentElement) {
          svgEl.parentElement.style.setProperty('text-align', 'center', 'important');
          svgEl.parentElement.style.setProperty('display', 'flex', 'important');
          svgEl.parentElement.style.setProperty('justify-content', 'center', 'important');
          svgEl.parentElement.style.setProperty('margin', '20px auto', 'important');
        }
      });
    } catch (err) {
      console.warn('SVG colorization error:', err);
    }
  }, [renderedHtml, activeThemeId, isStreaming]);

  // 2. Dynamically Highlight Pinned Chunks in Note Preview
  useEffect(() => {
    if (!containerRef.current || isStreaming) return;
    const container = containerRef.current;

    // A. Remove any existing pinned highlight marks
    const existingMarks = container.querySelectorAll('mark.pinned-note-highlight');
    existingMarks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      }
    });
    container.normalize();

    if (selectedChunks.length === 0) return;

    // B. Wrap text node matches for each pinned chunk
    selectedChunks.forEach((chunk) => {
      const fullText = chunk.trim();
      if (!fullText || fullText.length < 2) return;

      const segments = fullText.split(/\n+/).map((s) => s.trim()).filter((s) => s.length >= 2);
      const targets = segments.length > 0 ? segments : [fullText];

      targets.forEach((targetText) => {
        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              if (
                parent.closest('mark.pinned-note-highlight') ||
                parent.closest('.katex') ||
                parent.closest('.mermaid') ||
                parent.closest('script') ||
                parent.closest('style') ||
                parent.closest('.ai-refine-interactive')
              ) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            },
          }
        );

        const replacements: { node: Text; idx: number; len: number }[] = [];
        let currentNode: Text | null;

        while ((currentNode = walker.nextNode() as Text | null)) {
          const textVal = currentNode.nodeValue || '';
          const idx = textVal.indexOf(targetText);
          if (idx !== -1) {
            replacements.push({ node: currentNode, idx, len: targetText.length });
          }
        }

        replacements.forEach(({ node, idx, len }) => {
          try {
            const textVal = node.nodeValue || '';
            const before = textVal.substring(0, idx);
            const match = textVal.substring(idx, idx + len);
            const after = textVal.substring(idx + len);

            const mark = document.createElement('mark');
            mark.className = 'pinned-note-highlight';
            mark.style.backgroundColor = 'rgba(249, 115, 22, 0.25)';
            mark.style.borderBottom = '2px solid #f97316';
            mark.style.borderRadius = '3px';
            mark.style.padding = '1px 3px';
            mark.style.color = 'inherit';
            mark.style.fontWeight = 'inherit';
            mark.textContent = match;

            const parent = node.parentNode;
            if (!parent) return;

            if (before) {
              parent.insertBefore(document.createTextNode(before), node);
            }
            parent.insertBefore(mark, node);
            if (after) {
              parent.insertBefore(document.createTextNode(after), node);
            }
            parent.removeChild(node);
          } catch (err) {
            console.warn('Failed to highlight text node:', err);
          }
        });

        container.normalize();
      });
    });
  }, [selectedChunks, renderedHtml, isStreaming]);
}
