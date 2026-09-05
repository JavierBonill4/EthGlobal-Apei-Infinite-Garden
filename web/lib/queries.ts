/**
 * Subgraph queries.
 *
 * Note what the ledger query orders by: `forborne`, descending. Water LEFT is
 * the headline number, not water taken. If restraint is invisible then holding
 * back just makes you a sucker, and the whole social layer stops working.
 */

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? "";

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!SUBGRAPH_URL) throw new Error("NEXT_PUBLIC_SUBGRAPH_URL is not set");
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

/** The demo screen. Who drew what this epoch, and who left the most behind. */
export const DRAW_LEDGER = /* GraphQL */ `
  query DrawLedger($epoch: Int!) {
    draws(where: { epoch: $epoch }, orderBy: forborne, orderDirection: desc, first: 200) {
      id
      amount
      forborne
      timestamp
      player {
        id
        ensName
      }
      plot {
        id
      }
    }
    epochRecord(id: $epoch) {
      epoch
      requirement
      wellLevel
      plotsMet
      plotsMissed
      totalDrawn
      totalForborne
      settledAt
    }
  }
`;

/**
 * Season history. This is the archaeological record -- every collapse the
 * world has survived, kept permanently.
 */
export const SEASON_HISTORY = /* GraphQL */ `
  query SeasonHistory {
    seasons(orderBy: level, orderDirection: desc) {
      id
      level
      outcome
      endedAtEpoch
      plotsAtStart
    }
  }
`;

export const PLAYER_STANDING = /* GraphQL */ `
  query PlayerStanding($id: ID!) {
    player(id: $id) {
      id
      ensName
      totalDrawn
      totalForborne
      seedsGiven
      epochsPresent
      collapsesPresentFor
      plot {
        id
        status
        lastTendedEpoch
      }
    }
  }
`;
