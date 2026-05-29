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

const CATEGORIAS = ["Todas", "Desayuno", "Entrante", "Primero", "Segundo", "Postre", "Snack", "Bebida"];
const DIFICULTADES = ["Todas", "Fácil", "Media", "Difícil"];
const APTO_PARA = ["Vegano", "Vegetariano", "Sin gluten", "Sin lactosa"];
const difficultyColor = { Fácil: "#5a7a4a", Media: "#b8860b", Difícil: "#8b3a2a" };

const FORM_EMPTY = {
  nombre: "", categoria: "Primero", tipo_cocina: "", apto_para: [],
  ingredientes: "", tiempo_prep: "", tiempo_coccion: "", dificultad: "Fácil",
  raciones: "", descripcion: "", pasos: "", autor: "",
};

export default function RecetasApp() {
  const [vista, setVista] = useState("lista");
  const [recetas, setRecetas] = useState([]);
  const [recetaActiva, setRecetaActiva] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroDificultad, setFiltroDificultad] = useState("Todas");
  const [filtroApto, setFiltroApto] = useState([]);
  const [filtroIngrediente, setFiltroIngrediente] = useState("");
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

  const cargarRecetas = async () => {
    setCargando(true);
    try {
      const data = await api("recetas?order=created_at.desc");
      setRecetas(data || []);
    } catch (e) {
      setError("Error al cargar recetas.");
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

  const recetasFiltradas = useMemo(() => recetas.filter((r) => {
    const matchBusqueda = r.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchCategoria = filtroCategoria === "Todas" || r.categoria === filtroCategoria;
    const matchDificultad = filtroDificultad === "Todas" || r.dificultad === filtroDificultad;
    const matchApto = filtroApto.length === 0 || filtroApto.every((a) => (r.apto_para || []).includes(a));
    const matchIngrediente = !filtroIngrediente ||
      (r.ingredientes || []).some((i) => i.toLowerCase().includes(filtroIngrediente.toLowerCase()));
    return matchBusqueda && matchCategoria && matchDificultad && matchApto && matchIngrediente;
  }), [recetas, busqueda, filtroCategoria, filtroDificultad, filtroApto, filtroIngrediente]);

  const toggleApto = (a) => setFiltroApto((p) => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const filtrosActivos = filtroCategoria !== "Todas" || filtroDificultad !== "Todas" || filtroApto.length > 0 || filtroIngrediente;

  const abrirNueva = () => solicitarAuth(() => {
    setForm(FORM_EMPTY); setEditando(null); setVista("formulario");
  });

  const abrirEditar = (r) => solicitarAuth(() => {
    setForm({
      nombre: r.nombre || "", categoria: r.categoria || "Primero",
      tipo_cocina: r.tipo_cocina || "", apto_para: r.apto_para || [],
      ingredientes: (r.ingredientes || []).join(", "),
      tiempo_prep: r.tiempo_prep || "", tiempo_coccion: r.tiempo_coccion || "",
      dificultad: r.dificultad || "Fácil", raciones: r.raciones || "",
      descripcion: r.descripcion || "", pasos: (r.pasos || []).join("\n"),
      autor: r.autor || "",
    });
    setEditando(r.id); setVista("formulario");
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
        ingredientes: form.ingredientes.split(",").map(i => i.trim().toLowerCase()).filter(Boolean),
        tiempo_prep: parseInt(form.tiempo_prep) || 0,
        tiempo_coccion: parseInt(form.tiempo_coccion) || 0,
        dificultad: form.dificultad,
        raciones: parseInt(form.raciones) || 0,
        descripcion: form.descripcion,
        pasos: form.pasos.split("\n").filter(Boolean),
        autor: form.autor || null,
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

  const importarJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        let data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) data = [data];
        for (const r of data) {
          const payload = {
            nombre: r.nombre || r.name || "",
            categoria: r.categoria || r.category || "Primero",
            tipo_cocina: r.tipo_cocina || r.tipoCocina || "",
            apto_para: r.apto_para || r.aptoPara || [],
            ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes : (r.ingredientes || "").split(",").map(i => i.trim()).filter(Boolean),
            tiempo_prep: parseInt(r.tiempo_prep || r.tiempoPrep) || 0,
            tiempo_coccion: parseInt(r.tiempo_coccion || r.tiempoCoccion) || 0,
            dificultad: r.dificultad || "Fácil",
            raciones: parseInt(r.raciones) || 0,
            descripcion: r.descripcion || "",
            pasos: Array.isArray(r.pasos) ? r.pasos : (r.pasos || "").split("\n").filter(Boolean),
            autor: r.autor || r.autor_fuente || null,
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
          <button style={s.btnSecondary} onClick={() => solicitarAuth(() => { fileRef.current.click(); })}
            title="Importar JSON">
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
                <div style={{ ...s.label, marginBottom: 8 }}>Ingrediente</div>
                <input value={filtroIngrediente} onChange={e => setFiltroIngrediente(e.target.value)}
                  placeholder="ej: tomate, huevo, ajo…" style={{ ...s.input, maxWidth: 280 }} />
              </div>
              {filtrosActivos && (
                <button onClick={() => { setFiltroCategoria("Todas"); setFiltroDificultad("Todas"); setFiltroApto([]); setFiltroIngrediente(""); }}
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
                  <div key={r.id} className="hcard" style={s.card} onClick={() => { setRecetaActiva(r); setVista("detalle"); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ ...s.tag, background: "#f0e4cc", color: "#5c3d1e" }}>{r.categoria}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: difficultyColor[r.dificultad] }}>{r.dificultad}</span>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, fontWeight: 700, marginBottom: 6, lineHeight: 1.2 }}>{r.nombre}</div>
                    <div style={{ fontSize: 13, color: "#7a5c3a", marginBottom: 8, fontStyle: "italic" }}>{r.tipo_cocina}</div>
                    <div style={{ fontSize: 13, color: "#5c4028", lineHeight: 1.5, marginBottom: 12 }}>{r.descripcion}</div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#8b6040" }}>
                      {(r.tiempo_prep + r.tiempo_coccion) > 0 && <span>🕐 {r.tiempo_prep + r.tiempo_coccion} min</span>}
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
            {recetaActiva.autor && <div style={{ fontSize: 14, color: "#8b6040", fontStyle: "italic", marginBottom: 12 }}>por {recetaActiva.autor}</div>}
            <p style={{ fontSize: 16, color: "#5c4028", lineHeight: 1.6, marginBottom: 20, fontStyle: "italic" }}>{recetaActiva.descripcion}</p>

            <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
              {recetaActiva.tiempo_prep > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 22 }}>🔪</div><div style={{ fontSize: 12, color: "#8b6040" }}>Prep.</div><div style={{ fontWeight: 600 }}>{recetaActiva.tiempo_prep} min</div></div>}
              {recetaActiva.tiempo_coccion > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 22 }}>🔥</div><div style={{ fontSize: 12, color: "#8b6040" }}>Cocción</div><div style={{ fontWeight: 600 }}>{recetaActiva.tiempo_coccion} min</div></div>}
              {recetaActiva.raciones > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 22 }}>👥</div><div style={{ fontSize: 12, color: "#8b6040" }}>Raciones</div><div style={{ fontWeight: 600 }}>{recetaActiva.raciones}</div></div>}
            </div>

            {(recetaActiva.apto_para || []).length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
                {recetaActiva.apto_para.map(a => <span key={a} style={{ ...s.tag, background: "#e8f0e0", color: "#3a5a28" }}>{a}</span>)}
              </div>
            )}

            <div style={{ borderTop: "1px solid #e0ccb0", paddingTop: 20, marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 12 }}>Ingredientes</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(recetaActiva.ingredientes || []).map((ing, i) => (
                  <span key={i} style={{ background: "#f0e4cc", padding: "4px 12px", borderRadius: 20, fontSize: 14, color: "#3d2400", textTransform: "capitalize" }}>{ing}</span>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e0ccb0", paddingTop: 20, marginBottom: 28 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 16 }}>Elaboración</h2>
              <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                {(recetaActiva.pasos || []).map((paso, i) => (
                  <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <span style={{ minWidth: 28, height: 28, borderRadius: "50%", background: "#c4843c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 15, lineHeight: 1.6, color: "#3d2400", paddingTop: 3 }}>{paso}</span>
                  </li>
                ))}
              </ol>
            </div>

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
              <div>
                <label style={s.label}>Ingredientes (separados por comas)</label>
                <input value={form.ingredientes} onChange={e => setForm({ ...form, ingredientes: e.target.value })}
                  placeholder="tomate, ajo, aceite de oliva…" style={s.input} />
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
              <div>
                <label style={s.label}>Autor / Fuente (opcional)</label>
                <input value={form.autor} onChange={e => setForm({ ...form, autor: e.target.value })}
                  placeholder="Nombre, libro, web…" style={s.input} />
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
