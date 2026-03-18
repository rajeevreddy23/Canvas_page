const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const toolEl = document.getElementById('tool');
const colorEl = document.getElementById('color');
const sizeEl = document.getElementById('size');
const sizeValue = document.getElementById('sizeValue');
const filledEl = document.getElementById('filled');
const coordsEl = document.getElementById('coords');
const textInput = document.getElementById('textInput');

const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const clearBtn = document.getElementById('clear');
const downloadBtn = document.getElementById('download');
const saveJsonBtn = document.getElementById('saveJson');
const loadJsonBtn = document.getElementById('loadJson');
const loadFile = document.getElementById('loadFile');
const meta = document.getElementById('meta');

let drawing = false;
let startX = 0, startY = 0;
let currentTool = 'brush';
let undoStack = [];
let redoStack = [];

function init() {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();
}

function setMeta(text) { meta.textContent = text; }
function saveState(pushRedo = false) {
  if (!pushRedo) redoStack = [];
  undoStack.push(canvas.toDataURL());
  if (undoStack.length > 80) undoStack.shift();
}

function restoreState(stackFrom, stackTo) {
  if (!stackFrom.length) return;
  stackTo.push(canvas.toDataURL());
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = stackFrom.pop();
}

function getRelativePoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const p = getRelativePoint(e);
  drawing = true;
  startX = p.x;
  startY = p.y;
  currentTool = toolEl.value;
  ctx.strokeStyle = colorEl.value;
  ctx.fillStyle = colorEl.value;
  ctx.lineWidth = Number(sizeEl.value);

  if (currentTool === 'fill') {
    fillCanvas(colorEl.value);
    saveState();
  } else if (currentTool === 'text') {
    const text = textInput.value.trim();
    if (text) {
      ctx.font = `${Math.max(14, Number(sizeEl.value) * 3)}px sans-serif`;
      ctx.fillStyle = colorEl.value;
      ctx.fillText(text, p.x, p.y);
      saveState();
    }
  } else {
    if (currentTool === 'brush' || currentTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = getRelativePoint(e);
  coordsEl.textContent = `x:${Math.round(p.x)} y:${Math.round(p.y)}`;
  if (!drawing) return;

  if (currentTool === 'brush') {
    ctx.strokeStyle = colorEl.value;
    ctx.lineWidth = Number(sizeEl.value);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else if (currentTool === 'eraser') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Number(sizeEl.value) * 2;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!drawing) return;
  drawing = false;
  const p = getRelativePoint(e);
  if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
    const w = p.x - startX;
    const h = p.y - startY;
    ctx.beginPath();
    ctx.strokeStyle = colorEl.value;
    ctx.fillStyle = colorEl.value;
    ctx.lineWidth = Number(sizeEl.value);

    if (currentTool === 'line') {
      ctx.moveTo(startX, startY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (currentTool === 'rect') {
      if (filledEl.checked) ctx.fillRect(startX, startY, w, h);
      else ctx.strokeRect(startX, startY, w, h);
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(w * w + h * h);
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      if (filledEl.checked) ctx.fill(); else ctx.stroke();
    }
  }
  saveState();
});

canvas.addEventListener('pointerleave', () => { if (drawing) drawing = false; });

function fillCanvas(color) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const [r,g,b,a] = hexToRgba(color);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] !== 0) {
      data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=a;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function hexToRgba(hex) {
  const c = hex.replace('#','');
  const bigint = parseInt(c,16);
  if (c.length === 6) {
    return [(bigint>>16)&255, (bigint>>8)&255, bigint&255, 255];
  }
  return [0,0,0,255];
}

sizeEl.addEventListener('input', () => { sizeValue.textContent = sizeEl.value; });

undoBtn.addEventListener('click', () => { restoreState(undoStack, redoStack); });
redoBtn.addEventListener('click', () => { restoreState(redoStack, undoStack); });
clearBtn.addEventListener('click', () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); saveState(); });
downloadBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `canvas-design-${Date.now()}.png`;
  a.click();
});

saveJsonBtn.addEventListener('click', () => {
  const payload = { width: canvas.width, height: canvas.height, image: canvas.toDataURL() };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'canvas-design.json';
  a.click();
});

loadJsonBtn.addEventListener('click', () => loadFile.click());
loadFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      const img = new Image();
      img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img, 0,0); saveState(); };
      img.src = data.image;
    } catch (err) {
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(file);
});

init();