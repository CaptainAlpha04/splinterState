export type PlayerState = {
  tickets: number;
  campaignFavoriteCountryId: string | null;
  campaignStake: number;
  activeWarBets: Map<
    string,
    { warId: string; predictedWinnerId: string; amount: number }
  >;
};
