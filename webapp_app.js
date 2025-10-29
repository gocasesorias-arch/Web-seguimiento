/* Minimal web app que emula SharePoint (Cursos, Hitos, Progreso) usando localStorage.
   - Estados secuenciales con 4 sub-hitos
   - Avance automático al completar 4/4
   - Import/Export JSON para versionar en GitHub
*/

const ESTADOS = ["Pendiente","Planificado","En Proceso","Programado","En Ejecución","Realizado"];
const ESPECIALES = ["Suspendido","Postergado"];
const STORAGE_KEY = "capacitaciones-webdb-v1";

const defaultHitos = {
  "Pendiente": [
    "Recepción requerimientos desde equipo de Capacitación",
    "Validación con referente técnico (líderes de proceso)",
    "Análisis de necesidades y alcance",
    "Aprobación preliminar del requerimiento"
  ],
  "Planificado": [
    "Solicitar propuestas técnicas y económicas a proveedores",
    "Matriz comparativa y propuesta final",
    "Validación propuesta con líderes de proceso",
    "Asignación de presupuesto"
  ],
  "En Proceso": [
    "Revisión de turnos y condiciones operativas",
    "Estructuración de fechas de ejecución",
    "Validación final de nóminas",
    "Preparación de materiales y recursos"
  ],
  "Programado": [
    "Coordinación logística adicional",
    "Elaboración y envío de invitaciones",
    "Coordinación con proveedor",
    "Confirmación de participación"
  ],
  "En Ejecución": [
    "Supervisar ejecución efectiva",
    "Seguimiento de asistencia diaria",
    "Evaluación de desempeño",
    "Registro de incidencias o novedades"
  ],
  "Realizado": [
    "Subir asistencia a Clikma",
    "Recopilar encuestas de satisfacción",
    "Emitir certificados",
    "Cierre administrativo y archivo"
  ]
};

let db = loadDB();

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return {
    cursos: [], // {id, nombre, objetivo, gerencia, estado, modalidad, horas, participantes, otec}
    progreso: {}, // idCurso -> {estadoActual, h1,h2,h3,h4, ts}
    hitos: defaultHitos
  };
}
function saveDB() { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

// UI Elements
const cNombre = document.getElementById("cNombre");
const cObjetivo = document.getElementById("cObjetivo");
const cGerencia = document.getElementById("cGerencia");
const cModalidad = document.getElementById("cModalidad");
const cHoras = document.getElementById("cHoras");
const cParticipantes = document.getElementById("cParticipantes");
const cOTEC = document.getElementById("cOTEC");
const btnAddCurso = document.getElementById("btnAddCurso");

const fGerencia = document.getElementById("fGerencia");
const fEstado = document.getElementById("fEstado");
const fBuscar = document.getElementById("fBuscar");
const tblCursosBody = document.querySelector("#tblCursos tbody");
const stats = document.getElementById("stats");

const panelGestion = document.getElementById("panelGestion");
const gCurso = document.getElementById("gCurso");
const gEstado = document.getElementById("gEstado");
const listaHitos = document.getElementById("listaHitos");
const chk1 = document.getElementById("h1");
const chk2 = document.getElementById("h2");
const chk3 = document.getElementById("h3");
const chk4 = document.getElementById("h4");
const btnSuspender = document.getElementById("btnSuspender");
const btnPostergar = document.getElementById("btnPostergar");

const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");
const btnReset = document.getElementById("btnReset");

let currentCursoId = null;

// --- Helpers ---
function newId() { return Math.random().toString(36).slice(2,10); }
function todayISO() { return new Date().toISOString(); }

function ensureProgreso(idCurso) {
  if (!db.progreso[idCurso]) {
    const curso = db.cursos.find(c => c.id === idCurso);
    db.progreso[idCurso] = { estadoActual: curso.estado, h1:false, h2:false, h3:false, h4:false, ts: todayISO() };
    saveDB();
  }
  return db.progreso[idCurso];
}

function nextEstado(estado) {
  const idx = ESTADOS.indexOf(estado);
  if (idx >= 0 && idx < ESTADOS.length - 1) return ESTADOS[idx + 1];
  return estado; // último o especiales no avanzan
}

function badge(estado) {
  const cls = (estado === "Realizado") ? "ok"
           : (estado === "En Ejecución" || estado === "Programado") ? "run"
           : (estado === "Suspendido" || estado === "Postergado") ? "stop"
           : "info";
  return `<span class="badge ${cls}">${estado}</span>`;
}

function renderStats() {
  const all = db.cursos;
  const parts = [];
  const estadosAll = [...ESTADOS, ...ESPECIALES];
  estadosAll.forEach(st => {
    const n = all.filter(c => c.estado === st).length;
    if (n>0) parts.push(`<span class="stat">${st}: <b>${n}</b></span>`);
  });
  parts.push(`<span class="stat">Total: <b>${all.length}</b></span>`);
  stats.innerHTML = parts.join("");
}

function renderFilters() {
  const gerencias = Array.from(new Set(db.cursos.map(c => c.gerencia))).filter(Boolean).sort();
  fGerencia.innerHTML = `<option value="">Todas</option>` + gerencias.map(g => `<option>${g}</option>`).join("");
}

function renderCursos() {
  const term = (fBuscar.value || "").toLowerCase();
  const g = fGerencia.value;
  const e = fEstado.value;
  let rows = db.cursos.filter(c => {
    const matchG = !g || c.gerencia === g;
    const matchE = !e || c.estado === e;
    const matchT = !term || (c.nombre.toLowerCase().includes(term) || (c.otec||"").toLowerCase().includes(term));
    return matchG && matchE && matchT;
  }).sort((a,b)=> a.nombre.localeCompare(b.nombre));

  tblCursosBody.innerHTML = rows.map(c => `
    <tr>
      <td>${c.nombre}</td>
      <td>${c.gerencia||""}</td>
      <td>${badge(c.estado)}</td>
      <td>${c.modalidad}</td>
      <td>${c.horas}</td>
      <td>${c.participantes}</td>
      <td>${c.otec||""}</td>
      <td class="row-actions">
        <button data-id="${c.id}" data-act="gestionar">Gestionar</button>
        <button data-id="${c.id}" data-act="avanzar">Avanzar</button>
        <button data-id="${c.id}" data-act="retroceder">Retroceder</button>
        <button data-id="${c.id}" data-act="eliminar">Eliminar</button>
      </td>
    </tr>
  `).join("");
  renderStats();
}

function openGestion(idCurso) {
  const c = db.cursos.find(x => x.id === idCurso);
  if (!c) return;
  currentCursoId = idCurso;
  const prog = ensureProgreso(idCurso);
  gCurso.textContent = c.nombre;
  gEstado.textContent = `(${prog.estadoActual})`;

  // lista texto de hitos para el estado actual
  const list = db.hitos[prog.estadoActual] || [];
  listaHitos.innerHTML = list.map(t => `<li>${t}</li>`).join("");

  // checkboxes
  chk1.checked = !!prog.h1; chk2.checked = !!prog.h2; chk3.checked = !!prog.h3; chk4.checked = !!prog.h4;

  panelGestion.hidden = false;
  window.scrollTo({top: panelGestion.offsetTop - 12, behavior: "smooth"});
}

function updateChecks() {
  if (!currentCursoId) return;
  const p = db.progreso[currentCursoId];
  p.h1 = chk1.checked; p.h2 = chk2.checked; p.h3 = chk3.checked; p.h4 = chk4.checked;
  p.ts = todayISO();
  saveDB();

  // Si 4/4 => avanzar
  if (p.h1 && p.h2 && p.h3 && p.h4) {
    const c = db.cursos.find(x => x.id === currentCursoId);
    if (!c) return;
    // avanzar solo si está en el flujo principal
    if (ESTADOS.includes(p.estadoActual)) {
      const nxt = nextEstado(p.estadoActual);
      c.estado = nxt;
      p.estadoActual = nxt;
      p.h1 = p.h2 = p.h3 = p.h4 = false;
      p.ts = todayISO();
      saveDB();
      renderCursos();
      openGestion(currentCursoId);
    }
  }
}

function suspendOrPostpone(kind) {
  if (!currentCursoId) return;
  const c = db.cursos.find(x => x.id === currentCursoId);
  if (!c) return;
  const p = ensureProgreso(currentCursoId);
  c.estado = kind;
  p.estadoActual = kind;
  p.h1 = p.h2 = p.h3 = p.h4 = false;
  p.ts = todayISO();
  saveDB();
  renderCursos();
  openGestion(currentCursoId);
}

// --- Events ---
btnAddCurso.addEventListener("click", () => {
  const nombre = cNombre.value.trim();
  if (!nombre) { alert("Ingresa un nombre de curso"); return; }
  const item = {
    id: newId(),
    nombre,
    objetivo: cObjetivo.value.trim(),
    gerencia: cGerencia.value.trim(),
    estado: "Pendiente",
    modalidad: cModalidad.value,
    horas: Number(cHoras.value||0),
    participantes: Number(cParticipantes.value||0),
    otec: cOTEC.value.trim()
  };
  db.cursos.push(item);
  saveDB();
  cNombre.value = ""; cObjetivo.value = ""; cGerencia.value = ""; cOTEC.value = "";
  renderFilters();
  renderCursos();
});

fGerencia.addEventListener("change", renderCursos);
fEstado.addEventListener("change", renderCursos);
fBuscar.addEventListener("input", renderCursos);

tblCursosBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  const id = btn.dataset.id; const act = btn.dataset.act;
  const idx = db.cursos.findIndex(c => c.id === id);
  if (idx < 0) return;
  if (act === "gestionar") {
    openGestion(id);
  } else if (act === "eliminar") {
    if (confirm("¿Eliminar este curso?")) {
      db.cursos.splice(idx,1);
      delete db.progreso[id];
      saveDB();
      renderFilters();
      renderCursos();
      if (currentCursoId === id) { panelGestion.hidden = true; currentCursoId = null; }
    }
  } else if (act === "avanzar") {
    const c = db.cursos[idx];
    const p = ensureProgreso(id);
    if (ESTADOS.includes(p.estadoActual)) {
      const nxt = nextEstado(p.estadoActual);
      c.estado = nxt; p.estadoActual = nxt; p.h1=p.h2=p.h3=p.h4=false; p.ts=todayISO();
      saveDB();
      renderCursos();
      if (currentCursoId === id) openGestion(id);
    }
  } else if (act === "retroceder") {
    const c = db.cursos[idx];
    const p = ensureProgreso(id);
    const i = ESTADOS.indexOf(p.estadoActual);
    if (i > 0) {
      const prev = ESTADOS[i-1];
      c.estado = prev; p.estadoActual = prev; p.h1=p.h2=p.h3=p.h4=false; p.ts=todayISO();
      saveDB();
      renderCursos();
      if (currentCursoId === id) openGestion(id);
    }
  }
});

[chk1,chk2,chk3,chk4].forEach(chk => chk.addEventListener("change", updateChecks));

btnSuspender.addEventListener("click", () => suspendOrPostpone("Suspendido"));
btnPostergar.addEventListener("click", () => suspendOrPostpone("Postergado"));

btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "capacitaciones_webdb.json";
  a.click();
});

fileImport.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== "object") throw new Error("JSON inválido");
    db = obj;
    saveDB();
    renderFilters();
    renderCursos();
    alert("Importado OK");
  } catch(err) {
    alert("No se pudo importar: " + err.message);
  } finally {
    e.target.value = "";
  }
});

btnReset.addEventListener("click", () => {
  if (!confirm("Esto borrará la base local del navegador. ¿Continuar?")) return;
  localStorage.removeItem(STORAGE_KEY);
  db = loadDB();
  renderFilters();
  renderCursos();
  panelGestion.hidden = true;
  currentCursoId = null;
});

// Boot
renderFilters();
renderCursos();