import { initWasm, Resvg } from "@resvg/resvg-wasm";
import robotoRegular from "@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf";
import robotoBold from "@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

let wasmReady;
let fontBuffers;

function fonts() {
  fontBuffers ??= [new Uint8Array(robotoRegular), new Uint8Array(robotoBold)];
  return fontBuffers;
}

export async function renderLineupPngInWorker(svg) {
  wasmReady ??= initWasm(resvgWasm);
  await wasmReady;

  const renderer = new Resvg(svg, {
    fitTo: { mode: "width", value: 900 },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: "Roboto",
      fontBuffers: fonts(),
    },
  });
  const image = renderer.render();
  const png = image.asPng();
  renderer.free();
  image.free();
  return png;
}
