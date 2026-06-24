import type { CommunityMapPack, GeoLocation } from "../types/game";
import generatedLocations from "./generated/locations.generated.json";

const wikimediaFile = (fileName: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;

const rawBuiltInLocations: GeoLocation[] = [
  {
    id: "rome-colosseum",
    title: "Kolosseum, Rom",
    countryCode: "IT",
    countryName: "Italien",
    continent: "Europe",
    lat: 41.8902,
    lng: 12.4922,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/5/53/Colosseum_in_Rome%2C_Italy_-_April_2007.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Colosseum_in_Rome,_Italy_-_April_2007.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/5/53/Colosseum_in_Rome%2C_Italy_-_April_2007.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "nyc-times-square",
    title: "Times Square, New York",
    countryCode: "US",
    countryName: "USA",
    continent: "North America",
    lat: 40.758,
    lng: -73.9855,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/4/47/New_york_times_square-terabass.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/New_york_times_square-terabass.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/4/47/New_york_times_square-terabass.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "cities"
  },
  {
    id: "tokyo-shibuya",
    title: "Shibuya Crossing, Tokio",
    countryCode: "JP",
    countryName: "Japan",
    continent: "Asia",
    lat: 35.6595,
    lng: 139.7005,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6c/Shibuya_Crossing%2C_Tokyo%2C_Japan.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Shibuya_Crossing,_Tokyo,_Japan.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/6/6c/Shibuya_Crossing%2C_Tokyo%2C_Japan.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "cities"
  },
  {
    id: "rio-christ",
    title: "Cristo Redentor, Rio",
    countryCode: "BR",
    countryName: "Brasilien",
    continent: "South America",
    lat: -22.9519,
    lng: -43.2105,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Aerial_view_of_the_Statue_of_Christ_the_Redeemer.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Aerial_view_of_the_Statue_of_Christ_the_Redeemer.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/e/e7/Aerial_view_of_the_Statue_of_Christ_the_Redeemer.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "cape-town",
    title: "Tafelberg, Kapstadt",
    countryCode: "ZA",
    countryName: "Südafrika",
    continent: "Africa",
    lat: -33.9628,
    lng: 18.4098,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Cape_Town_and_Table_Mountain_from_Bloubergstrand.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Cape_Town_and_Table_Mountain_from_Bloubergstrand.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/2/2c/Cape_Town_and_Table_Mountain_from_Bloubergstrand.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landscapes"
  },
  {
    id: "sydney-opera",
    title: "Sydney Opera House",
    countryCode: "AU",
    countryName: "Australien",
    continent: "Oceania",
    lat: -33.8568,
    lng: 151.2153,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Sydney_Opera_House_Sails.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Sydney_Opera_House_Sails.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/4/40/Sydney_Opera_House_Sails.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "reykjavik-hallgrimskirkja",
    title: "Hallgrimskirkja, Reykjavik",
    countryCode: "IS",
    countryName: "Island",
    continent: "Europe",
    lat: 64.1417,
    lng: -21.9266,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Hallgrimskirkja_Reykjavik_Iceland.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hallgrimskirkja_Reykjavik_Iceland.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/8/8d/Hallgrimskirkja_Reykjavik_Iceland.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "capitals"
  },
  {
    id: "marrakesh",
    title: "Djemaa el Fna, Marrakesch",
    countryCode: "MA",
    countryName: "Marokko",
    continent: "Africa",
    lat: 31.6258,
    lng: -7.9891,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Djemaa_el_Fna_square%2C_Marrakesh.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Djemaa_el_Fna_square,_Marrakesh.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/e/e4/Djemaa_el_Fna_square%2C_Marrakesh.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "cities"
  },
  {
    id: "paris-eiffel",
    title: "Eiffelturm, Paris",
    countryCode: "FR",
    countryName: "Frankreich",
    continent: "Europe",
    lat: 48.8584,
    lng: 2.2945,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:FilePath/Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/e/e6/Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "agra-taj-mahal",
    title: "Taj Mahal, Agra",
    countryCode: "IN",
    countryName: "Indien",
    continent: "Asia",
    lat: 27.1751,
    lng: 78.0421,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Taj_Mahal_%28Edited%29.jpeg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:FilePath/Taj_Mahal_%28Edited%29.jpeg",
      "https://upload.wikimedia.org/wikipedia/commons/1/1d/Taj_Mahal_%28Edited%29.jpeg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "peru-machu-picchu",
    title: "Machu Picchu",
    countryCode: "PE",
    countryName: "Peru",
    continent: "South America",
    lat: -13.1631,
    lng: -72.545,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Machu_Picchu%2C_Peru.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:FilePath/Machu_Picchu%2C_Peru.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/e/eb/Machu_Picchu%2C_Peru.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landscapes"
  },
  {
    id: "china-great-wall",
    title: "Chinesische Mauer",
    countryCode: "CN",
    countryName: "China",
    continent: "Asia",
    lat: 40.4319,
    lng: 116.5704,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Great_Wall_of_China_July_2006.JPG",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:FilePath/Great_Wall_of_China_July_2006.JPG",
      "https://upload.wikimedia.org/wikipedia/commons/f/fa/Great_Wall_of_China_July_2006.JPG"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "berlin-brandenburg-gate",
    title: "Brandenburger Tor, Berlin",
    countryCode: "DE",
    countryName: "Deutschland",
    continent: "Europe",
    lat: 52.5163,
    lng: 13.3777,
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Brandenburger_Tor_abends.jpg",
    panoramaUrls: [
      "https://commons.wikimedia.org/wiki/Special:FilePath/Brandenburger_Tor_abends.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/a/a6/Brandenburger_Tor_abends.jpg"
    ],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "capitals"
  },
  {
    id: "flag-japan",
    title: "Flagge von Japan",
    countryCode: "JP",
    countryName: "Japan",
    continent: "Asia",
    lat: 35.6762,
    lng: 139.6503,
    panoramaUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Japan.svg",
    panoramaUrls: ["https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Japan.svg"],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "flag-brazil",
    title: "Flagge von Brasilien",
    countryCode: "BR",
    countryName: "Brasilien",
    continent: "South America",
    lat: -15.7939,
    lng: -47.8828,
    panoramaUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Brazil.svg",
    panoramaUrls: ["https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Brazil.svg"],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "flag-south-africa",
    title: "Flagge von Südafrika",
    countryCode: "ZA",
    countryName: "Südafrika",
    continent: "Africa",
    lat: -25.7479,
    lng: 28.2293,
    panoramaUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_South_Africa.svg",
    panoramaUrls: ["https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_South_Africa.svg"],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "flag-france",
    title: "Flagge von Frankreich",
    countryCode: "FR",
    countryName: "Frankreich",
    continent: "Europe",
    lat: 48.8566,
    lng: 2.3522,
    panoramaUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_France.svg",
    panoramaUrls: ["https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_France.svg"],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "capital-london",
    title: "London",
    countryCode: "GB",
    countryName: "Vereinigtes Königreich",
    continent: "Europe",
    lat: 51.5072,
    lng: -0.1276,
    panoramaUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/London_Eye_Twilight_April_2006.jpg",
    panoramaUrls: ["https://commons.wikimedia.org/wiki/Special:FilePath/London_Eye_Twilight_April_2006.jpg"],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "capitals"
  },
  {
    id: "san-francisco-golden-gate",
    title: "Golden Gate Bridge, San Francisco",
    countryCode: "US",
    countryName: "USA",
    continent: "North America",
    lat: 37.8199,
    lng: -122.4783,
    panoramaUrl: wikimediaFile("Golden Gate Bridge as seen from Battery East.jpg"),
    panoramaUrls: [wikimediaFile("Golden Gate Bridge as seen from Battery East.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "cities"
  },
  {
    id: "singapore-marina-bay",
    title: "Marina Bay, Singapur",
    countryCode: "SG",
    countryName: "Singapur",
    continent: "Asia",
    lat: 1.2834,
    lng: 103.8607,
    panoramaUrl: wikimediaFile("Marina Bay Sands in the evening - 20101120.jpg"),
    panoramaUrls: [wikimediaFile("Marina Bay Sands in the evening - 20101120.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "cities"
  },
  {
    id: "istanbul-galata",
    title: "Istanbul",
    countryCode: "TR",
    countryName: "Türkei",
    continent: "Europe",
    lat: 41.0082,
    lng: 28.9784,
    panoramaUrl: wikimediaFile("Istanbul as seen from Galata Tower.jpg"),
    panoramaUrls: [wikimediaFile("Istanbul as seen from Galata Tower.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "cities"
  },
  {
    id: "hong-kong-skyline",
    title: "Hongkong Skyline",
    countryCode: "HK",
    countryName: "Hongkong",
    continent: "Asia",
    lat: 22.3193,
    lng: 114.1694,
    panoramaUrl: wikimediaFile("Hong Kong Skyline Restitch - Dec 2007.jpg"),
    panoramaUrls: [wikimediaFile("Hong Kong Skyline Restitch - Dec 2007.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "cities"
  },
  {
    id: "cairo-pyramids-giza",
    title: "Pyramiden von Gizeh",
    countryCode: "EG",
    countryName: "Ägypten",
    continent: "Africa",
    lat: 29.9792,
    lng: 31.1342,
    panoramaUrl: wikimediaFile("All Gizah Pyramids.jpg"),
    panoramaUrls: [wikimediaFile("All Gizah Pyramids.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "moscow-saint-basils",
    title: "Basilius-Kathedrale, Moskau",
    countryCode: "RU",
    countryName: "Russland",
    continent: "Europe",
    lat: 55.7525,
    lng: 37.6231,
    panoramaUrl: wikimediaFile("Saint Basil's Cathedral in Moscow.jpg"),
    panoramaUrls: [wikimediaFile("Saint Basil's Cathedral in Moscow.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "barcelona-sagrada-familia",
    title: "Sagrada Familia, Barcelona",
    countryCode: "ES",
    countryName: "Spanien",
    continent: "Europe",
    lat: 41.4036,
    lng: 2.1744,
    panoramaUrl: wikimediaFile("Sagrada Familia 01.jpg"),
    panoramaUrls: [wikimediaFile("Sagrada Familia 01.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landmarks"
  },
  {
    id: "grand-canyon",
    title: "Grand Canyon",
    countryCode: "US",
    countryName: "USA",
    continent: "North America",
    lat: 36.1069,
    lng: -112.1129,
    panoramaUrl: wikimediaFile("Grand Canyon view from Pima Point 2010.jpg"),
    panoramaUrls: [wikimediaFile("Grand Canyon view from Pima Point 2010.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landscapes"
  },
  {
    id: "niagara-falls",
    title: "Niagarafälle",
    countryCode: "CA",
    countryName: "Kanada",
    continent: "North America",
    lat: 43.0962,
    lng: -79.0377,
    panoramaUrl: wikimediaFile("Niagara Falls from Canada.jpg"),
    panoramaUrls: [wikimediaFile("Niagara Falls from Canada.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landscapes"
  },
  {
    id: "mount-fuji",
    title: "Fuji",
    countryCode: "JP",
    countryName: "Japan",
    continent: "Asia",
    lat: 35.3606,
    lng: 138.7274,
    panoramaUrl: wikimediaFile("Mount Fuji from Hotel Mt Fuji 1999-8-7.jpg"),
    panoramaUrls: [wikimediaFile("Mount Fuji from Hotel Mt Fuji 1999-8-7.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landscapes"
  },
  {
    id: "victoria-falls",
    title: "Victoriafälle",
    countryCode: "ZW",
    countryName: "Simbabwe",
    continent: "Africa",
    lat: -17.9243,
    lng: 25.8572,
    panoramaUrl: wikimediaFile("Victoria Falls from the air.jpg"),
    panoramaUrls: [wikimediaFile("Victoria Falls from the air.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "landscapes"
  },
  {
    id: "flag-germany",
    title: "Flagge von Deutschland",
    countryCode: "DE",
    countryName: "Deutschland",
    continent: "Europe",
    lat: 52.52,
    lng: 13.405,
    panoramaUrl: wikimediaFile("Flag of Germany.svg"),
    panoramaUrls: [wikimediaFile("Flag of Germany.svg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "flag-canada",
    title: "Flagge von Kanada",
    countryCode: "CA",
    countryName: "Kanada",
    continent: "North America",
    lat: 45.4215,
    lng: -75.6972,
    panoramaUrl: wikimediaFile("Flag of Canada.svg"),
    panoramaUrls: [wikimediaFile("Flag of Canada.svg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "flag-india",
    title: "Flagge von Indien",
    countryCode: "IN",
    countryName: "Indien",
    continent: "Asia",
    lat: 28.6139,
    lng: 77.209,
    panoramaUrl: wikimediaFile("Flag of India.svg"),
    panoramaUrls: [wikimediaFile("Flag of India.svg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "flag-united-states",
    title: "Flagge der USA",
    countryCode: "US",
    countryName: "USA",
    continent: "North America",
    lat: 38.9072,
    lng: -77.0369,
    panoramaUrl: wikimediaFile("Flag of the United States.svg"),
    panoramaUrls: [wikimediaFile("Flag of the United States.svg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "flag-australia",
    title: "Flagge von Australien",
    countryCode: "AU",
    countryName: "Australien",
    continent: "Oceania",
    lat: -35.2809,
    lng: 149.13,
    panoramaUrl: wikimediaFile("Flag of Australia.svg"),
    panoramaUrls: [wikimediaFile("Flag of Australia.svg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "flags"
  },
  {
    id: "capital-washington-dc",
    title: "Washington, D.C.",
    countryCode: "US",
    countryName: "USA",
    continent: "North America",
    lat: 38.9072,
    lng: -77.0369,
    panoramaUrl: wikimediaFile("Washington, D.C. - The United States Capitol.jpg"),
    panoramaUrls: [wikimediaFile("Washington, D.C. - The United States Capitol.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "capitals"
  },
  {
    id: "capital-ottawa",
    title: "Ottawa",
    countryCode: "CA",
    countryName: "Kanada",
    continent: "North America",
    lat: 45.4215,
    lng: -75.6972,
    panoramaUrl: wikimediaFile("Parliament Hill, Ottawa, Canada.jpg"),
    panoramaUrls: [wikimediaFile("Parliament Hill, Ottawa, Canada.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "capitals"
  },
  {
    id: "capital-buenos-aires",
    title: "Buenos Aires",
    countryCode: "AR",
    countryName: "Argentinien",
    continent: "South America",
    lat: -34.6037,
    lng: -58.3816,
    panoramaUrl: wikimediaFile("Buenos Aires - Avenida 9 de Julio.jpg"),
    panoramaUrls: [wikimediaFile("Buenos Aires - Avenida 9 de Julio.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "capitals"
  },
  {
    id: "capital-seoul",
    title: "Seoul",
    countryCode: "KR",
    countryName: "Südkorea",
    continent: "Asia",
    lat: 37.5665,
    lng: 126.978,
    panoramaUrl: wikimediaFile("Seoul cityscape.jpg"),
    panoramaUrls: [wikimediaFile("Seoul cityscape.jpg")],
    attribution: "Wikimedia Commons",
    source: "wikimedia",
    category: "capitals"
  }
];

const generatedBuiltInLocations = generatedLocations as GeoLocation[];

const dedupeLocations = (locations: GeoLocation[]): GeoLocation[] => {
  const seen = new Set<string>();
  return locations.filter((location) => {
    const key = `${location.category}:${location.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const excludedImagePatterns = [
  /\baerial map\b/i,
  /\bcia map\b/i,
  /\bcollage\b/i,
  /\bcloudless\b/i,
  /\bdiagram\b/i,
  /\bkarte\b/i,
  /\blandsat\b/i,
  /\blocator\b/i,
  /\bmap\b/i,
  /\bmodel\b/i,
  /\bmontage\b/i,
  /\bnasa\b/i,
  /\bphoto[\s-]?montage\b/i,
  /\brelief map\b/i,
  /\bsatellite\b/i,
  /\bsentinel\b/i,
  /\btopo\b/i
];

function isDefaultPlayableLocation(location: GeoLocation) {
  if (location.difficulty === "hard") return false;
  if (location.category === "flags") return true;

  const imageFile = (location.imageFile ?? location.panoramaUrl).toLowerCase();
  return !excludedImagePatterns.some((pattern) => pattern.test(imageFile));
}

export const builtInLocations: GeoLocation[] = dedupeLocations([...rawBuiltInLocations, ...generatedBuiltInLocations])
  .filter(isDefaultPlayableLocation)
  .map((location) => ({
  ...location,
  panoramaUrls: location.panoramaUrls?.length ? location.panoramaUrls : [location.panoramaUrl]
}));

export const defaultMapPacks: CommunityMapPack[] = [
  {
    id: "world-party",
    name: "Weltparty Starter",
    author: "Punktlandung",
    description: "Kostenlose Seed-Karte mit globalen Wikimedia-Orten.",
    rating: 4.8,
    locations: builtInLocations
  }
];
