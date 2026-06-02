# Product & Technical Specifications: Splinter States
This document establishes the authoritative technical design and system architecture for a web-based, automated global grand strategy simulation game. The game combines map-painting mechanics, ideological civil wars, dynamic wheel-based initiative, and a high-stakes progression economy.

---

## 1. High-Level Technology Stack

The platform is designed as a lightweight, high-performance web application optimized for client-side rendering of complex visual states and rapid data processing.

* **Frontend Framework:** Next.js (App Router) using TypeScript for strict type safety across game states.
* **Graphics & Map Engine:** HTML5 Canvas API or Tailwind CSS integrated with customized SVG-based map paths for individual provinces. The Canvas API handles the real-time drawing and animation of the Initiative Spin Wheel.
* **State Management:** Zustand. This ensures high-performance, atomic state updates without rendering bottlenecks during rapid simulation loops.
* **Styling:** Tailwind CSS for modular layouts.
* **Mathematical Utilities:** Native JavaScript `Math` libraries utilizing deterministic seeding algorithms to ensure identical simulation results across clients in multiplayer contexts.

### 1.1 Map Data & Scope Decisions

* **Map Dataset:** Natural Earth admin-1 (most detailed available) with present-day boundaries.
* **Province Granularity:** All admin-1 regions worldwide (one province per admin-1 region).
* **Capital Data:** National capitals (country-level) to anchor campaign setup and UI.
* **Country Metadata:** REST Countries metadata is stored locally for ISO3 names, ISO2-derived flags, population, area, region, and subregion. Province count remains the map-painting unit, not the sole value metric.
* **Tiering Rule:** Modern-content based. The United States and China are the only starting Empires. Other countries become Empires through conquest, formations, or mission-tree-style identity progression.
* **Storage:** Local state only for MVP; multiplayer support as stubs.
* **Rendering:** Hybrid UI with SVG map and Canvas initiative wheel.

---

## 2. Core Game State & Data Models

### 2.1 Enums & Literal Types

```typescript
type CountryTier = 'Kingdom' | 'Empire' | 'Hegemon';

type GovernmentType = 'Communism' | 'Caliphate' | 'Democracy' | 'Aristocracy' | 'Revolutionary';

type IdeologicalFaction = {
  government: GovernmentType;
  colorHex: string;
  rebelPrefix: string;
};

```

### 2.2 Entity Interfaces

```typescript
interface Province {
  id: string;
  name: string;
  adjacentProvinceIds: string[];
  isIncinerated: boolean; // Flags radioactive zones during active wars
}

interface Country {
  id: string;
  name: string;
  provinces: string[]; // Array of Province IDs
  capitalProvinceId: string;
  government: GovernmentType;
  armyCampsCount: number; // Campaign-long inherited asset
  isAlive: boolean;
}

interface ActiveWar {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerOccupiedCapital: boolean;
  defenderOccupiedCapital: boolean;
  incineratedProvinceIds: string[]; // Active dead zones for this war only
}

interface PlayerState {
  tickets: number; // Base safety net = 500
  campaignFavoriteCountryId: string | null;
  activeWarBets: Map<string, { warId: string; predictedWinnerId: string; amount: number }>;
}

```

---

## 3. Comprehensive Game Mechanics & Logic

### 3.1 The Ticket Ledger & Betting System

The game progression relies entirely on a ticket-based economy that acts as both a gatekeeper and a score metric.

* **The Baseline Safety Net:** If a player's wallet drops to zero, the campaign does not immediately end. The next betting window becomes constrained until the player earns or receives enough tickets through later rules.
* **Country Entry Barriers:** Countries are locked behind buy-in thresholds tied to strategic power, population, area, and a small capped province subdivision factor.
* *Kingdom Tier:* Low to medium buy-in.
* *Empire Tier:* Reserved for starting superpowers and countries that earn imperial status in play.


* **The Double-or-Nothing Wagering Engine:** Players can place specific ticket wagers on individual conflicts during the pre-combat phase. A correct prediction returns $2 \times \text{wager}$. An incorrect prediction completely forfeits the wagered amount.

### 3.2 Campaign Setup & Round Architecture

The simulation begins with campaign setup before the combat loop starts.

```
[Pick Campaign Scope] -> [Pick Campaign Favorite] -> [Event Horizon] -> [War Matchmaking] -> [War Selection] -> [Betting] -> [Combat Resolution]

```

* **Campaign Scope:** The player chooses World War (entire map), Continent War (one continent), or Regional War (one broad region). This locks the eligible country set and outer camera boundary for the campaign.
* **Campaign Favorite:** Hovering a province shows province details. Clicking a province selects the controlling country and reveals country details. The player buys one campaign favorite; country price scales by metadata-backed strategic value rather than raw province count.
* **Dynamic Sidebar:** The sidebar only shows controls relevant to the current stage. The initiative wheel appears only when the player is viewing or resolving a specific war.

#### Country Identity Progression

Country content is driven by formation rules, not only by map ownership. Each country tracks its base ID, absorbed country IDs, absorbed governments, region, subregion, current color, and unlocked formations. After annexing a rival, the winner checks mission-tree-style formation rules.

Examples:

* Middle Eastern powers can form the **New Islamic Caliphate** after absorbing enough of the region.
* Kazakhstan or Russia can proclaim a **Revived USSR** after consolidating the post-Soviet sphere.
* Morocco can pursue **Andalusia** through Iberian expansion or a **North African Empire** through Maghrebi expansion.
* Iran can become the **Persian Empire**, Turkey can restore the **Ottoman Porte**, and South Asian powers can form a **Greater Indian Union**.
* If no bespoke formation is available, any country that has genuinely conquered enough territory can proclaim an empire-tier identity.

#### Event Horizon (Global Standstill Checking + Event Modifiers)

No military operations occur during this phase. Once the campaign favorite is selected, the engine scans all in-scope active countries, applies structural stability checks, and rolls temporary event modifiers that can increase or decrease initiative weight.

| Tier | Trigger | Rebellion Probability | Separation Paradigm |
| --- | --- | --- | --- |
| **Kingdom** | Starting and small conquered countries | $0\%$ | Stable. No strategic rebel checks. |
| **Empire** | Starting US/China or countries that earned empire status | roughly $18\% - 35\%$ after phase one | Structural stress. One full rebel country may split away. |

Each Event Horizon gives every active in-scope country a one-round initiative modifier from a named event. Positive events include local initiative, officer corps rallies, and golden mobilization. Negative events include border unrest, supply scandals, and state paralysis. The modifier is temporary and recalculated at the next Event Horizon.

No rebels spawn in the first Event Horizon. After that, only Empire-scale countries roll for rebellion. A rebel country takes at least five provinces when possible and is capped by the size of the largest country the parent previously absorbed. Rebel ideology is derived from the parent state's absorbed governments, current government, and regional religious/cultural context. Examples include **Red Arabia**, **Islamic Revolutionaries of Persia**, and liberation-front style names.

* **Forced Civil War Rule:** When rebels spawn, the parent and rebel state are automatically placed into war in the next War Selection phase. The player does not choose whether that civil war happens.

#### War Matchmaking

The system iterates through all active in-scope entities to automatically map valid conflicts.

* **The Monogamy Rule:** A country can never be assigned to more than one active war calculation simultaneously within a single round.
* **The Adjacency Core:** Valid declarations of war can only occur between countries that share at least one contiguous, non-incinerated border province.
* **Island / Naval Fallback:** If an isolated country has no land-border match, matchmaking may create an off-front war only against nearby capitals. Inland countries cannot randomly declare on distant states through this fallback.
* **Scope Boundary Rule:** Countries outside the selected campaign scope are not eligible combatants.

#### War Selection & Betting

The player reviews generated wars, opens one war, chooses a war favorite, and places a ticket bet. A correct prediction returns double the wager. An incorrect prediction forfeits the wager; if the player's wallet reaches zero, the campaign ends.

#### Combat Resolution Loop

The selected war is processed until one country is eliminated. Each combat turn computes the initiative wheel from country size plus government, event, army camp, and capital modifiers. The wheel winner rolls the -8 to +8 action die.

---

## 4. Algorithmic Resolution Mechanics

### 4.1 Step 1: The Dynamic Initiative Wheel Calculation

Every individual combat turn begins with a calculation of the slice distribution on a 360-degree interactive spin wheel.

The mathematical weight $W$ for a combatant $C$ within an active war is defined as:

$$W_C = P_C + M_{\text{Gov}} + (A_C \times 10) + K_C$$

Where:

* $P_C$: Metadata-backed strategic power plus a capped square-root province subdivision factor. Raw province count is not used directly because the map dataset subdivides countries unevenly.
* $M_{\text{Gov}}$: Fixed integer modifiers determined by government characteristics (e.g., $+10$ Army Morale under specific regimes).
* $A_C$: Total number of permanent campaign-wide Army Camps held by the country.
* $K_C$: The Capital Control Modifier. If a nation successfully occupies the opponent's starting capital province through nearest-border conquest, they receive a flat weight bonus of $+20$. The defender's weight drops by a corresponding margin.

The percentage allocation of the wheel space is computed as:

$$\text{Wheel Slice Size } (\%) = \left( \frac{W_C}{W_{\text{Attacker}} + W_{\text{Defender}}} \right) \times 100$$

### 4.2 Step 2: The Action Roll & Pathfinding Resolution

Once the client interface completes the wheel animation and stops on the selected nation, that nation acts as the attacker for the turn and rolls a single deterministic random number generator scoring between **-8 and +8**.

#### Positive Outcomes ($+1$ to $+8$)

The active nation captures a number of provinces equal to the rolled value from the target country.

* **The Proximity Pathfinding Law:** Conquest cannot execute non-contiguous territorial jumps. The engine runs a Breadth-First Search (BFS) starting directly from the closest shared border province. It identifies adjacent enemy provinces and transfers ownership sequentially based on geographical proximity.

#### Negative Outcomes ($-1$ to $-8$)

The offensive forces experience an immediate supply lines collapse. The defending country executes an instant counter-conquest, absorbing provinces from the active country using the same BFS proximity algorithm based on the absolute rolled value.

#### The Critical Zero Outcome ($0$)

The combat state enters a brief tactical equilibrium. The active country is presented with a critical technological upgrade split path:

1. **Construct Campaign Army Camp:** The nation gains a permanent, structural $+10\%$ initiative wheel modifier. This infrastructure is permanently tied to the geographical territory. If this country is subsequently annihilated by an adversary, the victor inherits all built Army Camps, compounding their global wheel weight.
2. **Deploy Tactical Nuclear Strike:** The active country fires a weapon targeting the enemy's designated capital province.
* The engine instantly executes a secondary **1–10 dice roll**.
* The resulting integer represents the exact number of enemy provinces targeted for destruction.
* Starting from the capital and radiating outwards via BFS proximity pathfinding, those provinces are captured by the attacker and flagged with `isIncinerated = true`.
* **The Dead Zone Rule:** For the remainder of that specific war, these radioactive zones provide zero power contribution to either side's initiative wheel math, cannot be recaptured or manipulated by the defender, and remain frozen until total war resolution.



#### Total Annihilation Rule

The combat resolution sub-loop breaks only when a country's active province array count reaches exactly zero. The victorious nation instantly executes a full annexation of the defeated territory, claims ownership of all underlying permanent assets, and triggers the ticket payout functions to the player.

---

## 5. Technical Implementation & Phase Architecture

The development pipeline is segmented into five distinct milestones to ensure rigorous state validation before scaling visual interfaces.

### Milestone 1: Map Data Pipeline + Minimal Viable Engine

* Establish pure TypeScript interfaces for provinces, countries, and player states.
* Ingest Natural Earth admin-1 polygons and normalize to province data (one province per admin-1 region).
* Generate adjacency graph by shared borders and store in `adjacentProvinceIds`.
* Map provinces to countries and set capital province IDs from national capital data.
* Implement the core mathematical engines: the wheel slice weight calculators, the base -8 to +8 random number generators, and the nuclear fallout 1-10 rollers.
* Write isolated unit tests validating that zero asset leakages occur when countries exchange provinces.

### Milestone 2: Proximity Pathfinding & Core Mechanics

* Implement the Breadth-First Search (BFS) proximity algorithm to handle all province transitions.
* Validate that negative rolls transfer provinces back to the defender cleanly along contiguous border coordinates.
* Program the database state transitions for the Critical Zero parameters: build the permanent campaign-wide Army Camp inheritance mechanics and configure the `isIncinerated` status flag within the active war array.

### Milestone 3: HTML5 Canvas & SVG Integration

* Render the global map layout dynamically utilizing custom SVG path data representing individual country boundaries.
* Map the UI components directly to the data states, ensuring that changing the owner ID of a province instantly updates its fill color on the screen.
* Build the canvas-driven Initiative Spin Wheel component using native 2D rendering contexts (`requestAnimationFrame`), handling dynamic sector slice sizing dynamically based on state metrics.

### Milestone 4: Ticket Economy & Turn Flow Integration

* Construct the state wrappers managing player wallets, betting options, buy-in restrictions, and the automated 500-ticket safety net engine.
* Assemble the macro round structure components, allowing players to smoothly move between Phase 1 (Event checking), Phase 2 (Matchmaking calculation), Phase 3 (Betting placements), and Phase 4 (Combat animation).

### Milestone 5: Polishing, Refinement & Edge-Case Validation

* Optimize Zustand state dispatchers to prevent rendering stutters when processing high-frequency map color updates.
* Ensure that the initial world map setup enforces strategic-power tiers rather than raw province-count tiers, so small countries with highly detailed admin-1 data do not become fake Empires or Hegemons.
* Verify that multi-faction fractures correctly flag breakaway shards as universally targetable by surrounding neighbors.

---

## 6. Proposed Code Layout

```
documentation/
  implementation_plan.md

src/
  app/
    page.tsx
    layout.tsx
    game/
      page.tsx

  assets/
    map/
      provinces.json
      countries.json
      capitals.json
      map.svg

  engine/
    index.ts
    models/
      country.ts
      province.ts
      war.ts
      player.ts
      enums.ts
    rng/
      seededRng.ts
    rules/
      tiers.ts
      modifiers.ts
      ticketLedger.ts
      splintering.ts
    mechanics/
      initiativeWheel.ts
      bfsConquest.ts
      combatResolution.ts
      nuclearStrike.ts
    phases/
      eventHorizon.ts
      matchmaking.ts
      intermission.ts
      combat.ts
    multiplayer/
      eventLog.ts
      stateSnapshot.ts

  store/
    gameStore.ts

  ui/
    components/
      MapSvg.tsx
      WheelCanvas.tsx
      Sidebar.tsx
      PhaseStepper.tsx
      BettingPanel.tsx
      RollLog.tsx
    hooks/
      useGameLoop.ts
      useWheelAnimation.ts

  lib/
    adjacency/
      buildAdjacency.ts
      validateAdjacency.ts
    data/
      loadMapAssets.ts

tests/
  engine/
    bfsConquest.test.ts
    combatResolution.test.ts
    nuclearStrike.test.ts
    ticketLedger.test.ts
    splintering.test.ts
```
