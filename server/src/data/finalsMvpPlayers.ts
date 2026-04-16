/**
 * Canonical Finals MVP pick list (exact spelling). Picks and admin results must match
 * one of these names so scoring stays consistent.
 */
export const FINALS_MVP_PLAYER_NAMES: string[] = [
  'Aaron Gordon',
  'Alperen Sengun',
  'Anthony Davis',
  'Anthony Edwards',
  'Austin Reaves',
  'Bam Adebayo',
  'Brandon Ingram',
  'Chet Holmgren',
  'Chris Paul',
  'Damian Lillard',
  'De\'Aaron Fox',
  'DeMar DeRozan',
  'Derrick White',
  'Desmond Bane',
  'Devin Booker',
  'Domantas Sabonis',
  'Donovan Mitchell',
  'Draymond Green',
  'Giannis Antetokounmpo',
  'James Harden',
  'Jalen Brunson',
  'Jalen Williams',
  'Jamal Murray',
  'Jayson Tatum',
  'Jaylen Brown',
  'Jimmy Butler',
  'Joel Embiid',
  'Julius Randle',
  'Kawhi Leonard',
  'Kevin Durant',
  'Khris Middleton',
  'Kyrie Irving',
  'LeBron James',
  'Lu Dort',
  'Luka Dončić',
  'Michael Porter Jr.',
  'Mike Conley',
  'Nikola Jokić',
  'Norman Powell',
  'Paolo Banchero',
  'Paul George',
  'Russell Westbrook',
  'Rudy Gobert',
  'Shai Gilgeous-Alexander',
  'Stephen Curry',
  'Tyrese Haliburton',
  'Tyrese Maxey',
  'Victor Wembanyama',
  'Zion Williamson',
].sort((a, b) => a.localeCompare(b));

const LOWER_TO_CANONICAL = new Map(
  FINALS_MVP_PLAYER_NAMES.map((name) => [name.toLowerCase(), name]),
);

/** Returns canonical list name, or null if not on the list (case-insensitive). */
export function canonicalMvpPlayerName(input: string): string | null {
  const key = input.trim().toLowerCase();
  return LOWER_TO_CANONICAL.get(key) ?? null;
}
