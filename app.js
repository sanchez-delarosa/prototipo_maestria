/* app.js — interfaz de dos paneles: lo que ve el estudiante y lo que hace el sistema. */
"use strict";

const CLAVE = "repaso-habilidades-v1";
let M = null;           // instancia de Motor
let pestana = "estado";
let aviso = "";         // mensaje de validación para el alumno

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const f2 = x => (typeof x === "number" && isFinite(x) ? x.toFixed(2) : "—");
const f3 = x => (typeof x === "number" && isFinite(x) ? x.toFixed(3) : "—");
const nombre = k => M.hab[k].nombre;

/* ---------------- Arranque ---------------- */
async function iniciar() {
  try {
    const [grafo, banco] = await Promise.all([
      fetch("datos/grafo.json").then(r => { if (!r.ok) throw new Error("grafo.json"); return r.json(); }),
      fetch("datos/preguntas.json").then(r => { if (!r.ok) throw new Error("preguntas.json"); return r.json(); }),
    ]);
    let guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { guardado = null; }
    M = new Motor(grafo, banco);
    if (guardado && guardado.sk && Object.keys(guardado.sk).length === M.ids.length && M.ids.every(id => guardado.sk[id])) {
      guardado.p = Object.assign(paramDefaults(), guardado.p || {});
      M.e = guardado;
    }
    if (!M.e.plan) M.planificar();
    conectar();
    render();
  } catch (err) {
    document.querySelector(".paneles").innerHTML = `<div class="error"><b>No se pudieron cargar los datos.</b>
      <p>El navegador bloquea la lectura de archivos JSON cuando la página se abre directamente desde el disco.
      Abre una terminal en la carpeta del prototipo y ejecuta <code>python -m http.server</code>; luego entra a <code>http://localhost:8000</code>.</p>
      <p>Detalle: ${esc(err.message)}</p></div>`;
  }
}

function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(M.e)); } catch (e) { /* sin almacenamiento: la sesión vive sólo en memoria */ } }

/* ---------------- Sesión del alumno ---------------- */
const plan = () => M.e.plan;
const actual = () => (plan() && M.e.pos < plan().items.length ? plan().items[M.e.pos] : null);

function prepararActual() {
  let it = actual();
  // Salta problemas de un tema que nunca se introdujo (por ejemplo, si cambió el plan)
  while (it && it.tipo === "problema" && !M.e.sk[it.j].acq) { it.resultado = "omitido"; M.e.pos++; it = actual(); }
  if (!it) return null;
  if (it.tipo === "ejemplo" && !M.e.sk[it.j].acq) M.introducir(it.j);
  if (!it.inst) it.inst = M.generar(it.j);
  if (it.tipo === "problema" && it.pred === undefined) it.pred = M.predecir(it.j);
  return it;
}

function responder(valor) {
  const it = actual();
  if (!it || it.tipo !== "problema" || it.resultado) return;
  const ok = revisar(it.inst, valor);
  if (ok === null) { aviso = "Escribe un número (puedes usar punto o coma decimal)."; render(); return; }
  aviso = "";
  it.valor = valor;
  it.resultado = ok ? "bien" : "mal";
  it.reg = M.observar(it.j, ok);
  render();
  const sig = $("#btn-sig");
  if (sig) sig.focus();
}

function siguiente() {
  const it = actual();
  if (!it) return;
  if (it.tipo === "ejemplo") it.visto = true;
  M.e.pos++;
  aviso = "";
  render();
  const inp = $("#resp");
  if (inp) inp.focus();
}

function respuestaIncorrecta(inst) {
  if (inst.tipo === "opcion") return (inst.correcta + 1) % inst.opciones.length;
  const r = inst.respuesta;
  return fmtNum(Math.abs(r) < 0.5 ? r + 1.7 : r * 1.37);
}
function respuestaCorrecta(inst) { return inst.tipo === "opcion" ? inst.correcta : fmtNum(inst.respuesta); }

function autoResponder(bien) {
  prepararActual();
  const it = actual();
  if (!it) return;
  if (it.tipo === "ejemplo") { siguiente(); return; }
  if (it.resultado) { siguiente(); return; }
  responder(bien ? respuestaCorrecta(it.inst) : respuestaIncorrecta(it.inst));
}

function simularDia() {
  let guard = 0;
  while (actual() && guard++ < 50) {
    const it = prepararActual();
    if (!it) break;
    if (it.tipo === "ejemplo") { it.visto = true; M.e.pos++; continue; }
    if (!it.resultado) {
      const ok = Math.random() < it.pred.P;
      const v = ok ? respuestaCorrecta(it.inst) : respuestaIncorrecta(it.inst);
      it.valor = v; it.resultado = ok ? "bien" : "mal"; it.reg = M.observar(it.j, ok);
    }
    M.e.pos++;
  }
  render();
}

function pasar(n) {
  if (plan()) for (const it of plan().items) if (!it.resultado && it.tipo === "problema") it.resultado = "omitido";
  M.pasarDias(n);
  aviso = "";
  render();
}

/* ---------------- Render: panel del estudiante ---------------- */
function renderProgreso() {
  const p = plan();
  $("#progreso").innerHTML = p ? p.items.map((it, i) => {
    let c = "punto";
    if (it.tipo === "ejemplo") c += it.visto ? " ejemplo" : "";
    else if (it.resultado === "bien") c += " bien";
    else if (it.resultado === "mal") c += " mal";
    else if (it.resultado === "omitido") c += " omitido";
    if (i === M.e.pos) c += " actual";
    const t = it.tipo === "ejemplo" ? "ejemplo resuelto" : (it.resultado || "pendiente");
    return `<span class="${c}" title="${i + 1}. ${esc(nombre(it.j))}: ${t}"></span>`;
  }).join("") : "";
}

const ORIGEN = { repaso: "Repaso", nuevo: "Tema nuevo", relleno: "Repaso adelantado" };

function renderAlumno() {
  const it = prepararActual();
  const p = plan();
  const total = p ? p.items.length : 0;
  const box = $("#alumno");
  const hechos = p ? p.items.filter(x => x.resultado === "bien" || x.resultado === "mal") : [];
  const bien = hechos.filter(x => x.resultado === "bien").length;

  if (!it) {
    const nada = total === 0;
    box.innerHTML = `
      <div class="saludo"><h3>${nada ? "Hoy no hay nada pendiente" : "¡Terminaste por hoy!"}</h3>
      <p>${nada ? "Todo lo que has visto sigue fresco y todavía no hay un tema nuevo listo para entrar." : "Vuelve mañana para el siguiente repaso."}</p></div>
      ${nada ? "" : `<div class="tarjeta fin"><span class="etiqueta">Resultado de la sesión</span><span class="cifra">${bien} / ${hechos.length}</span><p class="nota-alumno">problemas resueltos correctamente</p></div>`}
      <div class="acciones"><button class="btn primario grande" data-accion="dia">Pasa un día</button></div>
      <p class="nota-alumno">En la app real el estudiante simplemente regresaría al día siguiente. Aquí el botón adelanta el reloj.</p>`;
    return;
  }

  const n = M.e.pos + 1;
  const tema = esc(nombre(it.j));
  const cab = `<div class="saludo"><h3>Día ${M.e.t} · ${n} de ${total}</h3><p>${it.tipo === "ejemplo" ? "Vas a empezar un tema nuevo." : "Resuelve el problema y escribe sólo el número."}</p></div>`;

  if (it.tipo === "ejemplo") {
    const inst = it.inst;
    const res = inst.tipo === "opcion" ? esc(inst.opciones[inst.correcta]) : `${esc(fmtNum(inst.respuesta))} ${esc(inst.unidad)}`;
    box.innerHTML = `${cab}
      <article class="tarjeta">
        <span class="etiqueta"><span class="chip-origen nuevo">Tema nuevo</span><span class="tema">${tema}</span></span>
        <p class="enunciado">${esc(inst.enunciado)}</p>
        <div class="ejemplo-cuerpo">
          <span class="etiqueta">Ejemplo resuelto</span>
          <ol class="pasos">${inst.pasos.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
          <span class="res">Respuesta: ${res}</span>
        </div>
        <div class="acciones"><button class="btn primario grande" data-accion="siguiente">Entendido, a practicar</button></div>
      </article>`;
    return;
  }

  const inst = it.inst;
  const respondido = !!it.resultado && it.resultado !== "omitido";
  let entrada = "";
  if (inst.tipo === "opcion") {
    entrada = `<div class="opciones" role="group" aria-label="Opciones">${inst.opciones.map((o, i) => {
      let c = "opcion";
      if (respondido) { if (i === inst.correcta) c += " correcta"; if (String(i) === String(it.valor)) c += " elegida" + (i === inst.correcta ? "" : " incorrecta"); }
      return `<button class="${c}" data-accion="opcion" data-i="${i}" ${respondido ? "disabled" : ""}>${esc(o)}</button>`;
    }).join("")}</div>`;
  } else {
    entrada = `<form class="respuesta-fila" id="form-resp">
        <input id="resp" name="resp" inputmode="decimal" autocomplete="off" aria-label="Tu respuesta" value="${respondido ? esc(it.valor) : ""}" ${respondido ? "disabled" : ""}>
        <span class="unidad">${esc(inst.unidad)}</span>
        ${respondido ? "" : `<button class="btn primario grande" type="submit">Comprobar</button>`}
      </form>`;
  }
  let retro = "";
  if (respondido) {
    const ok = it.resultado === "bien";
    const correcta = inst.tipo === "opcion" ? esc(inst.opciones[inst.correcta]) : `${esc(fmtNum(inst.respuesta))} ${esc(inst.unidad)}`;
    retro = `<div class="retro ${ok ? "bien" : "mal"}">
        <span class="retro-t">${ok ? "Correcto" : `No es correcto. La respuesta es ${correcta}`}</span>
        <ol class="pasos">${inst.pasos.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      </div>
      <div class="acciones"><button class="btn primario grande" data-accion="siguiente" id="btn-sig">Siguiente</button></div>`;
  }
  box.innerHTML = `${cab}
    <article class="tarjeta">
      <span class="etiqueta"><span class="chip-origen ${it.origen}">${ORIGEN[it.origen]}</span><span class="tema">${tema}</span></span>
      <p class="enunciado">${esc(inst.enunciado)}</p>
      ${entrada}
      ${aviso ? `<p class="aviso" role="alert">${esc(aviso)}</p>` : ""}
      ${retro}
    </article>`;
}

/* ---------------- Render: panel del sistema ---------------- */
function renderActual() {
  const it = actual();
  const box = $("#actual");
  if (it && it.tipo === "problema" && !it.resultado && it.pred) {
    const pr = it.pred;
    const filas = pr.det.map(d => `  ${d.k.padEnd(6)} w = ${d.w.toFixed(2)}   R̂ = ${f3(d.R)}   R̂^w = ${f3(d.Rw)}`).join("\n");
    box.innerHTML = `<div class="caja">
      <h3>Problema actual: ${esc(it.j)} · ${esc(nombre(it.j))}</h3>
      <p class="sub">Antes de que el estudiante responda, el modelo predice su probabilidad de acierto con el modelo conjuntivo.</p>
      <div class="formula">Componentes del problema:
${filas}
Π = ∏ R̂^w = ${f3(pr.Pi)}
P̂(acierto) = (1 − s)·Π + g·(1 − Π) = ${(1 - M.p.s).toFixed(2)}·${f3(pr.Pi)} + ${M.p.g.toFixed(2)}·${f3(1 - pr.Pi)} = <span class="ok">${f3(pr.P)}</span></div>
    </div>`;
    return;
  }
  if (it && it.tipo === "ejemplo") {
    box.innerHTML = `<div class="caja"><h3>Tema nuevo: ${esc(it.j)} · ${esc(nombre(it.j))}</h3>
      <p class="sub">Al mostrar el ejemplo, el tema entra al modelo con Ŝ = Ŝ₀ = ${fmtNum(M.p.S0)} y L̂ = ${M.e.t}. Sus intentos de hoy no actualizan Ŝ: la práctica justo después de la explicación ocurre con R̂ ≈ 1 y no dice nada sobre la memoria de largo plazo.</p></div>`;
    return;
  }
  const u = M.e.ultimo;
  if (u && u.t === M.e.t) { box.innerHTML = cajaActualizacion(u); return; }
  box.innerHTML = `<div class="caja"><h3>Sin problema en curso</h3><p class="sub">Pulsa «Pasa un día» para que el sistema arme la siguiente sesión.</p></div>`;
}

function cajaActualizacion(u) {
  const p = M.p;
  const lineas = u.comps.map(c => {
    if (c.omitido) return `<span class="dim">${c.k.padEnd(6)} ya se actualizó hoy → sin cambio (Ŝ = ${f2(c.Santes)})</span>`;
    if (u.acierto) {
      return `${c.k.padEnd(6)} Ŝ = ${f2(c.Santes)} × [1 + ${c.w.toFixed(2)}·${p.G}·(1 − ${f3(c.Rantes)})] = ${f2(c.Santes)} × ${f3(c.factor)} = <span class="ok">${f2(c.Sdesp)}</span>
       R̂ = ${f3(c.Rantes)} + ${c.w.toFixed(2)}·(1 − ${f3(c.Rantes)}) = ${f3(c.Rdesp)}`;
    }
    const num = 1 - Math.pow(c.Rantes, c.w);
    const formulaB = p.culpa ? `b = (1 − R̂^w)(1 − g) / [(1 − Π)(1 − g) + Π·s]` : `b = (1 − R̂^w) / (1 − Π) = ${f3(num)} / ${f3(1 - u.Pi)}`;
    return `${c.k.padEnd(6)} ${formulaB} = ${f3(c.b)}
       Ŝ = max(${p.Smin}, ${f2(c.Santes)} × (1 − ${p.lambda}·${f3(c.b)})) = <span class="bad">${f2(c.Sdesp)}</span>
       R̂ = ${f3(c.Rantes)} + ${c.w.toFixed(2)}·(1 − ${f3(c.Rantes)}) = ${f3(c.Rdesp)}`;
  }).join("\n");
  return `<div class="caja">
    <h3>Última actualización: ${esc(u.j)} · ${esc(nombre(u.j))} <span class="resultado ${u.acierto ? "bien" : "mal"}">${u.acierto ? "acierto" : "fallo"}</span></h3>
    <p class="sub">Predicción antes de responder: P̂ = ${f3(u.P)} (Π = ${f3(u.Pi)}). ${u.acierto ? "Cada componente recibe crédito según su peso; gana más si R̂ era bajo." : "La culpa se reparte según qué componente es más probable que haya fallado."}</p>
    <div class="formula">${lineas}</div>
  </div>`;
}

const ESTADO_TXT = { aldia: "al día", vencida: "vencida", nueva: "nueva hoy", lista: "lista para entrar", bloqueada: "bloqueada" };

function renderGrafo() {
  const cols = {}, pos = {};
  for (const id of M.ids) (cols[M.prof[id]] ||= []).push(id);
  const NW = 68, NH = 38, CX = 88, CY = 50, X0 = 4, Y0 = 4;
  const maxFil = Math.max(...Object.values(cols).map(c => c.length));
  const ncol = Math.max(...Object.keys(cols).map(Number)) + 1;
  for (const [d, ids] of Object.entries(cols)) ids.forEach((id, i) => { pos[id] = { x: X0 + d * CX, y: Y0 + i * CY }; });
  const W = X0 * 2 + (ncol - 1) * CX + NW, H = Y0 * 2 + (maxFil - 1) * CY + NH;
  const it = actual();
  const activos = it && it.tipo === "problema" ? M.comps(it.j).map(([k]) => k) : (it ? [it.j] : []);
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafo de habilidades con el recuerdo estimado de cada una">`;
  for (const id of M.ids) for (const p of M.hab[id].pre) {
    const a = pos[p], b = pos[id];
    const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
    s += `<path class="g-edge" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`;
  }
  for (const id of M.ids) {
    const p = pos[id], st = M.estado(id), R = M.R(id);
    const h = Math.max(0, Math.min(1, R)) * (NH - 2);
    const cls = `g-node ${st}${activos.includes(id) ? " activo" : ""}`;
    s += `<g class="${cls}" transform="translate(${p.x},${p.y})"><title>${esc(id)} · ${esc(nombre(id))} (${ESTADO_TXT[st]})</title>
      <rect class="base" width="${NW}" height="${NH}" rx="6"/>
      <rect class="lleno" x="1" y="${(NH - 1 - h).toFixed(1)}" width="${NW - 2}" height="${h.toFixed(1)}" rx="5" opacity="0.22"/>
      <text x="7" y="15">${esc(id)}</text>
      <text class="r" x="7" y="30">${M.e.sk[id].acq ? `R̂ ${R.toFixed(2)}` : ESTADO_TXT[st]}</text></g>`;
  }
  return s + "</svg>";
}

function renderEstado() {
  const p = M.p, cd = M.e.cambiosDia && M.e.cambiosDia.t === M.e.t ? M.e.cambiosDia : null;
  const enPlan = new Set((plan() ? plan().items : []).map(x => x.j));
  const L = M.carga(), lim = p.rho * p.U, maxEsc = Math.max(lim * 1.25, L * 1.05, 1);
  const filas = M.ids.map(id => {
    const s = M.e.sk[id], st = M.estado(id), R = M.R(id);
    const v = M.vence(id);
    const ch = cd && cd.porHab[id];
    const dlt = ch ? `<span class="delta">${ch.antes.toFixed(2)}→</span>` : "";
    const barra = s.acq ? `<span class="barra">${dlt}<span class="pista"><span class="val" style="width:${(R * 100).toFixed(1)}%"></span><span class="marca-r" style="left:${(p.rStar * 100).toFixed(1)}%"></span></span><span>${R.toFixed(2)}</span></span>` : "—";
    let motivo = "";
    if (!s.acq && st === "bloqueada") {
      const Rm = Object.fromEntries(M.ids.map(k => [k, M.R(k)]));
      motivo = ` title="${esc(M.revisarAdmision(id, Rm).join("; "))}"`;
    }
    return `<tr class="${enPlan.has(id) ? "enplan" : ""}">
      <td><span class="cod">${esc(id)}</span>${esc(nombre(id))}</td>
      <td><span class="estado ${st}"${motivo}>${ESTADO_TXT[st]}</span></td>
      <td class="num">${s.acq ? f2(s.S) : "—"}</td>
      <td>${barra}</td>
      <td class="num">${v === null ? "—" : v === 0 ? "hoy" : `${v.toFixed(1)} d`}</td>
      <td class="num">${s.n ? `${s.ok}/${s.n}` : "—"}</td>
    </tr>`;
  }).join("");
  $("#vista-estado").innerHTML = `
    <div class="caja">
      <h3>Grafo de habilidades</h3>
      <p class="sub">El relleno de cada caja es el recuerdo estimado R̂. Borde grueso: componentes del problema actual.</p>
      <div class="grafo-caja">${renderGrafo()}</div>
      <div class="leyenda"><span><i style="border-color:var(--warn);border-width:2px"></i>vencida (R̂ &lt; r*)</span><span><i style="border-style:dashed;border-color:var(--accent)"></i>lista para entrar</span><span><i style="border-style:dashed"></i>bloqueada por sus prerrequisitos</span></div>
    </div>
    <div class="caja">
      <h3>Parámetros por habilidad</h3>
      <p class="sub">${cd ? `Pasó ${cd.n === 1 ? "un día" : `${cd.n} días`}: Ŝ no cambia con el tiempo; sólo baja R̂ = e^(−Δt/Ŝ). La columna R̂ muestra antes→ahora.` : "Ŝ sólo cambia cuando el estudiante responde; R̂ baja con el paso de los días."} La marca naranja en la barra es r* = ${p.rStar}.</p>
      <div class="tabla-caja"><table>
        <thead><tr><th>Habilidad</th><th>Estado</th><th>Ŝ (días)</th><th>R̂ hoy</th><th>Vence en</th><th>Aciertos</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>
    </div>
    <div class="caja carga">
      <h3>Carga de mantenimiento</h3>
      <p class="sub">𝓛 = Σ min(1, 1 / (Ŝ·ln(1/r*))) = ${f2(L)} repasos por día esperados. Se admite un tema nuevo sólo si 𝓛 + 1 ≤ ρ·U = ${f2(lim)}.</p>
      <div class="pista"><span class="val" style="width:${(L / maxEsc * 100).toFixed(1)}%"></span><span class="lim" style="left:${(lim / maxEsc * 100).toFixed(1)}%"></span></div>
    </div>`;
}

function renderPlan() {
  const pl = plan();
  if (!pl) { $("#vista-plan").innerHTML = `<p class="vacio">Todavía no hay plan.</p>`; return; }
  const e = pl.expl, p = M.p;
  const venc = e.vencidas.length
    ? `<ul class="lista-plan">${e.vencidas.sort((a, b) => b.pi - a.pi).map(v => `<li><span class="cod">${esc(v.k)}</span>${esc(nombre(v.k))}<span class="num">R̂ = ${f3(v.R)} → π = 1 − R̂ = ${f3(v.pi)}</span></li>`).join("")}</ul>`
    : `<p class="vacio">Ninguna: todo lo visto tiene R̂ ≥ r* = ${p.rStar}.</p>`;
  const voraz = e.voraz.length
    ? `<ol class="lista-plan">${e.voraz.map(v => `<li><span class="cod">${esc(v.j)}</span>ganancia Δ = ${f3(v.ganancia)}<span class="num">${v.cubre.map(c => `${c.k}: π·resto·w = ${f3(c.aporte)}`).join(" + ")}</span></li>`).join("")}</ol>`
    : `<p class="vacio">No hubo repasos por vencimiento.</p>`;
  const nf = e.noFactible.length ? `<p class="sub">No se usaron por tener un componente con R̂ &lt; r_min = ${p.rMin}: ${e.noFactible.map(esc).join(", ")}.</p>` : "";
  const adm = e.admision.length
    ? `<ul class="lista-plan">${e.admision.map(a => {
        const r = a.admitido ? `<span class="ok-t">entra hoy</span><span class="num">carga ${f2(a.carga)} + 1 ≤ ${f2(e.limite)}</span>`
          : a.listo ? `<span class="no-t">lista, pero no entra${a.motivoCarga ? `: ${esc(a.motivoCarga)}` : ": se alcanzó el máximo de temas nuevos o no quedan lugares"}</span>`
          : `<span class="no-t">bloqueada: ${esc(a.faltan.join("; "))}</span>`;
        return `<li><span class="cod">${esc(a.k)}</span>${esc(nombre(a.k))} ${r}</li>`;
      }).join("")}</ul>`
    : `<p class="vacio">Ya se introdujeron todos los temas.</p>`;
  const rel = e.relleno.length
    ? `<ul class="lista-plan">${e.relleno.map(r => `<li><span class="cod">${esc(r.j)}</span>${r.extra ? "práctica extra" : "repaso adelantado"}<span class="num">R̂ = ${f3(r.R)}</span></li>`).join("")}</ul>`
    : `<p class="vacio">${p.extra ? "No sobraron lugares." : "Lugares sobrantes sin usar (práctica extra desactivada): la sesión termina antes."}</p>`;
  $("#vista-plan").innerHTML = `
    <div class="caja"><h3>1. Habilidades vencidas</h3><p class="sub">Vencida si R̂ &lt; r*. Su prioridad π = 1 − R̂ tiene la forma de la intensidad óptima de Tabibian.</p>${venc}</div>
    <div class="caja"><h3>2. Cobertura voraz (U = ${p.U} lugares)</h3><p class="sub">En cada paso entra el problema que más masa vencida cubre: Δ(j) = Σ π_k · resto_k · w_jk. Después, resto_k ← resto_k·(1 − w_jk).</p>${voraz}${nf}</div>
    <div class="caja"><h3>3. Admisión de temas nuevos</h3><p class="sub">Entra un tema si cada prerrequisito tiene Ŝ ≥ S_listo = ${p.Slisto} y R̂ ≥ r*, y si la carga cabe: 𝓛 + 1 ≤ ρ·U. Hasta ${p.maxNew} por día; cada uno cuesta ${p.nIntro} lugares.</p>${adm}</div>
    <div class="caja"><h3>4. Lugares sobrantes</h3><p class="sub">Se llenan con lo menos recordado que todavía no venció.</p>${rel}</div>`;
}

function renderBitacora() {
  const b = M.e.bitacora;
  if (!b.length) { $("#vista-bitacora").innerHTML = `<p class="vacio">Aquí aparecerá cada evento: temas nuevos, respuestas y días que pasan.</p>`; return; }
  $("#vista-bitacora").innerHTML = `<ul class="bitacora">${b.map(r => {
    if (r.tipo === "dia") {
      const bajadas = r.cambios.map(c => `${c.k} ${c.antes.toFixed(2)}→${c.despues.toFixed(2)}`).join(" · ");
      return `<li class="dia"><span class="cuando">día ${r.t}</span><span>Pasó ${r.n === 1 ? "un día" : `${r.n} días`}. ${r.vencidas.length ? `Vencieron: ${r.vencidas.map(esc).join(", ")}.` : "No venció ninguna habilidad."}${r.pendientes ? ` Quedaron ${r.pendientes} problemas sin hacer; no cuentan como evidencia.` : ""}</span>${bajadas ? `<span class="det">R̂: ${esc(bajadas)}</span>` : ""}</li>`;
    }
    if (r.tipo === "intro") return `<li class="intro"><span class="cuando">día ${r.t}</span><span>Entró ${esc(r.k)} · ${esc(nombre(r.k))} con Ŝ = ${f2(r.S)}.</span></li>`;
    const cambios = r.comps.map(c => c.omitido ? `${c.k} sin cambio` : `${c.k} Ŝ ${f2(c.Santes)}→${f2(c.Sdesp)}${c.b !== undefined ? ` (b = ${c.b.toFixed(2)})` : ""}`).join(" · ");
    return `<li><span class="cuando">día ${r.t}</span><span>${esc(r.j)} · ${esc(nombre(r.j))} <span class="resultado ${r.acierto ? "bien" : "mal"}">${r.acierto ? "acierto" : "fallo"}</span> con P̂ = ${f2(r.P)}</span><span class="det">${esc(cambios)}</span></li>`;
  }).join("")}</ul>`;
}

function renderParametros() {
  const grupos = {};
  for (const d of PARAMS) (grupos[d.grupo] ||= []).push(d);
  $("#vista-parametros").innerHTML = `
    <div class="caja"><p class="sub">Los valores de Ŝ₀, G y λ son los que se estimaron por máxima verosimilitud en la simulación (grafo de subtemas). Los cambios en el modelo se aplican desde la siguiente respuesta; los del planificador, desde el siguiente plan.</p>
      <div class="acciones"><button class="btn mini" data-accion="replanificar">Rehacer el plan de hoy</button><button class="btn mini" data-accion="defaults">Restaurar valores</button></div></div>
    ${Object.entries(grupos).map(([g, ds]) => `<h3 class="grupo-t">${esc(g)}</h3><div class="params">${ds.map(d => `
      <div class="param"><label for="p-${d.k}">${esc(d.nombre)}</label>
        <input id="p-${d.k}" type="number" step="${d.paso}" ${d.min !== undefined ? `min="${d.min}"` : ""} ${d.max !== undefined ? `max="${d.max}"` : ""} value="${M.p[d.k]}" data-param="${d.k}">
        <small>${esc(d.txt)}</small></div>`).join("")}</div>`).join("")}`;
}

function render() {
  $("#dia").textContent = `Día ${M.e.t}`;
  renderProgreso();
  renderAlumno();
  renderActual();
  renderEstado();
  renderPlan();
  renderBitacora();
  if (pestana === "parametros" && !document.activeElement?.dataset?.param) renderParametros();
  for (const b of document.querySelectorAll(".pestana")) b.setAttribute("aria-selected", String(b.dataset.pestana === pestana));
  for (const v of ["estado", "plan", "bitacora", "parametros"]) $(`#vista-${v}`).hidden = v !== pestana;
  guardar();
}

/* ---------------- Eventos ---------------- */
let confirmarReinicio = false;
function conectar() {
  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-accion], [data-pestana]");
    if (!b) return;
    if (b.dataset.pestana) { pestana = b.dataset.pestana; if (pestana === "parametros") renderParametros(); render(); return; }
    const a = b.dataset.accion;
    if (a !== "reiniciar" && confirmarReinicio) { confirmarReinicio = false; $("#btn-reiniciar").textContent = "Reiniciar"; }
    if (a === "dia") pasar(1);
    else if (a === "semana") pasar(7);
    else if (a === "siguiente") siguiente();
    else if (a === "opcion") responder(b.dataset.i);
    else if (a === "auto-bien") autoResponder(true);
    else if (a === "auto-mal") autoResponder(false);
    else if (a === "auto-dia") simularDia();
    else if (a === "replanificar") { M.planificar(); render(); }
    else if (a === "defaults") { M.e.p = paramDefaults(); renderParametros(); render(); }
    else if (a === "reiniciar") {
      if (!confirmarReinicio) { confirmarReinicio = true; b.textContent = "¿Borrar todo? Pulsa otra vez"; return; }
      confirmarReinicio = false; b.textContent = "Reiniciar";
      M.e = M.estadoInicial(M.e.p); M.planificar(); aviso = ""; render();
    }
  });
  document.addEventListener("submit", ev => {
    if (ev.target.id !== "form-resp") return;
    ev.preventDefault();
    responder($("#resp").value);
  });
  document.addEventListener("change", ev => {
    const k = ev.target.dataset && ev.target.dataset.param;
    if (!k) return;
    const v = parseFloat(ev.target.value);
    if (isFinite(v)) { M.e.p[k] = v; render(); }
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Enter" && document.activeElement === document.body) { const sig = $("#btn-sig"); if (sig) sig.click(); }
  });
}

iniciar();
