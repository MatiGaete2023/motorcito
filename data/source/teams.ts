// FORCH.i ORACLE — 48 Equipos del Mundial FIFA 2026 (OFICIALES)
// Sorteo oficial completado — 12 grupos A-L
// Fuente: FIFA.com

export interface Team {
  name: string;
  englishName: string;
  code: string;
  flag: string;
  confederation: string;
  group: string;
  starPlayers: string[]; // 2-3 key players
}

export const WORLD_CUP_TEAMS: Team[] = [
  // ═══════════════ GROUP A — México, Sudáfrica, Corea del Sur, Chequia ═══════════════
  { name: 'México', englishName: 'Mexico', code: 'MEX', flag: '🇲🇽', confederation: 'CONCACAF', group: 'A', starPlayers: ['Santiago Giménez', 'Edson Álvarez', 'Guillermo Ochoa'] },
  { name: 'Sudáfrica', englishName: 'South Africa', code: 'RSA', flag: '🇿🇦', confederation: 'CAF', group: 'A', starPlayers: ['Percy Tau', 'Themba Zwane', 'Lyle Foster'] },
  { name: 'Corea del Sur', englishName: 'South Korea', code: 'KOR', flag: '🇰🇷', confederation: 'AFC', group: 'A', starPlayers: ['Son Heung-min', 'Hwang Hee-chan', 'Kim Min-jae'] },
  { name: 'Chequia', englishName: 'Czech Republic', code: 'CZE', flag: '🇨🇿', confederation: 'UEFA', group: 'A', starPlayers: ['Patrik Schick', 'Tomáš Souček', 'Vladimír Coufal'] },

  // ═══════════════ GROUP B — Canadá, Bosnia, Qatar, Suiza ═══════════════
  { name: 'Canadá', englishName: 'Canada', code: 'CAN', flag: '🇨🇦', confederation: 'CONCACAF', group: 'B', starPlayers: ['Alphonso Davies', 'Jonathan David', 'Cyle Larin'] },
  { name: 'Bosnia y Herzegovina', englishName: 'Bosnia and Herzegovina', code: 'BIH', flag: '🇧🇦', confederation: 'UEFA', group: 'B', starPlayers: ['Edin Džeko', 'Miralem Pjanić', 'Rade Krunić'] },
  { name: 'Qatar', englishName: 'Qatar', code: 'QAT', flag: '🇶🇦', confederation: 'AFC', group: 'B', starPlayers: ['Akram Afif', 'Almoez Ali', 'Hassan Al-Haydos'] },
  { name: 'Suiza', englishName: 'Switzerland', code: 'SUI', flag: '🇨🇭', confederation: 'UEFA', group: 'B', starPlayers: ['Granit Xhaka', 'Manuel Akanji', 'Breel Embolo'] },

  // ═══════════════ GROUP C — Brasil, Marruecos, Haití, Escocia ═══════════════
  { name: 'Brasil', englishName: 'Brazil', code: 'BRA', flag: '🇧🇷', confederation: 'CONMEBOL', group: 'C', starPlayers: ['Vinícius Jr.', 'Rodrygo', 'Marquinhos'] },
  { name: 'Marruecos', englishName: 'Morocco', code: 'MAR', flag: '🇲🇦', confederation: 'CAF', group: 'C', starPlayers: ['Achraf Hakimi', 'Hakim Ziyech', 'Sofyan Amrabat'] },
  { name: 'Haití', englishName: 'Haiti', code: 'HTI', flag: '🇭🇹', confederation: 'CONCACAF', group: 'C', starPlayers: ['Duckens Nazon', 'Wilde-Donald Guerrier', 'Carlens Arcus'] },
  { name: 'Escocia', englishName: 'Scotland', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA', group: 'C', starPlayers: ['Andrew Robertson', 'John McGinn', 'Che Adams'] },

  // ═══════════════ GROUP D — Estados Unidos, Paraguay, Australia, Turquía ═══════════════
  { name: 'Estados Unidos', englishName: 'USA', code: 'USA', flag: '🇺🇸', confederation: 'CONCACAF', group: 'D', starPlayers: ['Christian Pulisic', 'Tyler Adams', 'Weston McKennie'] },
  { name: 'Paraguay', englishName: 'Paraguay', code: 'PAR', flag: '🇵🇾', confederation: 'CONMEBOL', group: 'D', starPlayers: ['Miguel Almirón', 'Gustavo Gómez', 'Julio Enciso'] },
  { name: 'Australia', englishName: 'Australia', code: 'AUS', flag: '🇦🇺', confederation: 'AFC', group: 'D', starPlayers: ['Mathew Leckie', 'Riley McGree', 'Ajdin Hrustic'] },
  { name: 'Turquía', englishName: 'Turkey', code: 'TUR', flag: '🇹🇷', confederation: 'UEFA', group: 'D', starPlayers: ['Arda Güler', 'Hakan Çalhanoğlu', 'Kenan Yıldız'] },

  // ═══════════════ GROUP E — Alemania, Curazao, Costa de Marfil, Ecuador ═══════════════
  { name: 'Alemania', englishName: 'Germany', code: 'GER', flag: '🇩🇪', confederation: 'UEFA', group: 'E', starPlayers: ['Jamal Musiala', 'Florian Wirtz', 'Antonio Rüdiger'] },
  { name: 'Curazao', englishName: 'Curacao', code: 'CUW', flag: '🇨🇼', confederation: 'CONCACAF', group: 'E', starPlayers: ['Juninho Bacuna', 'Brandley Kuwas', 'Jarchinio Antonia'] },
  { name: 'Costa de Marfil', englishName: 'Ivory Coast', code: 'CIV', flag: '🇨🇮', confederation: 'CAF', group: 'E', starPlayers: ['Sébastien Haller', 'Franck Kessié', 'Wilfried Zaha'] },
  { name: 'Ecuador', englishName: 'Ecuador', code: 'ECU', flag: '🇪🇨', confederation: 'CONMEBOL', group: 'E', starPlayers: ['Moisés Caicedo', 'Kendry Páez', 'Piero Hincapié'] },

  // ═══════════════ GROUP F — Países Bajos, Japón, Suecia, Túnez ═══════════════
  { name: 'Países Bajos', englishName: 'Netherlands', code: 'NED', flag: '🇳🇱', confederation: 'UEFA', group: 'F', starPlayers: ['Cody Gakpo', 'Virgil van Dijk', 'Xavi Simons'] },
  { name: 'Japón', englishName: 'Japan', code: 'JPN', flag: '🇯🇵', confederation: 'AFC', group: 'F', starPlayers: ['Kaoru Mitoma', 'Takefusa Kubo', 'Wataru Endo'] },
  { name: 'Suecia', englishName: 'Sweden', code: 'SWE', flag: '🇸🇪', confederation: 'UEFA', group: 'F', starPlayers: ['Viktor Gyökeres', 'Alexander Isak', 'Dejan Kulusevski'] },
  { name: 'Túnez', englishName: 'Tunisia', code: 'TUN', flag: '🇹🇳', confederation: 'CAF', group: 'F', starPlayers: ['Wahbi Khazri', 'Ellyes Skhiri', 'Hannibal Mejbri'] },

  // ═══════════════ GROUP G — Bélgica, Egipto, Irán, Nueva Zelanda ═══════════════
  { name: 'Bélgica', englishName: 'Belgium', code: 'BEL', flag: '🇧🇪', confederation: 'UEFA', group: 'G', starPlayers: ['Jérémy Doku', 'Romelu Lukaku', 'Youri Tielemans'] },
  { name: 'Egipto', englishName: 'Egypt', code: 'EGY', flag: '🇪🇬', confederation: 'CAF', group: 'G', starPlayers: ['Mohamed Salah', 'Mostafa Mohamed', 'Trezeguet'] },
  { name: 'Irán', englishName: 'Iran', code: 'IRN', flag: '🇮🇷', confederation: 'AFC', group: 'G', starPlayers: ['Mehdi Taremi', 'Sardar Azmoun', 'Alireza Jahanbakhsh'] },
  { name: 'Nueva Zelanda', englishName: 'New Zealand', code: 'NZL', flag: '🇳🇿', confederation: 'OFC', group: 'G', starPlayers: ['Chris Wood', 'Liberato Cacace', 'Joe Bell'] },

  // ═══════════════ GROUP H — España, Cabo Verde, Arabia Saudita, Uruguay ═══════════════
  { name: 'España', englishName: 'Spain', code: 'ESP', flag: '🇪🇸', confederation: 'UEFA', group: 'H', starPlayers: ['Lamine Yamal', 'Pedri', 'Rodri'] },
  { name: 'Cabo Verde', englishName: 'Cape Verde', code: 'CPV', flag: '🇨🇻', confederation: 'CAF', group: 'H', starPlayers: ['Bebé', 'Garry Rodrigues', 'Ryan Mendes'] },
  { name: 'Arabia Saudita', englishName: 'Saudi Arabia', code: 'KSA', flag: '🇸🇦', confederation: 'AFC', group: 'H', starPlayers: ['Salem Al-Dawsari', 'Saleh Al-Shehri', 'Mohammed Al-Owais'] },
  { name: 'Uruguay', englishName: 'Uruguay', code: 'URU', flag: '🇺🇾', confederation: 'CONMEBOL', group: 'H', starPlayers: ['Federico Valverde', 'Darwin Núñez', 'Ronald Araújo'] },

  // ═══════════════ GROUP I — Francia, Senegal, Irak, Noruega ═══════════════
  { name: 'Francia', englishName: 'France', code: 'FRA', flag: '🇫🇷', confederation: 'UEFA', group: 'I', starPlayers: ['Kylian Mbappé', 'Aurélien Tchouaméni', 'William Saliba'] },
  { name: 'Senegal', englishName: 'Senegal', code: 'SEN', flag: '🇸🇳', confederation: 'CAF', group: 'I', starPlayers: ['Sadio Mané', 'Nicolas Jackson', 'Pape Matar Sarr'] },
  { name: 'Irak', englishName: 'Iraq', code: 'IRQ', flag: '🇮🇶', confederation: 'AFC', group: 'I', starPlayers: ['Aymen Hussein', 'Mohammed Amin', 'Ali Adnan'] },
  { name: 'Noruega', englishName: 'Norway', code: 'NOR', flag: '🇳🇴', confederation: 'UEFA', group: 'I', starPlayers: ['Erling Haaland', 'Martin Ødegaard', 'Alexander Sørloth'] },

  // ═══════════════ GROUP J — Argentina, Argelia, Austria, Jordania ═══════════════
  { name: 'Argentina', englishName: 'Argentina', code: 'ARG', flag: '🇦🇷', confederation: 'CONMEBOL', group: 'J', starPlayers: ['Lionel Messi', 'Julián Álvarez', 'Enzo Fernández'] },
  { name: 'Argelia', englishName: 'Algeria', code: 'ALG', flag: '🇩🇿', confederation: 'CAF', group: 'J', starPlayers: ['Riyad Mahrez', 'Youcef Atal', 'Amine Gouiri'] },
  { name: 'Austria', englishName: 'Austria', code: 'AUT', flag: '🇦🇹', confederation: 'UEFA', group: 'J', starPlayers: ['David Alaba', 'Marcel Sabitzer', 'Christoph Baumgartner'] },
  { name: 'Jordania', englishName: 'Jordan', code: 'JOR', flag: '🇯🇴', confederation: 'AFC', group: 'J', starPlayers: ['Musa Al-Taamari', 'Yazan Al-Naimat', 'Ali Olwan'] },

  // ═══════════════ GROUP K — Portugal, RD Congo, Uzbekistán, Colombia ═══════════════
  { name: 'Portugal', englishName: 'Portugal', code: 'POR', flag: '🇵🇹', confederation: 'UEFA', group: 'K', starPlayers: ['Cristiano Ronaldo', 'Bruno Fernandes', 'Rúben Dias'] },
  { name: 'RD Congo', englishName: 'DR Congo', code: 'COD', flag: '🇨🇩', confederation: 'CAF', group: 'K', starPlayers: ['Cédric Bakambu', 'Yoane Wissa', 'Arthur Masuaku'] },
  { name: 'Uzbekistán', englishName: 'Uzbekistan', code: 'UZB', flag: '🇺🇿', confederation: 'AFC', group: 'K', starPlayers: ['Sardor Rashidov', 'Jaloliddin Masharipov', 'Odiljon Hamrobekov'] },
  { name: 'Colombia', englishName: 'Colombia', code: 'COL', flag: '🇨🇴', confederation: 'CONMEBOL', group: 'K', starPlayers: ['James Rodríguez', 'Luis Díaz', 'Jhon Arias'] },

  // ═══════════════ GROUP L — Inglaterra, Croacia, Ghana, Panamá ═══════════════
  { name: 'Inglaterra', englishName: 'England', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA', group: 'L', starPlayers: ['Jude Bellingham', 'Harry Kane', 'Bukayo Saka'] },
  { name: 'Croacia', englishName: 'Croatia', code: 'CRO', flag: '🇭🇷', confederation: 'UEFA', group: 'L', starPlayers: ['Luka Modrić', 'Joško Gvardiol', 'Marcelo Brozović'] },
  { name: 'Ghana', englishName: 'Ghana', code: 'GHA', flag: '🇬🇭', confederation: 'CAF', group: 'L', starPlayers: ['Mohammed Kudus', 'Thomas Partey', 'Inaki Williams'] },
  { name: 'Panamá', englishName: 'Panama', code: 'PAN', flag: '🇵🇦', confederation: 'CONCACAF', group: 'L', starPlayers: ['José Fajardo', 'César Blackman', 'Aníbal Godoy'] },
];

// ═══════════════════════════════════════════════════════════════
// ELO RATINGS — FUENTE ÚNICA DE VERDAD
// ═══════════════════════════════════════════════════════════════
// Todos los motores (predictor-engine, prediction-store) deben importar
// de aquí. NO duplicar estos datos en otros archivos.

export interface EloEntry {
  elo: number;
  attack: number;   // goles anotados promedio (últimos 12 meses)
  defense: number;  // goles concedidos promedio (últimos 12 meses)
}

export const ELO_RATINGS: Record<string, EloEntry> = {
  // Tier 1 — Élite (2100+)
  'Argentina':     { elo: 2127, attack: 2.1, defense: 0.6 },
  'Francia':       { elo: 2112, attack: 2.3, defense: 0.7 },
  'Brasil':        { elo: 2103, attack: 2.0, defense: 0.9 },
  'Inglaterra':    { elo: 2098, attack: 1.9, defense: 0.7 },
  'España':        { elo: 2087, attack: 2.4, defense: 0.8 },
  'Portugal':      { elo: 2069, attack: 2.0, defense: 0.8 },
  'Alemania':      { elo: 2061, attack: 2.1, defense: 0.9 },
  'Países Bajos':  { elo: 2058, attack: 1.8, defense: 0.8 },

  // Tier 2 — Top (2000-2050)
  'Bélgica':       { elo: 2044, attack: 1.6, defense: 1.0 },
  'Colombia':      { elo: 2032, attack: 1.7, defense: 0.8 },
  'Uruguay':       { elo: 2027, attack: 1.6, defense: 0.9 },
  'Italia':        { elo: 1992, attack: 1.5, defense: 0.8 },
  'Croacia':       { elo: 1998, attack: 1.4, defense: 0.9 },
  'Marruecos':     { elo: 1988, attack: 1.3, defense: 0.7 },
  'Japón':         { elo: 1978, attack: 1.5, defense: 0.9 },

  // Tier 3 — Competitivo (1900-1980)
  'México':        { elo: 1945, attack: 1.3, defense: 1.0 },
  'Estados Unidos':{ elo: 1935, attack: 1.4, defense: 1.1 },
  'Suiza':         { elo: 1932, attack: 1.4, defense: 1.0 },
  'Austria':       { elo: 1928, attack: 1.5, defense: 1.2 },
  'Noruega':       { elo: 1924, attack: 1.5, defense: 1.3 },
  'Corea del Sur': { elo: 1918, attack: 1.2, defense: 1.0 },
  'Ecuador':       { elo: 1912, attack: 1.3, defense: 1.0 },
  'Senegal':       { elo: 1908, attack: 1.4, defense: 0.9 },
  'Dinamarca':     { elo: 1905, attack: 1.5, defense: 1.1 },

  // Tier 4 — Medio (1850-1900)
  'Irán':          { elo: 1895, attack: 1.3, defense: 0.9 },
  'Australia':     { elo: 1889, attack: 1.1, defense: 1.0 },
  'Turquía':       { elo: 1885, attack: 1.4, defense: 1.3 },
  'Egipto':        { elo: 1878, attack: 1.2, defense: 1.1 },
  'Argelia':       { elo: 1872, attack: 1.1, defense: 1.0 },
  'Túnez':         { elo: 1865, attack: 1.0, defense: 1.0 },
  'Suecia':        { elo: 1862, attack: 1.3, defense: 1.2 },
  'Chequia':       { elo: 1855, attack: 1.1, defense: 1.1 },
  'Paraguay':      { elo: 1848, attack: 0.9, defense: 1.1 },
  'Arabia Saudita':{ elo: 1842, attack: 1.0, defense: 1.1 },
  'Bosnia y Herzegovina': { elo: 1835, attack: 1.0, defense: 1.3 },
  'Canadá':        { elo: 1832, attack: 1.2, defense: 1.2 },
  'Escocia':       { elo: 1825, attack: 1.2, defense: 1.1 },

  // Tier 5 — Emergente (1750-1820)
  'Sudáfrica':     { elo: 1818, attack: 0.9, defense: 1.1 },
  'Nigeria':       { elo: 1812, attack: 1.2, defense: 1.1 },
  'Costa de Marfil': { elo: 1808, attack: 1.2, defense: 1.2 },
  'Cabo Verde':    { elo: 1802, attack: 0.8, defense: 1.0 },
  'Qatar':         { elo: 1795, attack: 0.9, defense: 1.3 },
  'Ghana':         { elo: 1792, attack: 1.1, defense: 1.2 },
  'Jordania':      { elo: 1785, attack: 0.9, defense: 1.1 },
  'Irak':          { elo: 1778, attack: 0.9, defense: 1.2 },
  'Nueva Zelanda': { elo: 1772, attack: 0.8, defense: 1.2 },
  'Uzbekistán':    { elo: 1768, attack: 1.0, defense: 1.2 },
  'Haití':         { elo: 1762, attack: 0.7, defense: 1.4 },
  'RD Congo':      { elo: 1758, attack: 0.9, defense: 1.3 },
  'Curazao':       { elo: 1745, attack: 0.8, defense: 1.4 },
  'Panamá':        { elo: 1738, attack: 0.8, defense: 1.2 },
};

// ═══════════════════════════════════════════════════════════════
// POWER RATINGS — Attack / Defense / Midfield (0-100)
// ═══════════════════════════════════════════════════════════════
export const POWER_RATINGS: Record<string, { attack: number; defense: number; midfield: number }> = {
  // Tier 1 — Élite
  'Argentina': { attack: 95, defense: 88, midfield: 94 },
  'Francia': { attack: 96, defense: 90, midfield: 92 },
  'Brasil': { attack: 94, defense: 85, midfield: 90 },
  'Inglaterra': { attack: 90, defense: 87, midfield: 91 },
  'España': { attack: 92, defense: 88, midfield: 95 },
  'Portugal': { attack: 93, defense: 86, midfield: 89 },
  'Alemania': { attack: 91, defense: 87, midfield: 90 },
  'Países Bajos': { attack: 89, defense: 88, midfield: 90 },

  // Tier 2 — Top
  'Bélgica': { attack: 88, defense: 82, midfield: 86 },
  'Colombia': { attack: 85, defense: 82, midfield: 84 },
  'Uruguay': { attack: 83, defense: 85, midfield: 82 },
  'Italia': { attack: 82, defense: 85, midfield: 84 },
  'Croacia': { attack: 78, defense: 82, midfield: 88 },
  'Marruecos': { attack: 80, defense: 86, midfield: 78 },
  'Japón': { attack: 79, defense: 78, midfield: 80 },

  // Tier 3 — Competitivo
  'México': { attack: 74, defense: 72, midfield: 73 },
  'Estados Unidos': { attack: 73, defense: 71, midfield: 72 },
  'Suiza': { attack: 72, defense: 76, midfield: 74 },
  'Austria': { attack: 75, defense: 73, midfield: 74 },
  'Noruega': { attack: 80, defense: 70, midfield: 72 },
  'Corea del Sur': { attack: 76, defense: 72, midfield: 73 },
  'Ecuador': { attack: 72, defense: 74, midfield: 70 },
  'Senegal': { attack: 75, defense: 76, midfield: 72 },
  'Dinamarca': { attack: 73, defense: 75, midfield: 76 },

  // Tier 4 — Medio
  'Irán': { attack: 68, defense: 72, midfield: 67 },
  'Australia': { attack: 67, defense: 70, midfield: 66 },
  'Turquía': { attack: 72, defense: 68, midfield: 70 },
  'Egipto': { attack: 72, defense: 68, midfield: 67 },
  'Argelia': { attack: 70, defense: 69, midfield: 68 },
  'Túnez': { attack: 66, defense: 70, midfield: 67 },
  'Suecia': { attack: 68, defense: 70, midfield: 69 },
  'Chequia': { attack: 66, defense: 68, midfield: 67 },
  'Paraguay': { attack: 64, defense: 68, midfield: 63 },
  'Arabia Saudita': { attack: 63, defense: 65, midfield: 64 },
  'Bosnia y Herzegovina': { attack: 65, defense: 64, midfield: 63 },
  'Canadá': { attack: 68, defense: 62, midfield: 64 },
  'Escocia': { attack: 62, defense: 66, midfield: 63 },

  // Tier 5 — Emergente
  'Sudáfrica': { attack: 60, defense: 62, midfield: 58 },
  'Nigeria': { attack: 66, defense: 62, midfield: 60 },
  'Costa de Marfil': { attack: 65, defense: 60, midfield: 58 },
  'Cabo Verde': { attack: 58, defense: 60, midfield: 57 },
  'Qatar': { attack: 55, defense: 56, midfield: 54 },
  'Ghana': { attack: 62, defense: 60, midfield: 59 },
  'Jordania': { attack: 58, defense: 56, midfield: 55 },
  'Irak': { attack: 57, defense: 56, midfield: 54 },
  'Nueva Zelanda': { attack: 54, defense: 56, midfield: 52 },
  'Uzbekistán': { attack: 55, defense: 54, midfield: 53 },
  'Haití': { attack: 52, defense: 52, midfield: 50 },
  'RD Congo': { attack: 56, defense: 55, midfield: 52 },
  'Curazao': { attack: 50, defense: 48, midfield: 48 },
  'Panamá': { attack: 52, defense: 54, midfield: 50 },
};

// Lookup: Spanish name → English API name (derived from team data, not hardcoded)
const englishNameMap = new Map<string, string>(
  WORLD_CUP_TEAMS.map((t) => [t.name.toLowerCase(), t.englishName])
);

const starPlayerMap = new Map<string, string[]>(
  WORLD_CUP_TEAMS.map((t) => [t.name.toLowerCase(), t.starPlayers])
);

/**
 * Convert a Spanish team name to the English name used by API-Football.
 * Falls back to the original name if not found.
 */
export function getTeamEnglishName(spanishName: string): string {
  return englishNameMap.get(spanishName.toLowerCase()) || spanishName;
}

/** Get star players for a team */
export function getTeamStarPlayers(teamName: string): string[] {
  return starPlayerMap.get(teamName.toLowerCase()) || [];
}

/** Get all team names in Spanish (for dropdowns) */
export const TEAM_NAMES = WORLD_CUP_TEAMS.map((t) => `${t.flag} ${t.name}`).sort();

/** Función para obtener equipo por nombre */
// Constante compartida para forma por defecto (evita hardcodear en múltiples archivos)
export const DEFAULT_FORM: ('W' | 'D' | 'L')[] = ['D', 'D', 'D', 'D', 'D'];

export function getTeamByName(name: string): Team | undefined {
  return WORLD_CUP_TEAMS.find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  );
}

/** Función para obtener equipos por grupo */
export function getTeamsByGroup(group: string): Team[] {
  return WORLD_CUP_TEAMS.filter((t) => t.group === group);
}
