/* motor.js — modelo de repetición espaciada sobre un grafo de habilidades.
 *
 * Es el mismo modelo del simulador (simulador.py, clases Belief y Proposed):
 *   memoria      R̂_k(t) = exp(−(t − L̂_k) / Ŝ_k)
 *   observación  P̂(acierto) = (1 − s)·Π + g·(1 − Π),   Π = ∏ R̂_k^{w_jk}
 *   acierto      Ŝ_k ← Ŝ_k·[1 + w·G·(1 − R̂_k)]
 *   fallo        b_k = (1 − R̂_k^w) / (1 − Π),   Ŝ_k ← max(Ŝ_min, Ŝ_k·(1 − λ·b_k))
 *   salto        R̂_k ← R̂_k + w·(1 − R̂_k)   (el alumno ve la solución)
 *   admisión     prerrequisitos con Ŝ ≥ S_listo y R̂ ≥ r*, y carga + 1 ≤ ρ·U
 *   sesión       cobertura voraz de las habilidades vencidas (R̂ < r*)
 * Diferencia: aquí cada día es una sesión, así que la carga usa 1 sesión por día.
 */
"use strict";

/* ---------------- Expresiones seguras para las plantillas ---------------- */
const Expr = (() => {
  const rad = x => x * Math.PI / 180, deg = x => x * 180 / Math.PI;
  const FUN = {
    sqrt: Math.sqrt, abs: Math.abs, min: Math.min, max: Math.max,
    sin: x => Math.sin(rad(x)), cos: x => Math.cos(rad(x)), tan: x => Math.tan(rad(x)),
    asin: x => deg(Math.asin(x)), acos: x => deg(Math.acos(x)), atan: x => deg(Math.atan(x)),
  };
  const cache = new Map();
  function tokenize(src) {
    const re = /\s*(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-z_]\w*|[-+*/^(),])/y;
    const toks = [];
    re.lastIndex = 0;
    while (re.lastIndex < src.length) {
      const start = re.lastIndex;
      const m = re.exec(src);
      if (!m) {
        if (/^\s*$/.test(src.slice(start))) break;
        throw new Error(`Expresión inválida: «${src}»`);
      }
      toks.push(m[1]);
    }
    return toks;
  }
  function compile(src) {
    if (cache.has(src)) return cache.get(src);
    const t = tokenize(src);
    let i = 0;
    const peek = () => t[i], next = () => t[i++];
    const expect = s => { if (t[i] !== s) throw new Error(`Falta «${s}» en «${src}»`); i++; };
    function expr() { let a = term(); while (peek() === "+" || peek() === "-") { const op = next(), b = term(), l = a; a = op === "+" ? e => l(e) + b(e) : e => l(e) - b(e); } return a; }
    function term() { let a = unary(); while (peek() === "*" || peek() === "/") { const op = next(), b = unary(), l = a; a = op === "*" ? e => l(e) * b(e) : e => l(e) / b(e); } return a; }
    function unary() { if (peek() === "-") { next(); const a = unary(); return e => -a(e); } if (peek() === "+") { next(); return unary(); } return power(); }
    function power() { const b = primary(); if (peek() === "^") { next(); const x = unary(); return e => Math.pow(b(e), x(e)); } return b; }
    function primary() {
      const tk = next();
      if (tk === undefined) throw new Error(`Expresión incompleta: «${src}»`);
      if (/^[\d.]/.test(tk)) { const v = parseFloat(tk); return () => v; }
      if (tk === "(") { const a = expr(); expect(")"); return a; }
      if (/^[A-Za-z_]/.test(tk)) {
        if (peek() === "(") {
          next();
          const f = FUN[tk];
          if (!f) throw new Error(`Función desconocida «${tk}»`);
          const args = [];
          if (peek() !== ")") { args.push(expr()); while (peek() === ",") { next(); args.push(expr()); } }
          expect(")");
          return e => f(...args.map(a => a(e)));
        }
        return e => { if (!(tk in e)) throw new Error(`Variable desconocida «${tk}»`); return e[tk]; };
      }
      throw new Error(`Símbolo inesperado «${tk}» en «${src}»`);
    }
    const f = expr();
    if (i < t.length) throw new Error(`Sobra «${t[i]}» en «${src}»`);
    cache.set(src, f);
    return f;
  }
  return { compile, evaluar: (src, env) => compile(src)(env) };
})();

function fmtNum(x) {
  if (typeof x !== "number" || !isFinite(x)) return String(x);
  const d = Math.abs(x) >= 100 ? 1 : 2;
  let s = x.toFixed(d).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
}

/* ---------------- Plantillas de problemas ---------------- */
function sortear(spec) {
  if (Array.isArray(spec)) {
    const [a, b, p] = spec;
    const n = Math.floor((b - a) / p + 1e-9);
    return +(a + p * Math.floor(Math.random() * (n + 1))).toFixed(6);
  }
  if (spec && Array.isArray(spec.valores)) return spec.valores[Math.floor(Math.random() * spec.valores.length)];
  return spec;
}

function instanciar(pl) {
  const env = { g: 9.8 };
  for (const [k, s] of Object.entries(pl.variables || {})) env[k] = sortear(s);
  for (const [k, ex] of Object.entries(pl.derivadas || {})) env[k] = Expr.evaluar(ex, env);
  const tipo = pl.tipo || "numero";
  if (tipo !== "opcion") env.respuesta = Expr.evaluar(pl.respuesta, env);
  const txt = s => String(s).replace(/\{(\w+)\}/g, (m, n) => (n in env ? fmtNum(env[n]) : m));
  return {
    plantilla: pl.id, habilidad: pl.habilidad, tipo,
    enunciado: txt(pl.enunciado), pasos: (pl.pasos || []).map(txt),
    unidad: pl.unidad || "", respuesta: tipo === "opcion" ? null : env.respuesta,
    tolerancia: pl.tolerancia ?? 0.02,
    opciones: (pl.opciones || []).map(txt), correcta: pl.correcta,
  };
}

function revisar(inst, valor) {
  if (inst.tipo === "opcion") return Number(valor) === inst.correcta;
  const x = parseFloat(String(valor).replace(",", ".").trim());
  if (!isFinite(x)) return null;
  return Math.abs(x - inst.respuesta) <= Math.max(inst.tolerancia * Math.abs(inst.respuesta), 0.01);
}

/* ---------------- Parámetros ---------------- */
const PARAMS = [
  { k: "S0", nombre: "Ŝ₀", def: 8.2, paso: 0.1, min: 0.5, grupo: "Modelo", txt: "Estabilidad con la que arranca un tema nuevo (días, escala exponencial)." },
  { k: "G", nombre: "G", def: 7.2, paso: 0.1, min: 0, grupo: "Modelo", txt: "Ganancia por acierto: Ŝ ← Ŝ·[1 + w·G·(1 − R̂)]." },
  { k: "lambda", nombre: "λ", def: 0.13, paso: 0.01, min: 0, max: 1, grupo: "Modelo", txt: "Severidad del fallo: Ŝ ← Ŝ·(1 − λ·b)." },
  { k: "s", nombre: "s", def: 0.05, paso: 0.01, min: 0, max: 0.5, grupo: "Modelo", txt: "Descuido: fallar aunque sepa todo." },
  { k: "g", nombre: "g", def: 0.02, paso: 0.01, min: 0, max: 0.5, grupo: "Modelo", txt: "Adivinanza: acertar sin saber." },
  { k: "wPre", nombre: "w_pre", def: 0.5, paso: 0.05, min: 0, max: 1, grupo: "Modelo", txt: "Cuánto ejercita un problema a cada prerrequisito directo." },
  { k: "Smin", nombre: "Ŝ_min", def: 0.2, paso: 0.1, min: 0.05, grupo: "Modelo", txt: "Piso de estabilidad." },
  { k: "rStar", nombre: "r*", def: 0.7, paso: 0.05, min: 0.3, max: 0.99, grupo: "Planificador", txt: "Retención objetivo: un tema vence cuando R̂ < r*." },
  { k: "rMin", nombre: "r_min", def: 0.6, paso: 0.05, min: 0, max: 0.99, grupo: "Planificador", txt: "No usar un problema si alguno de sus otros componentes tiene R̂ < r_min." },
  { k: "Slisto", nombre: "S_listo", def: 12, paso: 1, min: 0, grupo: "Planificador", txt: "Estabilidad mínima de cada prerrequisito para admitir un tema." },
  { k: "rho", nombre: "ρ", def: 0.8, paso: 0.05, min: 0.1, max: 1, grupo: "Planificador", txt: "Fracción máxima de la sesión que puede ocupar el mantenimiento." },
  { k: "U", nombre: "U", def: 5, paso: 1, min: 1, max: 20, grupo: "Planificador", txt: "Lugares por sesión (problemas y ejemplos)." },
  { k: "nIntro", nombre: "n_intro", def: 2, paso: 1, min: 1, max: 5, grupo: "Planificador", txt: "Lugares que cuesta introducir un tema: ejemplo resuelto + práctica." },
  { k: "maxNew", nombre: "nuevos/día", def: 2, paso: 1, min: 0, max: 5, grupo: "Planificador", txt: "Temas nuevos máximos por sesión." },
  { k: "extra", nombre: "práctica extra", def: 0, paso: 1, min: 0, max: 1, grupo: "Planificador", txt: "1 = llenar los lugares sobrantes repitiendo temas; 0 = terminar la sesión antes." },
  { k: "culpa", nombre: "culpa completa", def: 0, paso: 1, min: 0, max: 1, grupo: "Modelo", txt: "0 = b = (1 − R̂^w)/(1 − Π), como en la simulación; 1 = versión bayesiana que incluye s y g." },
];
const paramDefaults = () => Object.fromEntries(PARAMS.map(p => [p.k, p.def]));

/* ---------------- Modelo ---------------- */
class Motor {
  constructor(grafo, banco, estado) {
    this.grafo = grafo;
    this.ids = grafo.habilidades.map(h => h.id);
    this.hab = Object.fromEntries(grafo.habilidades.map(h => [h.id, h]));
    this.post = Object.fromEntries(this.ids.map(id => [id, []]));
    for (const h of grafo.habilidades) for (const p of h.pre) this.post[p].push(h.id);
    this.prof = {};
    for (const id of this.ids) { const h = this.hab[id]; this.prof[id] = h.pre.length ? 1 + Math.max(...h.pre.map(p => this.prof[p])) : 0; }
    this.porHab = {};
    for (const pl of banco.plantillas) (this.porHab[pl.habilidad] ||= []).push(pl);
    for (const id of this.ids) if (!this.porHab[id]) throw new Error(`No hay preguntas para ${id}`);
    this.e = estado || this.estadoInicial();
  }

  estadoInicial(params) {
    return {
      t: 0,
      p: params || paramDefaults(),
      sk: Object.fromEntries(this.ids.map(id => [id, { acq: false, S: 0, L: 0, n: 0, ok: 0, intro: null, ultima: null }])),
      hoy: [],
      plan: null,
      pos: 0,
      ultimo: null,
      bitacora: [],
    };
  }

  get p() { return this.e.p; }
  R(k, t = this.e.t) { const s = this.e.sk[k]; return s.acq ? Math.exp(-(t - s.L) / s.S) : 0; }
  comps(j) { return [[j, 1], ...this.hab[j].pre.map(q => [q, this.p.wPre])]; }

  predecir(j, t = this.e.t) {
    const det = this.comps(j).map(([k, w]) => { const R = this.R(k, t); return { k, w, R, Rw: R > 0 ? Math.pow(R, w) : 0 }; });
    const Pi = det.reduce((a, d) => a * d.Rw, 1);
    return { Pi, P: (1 - this.p.s) * Pi + this.p.g * (1 - Pi), det };
  }

  carga(extra = 0) {
    const c = Math.log(1 / this.p.rStar);
    let L = 0;
    for (const id of this.ids) { const s = this.e.sk[id]; if (s.acq) L += Math.min(1, 1 / (s.S * c)); }
    return L + extra;
  }

  vence(k) {
    const s = this.e.sk[k];
    if (!s.acq) return null;
    const R = this.R(k);
    return R < this.p.rStar ? 0 : s.S * Math.log(R / this.p.rStar);
  }

  /* Por qué una habilidad no introducida puede o no entrar hoy */
  revisarAdmision(k, R) {
    const p = this.p, faltan = [];
    for (const q of this.hab[k].pre) {
      const s = this.e.sk[q];
      if (!s.acq) faltan.push(`${q} no se ha visto`);
      else if (s.S < p.Slisto) faltan.push(`${q}: Ŝ = ${fmtNum(s.S)} < S_listo = ${fmtNum(p.Slisto)}`);
      else if (R[q] < p.rStar) faltan.push(`${q}: R̂ = ${R[q].toFixed(2)} < r* = ${p.rStar}`);
    }
    return faltan;
  }

  introducir(k) {
    const s = this.e.sk[k];
    if (s.acq) return;
    Object.assign(s, { acq: true, S: this.p.S0, L: this.e.t, intro: this.e.t });
    if (!this.e.hoy.includes(k)) this.e.hoy.push(k);
    this.registrar({ tipo: "intro", t: this.e.t, k, S: s.S });
  }

  /* ---------- Planificación de la sesión (Algoritmo 1) ---------- */
  planificar() {
    const p = this.p, t = this.e.t;
    const acq = this.ids.filter(id => this.e.sk[id].acq);
    const R = Object.fromEntries(this.ids.map(id => [id, this.R(id, t)]));
    const due = {};
    for (const k of acq) if (R[k] < p.rStar) due[k] = 1 - R[k];
    const resid = Object.fromEntries(Object.keys(due).map(k => [k, 1]));
    const factible = acq.filter(j => this.comps(j).every(([c]) => c === j || (this.e.sk[c].acq && R[c] >= p.rMin)));
    const noFactible = acq.filter(j => !factible.includes(j) && j in due);
    const expl = { t, R, vencidas: Object.entries(due).map(([k, pi]) => ({ k, R: R[k], pi })), voraz: [], noFactible, admision: [], relleno: [], cargaInicial: this.carga(), limite: p.rho * p.U };

    const usados = new Set(), repasos = [];
    let lugares = p.U;
    while (lugares > 0 && Object.keys(due).length) {
      let mejor = null, mg = 1e-3, cubre = null;
      for (const j of factible) {
        if (usados.has(j)) continue;
        const partes = [];
        let gan = 0;
        for (const [k, w] of this.comps(j)) if (k in due) { const a = due[k] * resid[k] * w; gan += a; partes.push({ k, w, aporte: a }); }
        if (gan > mg) { mejor = j; mg = gan; cubre = partes; }
      }
      if (!mejor) break;
      usados.add(mejor); repasos.push(mejor); lugares--;
      expl.voraz.push({ j: mejor, ganancia: mg, cubre });
      for (const [k, w] of this.comps(mejor)) if (k in resid) resid[k] *= 1 - w;
    }

    const nuevos = [];
    const candidatos = this.ids.filter(id => !this.e.sk[id].acq);
    for (const k of candidatos) {
      const faltan = this.revisarAdmision(k, R);
      expl.admision.push({ k, listo: faltan.length === 0, faltan, admitido: false });
    }
    while (nuevos.length < p.maxNew && lugares >= p.nIntro) {
      const L = this.carga(nuevos.length);
      const cand = expl.admision.find(a => a.listo && !a.admitido);
      if (!cand) break;
      if (L + 1 > p.rho * p.U) { cand.motivoCarga = `carga ${fmtNum(L)} + 1 > ρ·U = ${fmtNum(p.rho * p.U)}`; break; }
      cand.admitido = true; cand.carga = L;
      nuevos.push(cand.k); lugares -= p.nIntro;
    }

    const relleno = [];
    const pool = factible.filter(j => !usados.has(j)).sort((a, b) => R[a] - R[b]);
    while (lugares > 0 && pool.length) { const j = pool.shift(); relleno.push(j); usados.add(j); lugares--; expl.relleno.push({ j, R: R[j], extra: false }); }
    if (p.extra) {
      const rep = [...acq, ...nuevos];
      while (lugares > 0 && rep.length) { const j = rep[Math.floor(Math.random() * rep.length)]; relleno.push(j); lugares--; expl.relleno.push({ j, R: R[j], extra: true }); }
    }

    const items = [];
    for (const j of repasos) items.push({ tipo: "problema", j, origen: "repaso" });
    for (const k of nuevos) {
      items.push({ tipo: "ejemplo", j: k, origen: "nuevo" });
      for (let i = 1; i < p.nIntro; i++) items.push({ tipo: "problema", j: k, origen: "nuevo" });
    }
    for (const j of relleno) items.push({ tipo: "problema", j, origen: "relleno" });
    this.e.plan = { dia: t, items, expl };
    this.e.pos = 0;
    return this.e.plan;
  }

  /* Elige una plantilla distinta de la última usada para esa habilidad */
  generar(j) {
    const lista = this.porHab[j];
    const ultima = this.e.sk[j].ultima;
    const opciones = lista.length > 1 ? lista.filter(pl => pl.id !== ultima) : lista;
    const pl = opciones[Math.floor(Math.random() * opciones.length)];
    this.e.sk[j].ultima = pl.id;
    return instanciar(pl);
  }

  /* ---------- Actualización tras un intento ---------- */
  observar(j, acierto) {
    const p = this.p, t = this.e.t;
    const pred = this.predecir(j, t);
    const comps = this.comps(j).filter(([k]) => this.e.sk[k].acq).map(([k, w]) => ({ k, w, Rantes: this.R(k, t), Santes: this.e.sk[k].S }));
    const Pi = comps.reduce((a, c) => a * Math.pow(c.Rantes, c.w), 1);
    const sj = this.e.sk[j];
    sj.n++; if (acierto) sj.ok++;
    for (const c of comps) {
      const s = this.e.sk[c.k];
      if (this.e.hoy.includes(c.k)) { c.omitido = true; c.Sdesp = s.S; c.Rdesp = c.Rantes; continue; }
      if (acierto) {
        c.factor = 1 + c.w * p.G * (1 - c.Rantes);
        s.S = s.S * c.factor;
      } else {
        const Rw = Math.pow(c.Rantes, c.w);
        let b;
        if (p.culpa) b = ((1 - Rw) * (1 - p.g)) / Math.max(1e-9, (1 - Pi) * (1 - p.g) + Pi * p.s);
        else b = (1 - Rw) / Math.max(1e-9, 1 - Pi);
        c.b = Math.min(1, b);
        s.S = Math.max(p.Smin, s.S * (1 - p.lambda * c.b));
      }
      const Rn = c.Rantes + c.w * (1 - c.Rantes);
      s.L = t + s.S * Math.log(Rn);
      c.Sdesp = s.S; c.Rdesp = Rn;
      this.e.hoy.push(c.k);
    }
    const reg = { tipo: "respuesta", t, j, acierto, P: pred.P, Pi, comps };
    this.e.ultimo = reg;
    this.registrar(reg);
    return reg;
  }

  /* ---------- Pasar el tiempo ---------- */
  pasarDias(n = 1) {
    const antes = Object.fromEntries(this.ids.filter(id => this.e.sk[id].acq).map(id => [id, this.R(id)]));
    const pendientes = this.e.plan ? this.e.plan.items.filter(it => it.tipo === "problema" && (!it.resultado || it.resultado === "omitido")).length : 0;
    this.e.t += n;
    this.e.hoy = [];
    const cambios = Object.entries(antes).map(([k, Ra]) => ({ k, antes: Ra, despues: this.R(k), S: this.e.sk[k].S }));
    const vencidas = cambios.filter(c => c.antes >= this.p.rStar && c.despues < this.p.rStar).map(c => c.k);
    this.e.cambiosDia = { t: this.e.t, n, porHab: Object.fromEntries(cambios.map(c => [c.k, c])) };
    this.registrar({ tipo: "dia", t: this.e.t, n, cambios, vencidas, pendientes });
    return this.planificar();
  }

  registrar(r) {
    this.e.bitacora.unshift(r);
    if (this.e.bitacora.length > 200) this.e.bitacora.length = 200;
  }

  estado(k) {
    const s = this.e.sk[k];
    if (!s.acq) {
      const R = Object.fromEntries(this.ids.map(id => [id, this.R(id)]));
      return this.revisarAdmision(k, R).length ? "bloqueada" : "lista";
    }
    if (s.intro === this.e.t) return "nueva";
    return this.R(k) < this.p.rStar ? "vencida" : "aldia";
  }
}
