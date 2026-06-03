export type Province = {
  id: string;
  name: string;
  initialCountryId: string;
  ownerId: string;
  adjacentProvinceIds: string[];
  isIncinerated: boolean;
  rings?: number[][][];
  bounds?: number[];
};
