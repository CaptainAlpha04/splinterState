export type PlayerState = {
  tickets: number;
  campaignFavoriteCountryId: string | null;
  activeWarBets: Map<
    string,
    { warId: string; predictedWinnerId: string; amount: number }
  >;
};
