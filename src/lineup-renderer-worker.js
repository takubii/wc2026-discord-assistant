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

async function resolveExternalImages(renderer) {
  for (const item of renderer.imagesToResolve()) {
    const href = item.href;
    if (!/^https:\/\//.test(href)) continue;
    const res = await fetch(href);
    if (!res.ok) continue;
    renderer.resolveImage(href, new Uint8Array(await res.arrayBuffer()));
  }
}

export async function renderLineupPngInWorker(svg, width = 900) {
  wasmReady ??= initWasm(resvgWasm);
  await wasmReady;

  const renderer = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: "Roboto",
      fontBuffers: fonts(),
    },
  });
  await resolveExternalImages(renderer);
  const image = renderer.render();
  const png = image.asPng();
  renderer.free();
  image.free();
  return png;
}
