import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

let wasmReady;

export async function renderLineupPngInWorker(svg) {
  wasmReady ??= initWasm(resvgWasm);
  await wasmReady;

  const renderer = new Resvg(svg, {
    fitTo: { mode: "width", value: 900 },
    font: { loadSystemFonts: false, defaultFontFamily: "Arial" },
  });
  const image = renderer.render();
  const png = image.asPng();
  renderer.free();
  image.free();
  return png;
}
