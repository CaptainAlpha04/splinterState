import type { GovernmentType } from "./enums";

export type ReligiousDenomination =
  | "Sunni Islam"
  | "Shia Islam"
  | "Catholic Christianity"
  | "Protestant Christianity"
  | "Orthodox Christianity"
  | "Hinduism"
  | "Theravada Buddhism"
  | "Mahayana Buddhism"
  | "Judaism"
  | "State Atheism"
  | "Secular Pluralism"
  | "Folk Traditions";

export type CountryModifier = {
  label: string;
  value: number;
  description: string;
};

export type Country = {
  id: string;
  baseId: string;
  name: string;
  flag: string;
  mapColor: string;
  provinces: string[];
  initialProvinceCount: number;
  strategicPower: number;
  population: number;
  area: number;
  region: string;
  subregion: string;
  absorbedGovernments: GovernmentType[];
  absorbedCountryIds: string[];
  unlockedFormations: string[];
  largestAbsorbedProvinceCount: number;
  campaignPhaseBorn: number;
  capitalProvinceId: string;
  government: GovernmentType;
  religion: ReligiousDenomination;
  specialModifiers: CountryModifier[];
  armyCampsCount: number;
  eventModifier: number;
  isAlive: boolean;
};
