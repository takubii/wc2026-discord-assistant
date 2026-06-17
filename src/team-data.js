export const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czechia"],
  B: ["Canada", "Bosnia-Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Türkiye"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "Congo DR", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

export const TEAM_LABELS = {
  Algeria: "アルジェリア",
  Argentina: "アルゼンチン",
  Australia: "オーストラリア",
  Austria: "オーストリア",
  Belgium: "ベルギー",
  "Bosnia-Herzegovina": "ボスニア・ヘルツェゴビナ",
  Brazil: "ブラジル",
  Canada: "カナダ",
  "Cape Verde": "カーボベルデ",
  Colombia: "コロンビア",
  "Congo DR": "コンゴ民主共和国",
  Croatia: "クロアチア",
  Curacao: "キュラソー",
  "Curaçao": "キュラソー",
  Czechia: "チェコ",
  Ecuador: "エクアドル",
  Egypt: "エジプト",
  England: "イングランド",
  France: "フランス",
  Germany: "ドイツ",
  Ghana: "ガーナ",
  Haiti: "ハイチ",
  Iran: "イラン",
  Iraq: "イラク",
  "Ivory Coast": "コートジボワール",
  Japan: "日本",
  Jordan: "ヨルダン",
  Mexico: "メキシコ",
  Morocco: "モロッコ",
  Netherlands: "オランダ",
  "New Zealand": "ニュージーランド",
  Norway: "ノルウェー",
  Panama: "パナマ",
  Paraguay: "パラグアイ",
  Portugal: "ポルトガル",
  Qatar: "カタール",
  "Saudi Arabia": "サウジアラビア",
  Scotland: "スコットランド",
  Senegal: "セネガル",
  "South Africa": "南アフリカ",
  "South Korea": "韓国",
  Spain: "スペイン",
  Sweden: "スウェーデン",
  Switzerland: "スイス",
  Tunisia: "チュニジア",
  Türkiye: "トルコ",
  "United States": "アメリカ",
  Uruguay: "ウルグアイ",
  Uzbekistan: "ウズベキスタン",
};

export const TEAM_ALIASES = {
  アメリカ: "United States",
  米国: "United States",
  USA: "United States",
  日本: "Japan",
  にほん: "Japan",
  ニッポン: "Japan",
  韓国: "South Korea",
  "韓国代表": "South Korea",
  イングランド: "England",
  スコットランド: "Scotland",
  キュラソー: "Curaçao",
  キュラソー島: "Curaçao",
  トルコ: "Türkiye",
  ドイツ: "Germany",
  ブラジル: "Brazil",
  アルゼンチン: "Argentina",
  フランス: "France",
  スペイン: "Spain",
  ポルトガル: "Portugal",
  オランダ: "Netherlands",
  メキシコ: "Mexico",
  カナダ: "Canada",
  オーストラリア: "Australia",
  モロッコ: "Morocco",
  スイス: "Switzerland",
  カタール: "Qatar",
  ガーナ: "Ghana",
  クロアチア: "Croatia",
  コロンビア: "Colombia",
  ウルグアイ: "Uruguay",
  ベルギー: "Belgium",
  エジプト: "Egypt",
  イラン: "Iran",
  イラク: "Iraq",
  ノルウェー: "Norway",
  セネガル: "Senegal",
  チュニジア: "Tunisia",
  サウジアラビア: "Saudi Arabia",
  南アフリカ: "South Africa",
  パラグアイ: "Paraguay",
  パナマ: "Panama",
  チェコ: "Czechia",
  スウェーデン: "Sweden",
  エクアドル: "Ecuador",
  アルジェリア: "Algeria",
  オーストリア: "Austria",
  ヨルダン: "Jordan",
  ハイチ: "Haiti",
  カーボベルデ: "Cape Verde",
  "コートジボワール": "Ivory Coast",
  "コンゴ民主共和国": "Congo DR",
  ウズベキスタン: "Uzbekistan",
  "ニュージーランド": "New Zealand",
  "ボスニア": "Bosnia-Herzegovina",
  "ボスニア・ヘルツェゴビナ": "Bosnia-Herzegovina",
};

export function normalizeText(value) {
  const transliterated = String(value ?? "")
    .replace(/[ıİ]/g, (char) => (char === "ı" ? "i" : "I"))
    .replace(/[øØ]/g, (char) => (char === "ø" ? "o" : "O"))
    .replace(/[đĐ]/g, (char) => (char === "đ" ? "d" : "D"))
    .replace(/[ðÐ]/g, (char) => (char === "ð" ? "d" : "D"))
    .replace(/[łŁ]/g, (char) => (char === "ł" ? "l" : "L"))
    .replace(/[þÞ]/g, (char) => (char === "þ" ? "th" : "Th"))
    .replace(/[ß]/g, "ss")
    .replace(/[æÆ]/g, (char) => (char === "æ" ? "ae" : "AE"))
    .replace(/[œŒ]/g, (char) => (char === "œ" ? "oe" : "OE"));

  return transliterated
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ぁ-んァ-ヶー一-龠]+/g, " ")
    .trim();
}

export function teamLabel(teamName) {
  return TEAM_LABELS[teamName] ?? teamName;
}

export function canonicalTeamName(query) {
  const raw = String(query ?? "").trim();
  if (!raw) return "";
  if (TEAM_ALIASES[raw]) return TEAM_ALIASES[raw];
  const normalized = normalizeText(raw);
  const teams = Object.values(GROUPS).flat();
  return (
    teams.find((team) => normalizeText(team) === normalized) ??
    teams.find((team) => normalizeText(teamLabel(team)) === normalized) ??
    teams.find((team) => normalizeText(team).includes(normalized) || normalizeText(teamLabel(team)).includes(normalized)) ??
    raw
  );
}

export function teamChoices(query = "") {
  const normalized = normalizeText(query);
  return Object.values(GROUPS)
    .flat()
    .filter((team) => {
      if (!normalized) return true;
      return normalizeText(team).includes(normalized) || normalizeText(teamLabel(team)).includes(normalized);
    })
    .slice(0, 25)
    .map((team) => ({ name: `${teamLabel(team)} / ${team}`, value: team }));
}
