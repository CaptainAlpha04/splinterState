import type { GovernmentType } from "./enums";

export type CountryModifier = {
  label: string;
  value: number;
  description: string;
};

export type Country = {
  id: string;
  name: string;
  flag: string;
  provinces: string[];
  strategicPower: number;
  capitalProvinceId: string;
  government: GovernmentType;
  specialModifiers: CountryModifier[];
  armyCampsCount: number;
  eventModifier: number;
  isAlive: boolean;
};
