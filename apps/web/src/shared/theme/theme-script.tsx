import { SURFACE_DEFAULTS, STORAGE_PREFIX, THEME_COLOR, THEMEABLE_SURFACES } from "./theme";

// Script que corre SÍNCRONO mientras el navegador parsea el `<head>`, antes
// del primer paint. Es el único modo de que una recarga dura sobre
// `/admin/clients/123` con la preferencia en "claro" no pinte un frame oscuro
// primero: `useEffect` corre después del paint y `useLayoutEffect` después de
// la hidratación — en una conexión lenta el navegador ya pintó el HTML del
// servidor mucho antes de que React exista.
//
// Patrón oficial de Next 16 (`docs/01-app/02-guides/preventing-flash-before-hydration.md`,
// sección "Themes"), con `suppressHydrationWarning` en `<html>`.
//
// GOTCHA: el algoritmo está escrito DOS veces — acá en JS plano (no puede
// importar nada, corre antes del bundle) y en `theme.ts` para React. Las
// CONSTANTES sí tienen una sola fuente: se interpolan desde `theme.ts`. Si
// cambias `resolveSurface` o `resolveTheme`, cambia también este string.

const script = `(function(){try{
var d=document.documentElement;
var p=location.pathname;
var s="public";
var known=["admin","collector","client"];
for(var i=0;i<known.length;i++){var k="/"+known[i];if(p===k||p.indexOf(k+"/")===0){s=known[i];break}}
var defaults=${JSON.stringify(SURFACE_DEFAULTS)};
var themeable=${JSON.stringify(THEMEABLE_SURFACES)};
var t=defaults[s];
if(themeable.indexOf(s)!==-1){
var pref=null;
try{pref=localStorage.getItem(${JSON.stringify(STORAGE_PREFIX)}+s)}catch(e){}
if(pref==="light"||pref==="dark"){t=pref}
else if(pref==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}
}
if(t==="dark"){d.classList.add("dark")}else{d.classList.remove("dark")}
var m=document.querySelector('meta[name="theme-color"]');
if(!m){m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m)}
m.content=${JSON.stringify(THEME_COLOR)}[t];
}catch(e){}})()`;

export function ThemeScript() {
  return (
    <script
      // React avisa en desarrollo cuando un render produce un `<script>`. En
      // el servidor se emite ejecutable; en el cliente queda inerte (nunca se
      // re-ejecuta en una navegación soft — de eso se encarga `ThemeSync`).
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
