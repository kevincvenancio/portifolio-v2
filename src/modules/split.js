/* ════════════════════════════════════════════════════════════
   DIVISÃO DE TEXTO
   Quebra em caracteres / palavras / linhas com máscara de
   overflow, preservando marcação inline e acessibilidade.
   ════════════════════════════════════════════════════════════ */

function ensureLabel(el){
  if (!el.getAttribute('aria-label')) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  }
}

/* Percorre os nós de texto preservando os elementos inline (b, i, span…) */
function walkText(root, fn){
  const nodes = [];
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = it.nextNode())) if (n.nodeValue.trim().length) nodes.push(n);
  nodes.forEach(fn);
}

/** Caracteres — cada letra vira um span animável. */
export function splitChars(el){
  ensureLabel(el);
  const out = [];
  walkText(el, (node) => {
    const frag = document.createDocumentFragment();
    for (const ch of node.nodeValue) {
      if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span');
      s.className = 'char';
      s.textContent = ch;
      s.setAttribute('aria-hidden', 'true');
      frag.appendChild(s);
      out.push(s);
    }
    node.parentNode.replaceChild(frag, node);
  });
  return out;
}

/** Palavras — máscara por palavra, para subida "de dentro da linha". */
export function splitWords(el){
  ensureLabel(el);
  const out = [];
  walkText(el, (node) => {
    const frag = document.createDocumentFragment();
    const parts = node.nodeValue.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
      const mask = document.createElement('span');
      mask.className = 'word-mask';
      mask.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'word-inner';
      inner.textContent = part;
      mask.appendChild(inner);
      frag.appendChild(mask);
      out.push(inner);
    }
    node.parentNode.replaceChild(frag, node);
  });
  return out;
}
