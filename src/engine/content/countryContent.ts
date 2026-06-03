import type { GovernmentType } from "../models/enums";
import type { Country, ReligiousDenomination } from "../models/country";
import type { CountryMetadataRecord } from "../../lib/data/loadMapAssets";

export type CountryMetadataIndex = Record<string, CountryMetadataRecord>;

export type FormationRule = {
  id: string;
  name: string;
  color: string;
  flag?: string;
  eligibleRoots?: string[];
  requiredCountryIds?: string[];
  requiredRegions?: string[];
  requiredSubregions?: string[];
  minimumProvinces?: number;
  minimumAbsorbed?: number;
  government?: GovernmentType;
  requiredReligions?: ReligiousDenomination[];
  requiredFormations?: string[];
  priority: number;
};

export const MODERN_EMPIRES = new Set(["USA", "CHN"]);

export const MODERN_POWER_OVERRIDES: Record<string, number> = {
  USA: 112,
  CHN: 108,
  IND: 82,
  RUS: 78,
  TUR: 64,
  IRN: 61,
  DEU: 60,
  GBR: 59,
  FRA: 58,
  JPN: 56,
  BRA: 55,
  IDN: 53,
  PAK: 51,
  SAU: 50,
  KOR: 49,
  MEX: 48,
  NGA: 46,
  ITA: 45,
  CAN: 44,
  AUS: 43,
  EGY: 43,
  ZAF: 39,
  ARG: 38,
  POL: 38,
  UKR: 37,
  VNM: 35,
  THA: 34,
  KAZ: 33,
  COL: 33,
  ETH: 32,
};

const RELIGION_OVERRIDES: Record<string, ReligiousDenomination> = {
  AFG: "Sunni Islam",
  ARE: "Sunni Islam",
  ARM: "Orthodox Christianity",
  AUS: "Secular Pluralism",
  AUT: "Catholic Christianity",
  AZE: "Shia Islam",
  BGD: "Sunni Islam",
  BRA: "Catholic Christianity",
  CAN: "Secular Pluralism",
  CHN: "State Atheism",
  CUB: "State Atheism",
  DEU: "Protestant Christianity",
  EGY: "Sunni Islam",
  ESP: "Catholic Christianity",
  ETH: "Orthodox Christianity",
  FRA: "Catholic Christianity",
  GBR: "Protestant Christianity",
  GEO: "Orthodox Christianity",
  GRC: "Orthodox Christianity",
  IDN: "Sunni Islam",
  IND: "Hinduism",
  IRN: "Shia Islam",
  IRQ: "Shia Islam",
  ISR: "Judaism",
  ITA: "Catholic Christianity",
  JOR: "Sunni Islam",
  JPN: "Mahayana Buddhism",
  KAZ: "Sunni Islam",
  KHM: "Theravada Buddhism",
  KOR: "Secular Pluralism",
  KWT: "Sunni Islam",
  LAO: "Theravada Buddhism",
  LBN: "Sunni Islam",
  LKA: "Theravada Buddhism",
  MMR: "Theravada Buddhism",
  MYS: "Sunni Islam",
  NGA: "Sunni Islam",
  OMN: "Sunni Islam",
  PAK: "Sunni Islam",
  PHL: "Catholic Christianity",
  POL: "Catholic Christianity",
  PRK: "State Atheism",
  QAT: "Sunni Islam",
  RUS: "Orthodox Christianity",
  SAU: "Sunni Islam",
  SYR: "Sunni Islam",
  THA: "Theravada Buddhism",
  TUR: "Sunni Islam",
  UKR: "Orthodox Christianity",
  USA: "Protestant Christianity",
  VEN: "Catholic Christianity",
  VNM: "State Atheism",
  YEM: "Sunni Islam",
};

export function religionForCountry(countryId: string, region: string, subregion: string): ReligiousDenomination {
  if (RELIGION_OVERRIDES[countryId]) return RELIGION_OVERRIDES[countryId];
  if (subregion === "Western Asia" || subregion === "Middle East" || subregion === "Northern Africa") return "Sunni Islam";
  if (region === "Europe") return "Catholic Christianity";
  if (subregion === "South America" || subregion === "Central America" || subregion === "Caribbean") return "Catholic Christianity";
  if (subregion === "Southern Asia") return "Hinduism";
  if (subregion === "Eastern Asia") return "Mahayana Buddhism";
  if (subregion === "South-Eastern Asia") return "Theravada Buddhism";
  if (region === "Africa") return "Folk Traditions";
  return "Secular Pluralism";
}

export function religionModifier(religion: ReligiousDenomination) {
  const values: Record<ReligiousDenomination, number> = {
    "Sunni Islam": 9,
    "Shia Islam": 10,
    "Catholic Christianity": 6,
    "Protestant Christianity": 7,
    "Orthodox Christianity": 8,
    Hinduism: 8,
    "Theravada Buddhism": 5,
    "Mahayana Buddhism": 5,
    Judaism: 9,
    "State Atheism": 7,
    "Secular Pluralism": 4,
    "Folk Traditions": 3,
  };
  return values[religion] ?? 0;
}

export function religionModifierLabel(religion: ReligiousDenomination) {
  const labels: Record<ReligiousDenomination, string> = {
    "Sunni Islam": "Sunni Zeal",
    "Shia Islam": "Shia Resolve",
    "Catholic Christianity": "Catholic Orders",
    "Protestant Christianity": "Protestant Industry",
    "Orthodox Christianity": "Orthodox Patriarchate",
    Hinduism: "Dharmic Mobilization",
    "Theravada Buddhism": "Monastic Discipline",
    "Mahayana Buddhism": "Mandate Doctrine",
    Judaism: "Covenant Defense",
    "State Atheism": "Party Secularism",
    "Secular Pluralism": "Pluralist Cohesion",
    "Folk Traditions": "Ancestral Guard",
  };
  return labels[religion] ?? religion;
}

export function controlledDevelopmentScore(country: Country) {
  const strategic = country.strategicPower * 2.2;
  const population = Math.max(0, Math.log10(Math.max(1, country.population)) - 6) * 28;
  const area = Math.max(0, Math.log10(Math.max(1, country.area)) - 4) * 18;
  const footprint = Math.sqrt(Math.max(1, country.provinces.length)) * 4;
  const formations = country.unlockedFormations.length * 14;
  return Math.round(strategic + population + area + footprint + formations);
}

export const FORMATION_RULES: FormationRule[] = [
  {
    id: "new_islamic_caliphate",
    name: "New Islamic Caliphate",
    color: "#0e8f62",
    eligibleRoots: ["SAU", "IRN", "IRQ", "TUR", "PAK", "EGY", "IDN", "MAR", "DZA"],
    requiredSubregions: ["Middle East", "Western Asia"],
    requiredReligions: ["Sunni Islam", "Shia Islam"],
    minimumAbsorbed: 3,
    minimumProvinces: 35,
    priority: 100,
  },
  {
    id: "revived_ussr",
    name: "Revived USSR",
    color: "#b3262e",
    eligibleRoots: ["RUS", "KAZ", "UKR", "BLR"],
    requiredCountryIds: ["RUS", "KAZ"],
    requiredReligions: ["Orthodox Christianity", "State Atheism", "Sunni Islam"],
    minimumAbsorbed: 2,
    priority: 98,
  },
  {
    id: "persian_empire",
    name: "Persian Empire",
    color: "#7f4ba3",
    eligibleRoots: ["IRN"],
    requiredCountryIds: ["IRN"],
    requiredSubregions: ["Middle East", "Central Asia", "South Asia", "Southern Asia"],
    requiredReligions: ["Shia Islam", "Sunni Islam"],
    minimumAbsorbed: 3,
    priority: 96,
  },
  {
    id: "ottoman_porte",
    name: "Restored Ottoman Empire",
    color: "#9f3131",
    eligibleRoots: ["TUR"],
    requiredCountryIds: ["TUR"],
    requiredSubregions: ["Middle East", "Southern Europe"],
    requiredReligions: ["Sunni Islam"],
    minimumAbsorbed: 3,
    priority: 95,
  },
  {
    id: "turkic_khaganate",
    name: "Turkic Khaganate",
    color: "#2b8a9a",
    eligibleRoots: ["TUR", "KAZ", "AZE", "UZB", "TKM", "KGZ"],
    requiredCountryIds: ["TUR", "KAZ"],
    minimumAbsorbed: 2,
    priority: 94,
  },
  {
    id: "greater_india",
    name: "Greater Indian Union",
    color: "#c17a24",
    eligibleRoots: ["IND", "PAK", "BGD"],
    requiredSubregions: ["South Asia", "Southern Asia"],
    minimumAbsorbed: 3,
    priority: 93,
  },
  {
    id: "akhand_bharat",
    name: "Akhand Bharat",
    color: "#d18424",
    eligibleRoots: ["IND"],
    requiredCountryIds: ["IND", "PAK", "BGD"],
    requiredReligions: ["Hinduism"],
    minimumAbsorbed: 3,
    priority: 91,
  },
  {
    id: "indus_confederation",
    name: "Indus Confederation",
    color: "#2f8b6b",
    eligibleRoots: ["PAK"],
    requiredCountryIds: ["PAK", "IND"],
    minimumAbsorbed: 2,
    priority: 90,
  },
  {
    id: "serendib_thalassocracy",
    name: "Serendib Thalassocracy",
    color: "#6b8f3d",
    eligibleRoots: ["LKA", "MDV"],
    requiredSubregions: ["South Asia", "Southern Asia"],
    requiredReligions: ["Theravada Buddhism"],
    minimumProvinces: 25,
    minimumAbsorbed: 2,
    priority: 89,
  },
  {
    id: "celestial_commonwealth",
    name: "Celestial Commonwealth",
    color: "#c24b3c",
    eligibleRoots: ["CHN"],
    requiredSubregions: ["Eastern Asia", "South-Eastern Asia"],
    requiredReligions: ["State Atheism", "Mahayana Buddhism"],
    minimumAbsorbed: 4,
    priority: 92,
  },
  {
    id: "pacific_dominion",
    name: "Pacific Dominion",
    color: "#346f9f",
    eligibleRoots: ["JPN", "AUS", "IDN", "PHL"],
    requiredSubregions: ["Australia and New Zealand", "Eastern Asia", "South-Eastern Asia"],
    minimumAbsorbed: 4,
    priority: 88,
  },
  {
    id: "southeast_asian_mandala",
    name: "Southeast Asian Mandala",
    color: "#6c9a42",
    eligibleRoots: ["THA", "KHM", "VNM", "MMR", "LAO", "MYS", "IDN"],
    requiredSubregions: ["Southeast Asia", "South-Eastern Asia"],
    requiredReligions: ["Theravada Buddhism", "Mahayana Buddhism", "Sunni Islam"],
    minimumAbsorbed: 4,
    priority: 87,
  },
  {
    id: "malacca_league",
    name: "Malacca League",
    color: "#2d8e92",
    eligibleRoots: ["MYS", "IDN", "SGP", "BRN"],
    requiredCountryIds: ["MYS", "IDN"],
    minimumAbsorbed: 2,
    priority: 86,
  },
  {
    id: "andalusia",
    name: "Andalusia",
    color: "#b8893e",
    eligibleRoots: ["MAR", "DZA", "ESP", "PRT"],
    requiredCountryIds: ["ESP", "MAR"],
    minimumAbsorbed: 2,
    priority: 85,
  },
  {
    id: "north_african_empire",
    name: "North African Empire",
    color: "#b37f35",
    flag: "🏜️",
    eligibleRoots: ["MAR", "DZA", "TUN", "LBY", "EGY"],
    requiredSubregions: ["Northern Africa"],
    minimumAbsorbed: 3,
    priority: 84,
  },
  {
    id: "third_reich",
    name: "Third Reich",
    color: "#2f3035",
    flag: "🦅",
    eligibleRoots: ["DEU"],
    requiredCountryIds: ["DEU", "AUT"],
    requiredSubregions: ["Western Europe", "Central Europe", "Eastern Europe"],
    minimumAbsorbed: 5,
    priority: 101,
  },
  {
    id: "byzantine_empire",
    name: "Byzantine Empire",
    color: "#7b4aa0",
    flag: "☦️",
    eligibleRoots: ["GRC", "TUR"],
    requiredCountryIds: ["GRC", "TUR"],
    requiredSubregions: ["Southern Europe", "Middle East", "Western Asia"],
    requiredReligions: ["Orthodox Christianity"],
    minimumAbsorbed: 3,
    priority: 100,
  },
  {
    id: "tsardom_of_russia",
    name: "Tsardom of Russia",
    color: "#d8c8a8",
    flag: "👑",
    eligibleRoots: ["RUS"],
    requiredCountryIds: ["RUS"],
    requiredReligions: ["Orthodox Christianity"],
    minimumAbsorbed: 4,
    priority: 99,
  },
  {
    id: "akhand_pakistan",
    name: "Akhand Pakistan",
    color: "#136f47",
    flag: "☪️",
    eligibleRoots: ["PAK"],
    requiredCountryIds: ["PAK", "IND", "BGD"],
    requiredReligions: ["Sunni Islam"],
    minimumAbsorbed: 3,
    priority: 97,
  },
  {
    id: "mughal_empire",
    name: "Mughal Empire",
    color: "#2f7d62",
    flag: "🕌",
    eligibleRoots: ["PAK", "IND", "BGD", "AFG"],
    requiredCountryIds: ["PAK", "IND"],
    requiredReligions: ["Sunni Islam"],
    minimumAbsorbed: 4,
    priority: 96,
  },
  {
    id: "maurya_chakravartin",
    name: "Maurya Chakravartin",
    color: "#c88023",
    flag: "☸️",
    eligibleRoots: ["IND", "NPL", "LKA"],
    requiredCountryIds: ["IND"],
    requiredReligions: ["Hinduism", "Theravada Buddhism"],
    minimumAbsorbed: 5,
    priority: 95,
  },
  {
    id: "qing_restoration",
    name: "Qing Restoration",
    color: "#d8a032",
    flag: "🐉",
    eligibleRoots: ["CHN", "MNG"],
    requiredCountryIds: ["CHN", "MNG"],
    requiredSubregions: ["Eastern Asia"],
    minimumAbsorbed: 3,
    priority: 94,
  },
  {
    id: "yuan_khanate",
    name: "Yuan Khanate",
    color: "#7f8f3b",
    flag: "🐎",
    eligibleRoots: ["MNG", "CHN", "KAZ"],
    requiredCountryIds: ["MNG", "CHN"],
    minimumAbsorbed: 3,
    priority: 94,
  },
  {
    id: "greater_japan",
    name: "Greater Japanese Empire",
    color: "#b84b5e",
    flag: "🌸",
    eligibleRoots: ["JPN"],
    requiredCountryIds: ["JPN"],
    requiredSubregions: ["Eastern Asia", "South-Eastern Asia"],
    minimumAbsorbed: 4,
    priority: 93,
  },
  {
    id: "korean_empire",
    name: "Korean Empire",
    color: "#4b6fa8",
    flag: "☯️",
    eligibleRoots: ["KOR", "PRK"],
    requiredCountryIds: ["KOR", "PRK"],
    minimumAbsorbed: 1,
    priority: 92,
  },
  {
    id: "nusantara_empire",
    name: "Nusantara Empire",
    color: "#b86b28",
    flag: "🌊",
    eligibleRoots: ["IDN", "MYS", "PHL", "BRN"],
    requiredCountryIds: ["IDN", "MYS"],
    requiredSubregions: ["South-Eastern Asia"],
    requiredReligions: ["Sunni Islam"],
    minimumAbsorbed: 4,
    priority: 92,
  },
  {
    id: "indochinese_union",
    name: "Indochinese Union",
    color: "#9b3e35",
    flag: "🐘",
    eligibleRoots: ["VNM", "LAO", "KHM", "THA"],
    requiredCountryIds: ["VNM", "LAO", "KHM"],
    requiredSubregions: ["South-Eastern Asia"],
    minimumAbsorbed: 3,
    priority: 91,
  },
  {
    id: "siamese_mandala",
    name: "Siamese Mandala",
    color: "#a14d8f",
    flag: "🛕",
    eligibleRoots: ["THA"],
    requiredCountryIds: ["THA"],
    requiredReligions: ["Theravada Buddhism"],
    minimumAbsorbed: 3,
    priority: 90,
  },
  {
    id: "himalayan_confederation",
    name: "Himalayan Confederation",
    color: "#7b6cc2",
    flag: "🏔️",
    eligibleRoots: ["NPL", "BTN", "IND", "CHN"],
    requiredCountryIds: ["NPL", "BTN"],
    requiredSubregions: ["South Asia", "Southern Asia"],
    minimumAbsorbed: 2,
    priority: 89,
  },
  {
    id: "timurid_empire",
    name: "Timurid Empire",
    color: "#27887a",
    flag: "💠",
    eligibleRoots: ["UZB", "AFG", "IRN", "PAK", "TKM"],
    requiredCountryIds: ["UZB", "AFG"],
    requiredReligions: ["Sunni Islam", "Shia Islam"],
    minimumAbsorbed: 3,
    priority: 89,
  },
  {
    id: "holy_roman_empire",
    name: "Holy Roman Empire",
    color: "#b49a58",
    flag: "✝️",
    eligibleRoots: ["DEU", "AUT", "CHE"],
    requiredCountryIds: ["DEU", "AUT"],
    requiredReligions: ["Catholic Christianity", "Protestant Christianity"],
    minimumAbsorbed: 4,
    priority: 88,
  },
  {
    id: "frankish_empire",
    name: "Frankish Empire",
    color: "#4f6fa6",
    flag: "⚜️",
    eligibleRoots: ["FRA", "DEU", "BEL"],
    requiredCountryIds: ["FRA", "DEU"],
    requiredReligions: ["Catholic Christianity", "Protestant Christianity"],
    minimumAbsorbed: 3,
    priority: 87,
  },
  {
    id: "iberian_union",
    name: "Iberian Union",
    color: "#b06d3a",
    flag: "🛡️",
    eligibleRoots: ["ESP", "PRT"],
    requiredCountryIds: ["ESP", "PRT"],
    minimumAbsorbed: 1,
    priority: 87,
  },
  {
    id: "north_sea_empire",
    name: "North Sea Empire",
    color: "#477889",
    flag: "⚓",
    eligibleRoots: ["GBR", "DNK", "NOR", "SWE"],
    requiredCountryIds: ["GBR", "DNK"],
    requiredSubregions: ["Northern Europe"],
    minimumAbsorbed: 3,
    priority: 86,
  },
  {
    id: "kalmar_union",
    name: "Kalmar Union",
    color: "#5e8a63",
    flag: "❄️",
    eligibleRoots: ["SWE", "DNK", "NOR", "FIN"],
    requiredCountryIds: ["SWE", "DNK", "NOR"],
    minimumAbsorbed: 2,
    priority: 86,
  },
  {
    id: "british_imperial_federation",
    name: "Imperial Federation",
    color: "#334f8f",
    flag: "👑",
    eligibleRoots: ["GBR", "CAN", "AUS", "NZL"],
    requiredCountryIds: ["GBR"],
    requiredSubregions: ["Northern America", "Australia and New Zealand"],
    minimumAbsorbed: 4,
    priority: 85,
  },
  {
    id: "polish_lithuanian_commonwealth",
    name: "Polish-Lithuanian Commonwealth",
    color: "#c85a5d",
    flag: "⚔️",
    eligibleRoots: ["POL", "LTU", "UKR", "BLR"],
    requiredCountryIds: ["POL", "LTU"],
    minimumAbsorbed: 2,
    priority: 85,
  },
  {
    id: "baltic_commonwealth",
    name: "Baltic Commonwealth",
    color: "#4d7d8d",
    flag: "🌲",
    eligibleRoots: ["LTU", "LVA", "EST", "POL"],
    requiredCountryIds: ["LTU", "LVA", "EST"],
    minimumAbsorbed: 2,
    priority: 84,
  },
  {
    id: "danubian_federation",
    name: "Danubian Federation",
    color: "#8a6b47",
    flag: "🌉",
    eligibleRoots: ["AUT", "HUN", "CZE", "SVK", "ROU"],
    requiredCountryIds: ["AUT", "HUN"],
    requiredSubregions: ["Eastern Europe", "Southern Europe"],
    minimumAbsorbed: 3,
    priority: 84,
  },
  {
    id: "balkan_federation",
    name: "Balkan Federation",
    color: "#6a5ea8",
    flag: "⛰️",
    eligibleRoots: ["SRB", "BGR", "GRC", "ROU", "ALB"],
    requiredSubregions: ["Southern Europe"],
    minimumAbsorbed: 5,
    priority: 83,
  },
  {
    id: "yugoslav_restoration",
    name: "Yugoslav Restoration",
    color: "#315f9b",
    flag: "⭐",
    eligibleRoots: ["SRB", "HRV", "BIH", "SVN", "MNE"],
    requiredCountryIds: ["SRB", "HRV", "BIH"],
    minimumAbsorbed: 3,
    priority: 83,
  },
  {
    id: "carpathian_realm",
    name: "Carpathian Realm",
    color: "#8e514f",
    flag: "🏰",
    eligibleRoots: ["HUN", "ROU", "UKR", "SVK"],
    requiredSubregions: ["Eastern Europe"],
    minimumAbsorbed: 4,
    priority: 82,
  },
  {
    id: "caucasus_imamate",
    name: "Caucasus Imamate",
    color: "#347a5c",
    flag: "⛰️",
    eligibleRoots: ["AZE", "GEO", "ARM", "RUS"],
    requiredCountryIds: ["AZE", "GEO", "ARM"],
    requiredSubregions: ["Western Asia"],
    minimumAbsorbed: 2,
    priority: 82,
  },
  {
    id: "levantine_mandate",
    name: "Levantine Mandate",
    color: "#9b7145",
    flag: "🕊️",
    eligibleRoots: ["SYR", "JOR", "LBN", "ISR", "PSE"],
    requiredCountryIds: ["SYR", "JOR"],
    requiredSubregions: ["Middle East", "Western Asia"],
    minimumAbsorbed: 3,
    priority: 81,
  },
  {
    id: "gulf_federation",
    name: "Gulf Federation",
    color: "#25866c",
    flag: "⛽",
    eligibleRoots: ["SAU", "ARE", "QAT", "KWT", "OMN", "BHR"],
    requiredCountryIds: ["SAU", "ARE"],
    requiredSubregions: ["Middle East", "Western Asia"],
    requiredReligions: ["Sunni Islam", "Shia Islam"],
    minimumAbsorbed: 3,
    priority: 80,
  },
  {
    id: "maghreb_union",
    name: "Maghreb Union",
    color: "#a17637",
    flag: "🌙",
    eligibleRoots: ["MAR", "DZA", "TUN", "LBY"],
    requiredCountryIds: ["MAR", "DZA", "TUN"],
    requiredReligions: ["Sunni Islam"],
    minimumAbsorbed: 2,
    priority: 80,
  },
  {
    id: "nile_kingdom",
    name: "Nile Kingdom",
    color: "#4d8b7f",
    flag: "🐊",
    eligibleRoots: ["EGY", "SDN", "ETH"],
    requiredCountryIds: ["EGY", "SDN"],
    requiredSubregions: ["Northern Africa", "Eastern Africa"],
    minimumAbsorbed: 3,
    priority: 79,
  },
  {
    id: "abyssinian_empire",
    name: "Abyssinian Empire",
    color: "#967547",
    flag: "☦️",
    eligibleRoots: ["ETH", "ERI", "SOM"],
    requiredCountryIds: ["ETH", "ERI"],
    requiredReligions: ["Orthodox Christianity", "Sunni Islam"],
    minimumAbsorbed: 2,
    priority: 79,
  },
  {
    id: "great_lakes_confederacy",
    name: "Great Lakes Confederacy",
    color: "#477f6c",
    flag: "💧",
    eligibleRoots: ["UGA", "RWA", "BDI", "COD", "TZA"],
    requiredSubregions: ["Eastern Africa", "Middle Africa"],
    minimumAbsorbed: 4,
    priority: 78,
  },
  {
    id: "kongo_restoration",
    name: "Kongo Restoration",
    color: "#8b5d39",
    flag: "🥁",
    eligibleRoots: ["COD", "COG", "AGO"],
    requiredCountryIds: ["COD", "COG"],
    minimumAbsorbed: 2,
    priority: 78,
  },
  {
    id: "west_african_mandate",
    name: "West African Mandate",
    color: "#3d8a58",
    flag: "🌍",
    eligibleRoots: ["NGA", "GHA", "CIV", "SEN", "MLI"],
    requiredSubregions: ["Western Africa"],
    minimumAbsorbed: 5,
    priority: 77,
  },
  {
    id: "sahel_caliphate",
    name: "Sahel Caliphate",
    color: "#8f7b39",
    flag: "☪️",
    eligibleRoots: ["MLI", "NER", "TCD", "BFA", "SDN"],
    requiredReligions: ["Sunni Islam"],
    requiredSubregions: ["Western Africa", "Middle Africa", "Northern Africa"],
    minimumAbsorbed: 4,
    priority: 77,
  },
  {
    id: "cape_to_cairo",
    name: "Cape-to-Cairo Dominion",
    color: "#6f7d4a",
    flag: "🚂",
    eligibleRoots: ["ZAF", "EGY", "KEN", "ETH"],
    requiredCountryIds: ["ZAF", "EGY"],
    requiredRegions: ["Africa"],
    minimumAbsorbed: 6,
    priority: 76,
  },
  {
    id: "american_empire",
    name: "American Empire",
    color: "#315f9b",
    flag: "🦅",
    eligibleRoots: ["USA"],
    requiredCountryIds: ["USA"],
    requiredSubregions: ["Northern America", "Central America", "Caribbean"],
    minimumAbsorbed: 4,
    priority: 76,
  },
  {
    id: "manifest_union",
    name: "Manifest Union",
    color: "#406fa5",
    flag: "⭐",
    eligibleRoots: ["USA", "MEX", "CAN"],
    requiredCountryIds: ["USA", "MEX", "CAN"],
    minimumAbsorbed: 2,
    priority: 75,
  },
  {
    id: "maple_crown",
    name: "Maple Crown",
    color: "#ad4f58",
    flag: "🍁",
    eligibleRoots: ["CAN"],
    requiredCountryIds: ["CAN"],
    requiredSubregions: ["Northern America"],
    minimumAbsorbed: 3,
    priority: 75,
  },
  {
    id: "mexican_empire",
    name: "Mexican Empire",
    color: "#2f7d52",
    flag: "🌵",
    eligibleRoots: ["MEX"],
    requiredCountryIds: ["MEX"],
    requiredSubregions: ["Central America", "Northern America"],
    minimumAbsorbed: 3,
    priority: 74,
  },
  {
    id: "amazonian_pact",
    name: "Amazonian Pact",
    color: "#2c7f4d",
    flag: "🌿",
    eligibleRoots: ["BRA", "PER", "COL", "VEN", "BOL"],
    requiredCountryIds: ["BRA"],
    requiredSubregions: ["South America"],
    minimumAbsorbed: 5,
    priority: 74,
  },
  {
    id: "la_plata_union",
    name: "La Plata Union",
    color: "#5b77a7",
    flag: "☀️",
    eligibleRoots: ["ARG", "URY", "PRY", "BOL"],
    requiredCountryIds: ["ARG", "URY"],
    requiredSubregions: ["South America"],
    minimumAbsorbed: 2,
    priority: 73,
  },
  {
    id: "patagonian_republic",
    name: "Patagonian Republic",
    color: "#577fa0",
    flag: "❄️",
    eligibleRoots: ["ARG", "CHL"],
    requiredCountryIds: ["ARG", "CHL"],
    minimumAbsorbed: 2,
    priority: 73,
  },
  {
    id: "bolivarian_league",
    name: "Bolivarian League",
    color: "#c99a31",
    flag: "⚡",
    eligibleRoots: ["VEN", "COL", "ECU", "BOL"],
    requiredCountryIds: ["VEN", "COL"],
    minimumAbsorbed: 3,
    priority: 72,
  },
  {
    id: "southern_cross_federation",
    name: "Southern Cross Federation",
    color: "#3e7b8d",
    flag: "✦",
    eligibleRoots: ["AUS", "NZL"],
    requiredCountryIds: ["AUS", "NZL"],
    requiredSubregions: ["Australia and New Zealand"],
    minimumAbsorbed: 1,
    priority: 72,
  },
  {
    id: "oceanic_league",
    name: "Oceanic League",
    color: "#2c8494",
    flag: "🌺",
    eligibleRoots: ["AUS", "NZL", "PNG", "FJI"],
    requiredSubregions: ["Melanesia", "Polynesia", "Australia and New Zealand"],
    minimumAbsorbed: 4,
    priority: 71,
  },
  {
    id: "pacific_ring_command",
    name: "Pacific Ring Command",
    color: "#2e6e8f",
    flag: "🌀",
    eligibleRoots: ["JPN", "IDN", "PHL", "AUS", "USA", "CHL"],
    requiredSubregions: ["Eastern Asia", "South-Eastern Asia", "Australia and New Zealand", "South America"],
    minimumAbsorbed: 7,
    priority: 70,
  },
  {
    id: "red_international",
    name: "Red International",
    color: "#b5262d",
    flag: "🚩",
    requiredReligions: ["State Atheism"],
    government: "Communism",
    minimumAbsorbed: 14,
    minimumProvinces: 120,
    priority: 69,
  },
  {
    id: "liberal_world_order",
    name: "Liberal World Order",
    color: "#3c68a9",
    flag: "🗽",
    government: "Democracy",
    minimumAbsorbed: 15,
    minimumProvinces: 130,
    priority: 68,
  },
  {
    id: "crowned_earth",
    name: "Crowned Earth",
    color: "#7a5b9b",
    flag: "👑",
    government: "Aristocracy",
    minimumAbsorbed: 15,
    minimumProvinces: 130,
    priority: 67,
  },
  {
    id: "world_caliphate",
    name: "World Caliphate",
    color: "#0c7a54",
    flag: "☪️",
    requiredReligions: ["Sunni Islam", "Shia Islam"],
    minimumAbsorbed: 16,
    minimumProvinces: 150,
    priority: 66,
  },
  {
    id: "european_directorate",
    name: "European Directorate",
    color: "#476aa6",
    flag: "🏛️",
    eligibleRoots: ["FRA", "DEU", "ITA", "ESP", "POL", "NLD", "BEL"],
    requiredRegions: ["Europe"],
    minimumAbsorbed: 5,
    priority: 82,
  },
  {
    id: "roman_empire",
    name: "Roman Empire",
    color: "#8f3230",
    eligibleRoots: ["ITA"],
    requiredCountryIds: ["ITA"],
    requiredSubregions: ["Southern Europe", "Western Europe", "Middle East"],
    requiredReligions: ["Catholic Christianity", "Orthodox Christianity"],
    minimumAbsorbed: 6,
    priority: 83,
  },
  {
    id: "gran_colombia",
    name: "Gran Colombia",
    color: "#c79d32",
    eligibleRoots: ["COL", "VEN", "ECU", "PAN"],
    requiredCountryIds: ["COL", "VEN", "ECU"],
    minimumAbsorbed: 2,
    priority: 81,
  },
  {
    id: "andes_federation",
    name: "Andean Federation",
    color: "#7d63a8",
    eligibleRoots: ["PER", "BOL", "CHL", "ECU"],
    requiredSubregions: ["South America"],
    minimumAbsorbed: 4,
    priority: 79,
  },
  {
    id: "african_union_state",
    name: "African Union State",
    color: "#38865f",
    eligibleRoots: ["NGA", "ZAF", "EGY", "ETH", "DZA", "COD"],
    requiredRegions: ["Africa"],
    minimumAbsorbed: 7,
    priority: 76,
  },
  {
    id: "east_african_federation",
    name: "East African Federation",
    color: "#4c8f54",
    eligibleRoots: ["KEN", "TZA", "UGA", "ETH", "RWA"],
    requiredSubregions: ["Eastern Africa"],
    minimumAbsorbed: 3,
    priority: 75,
  },
  {
    id: "north_american_compact",
    name: "North American Compact",
    color: "#315f9b",
    eligibleRoots: ["USA", "CAN", "MEX"],
    requiredCountryIds: ["USA", "CAN", "MEX"],
    minimumAbsorbed: 2,
    priority: 74,
  },
  {
    id: "southern_cone",
    name: "Southern Cone League",
    color: "#5b74a8",
    eligibleRoots: ["ARG", "CHL", "URY", "PRY"],
    requiredCountryIds: ["ARG", "CHL"],
    minimumAbsorbed: 2,
    priority: 72,
  },
  {
    id: "caribbean_federation",
    name: "Caribbean Federation",
    color: "#3b82a0",
    eligibleRoots: ["CUB", "DOM", "HTI", "JAM", "TTO"],
    requiredSubregions: ["Caribbean"],
    minimumAbsorbed: 3,
    priority: 71,
  },
  {
    id: "sahel_sultanate",
    name: "Sahel Sultanate",
    color: "#9a7a3a",
    eligibleRoots: ["MLI", "NER", "TCD", "BFA", "SDN"],
    requiredSubregions: ["Western Africa", "Middle Africa", "Northern Africa"],
    requiredReligions: ["Sunni Islam"],
    minimumAbsorbed: 4,
    priority: 70,
  },
  {
    id: "arab_union",
    name: "Arab Union",
    color: "#23845c",
    eligibleRoots: ["SAU", "EGY", "IRQ", "JOR", "SYR", "ARE", "QAT", "KWT"],
    requiredSubregions: ["Middle East", "Northern Africa"],
    requiredReligions: ["Sunni Islam", "Shia Islam"],
    minimumAbsorbed: 4,
    priority: 69,
  },
];

export function buildMetadataIndex(metadata: CountryMetadataRecord[]): CountryMetadataIndex {
  const index: CountryMetadataIndex = {};
  metadata.forEach(record => {
    if (record.cca3) {
      index[record.cca3] = record;
    }
  });
  return index;
}

export function metadataName(countryId: string, metadata: CountryMetadataIndex) {
  return metadata[countryId]?.name?.common ?? countryId;
}

export function metadataFlag(countryId: string, metadata: CountryMetadataIndex) {
  const cca2 = metadata[countryId]?.cca2;
  if (!cca2 || cca2.length !== 2) return "⚑";
  return cca2
    .toUpperCase()
    .split("")
    .map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

export function metadataRegion(countryId: string, metadata: CountryMetadataIndex) {
  return metadata[countryId]?.region ?? "Unassigned";
}

export function metadataSubregion(countryId: string, metadata: CountryMetadataIndex) {
  return metadata[countryId]?.subregion ?? "Unassigned";
}

export function modernStrategicPower(countryId: string, metadata: CountryMetadataIndex, provinceCount: number) {
  if (MODERN_POWER_OVERRIDES[countryId]) return MODERN_POWER_OVERRIDES[countryId];
  const record = metadata[countryId];
  if (!record) {
    return Math.max(10, Math.min(32, Math.round(Math.sqrt(Math.max(1, provinceCount)) * 4)));
  }
  const populationScore = Math.log10(Math.max(1, record.population)) * 7;
  const areaScore = Math.log10(Math.max(1, record.area)) * 4;
  const subdivisionScore = Math.min(8, Math.sqrt(Math.max(1, provinceCount)));
  return Math.max(8, Math.min(49, Math.round(populationScore + areaScore + subdivisionScore - 34)));
}

export function countryTicketCost(country: Country) {
  const subdivisionCost = Math.min(50, Math.round(Math.sqrt(country.provinces.length) * 4));
  return Math.max(25, controlledDevelopmentScore(country) * 2 + subdivisionCost);
}

export function applyCountryFormation(country: Country, countries: Record<string, Country>) {
  const controlledIds = new Set([country.baseId, ...country.absorbedCountryIds]);
  const controlledRegions = new Set<string>();
  const controlledSubregions = new Set<string>();

  controlledIds.forEach(countryId => {
    const controlledCountry = countries[countryId] ?? Object.values(countries).find(candidate => candidate.baseId === countryId);
    if (controlledCountry) {
      controlledRegions.add(controlledCountry.region);
      controlledSubregions.add(controlledCountry.subregion);
    }
  });

  const rule = FORMATION_RULES
    .filter(candidate => !country.unlockedFormations.includes(candidate.id))
    .filter(candidate => !candidate.eligibleRoots || candidate.eligibleRoots.includes(country.baseId))
    .filter(candidate => !candidate.requiredFormations || candidate.requiredFormations.every(id => country.unlockedFormations.includes(id)))
    .filter(candidate => !candidate.minimumProvinces || country.provinces.length >= candidate.minimumProvinces)
    .filter(candidate => !candidate.minimumAbsorbed || country.absorbedCountryIds.length >= candidate.minimumAbsorbed)
    .filter(candidate => !candidate.government || country.government === candidate.government)
    .filter(candidate => !candidate.requiredReligions || candidate.requiredReligions.includes(country.religion))
    .filter(candidate => !candidate.requiredCountryIds || candidate.requiredCountryIds.every(id => controlledIds.has(id)))
    .filter(candidate => !candidate.requiredRegions || candidate.requiredRegions.some(region => controlledRegions.has(region)))
    .filter(candidate => !candidate.requiredSubregions || candidate.requiredSubregions.some(subregion => controlledSubregions.has(subregion)))
    .sort((a, b) => b.priority - a.priority)[0];

  if (rule) {
    const formationName = uniqueFormationName(country, rule.name, countries);
    return {
      country: {
        ...country,
        name: formationName,
        flag: rule.flag ?? country.flag,
        mapColor: rule.color,
        unlockedFormations: [...country.unlockedFormations, rule.id],
        strategicPower: Math.max(country.strategicPower, country.strategicPower + 6),
      },
      formationName,
    };
  }

  if (
    country.unlockedFormations.length === 0 &&
    country.absorbedCountryIds.length >= 5 &&
    country.provinces.length >= 45 &&
    controlledDevelopmentScore(country) >= 330 &&
    !/Empire$|Caliphate$|Imamate$|Order$|Mandala$|Directorate$|Realm$|Dominion$/u.test(country.name)
  ) {
    const baseName = country.name.replace(/ Empire$| Union$| State$| Directorate$| Federation$| Confederation$/u, "");
    const formationName = religiousRealmName(baseName, country.religion);
    return {
      country: {
        ...country,
        name: formationName,
        strategicPower: Math.max(country.strategicPower, country.strategicPower + 3),
      },
      formationName,
    };
  }

  return { country, formationName: null };
}

function uniqueFormationName(country: Country, formationName: string, countries: Record<string, Country>) {
  const duplicateExists = Object.values(countries).some(candidate => (
    candidate.id !== country.id &&
    candidate.isAlive &&
    candidate.name === formationName
  ));

  if (!duplicateExists) return formationName;
  const baseName = country.name.replace(/ Empire$| Union$| State$| Directorate$| Federation$/u, "");
  return `${baseName} ${formationName}`;
}

function religiousRealmName(baseName: string, religion: ReligiousDenomination) {
  if (religion === "Sunni Islam") return `${baseName} Caliphate`;
  if (religion === "Shia Islam") return `${baseName} Imamate`;
  if (religion === "Catholic Christianity") return `${baseName} Catholic Order`;
  if (religion === "Protestant Christianity") return `${baseName} Covenant`;
  if (religion === "Orthodox Christianity") return `${baseName} Orthodox Realm`;
  if (religion === "Hinduism") return `${baseName} Dharmic Realm`;
  if (religion === "Theravada Buddhism" || religion === "Mahayana Buddhism") return `${baseName} Mandala`;
  if (religion === "Judaism") return `${baseName} Covenant`;
  if (religion === "State Atheism") return `${baseName} Directorate`;
  return `${baseName} Empire`;
}

export function rebelName(parent: Country, government: GovernmentType) {
  const base = parent.name.replace(/ Empire$| Union$| State$| Directorate$| Federation$/u, "");
  if (government === "Communism") return `Red ${base}`;
  if (government === "Caliphate") return `Islamic Revolutionaries of ${base}`;
  if (government === "Revolutionary") return `${base} Liberation Front`;
  if (government === "Aristocracy") return `${base} Royal Restoration`;
  return `Free ${base}`;
}
