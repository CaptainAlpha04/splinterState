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

export type MapAssets = {
  provinces: ProvinceRecord[];
  countries: CountryRecord[];
  capitals: CapitalRecord[];
  svgMarkup: string;
};

export async function loadMapAssets(): Promise<MapAssets> {
  const [provincesRes, countriesRes, capitalsRes, svgRes] = await Promise.all([
    fetch("/map/provinces.json"),
    fetch("/map/countries.json"),
    fetch("/map/capitals.json"),
    fetch("/map/map.svg")
  ]);

  return {
    provinces: await provincesRes.json(),
    countries: await countriesRes.json(),
    capitals: await capitalsRes.json(),
    svgMarkup: await svgRes.text(),
  };
}
