const scenarios = [1_000, 10_000, 100_000];

const assumptions = {
  gamesPerActiveUserMonth: 4,
  roundsPerGame: 5,
  firestoreWritesPerGame: 11,
  firestoreTransactionReadsPerGame: 10,
  firestorePublicReadsPerActiveUserMonth: 12,
  postgresRowsPerGame: 11,
  estimatedPostgresBytesPerGameIncludingIndexes: 3_500
};

function compact(value) {
  return new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const rows = scenarios.map((monthlyActiveUsers) => {
  const games = monthlyActiveUsers * assumptions.gamesPerActiveUserMonth;
  const firestoreReads = games * assumptions.firestoreTransactionReadsPerGame +
    monthlyActiveUsers * assumptions.firestorePublicReadsPerActiveUserMonth;
  const firestoreWrites = games * assumptions.firestoreWritesPerGame;
  const postgresRows = games * assumptions.postgresRowsPerGame;
  const postgresMegabytes = games * assumptions.estimatedPostgresBytesPerGameIncludingIndexes / 1_000_000;
  return {
    MAU: compact(monthlyActiveUsers),
    Spiele: compact(games),
    "Firestore Reads/Monat": compact(firestoreReads),
    "Firestore Writes/Monat": compact(firestoreWrites),
    "Postgres-Zeilen": compact(postgresRows),
    "Postgres grob MB": Math.round(postgresMegabytes)
  };
});

console.log("Punktlandung Backend-Lastmodell (keine Preisgarantie)");
console.table(rows);
console.log("Annahmen:", assumptions);
