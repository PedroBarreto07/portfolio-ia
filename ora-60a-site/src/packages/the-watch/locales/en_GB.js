export default {
  lang: 'en',
  meta: {
    title: 'ORA 60A — The timeless automatic watch',
    description: 'A 42 mm automatic tourbillon with moon phase and 60-hour power reserve, explored in real-time 3D.',
  },
  header: {
    brand: 'ORA',
    discover: 'Discover',
    configure: 'Configure',
    sound: 'Sound',
    on: 'On',
    off: 'Off',
    switchLang: 'PT',
    switchLangLabel: 'Ver em português',
  },
  cursor: {
    hold: 'Hold to<br/>explore',
    drag: 'Drag',
    select: 'Select',
    swap: 'Swap',
    selectModel: 'Select<br/>model',
    scroll: 'Scroll',
  },
  colorLabel: 'Color',
  modelLabel: 'Model',
  modelValue: '146G',
  colors: ['Silver Steel', 'Deep Black', 'Pure Gold', 'Rose Gold'],
  dials: ['Slate', 'Midnight', 'Ivory', 'Onyx'],
  straps: ['Steel bracelet', 'Cognac leather', 'Black leather'],

  hero: {
    left: 'ORA',
    right: '60A',
    eyebrow: 'The timeless<br/>automatic watch',
    scroll: 'Scroll to discover',
    hold: 'Hold to explore',
    index: '01 / 12',
  },

  timeless: {
    index: '02 / 12',
    columns: [
      { title: 'Tourbillon', text: 'A one-minute flying cage at six o’clock cancels the effect of gravity on the balance — and doubles as the seconds display.' },
      { title: 'Automatic movement', text: 'Calibre 60A winds itself with every gesture: a 22k gold-rimmed rotor feeds a 60-hour mainspring.' },
    ],
    words: ['The', 'timeless', 'automatic', '42 mm', 'watch'],
  },

  vertical: {
    index: '03 / 12',
    caseTitle: 'Case &<br/>finishes',
    caseText: 'Polished bezel, satin-brushed flanks, hand-bevelled lugs. Four finishes, one silhouette: 42 mm wide, 11.8 mm thin.',
    dialTitle: 'Dial &<br/>complications',
    dialText: 'Sunburst dial, applied indices, a lunar disc that follows the real sky and a power-reserve gauge at nine o’clock.',
  },

  disassembly: {
    index: '04 / 12',
    title: 'Disassembly',
    hint: 'Click to explore',
    hintTouch: 'Drag & tap to explore',
    name: 'Name',
    function: 'Function',
    close: 'Close',
    count: 'parts',
    parts: {
      dial: { name: 'Dial', function: 'Sunburst-brushed brass, applied indices and transfer-printed tracks. Frames the moon phase and opens onto the tourbillon.' },
      tourbillon: { name: 'Tourbillon', function: 'Balance, hairspring and escapement mounted in a cage that turns once a minute, averaging out positional errors.' },
      mainplate: { name: 'Mainplate', function: 'The foundation of the calibre. Perlage-finished, it holds the jewels and the gear train between the bridges.' },
      barrel: { name: 'Barrel', function: 'Stores the energy of the mainspring and releases it evenly — 60 hours of autonomy at a constant torque.' },
      backplate: { name: 'Backplate', function: 'Three-quarter plate decorated with Côtes de Genève, blued screws and gold chatons holding 42 rubies.' },
      weight: { name: 'Weight', function: 'The oscillating rotor. Every movement of the wrist turns it and rewinds the mainspring — no crown needed.' },
    },
  },

  mechanism: {
    index: '05 / 12',
    title: ['Mechanical', 'heart'],
    intro: '211 components, assembled and adjusted by hand. A beat of 28,800 vibrations per hour — eight ticks every second.',
  },

  movement: {
    lines: ['The highly', 'precise', 'automatic', 'movement'],
    numeral: '60',
    unit: 'h',
    caption: 'of power reserve',
    specs: [
      { k: 'Frequency', v: '4 Hz · 28,800 vph' },
      { k: 'Jewels', v: '42 rubies' },
      { k: 'Precision', v: '−2 / +4 s per day' },
      { k: 'Components', v: '211' },
    ],
  },

  curves: {
    index: '06 / 12',
    pre: 'Elegant',
    title: 'Elegant<br/>contours',
    text: 'A gently domed sapphire, a bezel that catches the light at every angle. Curves drawn to disappear on the wrist.',
  },

  watchRight: {
    index: '07 / 12',
    items: [
      { title: 'Refined dial', text: 'Twelve layers of lacquer, a sunburst finish and indices set by hand.' },
      { title: 'Polished hands', text: 'Faceted dauphine hands — two mirror flanks that flash as the hours turn.' },
      { title: 'Premium bezel', text: 'Mirror-polished on a rounded profile, protecting an anti-reflective sapphire.' },
    ],
  },

  profile: {
    index: '08 / 12',
    title: 'Slim<br/>profile',
    text: 'A tourbillon in under twelve millimetres. The case slides under a cuff.',
    figure: '11.8',
    unit: 'mm',
  },

  bracelet: {
    index: '09 / 12',
    title: 'Bracelet',
    text: 'Three-row links, alternating polished and brushed, closing on a folding clasp engraved with the maison’s name.',
  },

  images: {
    index: '10 / 12',
    rows: ['ORA — 60A', 'The timeless automatic', '42 mm', 'watch /'],
    classic: 'Classic Edition',
    sport: 'Tourbillon Edition',
    caption: 'Automatic · Tourbillon · Moon phase',
  },

  colorsSection: {
    index: '11 / 12',
    title: 'Colors',
    text: 'Four finishes rendered live — every image below is drawn by the same 3D watch you just took apart.',
    rendering: 'Rendering',
  },

  partsSection: {
    index: '12 / 12',
    model: 'Model 146GR',
    colorLabel: 'Color',
    change: 'Change color',
    dialLabel: 'Dial',
    strapLabel: 'Strap',
    share: 'Copy configuration link',
    copied: 'Link copied',
    listTitle: 'Components',
    total: 'Total weight',
    unit: 'Gr',
  },

  parts: [
    { id: 'dial', name: 'Dial', group: 'Display', weight: 11 },
    { id: 'hands', name: 'Hands', group: 'Display', weight: 1 },
    { id: 'crystal', name: 'Crystal', group: 'Case', weight: 12 },
    { id: 'bezel', name: 'Bezel', group: 'Case', weight: 16 },
    { id: 'lugs', name: 'Lugs', group: 'Case', weight: 18 },
    { id: 'strap', name: 'Strap', group: 'Bracelet', weight: 34 },
    { id: 'buckle', name: 'Buckle', group: 'Bracelet', weight: 8 },
    { id: 'crown', name: 'Crown', group: 'Mechanism', weight: 3 },
    { id: 'caseback', name: 'Caseback', group: 'Case', weight: 14 },
    { id: 'movement', name: 'Movement', group: 'Mechanism', weight: 29 },
  ],

  outro: {
    line: 'Time,<br/>made visible.',
    pick: 'Choose your finish',
    hint: 'Hover · click to choose',
    top: 'Back to top',
    credits: 'Concept, 3D & code — procedural, real-time, no photos.',
    legal: '© ORA Horlogerie. Fictional brand for demonstration.',
  },
}
