import { useState, useMemo, useEffect, useRef } from "react";

const SUPABASE_URL = "https://sentaokgxmshmpkfbtlc.supabase.co";
const SUPABASE_KEY = "sb_publishable_PFq4Ne_RMuqIza1tW4UVKw_Re74J3Di";

const api = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const CATEGORIAS = ["Todas", "Desayuno", "Entrante", "Primero", "Segundo", "Guarnición", "Pan", "Postre", "Helado", "Snack", "Bebida"];

const DIFICULTADES = ["Todas", "Fácil", "Media", "Difícil"];
const APTO_PARA = ["Vegano", "Vegetariano", "Sin gluten", "Sin lactosa"];
const UNIDADES = ["g", "kg", "ml", "l", "tsp", "tbsp", "unidad", "al gusto"];
const difficultyColor = { Fácil: "#5a7a4a", Media: "#b8860b", Difícil: "#8b3a2a" };

const ING_EMPTY = { cantidad: "", unidad: "g", nombre: "" };
const FORM_EMPTY = {
  nombre: "", categoria: "Primero", tipo_cocina: "", apto_para: [],
  ingredientes_detalle: [{ ...ING_EMPTY }],
  tiempo_prep: "", tiempo_coccion: "", dificultad: "Fácil",
  raciones: "", descripcion: "", pasos: "", autor: "", libro: "",
};

const formatTiempo = (min) => {
  if (!min || min <= 0) return null;
  if (min < 90) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m} min` : `${h}h`;
};

const notaColor = (n) => {
  if (n >= 8) return { bg: "#e8f5e0", color: "#2d6a1f" };
  if (n >= 5) return { bg: "#fff8e0", color: "#7a6010" };
  return { bg: "#fde8e8", color: "#7a2020" };
};

const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

export default function RecetasApp() {
  const [vista, setVista] = useState("lista");
  const [recetas, setRecetas] = useState([]);
  const [recetaActiva, setRecetaActiva] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroDificultad, setFiltroDificultad] = useState("Todas");
  const [filtroApto, setFiltroApto] = useState([]);
  const [filtroLibro, setFiltroLibro] = useState("");
  const [filtroTiempo, setFiltroTiempo] = useState("");
  const [filtroNota, setFiltroNota] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Auth
  const [autenticado, setAutenticado] = useState(false);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState(null);

  // Form
  const [form, setForm] = useState(FORM_EMPTY);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef();

  // Detalle — raciones y modo cocina
  const [racionesActivas, setRacionesActivas] = useState(null);
  const [pasosCompletados, setPasosCompletados] = useState([]);

  // Puntuación
  const [notaInput, setNotaInput] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);

  const cargarRecetas = async () => {
    setCargando(true);
    try {
      const data = await api("recetas?order=created_at.desc");
      setRecetas(data || []);
    } catch {
      // silencioso
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarRecetas(); }, []);

  const verificarPassword = async (pass) => {
    try {
      const data = await api("config?clave=eq.password_admin&select=valor");
      return data && data[0]?.valor === pass;
    } catch { return false; }
  };

  const solicitarAuth = (accion) => {
    if (autenticado) { accion(); return; }
    setAccionPendiente(() => accion);
    setMostrarLogin(true);
    setPassInput("");
    setPassError(false);
  };

  const handleLogin = async () => {
    const ok = await verificarPassword(passInput);
    if (ok) {
      setAutenticado(true);
      setMostrarLogin(false);
      setPassError(false);
      if (accionPendiente) { accionPendiente(); setAccionPendiente(null); }
    } else {
      setPassError(true);
    }
  };

  const librosDisponibles = useMemo(() => {
    const libros = recetas.map(r => r.libro).filter(Boolean);
    return [...new Set(libros)].sort();
  }, [recetas]);

  const recetasFiltradas = useMemo(() => recetas.filter((r) => {
    const matchBusqueda = r.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchCategoria = filtroCategoria === "Todas" || r.categoria === filtroCategoria;
    const matchDificultad = filtroDificultad === "Todas" || r.dificultad === filtroDificultad;
    const matchApto = filtroApto.length === 0 || filtroApto.every((a) => (r.apto_para || []).includes(a));
    const matchLibro = !filtroLibro || r.libro === filtroLibro;
    const tiempoTotal = (r.tiempo_prep || 0) + (r.tiempo_coccion || 0);
    const matchTiempo = !filtroTiempo ||
      (filtroTiempo === "30" && tiempoTotal <= 30) ||
      (filtroTiempo === "60" && tiempoTotal <= 60) ||
      (filtroTiempo === "120" && tiempoTotal <= 120);
    const matchNota = !filtroNota ||
      (filtroNota === "sin" && r.nota === null) ||
      (filtroNota === "5" && r.nota !== null && r.nota >= 5) ||
      (filtroNota === "7" && r.nota !== null && r.nota >= 7) ||
      (filtroNota === "9" && r.nota !== null && r.nota >= 9);
    return matchBusqueda && matchCategoria && matchDificultad && matchApto && matchLibro && matchTiempo && matchNota;
  }), [recetas, busqueda, filtroCategoria, filtroDificultad, filtroApto, filtroLibro, filtroTiempo, filtroNota]);

  const toggleApto = (a) => setFiltroApto((p) => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const filtrosActivos = filtroCategoria !== "Todas" || filtroDificultad !== "Todas" || filtroApto.length > 0 || filtroLibro || filtroTiempo || filtroNota;

  const abrirDetalle = (r) => {
    setRecetaActiva(r);
    setRacionesActivas(r.raciones || 4);
    setPasosCompletados([]);
    setNotaInput(r.nota !== null && r.nota !== undefined ? String(r.nota) : "");
    setVista("detalle");
  };

  const abrirNueva = () => solicitarAuth(() => {
    setForm(FORM_EMPTY); setEditando(null); setVista("formulario");
  });

  const abrirEditar = (r) => solicitarAuth(() => {
    setForm({
      nombre: r.nombre || "",
      categoria: r.categoria || "Primero",
      tipo_cocina: r.tipo_cocina || "",
      apto_para: r.apto_para || [],
      ingredientes_detalle: (r.ingredientes_detalle || [{ ...ING_EMPTY }]).map(i => ({
        cantidad: i.cantidad !== null && i.cantidad !== undefined ? String(i.cantidad) : "",
        unidad: i.unidad || "g",
        nombre: i.nombre || "",
      })),
      tiempo_prep: r.tiempo_prep || "",
      tiempo_coccion: r.tiempo_coccion || "",
      dificultad: r.dificultad || "Fácil",
      raciones: r.raciones || "",
      descripcion: r.descripcion || "",
      pasos: (r.pasos || []).join("\n"),
      autor: r.autor || "",
      libro: r.libro || "",
    });
    setEditando(r.id);
    setVista("formulario");
  });

  const eliminarReceta = (id) => solicitarAuth(async () => {
    if (!confirm("¿Seguro que quieres eliminar esta receta?")) return;
    await api(`recetas?id=eq.${id}`, { method: "DELETE" });
    setVista("lista");
    cargarRecetas();
  });

  const guardarReceta = async () => {
    setGuardando(true);
    try {
      const payload = {
        nombre: form.nombre,
        categoria: form.categoria,
        tipo_cocina: form.tipo_cocina,
        apto_para: form.apto_para,
        ingredientes_detalle: form.ingredientes_detalle
          .filter(i => i.nombre.trim())
          .map(i => ({
            cantidad: i.unidad === "al gusto" ? null : (parseFloat(i.cantidad) || null),
            unidad: i.unidad,
            nombre: i.nombre.trim().toLowerCase(),
          })),
        tiempo_prep: parseInt(form.tiempo_prep) || 0,
        tiempo_coccion: parseInt(form.tiempo_coccion) || 0,
        dificultad: form.dificultad,
        raciones: parseInt(form.raciones) || 0,
        descripcion: form.descripcion,
        pasos: form.pasos.split("\n").filter(Boolean),
        autor: form.autor || null,
        libro: form.libro || null,
      };
      if (editando) {
        await api(`recetas?id=eq.${editando}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("recetas", { method: "POST", body: JSON.stringify(payload) });
      }
      await cargarRecetas();
      setVista("lista");
    } catch (e) {
      alert("Error al guardar: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardarNota = async () => {
    const n = parseInt(notaInput);
    if (isNaN(n) || n < 0 || n > 10) { alert("La nota debe ser un número entre 0 y 10."); return; }
    setGuardandoNota(true);
    try {
      await api(`recetas?id=eq.${recetaActiva.id}`, { method: "PATCH", body: JSON.stringify({ nota: n }) });
      const updated = { ...recetaActiva, nota: n };
      setRecetaActiva(updated);
      setRecetas(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (e) {
      alert("Error al guardar nota: " + e.message);
    } finally {
      setGuardandoNota(false);
    }
  };

  const importarJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        let data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) data = [data];
        for (const r of data) {
          let ingDetalle = [];
          if (Array.isArray(r.ingredientes_detalle)) {
            ingDetalle = r.ingredientes_detalle;
          } else if (Array.isArray(r.ingredientes)) {
            ingDetalle = r.ingredientes.map(i => ({ cantidad: null, unidad: null, nombre: i }));
          }
          const payload = {
            nombre: r.nombre || "",
            categoria: r.categoria || "Primero",
            tipo_cocina: r.tipo_cocina || "",
            apto_para: r.apto_para || [],
            ingredientes_detalle: ingDetalle,
            tiempo_prep: parseInt(r.tiempo_prep) || 0,
            tiempo_coccion: parseInt(r.tiempo_coccion) || 0,
            dificultad: r.dificultad || "Fácil",
            raciones: parseInt(r.raciones) || 0,
            descripcion: r.descripcion || "",
            pasos: Array.isArray(r.pasos) ? r.pasos : (r.pasos || "").split("\n").filter(Boolean),
            autor: r.autor || null,
            libro: r.libro || null,
          };
          await api("recetas", { method: "POST", body: JSON.stringify(payload) });
        }
        await cargarRecetas();
        alert(`✅ ${data.length} receta${data.length > 1 ? "s" : ""} importada${data.length > 1 ? "s" : ""} correctamente.`);
      } catch (err) {
        alert("Error al importar: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const escalarCantidad = (cantidad, racOriginal, racActiva) => {
    if (cantidad === null || cantidad === undefined) return null;
    if (!racOriginal || racOriginal === racActiva) return cantidad;
    const resultado = (cantidad * racActiva) / racOriginal;
    return Math.round(resultado * 100) / 100;
  };

  const addIngrediente = () => setForm(f => ({ ...f, ingredientes_detalle: [...f.ingredientes_detalle, { ...ING_EMPTY }] }));
  const removeIngrediente = (idx) => setForm(f => ({ ...f, ingredientes_detalle: f.ingredientes_detalle.filter((_, i) => i !== idx) }));
  const updateIngrediente = (idx, field, value) => setForm(f => ({
    ...f,
    ingredientes_detalle: f.ingredientes_detalle.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing),
  }));

  const s = {
    page: { fontFamily: "'Crimson Text','Georgia',serif", minHeight: "100vh", background: "#faf6f0", color: "#2c1f0e" },
    header: { background: "#2c1f0e", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" },
    logo: { display: "flex", alignItems: "center", gap: 10, padding: "14px 0", cursor: "pointer" },
    logoText: { fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#f5e6cc" },
    btnPrimary: { cursor: "pointer", border: "none", background: "#c4843c", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: "inherit" },
    btnSecondary: { cursor: "pointer", border: "1.5px solid #c4a882", background: "transparent", color: "#5c3d1e", padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: "inherit" },
    btnBack: { cursor: "pointer", border: "none", background: "none", color: "#5c3d1e", fontSize: 14, fontFamily: "inherit", padding: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 },
    main: { maxWidth: 960, margin: "0 auto", padding: "24px 16px" },
    card: { background: "#fff8f0", border: "1.5px solid #e0ccb0", borderRadius: 14, padding: "20px 18px", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 8px rgba(44,31,14,0.07)" },
    panel: { background: "#fff8f0", border: "1.5px solid #e0ccb0", borderRadius: 16, padding: "28px", boxShadow: "0 4px 16px rgba(44,31,14,0.08)" },
    label: { fontSize: 12, fontWeight: 600, color: "#8b6040", letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 5 },
    input: { width: "100%", padding: "9px 13px", borderRadius: 8, border: "1.5px solid #d4b896", background: "#fffcf7", fontSize: 15, color: "#2c1f0e", outline: "none", fontFamily: "inherit" },
    tag: { display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
    chip: (active) => ({ cursor: "pointer", padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#5c3d1e" : "#c4a882"}`, background: active ? "#5c3d1e" : "transparent", color: active ? "#faf6f0" : "#5c3d1e", fontFamily: "inherit", fontSize: 13, transition: "all 0.15s" }),
  };

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .hcard:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(44,31,14,0.13) !important; }
        .paso-completado { opacity: 0.45; text-decoration: line-through; }
        select { appearance: auto; }
      `}</style>

      {/* MODAL LOGIN */}
      {mostrarLogin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff8f0", borderRadius: 16, padding: 32, width: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 8 }}>Acceso de administrador</div>
            <div style={{ fontSize: 14, color: "#8b6040", marginBottom: 20 }}>Introduce tu contraseña para continuar.</div>
            <input
              type="password" value={passInput} onChange={e => { setPassInput(e.target.value); setPassError(false); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Contraseña…" autoFocus
              style={{ ...s.input, marginBottom: 8, border: passError ? "1.5px solid #8b3a2a" : "1.5px solid #d4b896" }}
            />
            {passError && <div style={{ color: "#8b3a2a", fontSize: 13, marginBottom: 10 }}>Contraseña incorrecta.</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setMostrarLogin(false)}>Cancelar</button>
              <button style={{ ...s.btnPrimary, flex: 1 }} onClick={handleLogin}>Entrar</button>
            </div>
          </div>
        </div>
      )}

      {/* CABECERA */}
      <header style={s.header}>
        <div style={s.logo} onClick={() => setVista("lista")}>
          <span style={{ fontSize: 26 }}>🍳</span>
          <span style={s.logoText}>Mi Recetario</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.btnSecondary} onClick={() => solicitarAuth(() => { fileRef.current.click(); })} title="Importar JSON">
            📥 Importar
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importarJSON} />
          <button style={s.btnPrimary} onClick={abrirNueva}>+ Añadir</button>
        </div>
      </header>

      {/* LISTA */}
      {vista === "lista" && (
        <main style={s.main}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar receta por nombre…"
              style={{ ...s.input, flex: 1, width: "auto" }} />
            <button style={s.chip(filtrosActivos)} onClick={() => setMostrarFiltros(!mostrarFiltros)}>
              {filtrosActivos ? "✓ Filtros" : "Filtros"}
            </button>
          </div>

          {mostrarFiltros && (
            <div style={{ background: "#fff8f0", border: "1.5px solid #e0ccb0", borderRadius: 12, padding: "18px 20px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Categoría", opts: CATEGORIAS, val: filtroCategoria, set: setFiltroCategoria },
                { label: "Dificultad", opts: DIFICULTADES, val: filtroDificultad, set: setFiltroDificultad },
              ].map(({ label, opts, val, set }) => (
                <div key={label}>
                  <div style={{ ...s.label, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {opts.map(o => <button key={o} style={s.chip(val === o)} onClick={() => set(o)}>{o}</button>)}
                  </div>
                </div>
              ))}
              <div>
                <div style={{ ...s.label, marginBottom: 8 }}>Apto para</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {APTO_PARA.map(a => <button key={a} style={s.chip(filtroApto.includes(a))} onClick={() => toggleApto(a)}>{a}</button>)}
                </div>
              </div>
              <div>
                <div style={{ ...s.label, marginBottom: 8 }}>Tiempo total</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {[{ label: "≤ 30 min", val: "30" }, { label: "≤ 1h", val: "60" }, { label: "≤ 2h", val: "120" }].map(o => (
                    <button key={o.val} style={s.chip(filtroTiempo === o.val)} onClick={() => setFiltroTiempo(filtroTiempo === o.val ? "" : o.val)}>{o.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ ...s.label, marginBottom: 8 }}>Nota</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {[{ label: "Sin evaluar", val: "sin" }, { label: "≥ 5", val: "5" }, { label: "≥ 7", val: "7" }, { label: "≥ 9", val: "9" }].map(o => (
                    <button key={o.val} style={s.chip(filtroNota === o.val)} onClick={() => setFiltroNota(filtroNota === o.val ? "" : o.val)}>{o.label}</button>
                  ))}
                </div>
              </div>
              {librosDisponibles.length > 0 && (
                <div>
                  <div style={{ ...s.label, marginBottom: 8 }}>Libro</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {librosDisponibles.map(l => (
                      <button key={l} style={s.chip(filtroLibro === l)} onClick={() => setFiltroLibro(filtroLibro === l ? "" : l)}>📖 {l}</button>
                    ))}
                  </div>
                </div>
              )}
              {filtrosActivos && (
                <button onClick={() => { setFiltroCategoria("Todas"); setFiltroDificultad("Todas"); setFiltroApto([]); setFiltroLibro(""); setFiltroTiempo(""); setFiltroNota(""); }}
                  style={{ alignSelf: "flex-start", color: "#8b3a2a", background: "none", border: "none", fontSize: 13, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {cargando ? (
            <div style={{ textAlign: "center", padding: 60, color: "#8b6040" }}>Cargando recetas…</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "#8b6040", marginBottom: 16 }}>
                {recetasFiltradas.length} {recetasFiltradas.length === 1 ? "receta encontrada" : "recetas encontradas"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18 }}>
                {recetasFiltradas.map(r => (
                  <div key={r.id} className="hcard" style={s.card} onClick={() => abrirDetalle(r)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ ...s.tag, background: "#f0e4cc", color: "#5c3d1e" }}>{r.categoria}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {r.nota !== null && r.nota !== undefined && (
                          <span style={{ ...s.tag, ...notaColor(r.nota), fontSize: 12 }}>★ {r.nota}/10</span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 700, color: difficultyColor[r.dificultad] }}>{r.dificultad}</span>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, fontWeight: 700, marginBottom: 6, lineHeight: 1.2 }}>{r.nombre}</div>
                    <div style={{ fontSize: 13, color: "#7a5c3a", marginBottom: 2, fontStyle: "italic" }}>{r.tipo_cocina}</div>
                    {r.libro && <div style={{ fontSize: 12, color: "#9a7050", marginBottom: 6 }}>📖 {r.libro}</div>}
                    <div style={{ fontSize: 13, color: "#5c4028", lineHeight: 1.5, marginBottom: 12 }}>{r.descripcion}</div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#8b6040" }}>
                      {(r.tiempo_prep + r.tiempo_coccion) > 0 && <span>🕐 {formatTiempo(r.tiempo_prep + r.tiempo_coccion)}</span>}
                      {r.raciones > 0 && <span>👥 {r.raciones} pers.</span>}
                    </div>
                    {(r.apto_para || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                        {r.apto_para.map(a => <span key={a} style={{ ...s.tag, background: "#e8f0e0", color: "#3a5a28", fontSize: 11 }}>{a}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {recetasFiltradas.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#8b6040" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 8 }}>No se encontraron recetas</div>
                  <div style={{ fontSize: 14 }}>Prueba a cambiar los filtros o añade una nueva receta.</div>
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* DETALLE */}
      {vista === "detalle" && recetaActiva && (
        <main style={{ ...s.main, maxWidth: 720 }}>
          <button style={s.btnBack} onClick={() => setVista("lista")}>← Volver al recetario</button>
          <div style={s.panel}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ ...s.tag, background: "#f0e4cc", color: "#5c3d1e" }}>{recetaActiva.categoria}</span>
              {recetaActiva.tipo_cocina && <span style={{ ...s.tag, background: "#e8ddd0", color: "#5c3d1e" }}>{recetaActiva.tipo_cocina}</span>}
              <span style={{ fontSize: 13, fontWeight: 700, color: difficultyColor[recetaActiva.dificultad], display: "flex", alignItems: "center" }}>{recetaActiva.dificultad}</span>
            </div>

            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 800, marginBottom: 8, lineHeight: 1.15 }}>{recetaActiva.nombre}</h1>
            {recetaActiva.autor && <div style={{ fontSize: 14, color: "#8b6040", fontStyle: "italic", marginBottom: 4 }}>por {recetaActiva.autor}</div>}
            {recetaActiva.libro && <div style={{ fontSize: 13, color: "#9a7050", marginBottom: 12 }}>📖 {recetaActiva.libro}</div>}
            {!recetaActiva.autor && !recetaActiva.libro && <div style={{ marginBottom: 12 }} />}
            <p style={{ fontSize: 16, color: "#5c4028", lineHeight: 1.6, marginBottom: 20, fontStyle: "italic" }}>{recetaActiva.descripcion}</p>

            <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
              {recetaActiva.tiempo_prep > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22 }}>🔪</div>
                  <div style={{ fontSize: 12, color: "#8b6040" }}>Prep.</div>
                  <div style={{ fontWeight: 600 }}>{formatTiempo(recetaActiva.tiempo_prep)}</div>
                </div>
              )}
              {recetaActiva.tiempo_coccion > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22 }}>🔥</div>
                  <div style={{ fontSize: 12, color: "#8b6040" }}>Cocción</div>
                  <div style={{ fontWeight: 600 }}>{formatTiempo(recetaActiva.tiempo_coccion)}</div>
                </div>
              )}
              {recetaActiva.raciones > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22 }}>👥</div>
                  <div style={{ fontSize: 12, color: "#8b6040", marginBottom: 4 }}>Raciones</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => setRacionesActivas(r => Math.max(1, r - 1))}
                      style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid #d4b896", background: "#fff8f0", cursor: "pointer", fontSize: 16, fontFamily: "inherit", color: "#5c3d1e", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontWeight: 700, fontSize: 18, minWidth: 24, textAlign: "center" }}>{racionesActivas}</span>
                    <button onClick={() => setRacionesActivas(r => r + 1)}
                      style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid #d4b896", background: "#fff8f0", cursor: "pointer", fontSize: 16, fontFamily: "inherit", color: "#5c3d1e", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                  {racionesActivas !== recetaActiva.raciones && (
                    <div style={{ fontSize: 11, color: "#9a7050", marginTop: 3 }}>original: {recetaActiva.raciones}</div>
                  )}
                </div>
              )}
            </div>

            {(recetaActiva.apto_para || []).length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
                {recetaActiva.apto_para.map(a => <span key={a} style={{ ...s.tag, background: "#e8f0e0", color: "#3a5a28" }}>{a}</span>)}
              </div>
            )}

            {/* Ingredientes */}
            <div style={{ borderTop: "1px solid #e0ccb0", paddingTop: 20, marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 12 }}>Ingredientes</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(recetaActiva.ingredientes_detalle || []).map((ing, i) => {
                  const cantEscalada = escalarCantidad(ing.cantidad, recetaActiva.raciones, racionesActivas);
                  const escalado = racionesActivas !== recetaActiva.raciones && ing.cantidad !== null;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: "1px dotted #e0ccb0" }}>
                      <span style={{ minWidth: 6, height: 6, borderRadius: "50%", background: "#c4843c", flexShrink: 0, marginTop: 6, display: "inline-block" }} />
                      {ing.unidad === "al gusto" || ing.cantidad === null ? (
                        <span style={{ fontSize: 15, color: "#3d2400" }}>
                          {capitalize(ing.nombre)} <span style={{ color: "#9a7050", fontStyle: "italic" }}>— al gusto</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 15, color: "#3d2400" }}>
                          <strong style={{ color: escalado ? "#c4843c" : "#2c1f0e" }}>{cantEscalada} {ing.unidad.toLowerCase()}</strong>
                          {" de "}{capitalize(ing.nombre)}
                          {escalado && <span style={{ color: "#b0906a", fontSize: 12, marginLeft: 6 }}>(orig. {ing.cantidad} {ing.unidad.toLowerCase()})</span>}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pasos */}
            <div style={{ borderTop: "1px solid #e0ccb0", paddingTop: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>Elaboración</h2>
                {pasosCompletados.length > 0 && (
                  <button onClick={() => setPasosCompletados([])}
                    style={{ fontSize: 12, color: "#8b6040", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                    Reiniciar
                  </button>
                )}
              </div>
              <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {(recetaActiva.pasos || []).map((paso, i) => {
                  const completado = pasosCompletados.includes(i);
                  return (
                    <li key={i} onClick={() => setPasosCompletados(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                      style={{ display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer" }}>
                      <span style={{ minWidth: 28, height: 28, borderRadius: "50%", background: completado ? "#a0b890" : "#c4843c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, transition: "background 0.2s" }}>
                        {completado ? "✓" : i + 1}
                      </span>
                      <span className={completado ? "paso-completado" : ""} style={{ fontSize: 15, lineHeight: 1.6, color: "#3d2400", paddingTop: 3 }}>{paso}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Puntuación */}
            <div style={{ borderTop: "1px solid #e0ccb0", paddingTop: 20, marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 12 }}>Puntuación</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {recetaActiva.nota !== null && recetaActiva.nota !== undefined ? (
                  <span style={{ ...s.tag, ...notaColor(recetaActiva.nota), fontSize: 16, padding: "4px 14px" }}>★ {recetaActiva.nota}/10</span>
                ) : (
                  <span style={{ fontSize: 13, color: "#9a7a5a", fontStyle: "italic" }}>Sin evaluar aún</span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number" min="0" max="10" value={notaInput}
                    onChange={e => setNotaInput(e.target.value)}
                    placeholder="0–10"
                    style={{ ...s.input, width: 72, textAlign: "center" }}
                  />
                  <button onClick={() => solicitarAuth(guardarNota)} disabled={guardandoNota || notaInput === ""}
                    style={{ ...s.btnPrimary, opacity: (guardandoNota || notaInput === "") ? 0.6 : 1 }}>
                    {guardandoNota ? "…" : "Guardar"}
                  </button>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: "flex", gap: 10, borderTop: "1px solid #e0ccb0", paddingTop: 20 }}>
              <button style={s.btnSecondary} onClick={() => abrirEditar(recetaActiva)}>✏️ Editar</button>
              <button style={{ ...s.btnSecondary, color: "#8b3a2a", borderColor: "#8b3a2a" }} onClick={() => eliminarReceta(recetaActiva.id)}>🗑️ Eliminar</button>
            </div>
          </div>
        </main>
      )}

      {/* FORMULARIO */}
      {vista === "formulario" && (
        <main style={{ ...s.main, maxWidth: 680 }}>
          <button style={s.btnBack} onClick={() => setVista("lista")}>← Volver al recetario</button>
          <div style={s.panel}>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, marginBottom: 24 }}>
              {editando ? "Editar receta" : "Nueva receta"}
            </h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={s.label}>Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={s.input} />
              </div>
              <div>
                <label style={s.label}>Descripción corta</label>
                <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2}
                  style={{ ...s.input, resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Categoría", key: "categoria", type: "select", opts: CATEGORIAS.filter(c => c !== "Todas") },
                  { label: "Dificultad", key: "dificultad", type: "select", opts: ["Fácil", "Media", "Difícil"] },
                  { label: "Prep. (min)", key: "tiempo_prep", type: "number" },
                  { label: "Cocción (min)", key: "tiempo_coccion", type: "number" },
                  { label: "Raciones", key: "raciones", type: "number" },
                  { label: "Tipo de cocina", key: "tipo_cocina", type: "text", placeholder: "Española, Italiana…" },
                ].map(({ label, key, type, opts, placeholder }) => (
                  <div key={key}>
                    <label style={s.label}>{label}</label>
                    {type === "select"
                      ? <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={s.input}>
                          {opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      : <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                          placeholder={placeholder} style={s.input} />
                    }
                  </div>
                ))}
              </div>

              {/* Ingredientes */}
              <div>
                <label style={s.label}>Ingredientes</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.ingredientes_detalle.map((ing, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "90px 110px 1fr 32px", gap: 6, alignItems: "center" }}>
                      <input
                        type="number" placeholder="Cantidad"
                        value={ing.cantidad} onChange={e => updateIngrediente(idx, "cantidad", e.target.value)}
                        disabled={ing.unidad === "al gusto"}
                        style={{ ...s.input, padding: "8px 10px", opacity: ing.unidad === "al gusto" ? 0.4 : 1 }}
                      />
                      <select value={ing.unidad} onChange={e => updateIngrediente(idx, "unidad", e.target.value)} style={s.input}>
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                      </select>
                      <input
                        placeholder="Nombre del ingrediente"
                        value={ing.nombre} onChange={e => updateIngrediente(idx, "nombre", e.target.value)}
                        style={{ ...s.input, padding: "8px 10px" }}
                      />
                      <button onClick={() => removeIngrediente(idx)} disabled={form.ingredientes_detalle.length === 1}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#8b3a2a", opacity: form.ingredientes_detalle.length === 1 ? 0.3 : 1 }}>×</button>
                    </div>
                  ))}
                  <button onClick={addIngrediente}
                    style={{ alignSelf: "flex-start", ...s.btnSecondary, fontSize: 13, padding: "6px 14px" }}>
                    + Añadir ingrediente
                  </button>
                </div>
              </div>

              <div>
                <label style={s.label}>Pasos (uno por línea)</label>
                <textarea value={form.pasos} onChange={e => setForm({ ...form, pasos: e.target.value })} rows={5}
                  placeholder={"Paso 1…\nPaso 2…"} style={{ ...s.input, resize: "vertical" }} />
              </div>
              <div>
                <label style={s.label}>Apto para</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {APTO_PARA.map(a => (
                    <button key={a} style={s.chip(form.apto_para.includes(a))}
                      onClick={() => setForm({ ...form, apto_para: form.apto_para.includes(a) ? form.apto_para.filter(x => x !== a) : [...form.apto_para, a] })}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Autor / Fuente (opcional)</label>
                  <input value={form.autor} onChange={e => setForm({ ...form, autor: e.target.value })}
                    placeholder="Nombre, web…" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Libro (opcional)</label>
                  <input value={form.libro} onChange={e => setForm({ ...form, libro: e.target.value })}
                    placeholder="Nombre del libro…" style={s.input} />
                </div>
              </div>
              <button onClick={guardarReceta} disabled={!form.nombre || guardando}
                style={{ ...s.btnPrimary, padding: 13, fontSize: 16, borderRadius: 10, opacity: (!form.nombre || guardando) ? 0.6 : 1 }}>
                {guardando ? "Guardando…" : "Guardar receta"}
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
