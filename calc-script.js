// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let current     = '0';
let previous    = '';
let operator    = null;
let waitingNext = false;
let history     = JSON.parse(localStorage.getItem('calc_history') || '[]');

// ─────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────
const display     = document.getElementById('display');
const expression  = document.getElementById('expression');
const historyList = document.getElementById('historyList');
const historyEmpty= document.getElementById('historyEmpty');

// ─────────────────────────────────────────
// DISPLAY
// ─────────────────────────────────────────
function updateDisplay(val) {
  // truncate if too long
  const str = String(val);
  display.textContent = str.length > 14 ? parseFloat(str).toExponential(6) : str;
  display.classList.remove('error');
}

function flashDisplay() {
  display.classList.add('flash');
  setTimeout(() => display.classList.remove('flash'), 80);
}

function setExpression(str) {
  expression.textContent = str || '\u00A0';
}

// ─────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────
function renderHistory() {
  // remove items except empty state
  historyList.querySelectorAll('.history-item').forEach(el => el.remove());

  if (history.length === 0) {
    historyEmpty.style.display = 'flex';
    return;
  }

  historyEmpty.style.display = 'none';

  // render newest first
  [...history].reverse().forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="hist-expr">${entry.expr}</div>
      <div class="hist-result">= ${entry.result}</div>`;
    // click to reuse result
    item.addEventListener('click', () => {
      current = String(entry.result);
      waitingNext = false;
      updateDisplay(current);
      setExpression(entry.expr);
    });
    historyList.appendChild(item);
  });
}

function addToHistory(expr, result) {
  history.push({ expr, result });
  if (history.length > 50) history.shift(); // cap at 50
  localStorage.setItem('calc_history', JSON.stringify(history));
  renderHistory();
}

// ─────────────────────────────────────────
// CORE LOGIC
// ─────────────────────────────────────────
function calculate(a, b, op) {
  a = parseFloat(a);
  b = parseFloat(b);
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
      if (b === 0) return 'DIV BY ZERO';
      return a / b;
  }
}

function formatResult(val) {
  if (typeof val === 'string') return val;
  // avoid floating point noise
  const rounded = parseFloat(val.toPrecision(12));
  return String(rounded);
}

// ─────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────
function handleNumber(val) {
  if (waitingNext) {
    current     = val;
    waitingNext = false;
  } else {
    if (current === '0' && val !== '.') {
      current = val;
    } else if (val === '.' && current.includes('.')) {
      return; // no double decimal
    } else {
      if (current.length >= 16) return; // max digits
      current += val;
    }
  }
  updateDisplay(current);
}

function handleOperator(op) {
  if (operator && !waitingNext) {
    // chain calculation
    const result = calculate(previous, current, operator);
    const resultStr = formatResult(result);

    if (resultStr === 'DIV BY ZERO') {
      showError();
      return;
    }

    current = resultStr;
    updateDisplay(current);
  }

  previous    = current;
  operator    = op;
  waitingNext = true;

  const opSymbol = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
  setExpression(`${previous} ${opSymbol}`);

  // highlight active operator button
  document.querySelectorAll('.key-op').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === op);
  });
}

function handleEquals() {
  if (!operator || waitingNext) return;

  const a = previous;
  const b = current;
  const op = operator;
  const opSymbol = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];

  const result = calculate(a, b, op);
  const resultStr = formatResult(result);

  if (resultStr === 'DIV BY ZERO') {
    showError();
    return;
  }

  const expr = `${a} ${opSymbol} ${b}`;
  setExpression(`${expr} =`);
  addToHistory(expr, resultStr);

  flashDisplay();
  current     = resultStr;
  previous    = '';
  operator    = null;
  waitingNext = true;
  updateDisplay(current);

  document.querySelectorAll('.key-op').forEach(btn => btn.classList.remove('active'));
}

function handleClear() {
  current     = '0';
  previous    = '';
  operator    = null;
  waitingNext = false;
  updateDisplay('0');
  setExpression('');
  document.querySelectorAll('.key-op').forEach(btn => btn.classList.remove('active'));
}

function handleSign() {
  if (current === '0' || current === 'ERR') return;
  current = current.startsWith('-') ? current.slice(1) : '-' + current;
  updateDisplay(current);
}

function handlePercent() {
  const val = parseFloat(current) / 100;
  current = formatResult(val);
  updateDisplay(current);
}

function handleDecimal() {
  if (waitingNext) {
    current = '0.';
    waitingNext = false;
    updateDisplay(current);
    return;
  }
  if (!current.includes('.')) {
    current += '.';
    updateDisplay(current);
  }
}

function showError() {
  display.textContent = 'ERR';
  display.classList.add('error');
  setExpression('DIVISION BY ZERO');
  current     = '0';
  previous    = '';
  operator    = null;
  waitingNext = false;
  setTimeout(handleClear, 1800);
}

// ─────────────────────────────────────────
// BUTTON EVENTS
// ─────────────────────────────────────────
document.querySelectorAll('.key').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    const value  = btn.dataset.value;

    switch (action) {
      case 'number':   handleNumber(value); break;
      case 'operator': handleOperator(value); break;
      case 'equals':   handleEquals(); break;
      case 'clear':    handleClear(); break;
      case 'sign':     handleSign(); break;
      case 'percent':  handlePercent(); break;
      case 'decimal':  handleDecimal(); break;
    }
  });
});

// ─────────────────────────────────────────
// KEYBOARD SUPPORT
// ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key >= '0' && e.key <= '9')      handleNumber(e.key);
  else if (e.key === '.')                 handleDecimal();
  else if (e.key === '+')                 handleOperator('+');
  else if (e.key === '-')                 handleOperator('-');
  else if (e.key === '*')                 handleOperator('*');
  else if (e.key === '/')    { e.preventDefault(); handleOperator('/'); }
  else if (e.key === 'Enter' || e.key === '=') handleEquals();
  else if (e.key === 'Backspace') {
    if (current.length > 1) {
      current = current.slice(0, -1);
      updateDisplay(current);
    } else {
      current = '0';
      updateDisplay('0');
    }
  }
  else if (e.key === 'Escape')            handleClear();
  else if (e.key === '%')                 handlePercent();
});

// ─────────────────────────────────────────
// CLEAR HISTORY
// ─────────────────────────────────────────
document.getElementById('clearHistory').addEventListener('click', () => {
  history = [];
  localStorage.removeItem('calc_history');
  renderHistory();
});

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
renderHistory();
updateDisplay('0');
