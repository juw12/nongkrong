// Countries, regions and the kinds of places people actually hang out in each one.
// layout: which floor plan the venue uses (see LAYOUTS). tz: IANA time zone of the region.

export const LAYOUTS = {
  bench:   { label: "Long benches", tables: [6, 6, 4, 4, 6, 2] },
  cafe:    { label: "Small tables", tables: [2, 4, 2, 4, 4, 2] },
  mat:     { label: "Floor mats", tables: [4, 4, 6, 4, 4] },
  counter: { label: "Counter and tables", tables: [8, 4, 4, 2, 2] },
  street:  { label: "Stools on the street", tables: [4, 4, 4, 4, 4, 4] },
  garden:  { label: "Garden tables", tables: [8, 6, 8, 6] },
};

const r = (name, tz) => ({ name, tz });

export const COUNTRIES = [
  { code: "ID", name: "Indonesia", table: "Meja", regions: [
      r("Jakarta", "Asia/Jakarta"), r("Batam", "Asia/Jakarta"), r("Bandung", "Asia/Jakarta"),
      r("Surabaya", "Asia/Jakarta"), r("Yogyakarta", "Asia/Jakarta"), r("Semarang", "Asia/Jakarta"),
      r("Medan", "Asia/Jakarta"), r("Pontianak", "Asia/Pontianak"), r("Bali", "Asia/Makassar"),
      r("Makassar", "Asia/Makassar"), r("Jayapura", "Asia/Jayapura")],
    venues: [
      { id: "warkop", name: "Warung kopi", note: "Kopi tubruk, gorengan and long benches.", layout: "bench" },
      { id: "angkringan", name: "Angkringan", note: "Night cart, wedang jahe, sitting on mats.", layout: "mat" },
      { id: "kafe", name: "Kafe", note: "Small tables, iced kopi susu, laptops welcome.", layout: "cafe" }] },
  { code: "MY", name: "Malaysia", table: "Meja", regions: [
      r("Kuala Lumpur", "Asia/Kuala_Lumpur"), r("Penang", "Asia/Kuala_Lumpur"), r("Johor Bahru", "Asia/Kuala_Lumpur"),
      r("Ipoh", "Asia/Kuala_Lumpur"), r("Kota Kinabalu", "Asia/Kuching"), r("Kuching", "Asia/Kuching")],
    venues: [
      { id: "mamak", name: "Mamak", note: "Teh tarik and roti canai until late.", layout: "street" },
      { id: "kopitiam", name: "Kopitiam", note: "Marble tables, kaya toast, kopi O.", layout: "cafe" },
      { id: "kafe", name: "Cafe", note: "Quiet corner tables.", layout: "cafe" }] },
  { code: "SG", name: "Singapore", table: "Table", regions: [
      r("Central", "Asia/Singapore"), r("East", "Asia/Singapore"), r("West", "Asia/Singapore"),
      r("North", "Asia/Singapore"), r("North-East", "Asia/Singapore")],
    venues: [
      { id: "kopitiam", name: "Kopitiam", note: "Kopi, kaya toast, round marble tables.", layout: "cafe" },
      { id: "hawker", name: "Hawker centre", note: "Shared tables between the stalls.", layout: "bench" },
      { id: "cafe", name: "Cafe", note: "Small tables and a long window bar.", layout: "counter" }] },
  { code: "TH", name: "Thailand", table: "Table", regions: [
      r("Bangkok", "Asia/Bangkok"), r("Chiang Mai", "Asia/Bangkok"), r("Phuket", "Asia/Bangkok"), r("Khon Kaen", "Asia/Bangkok")],
    venues: [
      { id: "streetfood", name: "Street food stall", note: "Plastic stools on the pavement.", layout: "street" },
      { id: "nightmarket", name: "Night market", note: "Shared tables in the middle of the stalls.", layout: "bench" },
      { id: "cafe", name: "Cafe", note: "Thai iced tea and small tables.", layout: "cafe" }] },
  { code: "VN", name: "Vietnam", table: "Ban", regions: [
      r("Hanoi", "Asia/Ho_Chi_Minh"), r("Ho Chi Minh City", "Asia/Ho_Chi_Minh"), r("Da Nang", "Asia/Ho_Chi_Minh"), r("Hue", "Asia/Ho_Chi_Minh")],
    venues: [
      { id: "caphe", name: "Ca phe via he", note: "Sidewalk coffee on low stools.", layout: "street" },
      { id: "biahoi", name: "Bia hoi corner", note: "Fresh beer, peanuts, small tables.", layout: "street" },
      { id: "cafe", name: "Cafe", note: "Egg coffee and quiet tables.", layout: "cafe" }] },
  { code: "PH", name: "Philippines", table: "Table", regions: [
      r("Metro Manila", "Asia/Manila"), r("Cebu", "Asia/Manila"), r("Davao", "Asia/Manila"), r("Baguio", "Asia/Manila")],
    venues: [
      { id: "carinderia", name: "Carinderia", note: "Home cooking and shared benches.", layout: "bench" },
      { id: "kapihan", name: "Kapihan", note: "Barako coffee and small tables.", layout: "cafe" },
      { id: "sarisari", name: "Sari-sari bench", note: "The bench outside the corner store.", layout: "street" }] },
  { code: "JP", name: "Japan", table: "Table", regions: [
      r("Tokyo", "Asia/Tokyo"), r("Osaka", "Asia/Tokyo"), r("Kyoto", "Asia/Tokyo"), r("Fukuoka", "Asia/Tokyo"), r("Sapporo", "Asia/Tokyo")],
    venues: [
      { id: "kissaten", name: "Kissaten", note: "Old coffee house, hand drip, low voices.", layout: "cafe" },
      { id: "izakaya", name: "Izakaya", note: "Counter seats and small tables after work.", layout: "counter" },
      { id: "yatai", name: "Yatai", note: "Food stall with a short counter.", layout: "counter" }] },
  { code: "KR", name: "South Korea", table: "Table", regions: [
      r("Seoul", "Asia/Seoul"), r("Busan", "Asia/Seoul"), r("Daegu", "Asia/Seoul"), r("Incheon", "Asia/Seoul")],
    venues: [
      { id: "pocha", name: "Pojangmacha", note: "Tent bar, soju and small tables.", layout: "street" },
      { id: "cafe", name: "Cafe", note: "Study tables and long hours.", layout: "cafe" },
      { id: "hof", name: "Hof", note: "Chicken, beer, long tables.", layout: "bench" }] },
  { code: "TW", name: "Taiwan", table: "Table", regions: [
      r("Taipei", "Asia/Taipei"), r("Taichung", "Asia/Taipei"), r("Tainan", "Asia/Taipei"), r("Kaohsiung", "Asia/Taipei")],
    venues: [
      { id: "teahouse", name: "Tea house", note: "Oolong and low tables.", layout: "mat" },
      { id: "nightmarket", name: "Night market", note: "Shared tables between the stalls.", layout: "bench" },
      { id: "cafe", name: "Cafe", note: "Small tables and a window bar.", layout: "counter" }] },
  { code: "IN", name: "India", table: "Table", regions: [
      r("Mumbai", "Asia/Kolkata"), r("Delhi", "Asia/Kolkata"), r("Bengaluru", "Asia/Kolkata"),
      r("Kolkata", "Asia/Kolkata"), r("Chennai", "Asia/Kolkata"), r("Hyderabad", "Asia/Kolkata")],
    venues: [
      { id: "tapri", name: "Chai tapri", note: "Cutting chai standing by the stall.", layout: "street" },
      { id: "irani", name: "Irani cafe", note: "Bun maska and bentwood chairs.", layout: "cafe" },
      { id: "dhaba", name: "Dhaba", note: "Roadside food and long tables.", layout: "bench" }] },
  { code: "AE", name: "United Arab Emirates", table: "Table", regions: [
      r("Dubai", "Asia/Dubai"), r("Abu Dhabi", "Asia/Dubai"), r("Sharjah", "Asia/Dubai")],
    venues: [
      { id: "karak", name: "Karak stall", note: "Karak chai and plastic chairs.", layout: "street" },
      { id: "majlis", name: "Majlis", note: "Floor cushions along the wall.", layout: "mat" },
      { id: "cafe", name: "Cafe", note: "Small tables, late hours.", layout: "cafe" }] },
  { code: "TR", name: "Turkiye", table: "Masa", regions: [
      r("Istanbul", "Europe/Istanbul"), r("Ankara", "Europe/Istanbul"), r("Izmir", "Europe/Istanbul")],
    venues: [
      { id: "caybahcesi", name: "Cay bahcesi", note: "Tea garden, tulip glasses, backgammon.", layout: "garden" },
      { id: "kahvehane", name: "Kahvehane", note: "Coffee house with small tables.", layout: "cafe" },
      { id: "meyhane", name: "Meyhane", note: "Meze and long tables.", layout: "bench" }] },
  { code: "EG", name: "Egypt", table: "Table", regions: [
      r("Cairo", "Africa/Cairo"), r("Alexandria", "Africa/Cairo"), r("Giza", "Africa/Cairo")],
    venues: [
      { id: "ahwa", name: "Ahwa", note: "Street coffee house, tea and shisha.", layout: "street" },
      { id: "cafe", name: "Cafe", note: "Small tables and a counter.", layout: "counter" }] },
  { code: "NG", name: "Nigeria", table: "Table", regions: [
      r("Lagos", "Africa/Lagos"), r("Abuja", "Africa/Lagos"), r("Ibadan", "Africa/Lagos"), r("Port Harcourt", "Africa/Lagos")],
    venues: [
      { id: "buka", name: "Buka", note: "Local food and shared benches.", layout: "bench" },
      { id: "joint", name: "Suya spot", note: "Plastic chairs by the grill.", layout: "street" },
      { id: "lounge", name: "Lounge", note: "Sofas and small tables.", layout: "cafe" }] },
  { code: "GB", name: "United Kingdom", table: "Table", regions: [
      r("London", "Europe/London"), r("Manchester", "Europe/London"), r("Birmingham", "Europe/London"),
      r("Glasgow", "Europe/London"), r("Edinburgh", "Europe/London"), r("Cardiff", "Europe/London")],
    venues: [
      { id: "pub", name: "Pub", note: "The bar plus a few tables.", layout: "counter" },
      { id: "cafe", name: "Cafe", note: "Tea, toast and small tables.", layout: "cafe" },
      { id: "beergarden", name: "Beer garden", note: "Picnic tables outside.", layout: "garden" }] },
  { code: "FR", name: "France", table: "Table", regions: [
      r("Paris", "Europe/Paris"), r("Lyon", "Europe/Paris"), r("Marseille", "Europe/Paris"), r("Toulouse", "Europe/Paris")],
    venues: [
      { id: "terrasse", name: "Cafe terrasse", note: "Small round tables facing the street.", layout: "street" },
      { id: "bistro", name: "Bistro", note: "Zinc bar and a few tables.", layout: "counter" },
      { id: "cave", name: "Bar a vin", note: "Wine and small plates.", layout: "cafe" }] },
  { code: "DE", name: "Germany", table: "Tisch", regions: [
      r("Berlin", "Europe/Berlin"), r("Munich", "Europe/Berlin"), r("Hamburg", "Europe/Berlin"), r("Cologne", "Europe/Berlin")],
    venues: [
      { id: "biergarten", name: "Biergarten", note: "Long garden tables, everyone shares.", layout: "garden" },
      { id: "kneipe", name: "Kneipe", note: "Neighbourhood bar with a counter.", layout: "counter" },
      { id: "cafe", name: "Cafe", note: "Kaffee und Kuchen.", layout: "cafe" }] },
  { code: "IT", name: "Italy", table: "Tavolo", regions: [
      r("Rome", "Europe/Rome"), r("Milan", "Europe/Rome"), r("Naples", "Europe/Rome"), r("Bologna", "Europe/Rome")],
    venues: [
      { id: "bar", name: "Bar", note: "Espresso at the counter.", layout: "counter" },
      { id: "piazza", name: "Piazza tables", note: "Outside tables on the square.", layout: "street" },
      { id: "enoteca", name: "Enoteca", note: "Wine bar, small tables.", layout: "cafe" }] },
  { code: "ES", name: "Spain", table: "Mesa", regions: [
      r("Madrid", "Europe/Madrid"), r("Barcelona", "Europe/Madrid"), r("Valencia", "Europe/Madrid"), r("Seville", "Europe/Madrid")],
    venues: [
      { id: "tapas", name: "Tapas bar", note: "Standing at the bar, small plates.", layout: "counter" },
      { id: "terraza", name: "Terraza", note: "Outdoor tables in the evening.", layout: "street" },
      { id: "cafe", name: "Cafeteria", note: "Cafe con leche and small tables.", layout: "cafe" }] },
  { code: "US", name: "United States", table: "Table", regions: [
      r("New York", "America/New_York"), r("Chicago", "America/Chicago"), r("Houston", "America/Chicago"),
      r("Denver", "America/Denver"), r("Los Angeles", "America/Los_Angeles"), r("San Francisco", "America/Los_Angeles"),
      r("Seattle", "America/Los_Angeles")],
    venues: [
      { id: "diner", name: "Diner", note: "Booths, coffee refills, open late.", layout: "bench" },
      { id: "coffee", name: "Coffee shop", note: "Small tables and a window bar.", layout: "counter" },
      { id: "bar", name: "Bar", note: "Counter seats and a few tables.", layout: "counter" }] },
  { code: "MX", name: "Mexico", table: "Mesa", regions: [
      r("Mexico City", "America/Mexico_City"), r("Guadalajara", "America/Mexico_City"), r("Monterrey", "America/Monterrey")],
    venues: [
      { id: "taqueria", name: "Taqueria", note: "Stools at the street stand.", layout: "street" },
      { id: "cantina", name: "Cantina", note: "Bar and botanas.", layout: "counter" },
      { id: "cafe", name: "Cafe", note: "Cafe de olla and small tables.", layout: "cafe" }] },
  { code: "BR", name: "Brazil", table: "Mesa", regions: [
      r("Sao Paulo", "America/Sao_Paulo"), r("Rio de Janeiro", "America/Sao_Paulo"),
      r("Belo Horizonte", "America/Sao_Paulo"), r("Salvador", "America/Bahia")],
    venues: [
      { id: "boteco", name: "Boteco", note: "Plastic tables on the pavement.", layout: "street" },
      { id: "padaria", name: "Padaria", note: "Bakery counter, pingado coffee.", layout: "counter" },
      { id: "quiosque", name: "Quiosque", note: "Beach kiosk tables.", layout: "garden" }] },
  { code: "AU", name: "Australia", table: "Table", regions: [
      r("Sydney", "Australia/Sydney"), r("Melbourne", "Australia/Melbourne"), r("Brisbane", "Australia/Brisbane"),
      r("Perth", "Australia/Perth"), r("Adelaide", "Australia/Adelaide")],
    venues: [
      { id: "cafe", name: "Cafe", note: "Flat whites and small tables.", layout: "cafe" },
      { id: "pub", name: "Pub", note: "Front bar and a beer garden.", layout: "garden" }] },
  { code: "XX", name: "Anywhere", table: "Table", regions: [r("Worldwide", "UTC")],
    venues: [
      { id: "lounge", name: "Open lounge", note: "For when nobody nearby is around.", layout: "cafe" },
      { id: "nightowl", name: "Night owls", note: "Late-night tables for any time zone.", layout: "bench" }] },
];

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

for (const c of COUNTRIES) {
  for (const reg of c.regions) {
    reg.id = slug(reg.name);
  }
}

export function findCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || null;
}

export function findRegion(country, regionId) {
  return country?.regions.find((x) => x.id === regionId) || null;
}

export function findVenue(country, venueId) {
  return country?.venues.find((v) => v.id === venueId) || null;
}

export function tablesFor(venue) {
  const sizes = LAYOUTS[venue.layout].tables;
  return sizes.map((seats, i) => ({ n: i + 1, seats }));
}

// Best guess from the browser's own time zone. Nothing is sent anywhere.
export function guessPlace(tz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  for (const c of COUNTRIES) {
    if (c.code === "XX") {
      continue;
    }
    const reg = c.regions.find((x) => x.tz === tz);
    if (reg) {
      return { country: c.code, region: reg.id };
    }
  }
  return { country: "XX", region: "worldwide" };
}
