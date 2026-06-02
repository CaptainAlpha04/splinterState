import type { GovernmentType } from "../models/enums";

export function governmentModifier(government: GovernmentType): number {
  switch (government) {
    case "Communism":
      return 10;
    case "Caliphate":
      return 6;
    case "Democracy":
      return 4;
    case "Aristocracy":
      return 2;
    case "Revolutionary":
      return 8;
    default:
      return 0;
  }
}
