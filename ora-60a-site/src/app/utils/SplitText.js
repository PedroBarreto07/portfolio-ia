/*
 * Home-made SplitText: lines → words → chars, with a double wrapper
 * (.char-wrapper > .st-char) so every glyph can slide inside its own mask.
 * <br> in the source html are kept as hard line breaks (they are part of
 * the design and come from the locale files).
 */
export default class SplitText {
  constructor(el, { lines = true, chars = true } = {}) {
    this.el = el
    this.opts = { lines, chars }
    this.original = el.innerHTML
    this.split()
  }

  split() {
    const el = this.el
    const tokens = []
    const walk = (node) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return
            if (/^\s+$/.test(t)) tokens.push({ type: 'space' })
            else tokens.push({ type: 'word', text: t, cls: node !== el ? node.className : '' })
          })
        } else if (n.nodeName === 'BR') tokens.push({ type: 'br' })
        else if (n.nodeType === 1) walk(n)
      })
    }
    walk(el)

    el.innerHTML = ''
    this.words = []
    this.chars = []
    const frag = document.createDocumentFragment()
    tokens.forEach((t) => {
      if (t.type === 'space') frag.appendChild(document.createTextNode(' '))
      else if (t.type === 'br') {
        const br = document.createElement('br')
        br.dataset.hard = '1'
        frag.appendChild(br)
      } else {
        const w = document.createElement('span')
        w.className = `st-word ${t.cls || ''}`.trim()
        if (this.opts.chars) {
          for (const ch of t.text) {
            const wrap = document.createElement('span')
            wrap.className = 'char-wrapper'
            const c = document.createElement('span')
            c.className = 'st-char'
            c.textContent = ch
            wrap.appendChild(c)
            w.appendChild(wrap)
            this.chars.push(c)
          }
        } else w.textContent = t.text
        this.words.push(w)
        frag.appendChild(w)
      }
    })
    el.appendChild(frag)
    if (this.opts.lines) this.groupLines()
  }

  groupLines() {
    const el = this.el
    const items = [...el.childNodes]
    const lines = []
    let current = []
    let lastTop = null
    items.forEach((n) => {
      if (n.nodeName === 'BR') {
        lines.push(current)
        current = []
        lastTop = null
        return
      }
      if (n.nodeType === 1) {
        const top = n.offsetTop
        if (lastTop !== null && Math.abs(top - lastTop) > 4) {
          lines.push(current)
          current = []
        }
        lastTop = top
      }
      current.push(n)
    })
    if (current.length) lines.push(current)
    el.innerHTML = ''
    this.lines = lines
      .filter((l) => l.some((n) => n.nodeType === 1))
      .map((nodes) => {
        const line = document.createElement('span')
        line.className = 'st-line'
        // trim spaces at line edges
        while (nodes.length && nodes[0].nodeType === 3) nodes.shift()
        while (nodes.length && nodes[nodes.length - 1].nodeType === 3) nodes.pop()
        nodes.forEach((n) => line.appendChild(n))
        el.appendChild(line)
        return line
      })
  }

  revert() {
    this.el.innerHTML = this.original
  }
}
