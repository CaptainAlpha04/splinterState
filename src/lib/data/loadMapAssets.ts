export type ProvinceRecord = {
  id: string;
  name: string;
  countryId: string;
  adjacentProvinceIds: string[];
};

export type CountryRecord = {
  id: string;
  name: string;
  capitalProvinceId: string;
  provinceIds: string[];
};

export type CapitalRecord = {
  countryId: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type CountryMetadataRecord = {
  cca2: string;
  cca3: string;
  flag: string;
  name: {
    common: string;
    official: string;
  };
  population: number;
  area: number;
  region: string;
  subregion?: string;
};

export type MapAssets = {
  provinces: ProvinceRecord[];
  countries: CountryRecord[];
  capitals: CapitalRecord[];
  metadata: CountryMetadataRecord[];
  svgMarkup: string;
};

export async function loadMapAssets(): Promise<MapAssets> {
  const [provincesRes, countriesRes, capitalsRes, metadataRes, svgRes] = await Promise.all([
    fetch("/map/provinces.json"),
    fetch("/map/countries.json"),
    fetch("/map/capitals.json"),
    fetch("/map/countryMetadata.json"),
    fetch("/map/map.svg")
  ]);

  return {
    provinces: await provincesRes.json(),
    countries: await countriesRes.json(),
    capitals: await capitalsRes.json(),
    metadata: await metadataRes.json(),
    svgMarkup: await svgRes.text(),
  };
}
