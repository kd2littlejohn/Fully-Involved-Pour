const STORAGE_KEY = "cellar-ledger-bottles";
const POUR_STORAGE_KEY = "cellar-ledger-pours";

const seedBottles = [
  {
    id: crypto.randomUUID(),
    name: "Russell's Reserve Single Barrel",
    distillery: "Wild Turkey",
    type: "Bourbon",
    region: "Kentucky",
    proof: 110,
    price: 68,
    rating: 8.7,
    status: "open",
    flavors: ["caramel", "oak", "cherry", "pepper"],
    notes: "Big oak, cherry cola, and a long spicy finish. Great Friday pour.",
  },
  {
    id: crypto.randomUUID(),
    name: "Redwood Empire Emerald Giant",
    distillery: "Redwood Empire",
    type: "Rye",
    region: "California",
    proof: 90,
    price: 42,
    rating: 8.1,
    status: "sealed",
    flavors: ["mint", "citrus", "baking spice"],
    notes: "Saving this one for a blind rye flight.",
  },
  {
    id: crypto.randomUUID(),
    name: "Four Roses Small Batch Select",
    distillery: "Four Roses",
    type: "Bourbon",
    region: "Kentucky",
    proof: 104,
    price: 62,
    rating: 8.4,
    status: "open",
    flavors: ["red fruit", "vanilla", "clove"],
    notes: "Balanced and bright. Works well for introducing friends to higher proof bourbon.",
  },
  {
    id: crypto.randomUUID(),
    name: "Ardbeg Uigeadail",
    distillery: "Ardbeg",
    type: "Scotch",
    region: "Islay",
    proof: 108.4,
    price: 89,
    rating: 9.0,
    status: "sealed",
    flavors: ["smoke", "raisin", "brine", "dark chocolate"],
    notes: "Open when the weather turns cold.",
  },
  {
    id: crypto.randomUUID(),
    name: "Elijah Craig Barrel Proof",
    distillery: "Heaven Hill",
    type: "Bourbon",
    region: "Kentucky",
    proof: 124.7,
    price: 80,
    rating: 9.2,
    status: "wishlist",
    flavors: ["toffee", "oak", "cinnamon"],
    notes: "Keep an eye out near retail. Avoid inflated secondary pricing.",
  },
];

const bottleCatalog = {
  "088004027104": {
    name: "Woodford Reserve Distiller's Select",
    distillery: "Woodford Reserve",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90.4,
    price: 38,
    flavors: ["vanilla", "orange", "cocoa", "spice"],
  },
  "080432102179": {
    name: "Old Forester 1920 Prohibition Style",
    distillery: "Old Forester",
    type: "Bourbon",
    region: "Kentucky",
    proof: 115,
    price: 62,
    flavors: ["banana", "caramel", "oak", "pepper"],
  },
  "088076183876": {
    name: "Maker's Mark",
    distillery: "Maker's Mark",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 32,
    flavors: ["wheat", "vanilla", "caramel"],
  },
  "080686016409": {
    name: "Buffalo Trace Bourbon",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 30,
    flavors: ["brown sugar", "toffee", "anise", "oak"],
  },
  "081128005078": {
    name: "Four Roses Small Batch",
    distillery: "Four Roses",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 36,
    flavors: ["red fruit", "honey", "spice"],
  },
  "721059897501": {
    name: "Bulleit Rye",
    distillery: "Bulleit",
    type: "Rye",
    region: "Kentucky",
    proof: 90,
    price: 34,
    flavors: ["mint", "pepper", "citrus", "spice"],
  },
};

const curatedBottleImages = {
  "russell's reserve single barrel-wild turkey":
    "https://www.thebarreltap.com/cdn/shop/files/Russell_sReserveSingleBarrelBourbon750mL.webp?v=1717177068&width=1080",
  "redwood empire emerald giant-redwood empire":
    "https://redwoodempirewhiskey.com/wp-content/uploads/2024/04/EmeraldGiant-Rye-Whiskey-RedwoodEmpire.png",
  "four roses small batch select-four roses":
    "https://www.fourrosesbourbon.com/_next/image?q=75&url=https%3A%2F%2Ffour-roses.files.svdcdn.com%2Fproduction%2Fimages%2Fbourbons%2FWeb_SB-Select_2023-06-14-135041_xnwi.png%3Fdm%3D1757960462&w=2560",
  "ardbeg uigeadail-ardbeg":
    "https://www.ardbeg.com/on/demandware.static/-/Sites-mh-master/default/dw44dfec1b/images/brand/ardbeg/Ardbeg_Uigeadail_bottle_front.png?im=Resize%2Cwidth%3D408%2Cheight%3D544",
  "elijah craig barrel proof-heaven hill": "https://elijahcraig.com/images/EC-barrel-proof.jpg",
  "buffalo trace bourbon-buffalo trace":
    "https://www.buffalotracedistillery.com/_next/image/?q=75&url=https%3A%2F%2Fcms.buffalotracedistillery.com%2Fwp-content%2Fuploads%2F2025%2F11%2FBUFFALO_TRACE_BOTTLE-e1765117225509.png&w=750",
};

const distilleryDatabase = [
  "1792 Barton",
  "A. Smith Bowman",
  "Aberfeldy",
  "Aberlour",
  "Angel's Envy",
  "Ardbeg",
  "Ardmore",
  "ASW Distillery",
  "Balcones",
  "Balvenie",
  "Bardstown Bourbon Company",
  "Barrell Craft Spirits",
  "Barton 1792",
  "Beam Suntory",
  "BenRiach",
  "Bernheim",
  "Blue Note",
  "Booker's",
  "Bowmore",
  "Breckenridge",
  "Bruichladdich",
  "Buffalo Trace",
  "Bulleit",
  "Bushmills",
  "Casey Jones",
  "Castle & Key",
  "Chattanooga Whiskey",
  "Cooper's Craft",
  "Coppercraft",
  "Crown Royal",
  "Dalmore",
  "Deanston",
  "Edradour",
  "Elijah Craig",
  "El Tesoro",
  "Evan Williams",
  "Foursquare",
  "Four Roses",
  "George Dickel",
  "GlenDronach",
  "Glenfiddich",
  "Glengoyne",
  "Glenlivet",
  "Glenmorangie",
  "Green River",
  "Hampden Estate",
  "Heaven Hill",
  "Herradura",
  "High West",
  "Hillrock",
  "Jack Daniel's",
  "James E. Pepper",
  "Jameson",
  "Jefferson's",
  "Jim Beam",
  "Johnnie Walker",
  "Jose Cuervo",
  "Kentucky Peerless",
  "Kilchoman",
  "Knob Creek",
  "Laphroaig",
  "Larceny",
  "Limestone Branch",
  "Lux Row",
  "Macallan",
  "Maker's Mark",
  "MGP",
  "Michter's",
  "Milam & Greene",
  "Nashville Barrel Company",
  "Nelson's Green Brier",
  "New Riff",
  "Old Elk",
  "Old Forester",
  "Old Grand-Dad",
  "Old Overholt",
  "Peerless",
  "Penelope",
  "Rabbit Hole",
  "Redbreast",
  "Redwood Empire",
  "Reservoir",
  "Ross & Squibb",
  "Russell's Reserve",
  "Sagamore Spirit",
  "Sazerac",
  "Smoke Wagon",
  "Smooth Ambler",
  "Starlight",
  "Stranahan's",
  "Suntory",
  "Talisker",
  "Teeling",
  "The Balvenie",
  "The Glenlivet",
  "The Macallan",
  "Tullamore D.E.W.",
  "Westland",
  "WhistlePig",
  "Wilderness Trail",
  "Wild Turkey",
  "Willett",
  "Woodford Reserve",
  "Yellowstone",
];

function normalizeBottle(bottle) {
  return normalizeLegacyBottle({
    shelf: "Main bar",
    quantity: 1,
    fillLevel: bottle.status === "open" ? "three-quarter" : "full",
    openedDate: "",
    category: defaultCategory(bottle),
    pourStyle: "daily",
    pourTier: "crowd",
    bottleSize: 750,
    ageStatement: "",
    storeLocation: "",
    coreBar: false,
    priority: 3,
    ...bottle,
  });
}

function normalizeLegacyBottle(bottle) {
  const legacyPourStyles = {
    "daily-drinker": "daily",
    "after-shift": "daily",
    "chill-night": "daily",
    "flavor-power": "share",
    "special-occasion": "special",
    experiment: "share",
    "cocktail-mix": "cocktail",
    "friday-night": "share",
    impress: "special",
  };

  const curatedImage = getCuratedBottleImage(bottle);

  return {
    ...bottle,
    imageUrl: bottle.imageUrl || curatedImage || "",
    pourStyle: legacyPourStyles[bottle.pourStyle] || bottle.pourStyle || "daily",
    pourTier: normalizePourTier(bottle.pourTier || (bottle.pourStyle === "special-occasion" || bottle.coreBar ? "reserve" : "crowd")),
    bottleSize: Number(bottle.bottleSize || bottle.size || 750),
  };
}

function normalizePourTier(tier) {
  return {
    standard: "crowd",
    crowd: "crowd",
    reserve: "reserve",
    vip: "vip",
  }[tier || "crowd"];
}

function getCuratedBottleImage(bottle) {
  const exactKey = `${bottle.name || ""}-${bottle.distillery || ""}`.toLowerCase();
  if (curatedBottleImages[exactKey]) return curatedBottleImages[exactKey];

  const normalizedName = String(bottle.name || "").toLowerCase();
  const normalizedDistillery = String(bottle.distillery || "").toLowerCase();
  const match = Object.entries(curatedBottleImages).find(([key]) => {
    const [name, distillery] = key.split("-");
    return normalizedName.includes(name) || (normalizedName.includes(name.split(" ")[0]) && normalizedDistillery.includes(distillery));
  });
  return match?.[1] || "";
}

function defaultCategory(bottle) {
  if (bottle.type === "Rye") return "rye";
  if (Number(bottle.proof) >= 115) return "high-proof";
  if (bottle.flavors?.some((flavor) => flavor.includes("wheat"))) return "wheated";
  return "daily";
}

const aiBottleLibrary = [
  ...Object.values(bottleCatalog),
  {
    name: "E.H. Taylor Small Batch",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 55,
    flavors: ["caramel", "vanilla", "oak", "cinnamon"],
  },
  {
    name: "E.H. Taylor Single Barrel",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 75,
    flavors: ["toffee", "cherry", "oak", "spice"],
  },
  {
    name: "Weller Special Reserve",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 35,
    flavors: ["wheat", "honey", "vanilla", "soft oak"],
  },
  {
    name: "Weller Antique 107",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 107,
    price: 60,
    flavors: ["caramel", "dark fruit", "oak", "cinnamon"],
  },
  {
    name: "Blanton's Single Barrel",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 93,
    price: 70,
    flavors: ["vanilla", "orange", "clove", "honey"],
  },
  {
    name: "Eagle Rare 10 Year",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 45,
    flavors: ["toffee", "orange peel", "oak", "leather"],
  },
  {
    name: "Stagg Jr.",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 130,
    price: 75,
    flavors: ["dark cherry", "brown sugar", "oak", "heat"],
  },
  {
    name: "Elijah Craig Small Batch",
    distillery: "Heaven Hill",
    type: "Bourbon",
    region: "Kentucky",
    proof: 94,
    price: 32,
    flavors: ["caramel", "nutmeg", "oak", "vanilla"],
  },
  {
    name: "Henry McKenna 10 Year Bottled-in-Bond",
    distillery: "Heaven Hill",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 65,
    flavors: ["peanut", "oak", "caramel", "spice"],
  },
  {
    name: "Larceny Barrel Proof",
    distillery: "Heaven Hill",
    type: "Bourbon",
    region: "Kentucky",
    proof: 122,
    price: 65,
    flavors: ["wheat", "toffee", "cinnamon", "oak"],
  },
  {
    name: "Wild Turkey 101",
    distillery: "Wild Turkey",
    type: "Bourbon",
    region: "Kentucky",
    proof: 101,
    price: 28,
    flavors: ["caramel", "vanilla", "pepper", "oak"],
  },
  {
    name: "Rare Breed Bourbon",
    distillery: "Wild Turkey",
    type: "Bourbon",
    region: "Kentucky",
    proof: 116.8,
    price: 58,
    flavors: ["brown sugar", "spice", "orange", "oak"],
  },
  {
    name: "Russell's Reserve 10 Year",
    distillery: "Wild Turkey",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 42,
    flavors: ["vanilla", "char", "toffee", "rye spice"],
  },
  {
    name: "Knob Creek 9 Year",
    distillery: "Jim Beam",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 38,
    flavors: ["peanut", "oak", "vanilla", "caramel"],
  },
  {
    name: "Booker's Bourbon",
    distillery: "Jim Beam",
    type: "Bourbon",
    region: "Kentucky",
    proof: 126,
    price: 95,
    flavors: ["peanut brittle", "oak", "brown sugar", "heat"],
  },
  {
    name: "Baker's 7 Year Single Barrel",
    distillery: "Jim Beam",
    type: "Bourbon",
    region: "Kentucky",
    proof: 107,
    price: 68,
    flavors: ["nutty", "caramel", "oak", "pepper"],
  },
  {
    name: "Four Roses Single Barrel",
    distillery: "Four Roses",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 48,
    flavors: ["cherry", "floral", "spice", "oak"],
  },
  {
    name: "Michter's US*1 Bourbon",
    distillery: "Michter's",
    type: "Bourbon",
    region: "Kentucky",
    proof: 91.4,
    price: 48,
    flavors: ["caramel", "stone fruit", "vanilla", "oak"],
  },
  {
    name: "Michter's US*1 Rye",
    distillery: "Michter's",
    type: "Rye",
    region: "Kentucky",
    proof: 84.8,
    price: 48,
    flavors: ["citrus", "mint", "spice", "vanilla"],
  },
  {
    name: "New Riff Single Barrel Bourbon",
    distillery: "New Riff",
    type: "Bourbon",
    region: "Kentucky",
    proof: 110,
    price: 58,
    flavors: ["rye spice", "vanilla", "oak", "cherry"],
  },
  {
    name: "Jack Daniel's Single Barrel Barrel Proof",
    distillery: "Jack Daniel's",
    type: "Bourbon",
    region: "Tennessee",
    proof: 130,
    price: 70,
    flavors: ["banana", "brown sugar", "oak", "heat"],
  },
  {
    name: "Old Grand-Dad 114",
    distillery: "Jim Beam",
    type: "Bourbon",
    region: "Kentucky",
    proof: 114,
    price: 32,
    flavors: ["cinnamon", "peanut", "oak", "pepper"],
  },
  {
    name: "1792 Full Proof",
    distillery: "Barton 1792",
    type: "Bourbon",
    region: "Kentucky",
    proof: 125,
    price: 55,
    flavors: ["caramel", "oak", "dark fruit", "spice"],
  },
  {
    name: "High West Double Rye",
    distillery: "High West",
    type: "Rye",
    region: "Utah",
    proof: 92,
    price: 40,
    flavors: ["mint", "cinnamon", "dill", "honey"],
  },
  {
    name: "Sazerac Rye",
    distillery: "Buffalo Trace",
    type: "Rye",
    region: "Kentucky",
    proof: 90,
    price: 36,
    flavors: ["clove", "vanilla", "citrus", "pepper"],
  },
  {
    name: "Rittenhouse Rye Bottled-in-Bond",
    distillery: "Heaven Hill",
    type: "Rye",
    region: "Kentucky",
    proof: 100,
    price: 30,
    flavors: ["cocoa", "spice", "orange", "oak"],
  },
];

const expandedWhiskeyLibrary = [
  { name: "Old Forester 100 Proof", distillery: "Old Forester", type: "Bourbon", region: "Kentucky", proof: 100, price: 28, flavors: ["banana", "caramel", "oak", "pepper"] },
  { name: "Old Forester Statesman", distillery: "Old Forester", type: "Bourbon", region: "Kentucky", proof: 95, price: 55, flavors: ["baking spice", "orange", "caramel", "oak"] },
  { name: "Old Forester 1910 Old Fine Whisky", distillery: "Old Forester", type: "Bourbon", region: "Kentucky", proof: 93, price: 58, flavors: ["chocolate", "marshmallow", "oak", "caramel"] },
  { name: "Old Forester 1897 Bottled in Bond", distillery: "Old Forester", type: "Bourbon", region: "Kentucky", proof: 100, price: 55, flavors: ["brown sugar", "spice", "oak", "vanilla"] },
  { name: "Woodford Reserve Double Oaked", distillery: "Woodford Reserve", type: "Bourbon", region: "Kentucky", proof: 90.4, price: 58, flavors: ["chocolate", "toasted oak", "caramel", "vanilla"] },
  { name: "Woodford Reserve Rye", distillery: "Woodford Reserve", type: "Rye", region: "Kentucky", proof: 90.4, price: 38, flavors: ["apple", "mint", "spice", "honey"] },
  { name: "Maker's Mark 46", distillery: "Maker's Mark", type: "Bourbon", region: "Kentucky", proof: 94, price: 42, flavors: ["wheat", "vanilla", "toast", "caramel"] },
  { name: "Maker's Mark Cask Strength", distillery: "Maker's Mark", type: "Bourbon", region: "Kentucky", proof: 110, price: 45, flavors: ["wheat", "brown sugar", "oak", "cinnamon"] },
  { name: "Maker's Mark Private Selection", distillery: "Maker's Mark", type: "Bourbon", region: "Kentucky", proof: 110, price: 75, flavors: ["wheat", "baking spice", "vanilla", "oak"] },
  { name: "Angel's Envy Bourbon", distillery: "Angel's Envy", type: "Bourbon", region: "Kentucky", proof: 86.6, price: 50, flavors: ["port", "raisin", "vanilla", "maple"] },
  { name: "Angel's Envy Rye", distillery: "Angel's Envy", type: "Rye", region: "Kentucky", proof: 100, price: 95, flavors: ["rum", "maple", "mint", "spice"] },
  { name: "Bulleit Bourbon", distillery: "Bulleit", type: "Bourbon", region: "Kentucky", proof: 90, price: 32, flavors: ["rye spice", "orange", "oak", "vanilla"] },
  { name: "Bulleit Barrel Strength", distillery: "Bulleit", type: "Bourbon", region: "Kentucky", proof: 119, price: 60, flavors: ["oak", "pepper", "caramel", "heat"] },
  { name: "1792 Small Batch", distillery: "Barton 1792", type: "Bourbon", region: "Kentucky", proof: 93.7, price: 34, flavors: ["vanilla", "rye spice", "caramel", "oak"] },
  { name: "1792 Bottled in Bond", distillery: "Barton 1792", type: "Bourbon", region: "Kentucky", proof: 100, price: 45, flavors: ["toffee", "oak", "spice", "apple"] },
  { name: "Casey Jones Wheated Bourbon", distillery: "Casey Jones", type: "Bourbon", region: "Kentucky", proof: 96, price: 42, flavors: ["wheat", "honey", "cornbread", "vanilla"] },
  { name: "Barrell Bourbon Batch", distillery: "Barrell Craft Spirits", type: "Bourbon", region: "Kentucky", proof: 115, price: 90, flavors: ["dark fruit", "oak", "spice", "toffee"] },
  { name: "Barrell Seagrass", distillery: "Barrell Craft Spirits", type: "Rye", region: "Blended", proof: 118, price: 90, flavors: ["apricot", "grass", "spice", "citrus"] },
  { name: "Smoke Wagon Small Batch", distillery: "Nevada H&C", type: "Bourbon", region: "Nevada", proof: 100, price: 55, flavors: ["caramel", "rye spice", "oak", "vanilla"] },
  { name: "Smoke Wagon Uncut Unfiltered", distillery: "Nevada H&C", type: "Bourbon", region: "Nevada", proof: 115, price: 75, flavors: ["dark fruit", "oak", "spice", "heat"] },
  { name: "Peerless Small Batch Bourbon", distillery: "Peerless", type: "Bourbon", region: "Kentucky", proof: 108, price: 80, flavors: ["citrus", "oak", "caramel", "spice"] },
  { name: "Peerless Rye", distillery: "Peerless", type: "Rye", region: "Kentucky", proof: 107, price: 90, flavors: ["mint", "cocoa", "pepper", "oak"] },
  { name: "Wilderness Trail Bottled in Bond Bourbon", distillery: "Wilderness Trail", type: "Bourbon", region: "Kentucky", proof: 100, price: 55, flavors: ["wheat", "vanilla", "citrus", "oak"] },
  { name: "Wilderness Trail Rye", distillery: "Wilderness Trail", type: "Rye", region: "Kentucky", proof: 100, price: 55, flavors: ["pepper", "mint", "citrus", "grain"] },
  { name: "Penelope Architect", distillery: "Penelope", type: "Bourbon", region: "Indiana", proof: 104, price: 65, flavors: ["vanilla", "oak", "spice", "honey"] },
  { name: "Penelope Barrel Strength", distillery: "Penelope", type: "Bourbon", region: "Indiana", proof: 115, price: 65, flavors: ["caramel", "oak", "cinnamon", "heat"] },
  { name: "Green River Wheated Bourbon", distillery: "Green River", type: "Bourbon", region: "Kentucky", proof: 90, price: 36, flavors: ["wheat", "honey", "pear", "vanilla"] },
  { name: "Green River Full Proof", distillery: "Green River", type: "Bourbon", region: "Kentucky", proof: 117, price: 50, flavors: ["oak", "brown sugar", "spice", "cherry"] },
  { name: "Heaven Hill Bottled in Bond", distillery: "Heaven Hill", type: "Bourbon", region: "Kentucky", proof: 100, price: 50, flavors: ["peanut", "oak", "vanilla", "caramel"] },
  { name: "Evan Williams Bottled in Bond", distillery: "Heaven Hill", type: "Bourbon", region: "Kentucky", proof: 100, price: 20, flavors: ["caramel", "corn", "oak", "pepper"] },
  { name: "Old Fitzgerald Bottled in Bond", distillery: "Heaven Hill", type: "Bourbon", region: "Kentucky", proof: 100, price: 150, flavors: ["wheat", "honey", "oak", "vanilla"] },
  { name: "Pikesville Rye", distillery: "Heaven Hill", type: "Rye", region: "Kentucky", proof: 110, price: 55, flavors: ["cocoa", "mint", "rye spice", "oak"] },
  { name: "Wild Turkey Rare Breed Rye", distillery: "Wild Turkey", type: "Rye", region: "Kentucky", proof: 112.2, price: 65, flavors: ["mint", "pepper", "orange", "oak"] },
  { name: "Russell's Reserve 6 Year Rye", distillery: "Wild Turkey", type: "Rye", region: "Kentucky", proof: 90, price: 42, flavors: ["mint", "vanilla", "spice", "oak"] },
  { name: "Knob Creek Rye", distillery: "Jim Beam", type: "Rye", region: "Kentucky", proof: 100, price: 38, flavors: ["rye spice", "vanilla", "oak", "herbal"] },
  { name: "Knob Creek Single Barrel Reserve", distillery: "Jim Beam", type: "Bourbon", region: "Kentucky", proof: 120, price: 60, flavors: ["peanut", "oak", "brown sugar", "heat"] },
  { name: "Sagamore Spirit Double Oak Rye", distillery: "Sagamore Spirit", type: "Rye", region: "Maryland", proof: 96.6, price: 65, flavors: ["toasted oak", "maple", "cinnamon", "mint"] },
  { name: "Sagamore Spirit Cask Strength Rye", distillery: "Sagamore Spirit", type: "Rye", region: "Maryland", proof: 112, price: 75, flavors: ["mint", "dark chocolate", "spice", "oak"] },
  { name: "New Riff Bottled in Bond Bourbon", distillery: "New Riff", type: "Bourbon", region: "Kentucky", proof: 100, price: 45, flavors: ["rye spice", "vanilla", "oak", "citrus"] },
  { name: "New Riff Bottled in Bond Rye", distillery: "New Riff", type: "Rye", region: "Kentucky", proof: 100, price: 45, flavors: ["mint", "spice", "citrus", "oak"] },
  { name: "Frey Ranch Straight Bourbon", distillery: "Frey Ranch", type: "Bourbon", region: "Nevada", proof: 90, price: 55, flavors: ["grain", "honey", "oak", "cocoa"] },
  { name: "Frey Ranch Single Barrel", distillery: "Frey Ranch", type: "Bourbon", region: "Nevada", proof: 120, price: 90, flavors: ["grain", "caramel", "oak", "heat"] },
  { name: "Balcones Texas 1 Single Malt", distillery: "Balcones", type: "American Single Malt", region: "Texas", proof: 106, price: 70, flavors: ["malt", "cocoa", "fruit", "oak"] },
  { name: "Westland American Single Malt", distillery: "Westland", type: "American Single Malt", region: "Washington", proof: 92, price: 70, flavors: ["malt", "chocolate", "honey", "oak"] },
  { name: "Stranahan's Original", distillery: "Stranahan's", type: "American Single Malt", region: "Colorado", proof: 94, price: 60, flavors: ["malt", "honey", "oak", "apple"] },
  { name: "Redbreast 12 Year", distillery: "Midleton", type: "Irish", region: "Ireland", proof: 80, price: 75, flavors: ["sherry", "apple", "spice", "cream"] },
  { name: "Redbreast Cask Strength", distillery: "Midleton", type: "Irish", region: "Ireland", proof: 115, price: 100, flavors: ["sherry", "spice", "fruit", "oak"] },
  { name: "Green Spot", distillery: "Midleton", type: "Irish", region: "Ireland", proof: 80, price: 70, flavors: ["apple", "honey", "malt", "spice"] },
  { name: "Yellow Spot 12 Year", distillery: "Midleton", type: "Irish", region: "Ireland", proof: 92, price: 115, flavors: ["honey", "fruit", "oak", "spice"] },
  { name: "Jameson Black Barrel", distillery: "Midleton", type: "Irish", region: "Ireland", proof: 80, price: 40, flavors: ["vanilla", "toast", "spice", "caramel"] },
  { name: "Lagavulin 16 Year", distillery: "Lagavulin", type: "Scotch", region: "Islay", proof: 86, price: 110, flavors: ["smoke", "brine", "peat", "dried fruit"] },
  { name: "Laphroaig 10 Year", distillery: "Laphroaig", type: "Scotch", region: "Islay", proof: 86, price: 65, flavors: ["peat", "iodine", "smoke", "seaweed"] },
  { name: "Ardbeg 10 Year", distillery: "Ardbeg", type: "Scotch", region: "Islay", proof: 92, price: 65, flavors: ["smoke", "lemon", "peat", "brine"] },
  { name: "Bruichladdich Classic Laddie", distillery: "Bruichladdich", type: "Scotch", region: "Islay", proof: 100, price: 65, flavors: ["malt", "citrus", "sea salt", "vanilla"] },
  { name: "Oban 14 Year", distillery: "Oban", type: "Scotch", region: "Highland", proof: 86, price: 95, flavors: ["orange", "malt", "smoke", "honey"] },
  { name: "Glenmorangie 10 Year", distillery: "Glenmorangie", type: "Scotch", region: "Highland", proof: 80, price: 45, flavors: ["orange", "vanilla", "malt", "honey"] },
  { name: "Macallan 12 Sherry Oak", distillery: "The Macallan", type: "Scotch", region: "Speyside", proof: 86, price: 95, flavors: ["sherry", "raisin", "oak", "spice"] },
  { name: "Glenfiddich 12 Year", distillery: "Glenfiddich", type: "Scotch", region: "Speyside", proof: 80, price: 50, flavors: ["pear", "malt", "oak", "honey"] },
  { name: "Balvenie DoubleWood 12", distillery: "The Balvenie", type: "Scotch", region: "Speyside", proof: 86, price: 75, flavors: ["sherry", "honey", "malt", "oak"] },
  { name: "Talisker 10 Year", distillery: "Talisker", type: "Scotch", region: "Islands", proof: 91.6, price: 75, flavors: ["pepper", "smoke", "sea salt", "malt"] },
  { name: "Nikka From The Barrel", distillery: "Nikka", type: "Japanese", region: "Japan", proof: 102.8, price: 90, flavors: ["malt", "spice", "fruit", "oak"] },
  { name: "Suntory Toki", distillery: "Suntory", type: "Japanese", region: "Japan", proof: 86, price: 45, flavors: ["green apple", "honey", "ginger", "malt"] },
  { name: "Crown Royal Northern Harvest Rye", distillery: "Crown Royal", type: "Canadian", region: "Canada", proof: 90, price: 35, flavors: ["rye spice", "vanilla", "oak", "fruit"] },
  { name: "Lot No. 40 Rye", distillery: "Hiram Walker", type: "Canadian", region: "Canada", proof: 86, price: 45, flavors: ["rye spice", "mint", "oak", "citrus"] },
];

const expressionLineupLibrary = [
  { name: "Weller Special Reserve", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 90, price: 35, flavors: ["wheat", "honey", "vanilla", "soft oak"] },
  { name: "Weller Antique 107", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 107, price: 60, flavors: ["wheat", "caramel", "dark fruit", "cinnamon"] },
  { name: "Weller 12 Year", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 90, price: 90, flavors: ["wheat", "oak", "honey", "vanilla"] },
  { name: "Weller Full Proof", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 114, price: 75, flavors: ["wheat", "cherry", "oak", "spice"] },
  { name: "Weller C.Y.P.B.", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 95, price: 150, flavors: ["wheat", "caramel", "vanilla", "oak"] },
  { name: "Weller Single Barrel", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 97, price: 150, flavors: ["wheat", "toffee", "cherry", "oak"] },
  { name: "William Larue Weller", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 125, price: 1000, flavors: ["wheat", "dark fruit", "oak", "molasses"] },
  { name: "Daniel Weller Emmer Wheat", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 94, price: 500, flavors: ["wheat", "grain", "honey", "oak"] },
  { name: "Weller Millennium", distillery: "Buffalo Trace", type: "American Whiskey", region: "Kentucky", proof: 99, price: 7500, flavors: ["wheat", "oak", "dark fruit", "vanilla"] },

  { name: "Buffalo Trace Kosher Wheat Recipe", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 94, price: 60, flavors: ["wheat", "honey", "vanilla", "oak"] },
  { name: "Buffalo Trace Kosher Rye Recipe", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 94, price: 60, flavors: ["rye spice", "caramel", "oak", "vanilla"] },
  { name: "Buffalo Trace Kosher Straight Rye", distillery: "Buffalo Trace", type: "Rye", region: "Kentucky", proof: 94, price: 60, flavors: ["mint", "spice", "oak", "citrus"] },
  { name: "E.H. Taylor Straight Rye", distillery: "Buffalo Trace", type: "Rye", region: "Kentucky", proof: 100, price: 100, flavors: ["rye spice", "mint", "oak", "citrus"] },
  { name: "E.H. Taylor Barrel Proof", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 130, price: 250, flavors: ["caramel", "oak", "dark fruit", "heat"] },
  { name: "E.H. Taylor Warehouse C", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 100, price: 900, flavors: ["cherry", "oak", "vanilla", "spice"] },
  { name: "E.H. Taylor Four Grain", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 100, price: 1200, flavors: ["grain", "honey", "oak", "spice"] },
  { name: "E.H. Taylor Amaranth Grain of the Gods", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 100, price: 1500, flavors: ["grain", "caramel", "oak", "spice"] },
  { name: "Benchmark Old No. 8", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 80, price: 15, flavors: ["corn", "caramel", "oak", "vanilla"] },
  { name: "Benchmark Bonded", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 100, price: 25, flavors: ["caramel", "oak", "spice", "vanilla"] },
  { name: "Benchmark Full Proof", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 125, price: 30, flavors: ["oak", "caramel", "heat", "pepper"] },
  { name: "Benchmark Single Barrel", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 95, price: 25, flavors: ["vanilla", "oak", "caramel", "spice"] },
  { name: "Benchmark Top Floor", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 86, price: 25, flavors: ["light oak", "vanilla", "corn", "honey"] },
  { name: "Benchmark Small Batch", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 90, price: 25, flavors: ["caramel", "oak", "vanilla", "pepper"] },
  { name: "George T. Stagg", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 130, price: 900, flavors: ["dark cherry", "oak", "molasses", "heat"] },
  { name: "Thomas H. Handy Sazerac Rye", distillery: "Buffalo Trace", type: "Rye", region: "Kentucky", proof: 125, price: 800, flavors: ["mint", "rye spice", "oak", "heat"] },
  { name: "Eagle Rare 17 Year", distillery: "Buffalo Trace", type: "Bourbon", region: "Kentucky", proof: 101, price: 1200, flavors: ["oak", "leather", "toffee", "orange"] },

  { name: "Old Forester 86 Proof", distillery: "Old Forester", type: "Bourbon", region: "Kentucky", proof: 86, price: 25, flavors: ["banana", "vanilla", "oak", "caramel"] },
  { name: "Old Forester Rye", distillery: "Old Forester", type: "Rye", region: "Kentucky", proof: 100, price: 28, flavors: ["mint", "pepper", "banana", "oak"] },
  { name: "Old Forester Single Barrel Barrel Strength", distillery: "Old Forester", type: "Bourbon", region: "Kentucky", proof: 130, price: 90, flavors: ["banana", "oak", "dark fruit", "heat"] },
  { name: "Old Forester Birthday Bourbon", distillery: "Old Forester", type: "Bourbon", region: "Kentucky", proof: 100, price: 800, flavors: ["oak", "caramel", "fruit", "spice"] },
  { name: "Woodford Reserve Batch Proof", distillery: "Woodford Reserve", type: "Bourbon", region: "Kentucky", proof: 120, price: 150, flavors: ["oak", "cocoa", "caramel", "heat"] },
  { name: "Woodford Reserve Master's Collection", distillery: "Woodford Reserve", type: "Bourbon", region: "Kentucky", proof: 90, price: 150, flavors: ["oak", "spice", "vanilla", "fruit"] },
  { name: "Maker's Mark 101", distillery: "Maker's Mark", type: "Bourbon", region: "Kentucky", proof: 101, price: 45, flavors: ["wheat", "caramel", "vanilla", "oak"] },
  { name: "Maker's Mark Cellar Aged", distillery: "Maker's Mark", type: "Bourbon", region: "Kentucky", proof: 115, price: 175, flavors: ["wheat", "oak", "dark fruit", "spice"] },
  { name: "Maker's Mark Wood Finishing Series", distillery: "Maker's Mark", type: "Bourbon", region: "Kentucky", proof: 110, price: 75, flavors: ["wheat", "toast", "vanilla", "spice"] },

  { name: "Elijah Craig Toasted Barrel", distillery: "Heaven Hill", type: "Bourbon", region: "Kentucky", proof: 94, price: 55, flavors: ["toasted oak", "marshmallow", "caramel", "vanilla"] },
  { name: "Elijah Craig 18 Year", distillery: "Heaven Hill", type: "Bourbon", region: "Kentucky", proof: 90, price: 200, flavors: ["oak", "leather", "vanilla", "caramel"] },
  { name: "Parker's Heritage Collection", distillery: "Heaven Hill", type: "Bourbon", region: "Kentucky", proof: 120, price: 400, flavors: ["oak", "caramel", "spice", "fruit"] },
  { name: "Larceny Small Batch", distillery: "Heaven Hill", type: "Bourbon", region: "Kentucky", proof: 92, price: 28, flavors: ["wheat", "honey", "vanilla", "oak"] },
  { name: "Bernheim Original Wheat Whiskey", distillery: "Heaven Hill", type: "American Whiskey", region: "Kentucky", proof: 90, price: 35, flavors: ["wheat", "honey", "grain", "vanilla"] },
  { name: "Mellow Corn Bottled in Bond", distillery: "Heaven Hill", type: "American Whiskey", region: "Kentucky", proof: 100, price: 18, flavors: ["corn", "honey", "oak", "grain"] },

  { name: "Wild Turkey Master's Keep", distillery: "Wild Turkey", type: "Bourbon", region: "Kentucky", proof: 100, price: 250, flavors: ["oak", "spice", "vanilla", "fruit"] },
  { name: "Wild Turkey Kentucky Spirit", distillery: "Wild Turkey", type: "Bourbon", region: "Kentucky", proof: 101, price: 60, flavors: ["caramel", "oak", "pepper", "vanilla"] },
  { name: "Russell's Reserve 13 Year", distillery: "Wild Turkey", type: "Bourbon", region: "Kentucky", proof: 114.8, price: 250, flavors: ["oak", "dark fruit", "caramel", "spice"] },
  { name: "Russell's Reserve Single Rickhouse", distillery: "Wild Turkey", type: "Bourbon", region: "Kentucky", proof: 112, price: 300, flavors: ["oak", "vanilla", "cherry", "spice"] },

  { name: "Jim Beam Black", distillery: "Jim Beam", type: "Bourbon", region: "Kentucky", proof: 86, price: 25, flavors: ["peanut", "caramel", "oak", "vanilla"] },
  { name: "Jim Beam Double Oak", distillery: "Jim Beam", type: "Bourbon", region: "Kentucky", proof: 86, price: 28, flavors: ["toasted oak", "vanilla", "caramel", "peanut"] },
  { name: "Basil Hayden Bourbon", distillery: "Jim Beam", type: "Bourbon", region: "Kentucky", proof: 80, price: 45, flavors: ["rye spice", "tea", "vanilla", "oak"] },
  { name: "Basil Hayden Dark Rye", distillery: "Jim Beam", type: "Rye", region: "Kentucky", proof: 80, price: 50, flavors: ["port", "spice", "fruit", "oak"] },
  { name: "Booker's Little Book", distillery: "Jim Beam", type: "American Whiskey", region: "Kentucky", proof: 120, price: 150, flavors: ["oak", "caramel", "grain", "heat"] },
  { name: "Knob Creek 12 Year", distillery: "Jim Beam", type: "Bourbon", region: "Kentucky", proof: 100, price: 75, flavors: ["oak", "peanut", "vanilla", "caramel"] },
  { name: "Knob Creek 15 Year", distillery: "Jim Beam", type: "Bourbon", region: "Kentucky", proof: 100, price: 150, flavors: ["oak", "leather", "caramel", "vanilla"] },
  { name: "Knob Creek 18 Year", distillery: "Jim Beam", type: "Bourbon", region: "Kentucky", proof: 100, price: 200, flavors: ["oak", "tobacco", "caramel", "leather"] },

  { name: "Jack Daniel's Old No. 7", distillery: "Jack Daniel's", type: "Bourbon", region: "Tennessee", proof: 80, price: 25, flavors: ["banana", "charcoal", "vanilla", "caramel"] },
  { name: "Jack Daniel's Bonded", distillery: "Jack Daniel's", type: "Bourbon", region: "Tennessee", proof: 100, price: 38, flavors: ["banana", "oak", "caramel", "spice"] },
  { name: "Jack Daniel's Triple Mash", distillery: "Jack Daniel's", type: "American Whiskey", region: "Tennessee", proof: 100, price: 38, flavors: ["grain", "spice", "banana", "oak"] },
  { name: "Jack Daniel's Single Barrel Select", distillery: "Jack Daniel's", type: "Bourbon", region: "Tennessee", proof: 94, price: 55, flavors: ["banana", "oak", "caramel", "char"] },
  { name: "Jack Daniel's Single Barrel Rye", distillery: "Jack Daniel's", type: "Rye", region: "Tennessee", proof: 94, price: 55, flavors: ["rye spice", "banana", "oak", "vanilla"] },
  { name: "Jack Daniel's 10 Year", distillery: "Jack Daniel's", type: "Bourbon", region: "Tennessee", proof: 97, price: 120, flavors: ["oak", "banana", "caramel", "leather"] },
  { name: "Jack Daniel's 12 Year", distillery: "Jack Daniel's", type: "Bourbon", region: "Tennessee", proof: 107, price: 180, flavors: ["oak", "banana", "dark sugar", "spice"] },

  { name: "Four Roses Yellow Label", distillery: "Four Roses", type: "Bourbon", region: "Kentucky", proof: 80, price: 25, flavors: ["fruit", "honey", "spice", "oak"] },
  { name: "Four Roses Small Batch Limited Edition", distillery: "Four Roses", type: "Bourbon", region: "Kentucky", proof: 110, price: 250, flavors: ["red fruit", "oak", "spice", "vanilla"] },
  { name: "Four Roses Private Selection OBSV", distillery: "Four Roses", type: "Bourbon", region: "Kentucky", proof: 115, price: 95, flavors: ["fruit", "rye spice", "oak", "vanilla"] },
  { name: "Four Roses Private Selection OESK", distillery: "Four Roses", type: "Bourbon", region: "Kentucky", proof: 115, price: 95, flavors: ["floral", "baking spice", "fruit", "oak"] },

  { name: "Michter's 10 Year Bourbon", distillery: "Michter's", type: "Bourbon", region: "Kentucky", proof: 94.4, price: 250, flavors: ["oak", "caramel", "fruit", "vanilla"] },
  { name: "Michter's 10 Year Rye", distillery: "Michter's", type: "Rye", region: "Kentucky", proof: 92.8, price: 250, flavors: ["mint", "citrus", "oak", "spice"] },
  { name: "Michter's Barrel Strength Rye", distillery: "Michter's", type: "Rye", region: "Kentucky", proof: 110, price: 150, flavors: ["mint", "oak", "dark chocolate", "spice"] },
  { name: "Michter's Toasted Barrel Bourbon", distillery: "Michter's", type: "Bourbon", region: "Kentucky", proof: 91.4, price: 150, flavors: ["toasted oak", "marshmallow", "caramel", "vanilla"] },

  { name: "Bardstown Bourbon Company Origin Series Bourbon", distillery: "Bardstown Bourbon Company", type: "Bourbon", region: "Kentucky", proof: 96, price: 45, flavors: ["caramel", "oak", "fruit", "spice"] },
  { name: "Bardstown Bourbon Company Origin Series Wheated", distillery: "Bardstown Bourbon Company", type: "Bourbon", region: "Kentucky", proof: 106, price: 55, flavors: ["wheat", "honey", "oak", "vanilla"] },
  { name: "Bardstown Bourbon Company Origin Series Rye", distillery: "Bardstown Bourbon Company", type: "Rye", region: "Kentucky", proof: 96, price: 55, flavors: ["mint", "spice", "citrus", "oak"] },
  { name: "Bardstown Discovery Series", distillery: "Bardstown Bourbon Company", type: "Bourbon", region: "Kentucky", proof: 115, price: 150, flavors: ["oak", "dark fruit", "caramel", "spice"] },
  { name: "Bardstown Fusion Series", distillery: "Bardstown Bourbon Company", type: "Bourbon", region: "Kentucky", proof: 98, price: 70, flavors: ["caramel", "fruit", "oak", "spice"] },

  { name: "Redwood Empire Pipe Dream", distillery: "Redwood Empire", type: "Bourbon", region: "California", proof: 90, price: 40, flavors: ["vanilla", "oak", "honey", "fruit"] },
  { name: "Redwood Empire Pipe Dream Cask Strength", distillery: "Redwood Empire", type: "Bourbon", region: "California", proof: 116, price: 75, flavors: ["oak", "caramel", "fruit", "heat"] },
  { name: "Redwood Empire Lost Monarch", distillery: "Redwood Empire", type: "American Whiskey", region: "California", proof: 90, price: 40, flavors: ["honey", "mint", "oak", "citrus"] },
  { name: "Redwood Empire Emerald Giant Cask Strength", distillery: "Redwood Empire", type: "Rye", region: "California", proof: 116, price: 75, flavors: ["mint", "citrus", "spice", "oak"] },
  { name: "Redwood Empire Grizzly Beast", distillery: "Redwood Empire", type: "Bourbon", region: "California", proof: 100, price: 90, flavors: ["grain", "oak", "caramel", "spice"] },
  { name: "Redwood Empire Rocket Top", distillery: "Redwood Empire", type: "Rye", region: "California", proof: 100, price: 90, flavors: ["mint", "grain", "spice", "oak"] },

  { name: "Willett Pot Still Reserve", distillery: "Willett", type: "Bourbon", region: "Kentucky", proof: 94, price: 55, flavors: ["floral", "caramel", "oak", "spice"] },
  { name: "Willett Family Estate Bourbon", distillery: "Willett", type: "Bourbon", region: "Kentucky", proof: 120, price: 250, flavors: ["oak", "caramel", "dark fruit", "spice"] },
  { name: "Willett Family Estate Rye", distillery: "Willett", type: "Rye", region: "Kentucky", proof: 115, price: 250, flavors: ["mint", "rye spice", "oak", "citrus"] },
  { name: "Noah's Mill", distillery: "Willett", type: "Bourbon", region: "Kentucky", proof: 114.3, price: 65, flavors: ["oak", "caramel", "spice", "walnut"] },
  { name: "Rowan's Creek", distillery: "Willett", type: "Bourbon", region: "Kentucky", proof: 100.1, price: 45, flavors: ["caramel", "oak", "spice", "fruit"] },

  { name: "Blue Note Juke Joint", distillery: "Blue Note", type: "Bourbon", region: "Tennessee", proof: 93, price: 35, flavors: ["caramel", "oak", "vanilla", "spice"] },
  { name: "Blue Note Crossroads", distillery: "Blue Note", type: "Bourbon", region: "Tennessee", proof: 100, price: 45, flavors: ["toasted oak", "caramel", "vanilla", "spice"] },
  { name: "Nashville Barrel Company Bourbon", distillery: "Nashville Barrel Company", type: "Bourbon", region: "Tennessee", proof: 115, price: 80, flavors: ["oak", "caramel", "dark fruit", "heat"] },
  { name: "Nashville Barrel Company Rye", distillery: "Nashville Barrel Company", type: "Rye", region: "Tennessee", proof: 110, price: 80, flavors: ["mint", "spice", "oak", "citrus"] },
];

aiBottleLibrary.push(...expandedWhiskeyLibrary, ...expressionLineupLibrary);
const uniqueLibrary = new Map();
aiBottleLibrary.forEach((bottle) => {
  uniqueLibrary.set(`${bottle.name}-${bottle.distillery}`.toLowerCase(), bottle);
});
aiBottleLibrary.splice(0, aiBottleLibrary.length, ...uniqueLibrary.values());

const availableDistilleries = [
  ...new Set(
    [
      ...distilleryDatabase,
      ...seedBottles.map((bottle) => bottle.distillery),
      ...Object.values(bottleCatalog).map((bottle) => bottle.distillery),
      ...aiBottleLibrary.map((bottle) => bottle.distillery),
    ]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  ),
];

let bottles = loadBottles();
let pours = loadPours();
let activeFilter = "all";
let activeCategory = "all";
let activePourStyle = "all";
let activeProofBand = "all";
let activeView = "collection";
let quickView = false;
let barcodeDetector;
let scannerStream;
let scannerTimer;
let formPhotoTimer;

const els = {
  bottleGrid: document.querySelector("#bottleGrid"),
  noteList: document.querySelector("#noteList"),
  flavorList: document.querySelector("#flavorList"),
  flavorRadar: document.querySelector("#flavorRadar"),
  shelfList: document.querySelector("#shelfList"),
  recommendation: document.querySelector("#recommendation"),
  resultCount: document.querySelector("#resultCount"),
  inventoryRatio: document.querySelector("#inventoryRatio"),
  totalBottles: document.querySelector("#totalBottles"),
  totalBottlesMeta: document.querySelector("#totalBottlesMeta"),
  openBottles: document.querySelector("#openBottles"),
  averageRating: document.querySelector("#averageRating"),
  estimatedValue: document.querySelector("#estimatedValue"),
  coreBarCount: document.querySelector("#coreBarCount"),
  buyNextCount: document.querySelector("#buyNextCount"),
  topDistillery: document.querySelector("#topDistillery"),
  topDistilleryMeta: document.querySelector("#topDistilleryMeta"),
  openedSealed: document.querySelector("#openedSealed"),
  openedSealedMeta: document.querySelector("#openedSealedMeta"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  toggleQuickView: document.querySelector("#toggleQuickView"),
  fetchBottlePhotos: document.querySelector("#fetchBottlePhotos"),
  bottleDialog: document.querySelector("#bottleDialog"),
  bottleForm: document.querySelector("#bottleForm"),
  formTitle: document.querySelector("#formTitle"),
  deleteBottle: document.querySelector("#deleteBottle"),
  collectionView: document.querySelector("#collectionView"),
  tastingView: document.querySelector("#tastingView"),
  aiToolsView: document.querySelector("#aiToolsView"),
  pourLogView: document.querySelector("#pourLogView"),
  pourDialog: document.querySelector("#pourDialog"),
  pourForm: document.querySelector("#pourForm"),
  pourBottle: document.querySelector("#pourBottle"),
  pourDate: document.querySelector("#pourDate"),
  pourOunces: document.querySelector("#pourOunces"),
  pourRating: document.querySelector("#pourRating"),
  pourOccasion: document.querySelector("#pourOccasion"),
  pourNotes: document.querySelector("#pourNotes"),
  pourList: document.querySelector("#pourList"),
  totalPours: document.querySelector("#totalPours"),
  weeklyPours: document.querySelector("#weeklyPours"),
  weeklyOunces: document.querySelector("#weeklyOunces"),
  bottleAlerts: document.querySelector("#bottleAlerts"),
  pourAnalysis: document.querySelector("#pourAnalysis"),
  tastingBottle: document.querySelector("#tastingBottle"),
  tastingNose: document.querySelector("#tastingNose"),
  tastingPalate: document.querySelector("#tastingPalate"),
  tastingFinish: document.querySelector("#tastingFinish"),
  tastingScore: document.querySelector("#tastingScore"),
  generatedTastingNote: document.querySelector("#generatedTastingNote"),
  scannerDialog: document.querySelector("#scannerDialog"),
  scannerVideo: document.querySelector("#scannerVideo"),
  scannerStatus: document.querySelector("#scannerStatus"),
  scanResult: document.querySelector("#scanResult"),
  manualBarcode: document.querySelector("#manualBarcode"),
  barcodeImage: document.querySelector("#barcodeImage"),
  aiSuggestions: document.querySelector("#aiSuggestions"),
  importCollection: document.querySelector("#importCollection"),
  assistantMessages: document.querySelector("#assistantMessages"),
  assistantPrompt: document.querySelector("#assistantPrompt"),
  assistantForm: document.querySelector("#assistantForm"),
  compareA: document.querySelector("#compareA"),
  compareB: document.querySelector("#compareB"),
  compareOutput: document.querySelector("#compareOutput"),
  quickBottleDialog: document.querySelector("#quickBottleDialog"),
  quickBottleDetail: document.querySelector("#quickBottleDetail"),
  libraryDialog: document.querySelector("#libraryDialog"),
  librarySearch: document.querySelector("#librarySearch"),
  libraryList: document.querySelector("#libraryList"),
  formPhotoPanel: document.querySelector("#formPhotoPanel"),
  formPhotoPreview: document.querySelector("#formPhotoPreview"),
  formPhotoName: document.querySelector("#formPhotoName"),
  formPhotoLinks: document.querySelector("#formPhotoLinks"),
  photoUpload: document.querySelector("#photoUpload"),
  distilleryOptions: document.querySelector("#distilleryOptions"),
};

const fields = {
  id: document.querySelector("#bottleId"),
  name: document.querySelector("#name"),
  distillery: document.querySelector("#distillery"),
  type: document.querySelector("#type"),
  region: document.querySelector("#region"),
  imageUrl: document.querySelector("#imageUrl"),
  proof: document.querySelector("#proof"),
  price: document.querySelector("#price"),
  rating: document.querySelector("#rating"),
  status: document.querySelector("#status"),
  ageStatement: document.querySelector("#ageStatement"),
  storeLocation: document.querySelector("#storeLocation"),
  shelf: document.querySelector("#shelf"),
  quantity: document.querySelector("#quantity"),
  fillLevel: document.querySelector("#fillLevel"),
  openedDate: document.querySelector("#openedDate"),
  category: document.querySelector("#category"),
  pourStyle: document.querySelector("#pourStyle"),
  pourTier: document.querySelector("#pourTier"),
  bottleSize: document.querySelector("#bottleSize"),
  coreBar: document.querySelector("#coreBar"),
  priority: document.querySelector("#priority"),
  flavors: document.querySelector("#flavors"),
  notes: document.querySelector("#notes"),
};

document.querySelector("#openBottleForm").addEventListener("click", () => openForm());
document.querySelector("#inventoryAddBottle").addEventListener("click", () => openForm());
document.querySelector("#openScanner").addEventListener("click", openScanner);
document.querySelector("#inventoryScanBottle").addEventListener("click", openScanner);
document.querySelector("#closeDialog").addEventListener("click", () => els.bottleDialog.close());
document.querySelector("#openLibrary").addEventListener("click", openLibrary);
document.querySelector("#closeLibrary").addEventListener("click", () => els.libraryDialog.close());
els.fetchBottlePhotos?.addEventListener("click", fetchBottlePhotos);
document.querySelector("#openPourForm").addEventListener("click", openPourForm);
document.querySelector("#closePourDialog").addEventListener("click", () => els.pourDialog.close());
document.querySelector("#analyzePours").addEventListener("click", analyzePours);
document.querySelector("#deleteLastPour").addEventListener("click", deleteLastPour);
document.querySelector("#closeScanner").addEventListener("click", closeScanner);
document.querySelector("#startScanner").addEventListener("click", startScanner);
document.querySelector("#lookupBarcode").addEventListener("click", () => lookupBarcode(els.manualBarcode.value));
els.barcodeImage.addEventListener("change", scanUploadedImage);
els.searchInput.addEventListener("input", render);
els.librarySearch.addEventListener("input", renderLibrary);
els.sortSelect.addEventListener("change", render);
els.toggleQuickView.addEventListener("click", () => {
  quickView = !quickView;
  render();
});
els.bottleForm.addEventListener("submit", saveBottle);
els.pourForm.addEventListener("submit", savePour);
els.deleteBottle.addEventListener("click", deleteBottle);
document.querySelector("#buildTastingNote").addEventListener("click", buildGuidedTastingNote);
document.querySelector("#saveTastingNote").addEventListener("click", saveGuidedTastingNote);
document.querySelector("#logTastingPour").addEventListener("click", logGuidedTastingPour);
els.scannerDialog.addEventListener("close", stopScanner);
document.querySelector("#exportCollection").addEventListener("click", exportCollection);
document.querySelector("#refreshAiTools").addEventListener("click", renderAiTools);
els.importCollection.addEventListener("change", importCollection);
els.assistantForm.addEventListener("submit", sendAssistantMessage);
document.querySelectorAll("[data-assistant-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    els.assistantPrompt.value = button.dataset.assistantPrompt;
    sendAssistantMessage();
  });
});
document.querySelectorAll("[data-ai-action]").forEach((button) => {
  button.addEventListener("click", () => runAiTool(button.dataset.aiAction));
});
fields.name.addEventListener("input", () => {
  renderBottleSuggestions();
  updateFormPhotoTools();
  queueAutoFormPhotoSearch();
});
fields.name.addEventListener("focus", renderBottleSuggestions);
fields.distillery.addEventListener("input", () => {
  updateFormPhotoTools();
  queueAutoFormPhotoSearch();
});
fields.imageUrl.addEventListener("input", updateFormPhotoTools);
els.photoUpload.addEventListener("change", uploadBottlePhoto);
document.querySelector("#autoFindPhoto").addEventListener("click", autoFindFormPhoto);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".name-field")) {
    clearBottleSuggestions();
  }
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    syncFilterButtons("[data-filter]", "filter", activeFilter);
    render();
  });
});

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    document.querySelectorAll("[data-category]").forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    render();
  });
});

document.querySelectorAll("[data-pour]").forEach((button) => {
  button.addEventListener("click", () => {
    activePourStyle = button.dataset.pour;
    document.querySelectorAll("[data-pour]").forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    render();
  });
});

document.querySelectorAll("[data-proof]").forEach((button) => {
  button.addEventListener("click", () => {
    activeProofBand = button.dataset.proof;
    document.querySelectorAll("[data-proof]").forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    render();
  });
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    const viewFilters = {
      wishlist: "wishlist",
      "core-bar": "core-bar",
      "buy-next": "buy-next",
      opened: "open",
      finished: "finished",
      dashboard: "all",
      collection: "all",
    };
    if (viewFilters[activeView]) {
      activeFilter = viewFilters[activeView];
      syncFilterButtons("[data-filter]", "filter", activeFilter);
    }
    render();
  });
});

function loadBottles() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const seeded = seedBottles.map(normalizeBottle);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(saved).map(normalizeBottle);
  } catch {
    return seedBottles.map(normalizeBottle);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bottles));
}

function loadPours() {
  const saved = localStorage.getItem(POUR_STORAGE_KEY);
  if (!saved) return [];

  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function persistPours() {
  localStorage.setItem(POUR_STORAGE_KEY, JSON.stringify(pours));
}

function renderDistilleryOptions() {
  els.distilleryOptions.innerHTML = availableDistilleries
    .map((distillery) => `<option value="${escapeHtml(distillery)}"></option>`)
    .join("");
}

function syncFilterButtons(selector, key, value) {
  document.querySelectorAll(selector).forEach((item) => {
    item.classList.toggle("is-selected", item.dataset[key] === value);
  });
}

function proofBandFor(proof) {
  const value = Number(proof || 0);
  if (!value) return "unknown";
  if (value < 80) return "under-80";
  if (value < 100) return "80-99";
  if (value < 115) return "100-114";
  return "115-plus";
}

function visibleBottles() {
  const query = els.searchInput.value.trim().toLowerCase();
  const filtered = bottles.filter((bottle) => {
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "owned" && !["wishlist", "buy-next"].includes(bottle.status)) ||
      (activeFilter === "finished" && (bottle.status === "finished" || bottle.fillLevel === "empty")) ||
      bottle.status === activeFilter ||
      (activeFilter === "core-bar" && bottle.coreBar);
    const matchesCategory = activeCategory === "all" || bottle.category === activeCategory;
    const matchesPour = activePourStyle === "all" || bottle.pourStyle === activePourStyle;
    const matchesProof = activeProofBand === "all" || proofBandFor(bottle.proof) === activeProofBand;
    const haystack = [
      bottle.name,
      bottle.distillery,
      bottle.type,
      bottle.region,
      bottle.ageStatement,
      bottle.storeLocation,
      bottle.category,
      bottle.pourStyle,
      bottle.notes,
      bottle.flavors.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return matchesFilter && matchesCategory && matchesPour && matchesProof && haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    const sort = els.sortSelect.value;
    if (sort === "rating") return Number(b.rating) - Number(a.rating);
    if (sort === "value") return Number(b.price) - Number(a.price);
    if (sort === "proof") return Number(b.proof) - Number(a.proof);
    return a.name.localeCompare(b.name);
  });
}

function render() {
  const shown = visibleBottles();
  const collectionVisible = !["reviews", "dispatch", "pour-log"].includes(activeView);
  els.collectionView.classList.toggle("is-hidden", !collectionVisible);
  els.tastingView.classList.toggle("is-hidden", activeView !== "reviews");
  els.aiToolsView.classList.toggle("is-hidden", activeView !== "dispatch");
  els.pourLogView.classList.toggle("is-hidden", activeView !== "pour-log");

  renderStats();
  renderCards(shown);
  renderFlavorMap();
  renderShelfMap();
  renderRecommendation();
  renderNotes();
  renderTastingWorkspace();
  renderAiTools();
  renderPourLog();
}

function renderStats() {
  const inventory = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  const open = bottles.filter((bottle) => bottle.status === "open");
  const rated = bottles.filter((bottle) => Number(bottle.rating) > 0);
  const sealed = bottles.filter((bottle) => bottle.status === "sealed");
  const distilleries = new Map();
  inventory.forEach((bottle) => {
    distilleries.set(bottle.distillery, (distilleries.get(bottle.distillery) || 0) + Number(bottle.quantity || 1));
  });
  const top = [...distilleries.entries()].sort((a, b) => b[1] - a[1])[0];
  const bottleCount = inventory.reduce((sum, bottle) => sum + Number(bottle.quantity || 1), 0);
  const value = inventory.reduce(
    (sum, bottle) => sum + Number(bottle.price || 0) * Number(bottle.quantity || 1),
    0,
  );
  const avg = rated.length
    ? rated.reduce((sum, bottle) => sum + Number(bottle.rating), 0) / rated.length
    : 0;

  els.totalBottles.textContent = bottleCount;
  els.totalBottlesMeta.textContent = `${inventory.length} owned`;
  els.openBottles.textContent = open.length;
  els.averageRating.textContent = avg.toFixed(1);
  els.estimatedValue.textContent = money(value);
  els.coreBarCount.textContent = bottles.filter((bottle) => bottle.coreBar).length;
  els.buyNextCount.textContent = bottles.filter((bottle) => bottle.status === "buy-next").length;
  els.topDistillery.textContent = top ? top[0] : "—";
  els.topDistilleryMeta.textContent = top ? `${top[1]} bottle${top[1] === 1 ? "" : "s"}` : "no data";
  els.openedSealed.textContent = `${open.length} / ${sealed.length}`;
  const finished = bottles.filter((bottle) => bottle.status === "finished" || bottle.fillLevel === "empty").length;
  els.openedSealedMeta.textContent = inventory.length ? `${finished} finished` : "no owned bottles";
  els.inventoryRatio.textContent = `${visibleBottles().length} of ${bottleCount} bottles`;
}

function renderCards(shown) {
  els.resultCount.textContent = `${shown.length} shown`;
  els.toggleQuickView.textContent = quickView ? "Card View" : "Quick View";
  els.bottleGrid.classList.toggle("quick-view", quickView);

  if (!shown.length) {
    els.bottleGrid.innerHTML = `<div class="empty-state">No bottles match the current search and filters.</div>`;
    return;
  }

  if (quickView) {
    els.bottleGrid.innerHTML = `
      <div class="quick-list" role="table" aria-label="Quick bottle view">
        <div class="quick-row quick-head" role="row">
          <span>Bottle</span>
          <span>Proof</span>
          <span>Rating</span>
          <span>Status</span>
          <span>Shelf</span>
          <span>Flavor</span>
          <span></span>
        </div>
        ${shown
          .map(
            (bottle) => `
              <div class="quick-row" role="row" data-quick="${bottle.id}">
                <div class="quick-bottle-cell">
                  <img src="${bottleImage(bottle)}" alt="${escapeHtml(bottle.name)} bottle" />
                  <div>
                    <strong>${escapeHtml(bottle.name)}</strong>
                    <small>${escapeHtml(bottle.type)} · ${numberOrDash(bottle.proof)} proof</small>
                    <small>${labelBottleSize(bottle.bottleSize)}${bottle.ageStatement ? ` · ${escapeHtml(bottle.ageStatement)}` : ""}</small>
                  </div>
                </div>
                <span>${numberOrDash(bottle.proof)}</span>
                <span>${numberOrDash(bottle.rating)}</span>
                <span class="status-pill ${bottle.status}">${labelStatus(bottle.status)}</span>
                <span>${escapeHtml(bottle.shelf || "Main bar")} · ${labelBottleSize(bottle.bottleSize)} · ${labelFillLevel(bottle.fillLevel)}</span>
                <div class="mini-radar">${renderBottleFlavorRadar(bottle)}</div>
                <div class="quick-actions">
                  <button class="secondary-action" type="button" data-edit="${bottle.id}">Edit</button>
                  <button class="secondary-action" type="button" data-toggle="${bottle.id}">${bottle.status === "open" ? "Seal" : "Open"}</button>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
    bindBottleActions();
    return;
  }

  els.bottleGrid.innerHTML = shown
    .map(
      (bottle) => `
        <article class="bottle-card" data-quick="${bottle.id}">
          <div class="bottle-top">
            <img class="bottle-photo" src="${bottleImage(bottle)}" alt="${escapeHtml(bottle.name)} bottle" />
            <div>
              <h3>${escapeHtml(bottle.name)}</h3>
              <p>${escapeHtml(bottle.distillery)} · ${escapeHtml(bottle.region || "Unknown region")}</p>
            </div>
            <span class="status-pill ${bottle.status}">${labelStatus(bottle.status)}</span>
          </div>
          <span class="type-pill">${escapeHtml(bottle.type)}</span>
          <div class="flavor-row">
            ${bottle.flavors.slice(0, 4).map((flavor) => `<span class="flavor-chip">${escapeHtml(flavor)}</span>`).join("")}
          </div>
          <div class="bottle-radar">
            ${renderBottleFlavorRadar(bottle)}
          </div>
          <p>${escapeHtml(bottle.notes || "No notes yet.")}</p>
          <div class="shelf-line">
            <span>${escapeHtml(bottle.shelf || "Main bar")}</span>
            <span>${labelFillLevel(bottle.fillLevel)}</span>
            <span>Qty ${Number(bottle.quantity || 1)}</span>
            <span>${labelBottleSize(bottle.bottleSize)}</span>
            ${bottle.ageStatement ? `<span>${escapeHtml(bottle.ageStatement)}</span>` : ""}
            ${bottle.storeLocation ? `<span>${escapeHtml(bottle.storeLocation)}</span>` : ""}
            <span>${labelCategory(bottle.category)}</span>
            <span>${labelPourStyle(bottle.pourStyle)}</span>
            <span>${labelPourTier(bottle.pourTier)}</span>
            ${bottle.coreBar ? `<span>Core Bar</span>` : ""}
          </div>
          <div class="bottle-meta">
            <div><span>Proof</span><strong>${numberOrDash(bottle.proof)}</strong></div>
            <div><span>Paid</span><strong>${money(bottle.price || 0)}</strong></div>
            <div><span>Rating</span><strong>${numberOrDash(bottle.rating)}</strong></div>
          </div>
          <div class="card-actions">
            <button class="secondary-action" type="button" data-edit="${bottle.id}">Edit</button>
            <button class="secondary-action" type="button" data-toggle="${bottle.id}">${bottle.status === "open" ? "Seal" : "Open"}</button>
          </div>
        </article>
      `,
    )
    .join("");

  bindBottleActions();
}

function bindBottleActions() {
  document.querySelectorAll("[data-quick]").forEach((item) => {
    item.addEventListener("click", () => openBottleQuick(item.dataset.quick));
  });

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openForm(button.dataset.edit);
    });
  });

  document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleBottle(button.dataset.toggle);
    });
  });
}

function openLibrary() {
  els.librarySearch.value = "";
  renderLibrary();
  els.libraryDialog.showModal();
}

function renderLibrary() {
  const query = els.librarySearch.value.trim().toLowerCase();
  const owned = new Set(bottles.map((bottle) => `${bottle.name}-${bottle.distillery}`.toLowerCase()));
  const matches = aiBottleLibrary
    .filter((bottle) => {
      const haystack = `${bottle.name} ${bottle.distillery} ${bottle.type} ${bottle.region} ${bottle.flavors.join(" ")}`.toLowerCase();
      return !query || haystack.includes(query);
    })
    .slice(0, 80);

  els.libraryList.innerHTML = matches.length
    ? matches
        .map((bottle, index) => {
          const key = `${bottle.name}-${bottle.distillery}`.toLowerCase();
          return `
            <article class="library-item">
              <img class="library-photo" src="${bottleImage(bottle)}" alt="${escapeHtml(bottle.name)} bottle" />
              <div>
                <strong>${escapeHtml(bottle.name)}</strong>
                <span>${escapeHtml(bottle.distillery)} · ${escapeHtml(bottle.type)} · ${numberOrDash(bottle.proof)} proof · ${money(bottle.price)}</span>
              </div>
              ${renderPhotoSourceLinks(bottle, "compact")}
              <button class="secondary-action" type="button" data-library-index="${index}" ${owned.has(key) ? "disabled" : ""}>${owned.has(key) ? "Added" : "Add"}</button>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">No library bottles match that search.</div>`;

  els.libraryList.querySelectorAll("[data-library-index]").forEach((button) => {
    button.addEventListener("click", () => addLibraryBottle(matches[Number(button.dataset.libraryIndex)]));
  });
}

function addLibraryBottle(source) {
  bottles = [
    normalizeBottle({
      ...source,
      id: crypto.randomUUID(),
      rating: 0,
      status: "sealed",
      notes: "Added from open whiskey library.",
    }),
    ...bottles,
  ];
  persist();
  renderLibrary();
  render();
}

function renderFlavorMap() {
  renderFlavorRadar();
  const counts = new Map();
  bottles
    .filter((bottle) => bottle.status !== "wishlist")
    .flatMap((bottle) => bottle.flavors)
    .forEach((flavor) => counts.set(flavor, (counts.get(flavor) || 0) + 1));

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top[0]?.[1] || 1;

  els.flavorList.innerHTML = top.length
    ? top
        .map(
          ([flavor, count]) => `
            <div class="flavor-bar">
              <span>${escapeHtml(flavor)}</span>
              <i style="width: ${Math.max(18, (count / max) * 100)}%"></i>
              <strong>${count}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">Add flavor tags to build your profile.</div>`;
}

function renderFlavorRadar() {
  const axes = flavorAxes();
  const inventory = bottles.filter((bottle) => bottle.status !== "wishlist");
  const scores = axes.map((axis) => scoreFlavorAxis(inventory, axis));
  const max = Math.max(...scores, 1);
  const center = 120;
  const radius = 82;
  const points = scores.map((score, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
    const value = Math.max(0.18, score / max);
    return `${center + Math.cos(angle) * radius * value},${center + Math.sin(angle) * radius * value}`;
  });
  const rings = [0.33, 0.66, 1]
    .map((scale) => polygonPoints(axes.length, center, radius * scale))
    .map((ring) => `<polygon points="${ring}" class="radar-ring"></polygon>`)
    .join("");
  const spokes = axes
    .map((_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
      return `<line x1="${center}" y1="${center}" x2="${center + Math.cos(angle) * radius}" y2="${center + Math.sin(angle) * radius}" class="radar-spoke"></line>`;
    })
    .join("");
  const labels = axes
    .map((axis, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
      return `<text x="${center + Math.cos(angle) * 105}" y="${center + Math.sin(angle) * 105}" text-anchor="middle" dominant-baseline="middle">${axis.label}</text>`;
    })
    .join("");

  els.flavorRadar.innerHTML = `
    <svg viewBox="0 0 240 240" role="img" aria-label="Flavor radar profile">
      ${rings}
      ${spokes}
      <polygon points="${points.join(" ")}" class="radar-shape"></polygon>
      ${labels}
    </svg>
  `;
}

function renderBottleFlavorRadar(bottle) {
  const axes = flavorAxes();
  const scores = axes.map((axis) => scoreFlavorAxis([bottle], axis));
  const max = Math.max(...scores, 1);
  const center = 60;
  const radius = 40;
  const points = scores.map((score, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
    const value = Math.max(0.12, score / max);
    return `${center + Math.cos(angle) * radius * value},${center + Math.sin(angle) * radius * value}`;
  });
  const labels = axes
    .map((axis, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
      return `<text x="${center + Math.cos(angle) * 51}" y="${center + Math.sin(angle) * 51}" text-anchor="middle" dominant-baseline="middle">${axis.label.slice(0, 2)}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(bottle.name)} flavor radar">
      <polygon points="${polygonPoints(axes.length, center, radius)}" class="radar-ring"></polygon>
      <polygon points="${points.join(" ")}" class="radar-shape"></polygon>
      ${labels}
    </svg>
  `;
}

function flavorAxes() {
  return [
    { key: "sweet", label: "Sweet", terms: ["caramel", "vanilla", "honey", "toffee", "brown sugar", "maple", "molasses", "marshmallow"] },
    { key: "oak", label: "Oak", terms: ["oak", "char", "toast", "toasted", "leather", "tobacco", "wood"] },
    { key: "spice", label: "Spice", terms: ["spice", "pepper", "cinnamon", "clove", "mint", "rye", "heat", "ginger"] },
    { key: "fruit", label: "Fruit", terms: ["fruit", "cherry", "orange", "apple", "pear", "citrus", "raisin", "apricot", "banana"] },
    { key: "smoke", label: "Smoke", terms: ["smoke", "peat", "brine", "iodine", "seaweed", "charcoal", "sea salt"] },
    { key: "grain", label: "Grain", terms: ["grain", "wheat", "corn", "malt", "cornbread", "grass", "herbal"] },
  ];
}

function scoreFlavorAxis(items, axis) {
  return items.reduce((sum, bottle) => {
    const text = `${bottle.flavors.join(" ")} ${bottle.notes || ""} ${bottle.type} ${bottle.category}`.toLowerCase();
    return sum + axis.terms.reduce((axisSum, term) => axisSum + (text.includes(term) ? 1 : 0), 0);
  }, 0);
}

function polygonPoints(count, center, radius) {
  return Array.from({ length: count })
    .map((_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
      return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
    })
    .join(" ");
}

function renderShelfMap() {
  const shelves = new Map();
  bottles
    .filter((bottle) => bottle.status !== "wishlist")
    .forEach((bottle) => {
      const shelf = bottle.shelf || "Main bar";
      const entry = shelves.get(shelf) || { count: 0, value: 0, low: 0 };
      entry.count += Number(bottle.quantity || 1);
      entry.value += Number(bottle.price || 0) * Number(bottle.quantity || 1);
      if (["low", "empty"].includes(bottle.fillLevel)) entry.low += 1;
      shelves.set(shelf, entry);
    });

  const rows = [...shelves.entries()].sort((a, b) => b[1].value - a[1].value);
  els.shelfList.innerHTML = rows.length
    ? rows
        .map(
          ([shelf, entry]) => `
            <div class="shelf-item">
              <div>
                <strong>${escapeHtml(shelf)}</strong>
                <span>${entry.count} bottles · ${money(entry.value)}</span>
              </div>
              ${entry.low ? `<em>${entry.low} low</em>` : `<em>Stocked</em>`}
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">Add shelf locations to map your collection.</div>`;
}

function renderRecommendation() {
  const candidates = bottles
    .filter((bottle) => bottle.status === "open" && Number(bottle.rating) > 0)
    .sort((a, b) => Number(b.rating) - Number(a.rating));
  const pick = candidates[0] || bottles.find((bottle) => bottle.status === "open");

  els.recommendation.innerHTML = pick
    ? `<strong>${escapeHtml(pick.name)}</strong><span>${escapeHtml(pick.type)} · ${numberOrDash(pick.proof)} proof · ${escapeHtml(pick.flavors.slice(0, 3).join(", "))}</span>`
    : `<span>Open a bottle to get a recommendation.</span>`;
}

function renderNotes() {
  const notes = bottles
    .filter((bottle) => bottle.notes.trim())
    .sort((a, b) => Number(b.rating) - Number(a.rating));

  els.noteList.innerHTML = notes.length
    ? notes
        .map(
          (bottle) => `
            <article class="note-item">
              <strong>${escapeHtml(bottle.name)}</strong>
              <span>${escapeHtml(bottle.distillery)} · ${labelStatus(bottle.status)} · Rating ${numberOrDash(bottle.rating)}</span>
              <p>${escapeHtml(bottle.notes)}</p>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">No tasting notes yet.</div>`;
}

function renderTastingWorkspace() {
  const available = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  const current = els.tastingBottle.value;
  els.tastingBottle.innerHTML = available.length
    ? available
        .map((bottle) => `<option value="${escapeHtml(bottle.id)}">${escapeHtml(bottle.name)} · ${escapeHtml(bottle.distillery)}</option>`)
        .join("")
    : `<option value="">No bottles available</option>`;
  els.tastingBottle.value = current || available[0]?.id || "";
}

function buildGuidedTastingNote() {
  const bottle = bottles.find((item) => item.id === els.tastingBottle.value);
  if (!bottle) {
    els.generatedTastingNote.textContent = "Choose a bottle first.";
    return "";
  }

  const nose = els.tastingNose.value.trim() || bottle.flavors.slice(0, 2).join(", ");
  const palate = els.tastingPalate.value.trim() || bottle.flavors.slice(1, 4).join(", ");
  const finish =
    els.tastingFinish.value.trim() ||
    (Number(bottle.proof) >= 110 ? "warm, lingering proof with oak and spice" : "balanced, clean, and approachable");
  const score = els.tastingScore.value ? ` Rating: ${Number(els.tastingScore.value).toFixed(1)}/10.` : "";
  const note = `${bottle.name} opens with ${nose} on the nose. The palate brings ${palate}, leading into a finish of ${finish}.${score}`;
  els.generatedTastingNote.textContent = note;
  return note;
}

function saveGuidedTastingNote() {
  const note = buildGuidedTastingNote();
  if (!note) return;
  bottles = bottles.map((bottle) => {
    if (bottle.id !== els.tastingBottle.value) return bottle;
    return {
      ...bottle,
      notes: note,
      rating: Number(els.tastingScore.value || bottle.rating || 0),
      status: bottle.status === "sealed" ? "open" : bottle.status,
      openedDate: bottle.openedDate || new Date().toISOString().slice(0, 10),
    };
  });
  persist();
  render();
}

function logGuidedTastingPour() {
  const note = buildGuidedTastingNote();
  if (!note || !els.tastingBottle.value) return;
  pours = [
    {
      id: crypto.randomUUID(),
      bottleId: els.tastingBottle.value,
      date: new Date().toISOString().slice(0, 10),
      ounces: 1.5,
      rating: Number(els.tastingScore.value || 0),
      occasion: "Guided tasting",
      notes: note,
    },
    ...pours,
  ];
  persistPours();
  saveGuidedTastingNote();
}

function renderPourLog() {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const recent = pours.filter((pour) => new Date(pour.date) >= weekStart);
  const openedAlerts = bottles.filter((bottle) => bottle.status === "open" && ["low", "empty"].includes(bottle.fillLevel));

  els.totalPours.textContent = pours.length;
  els.weeklyPours.textContent = recent.length;
  els.weeklyOunces.textContent = recent.reduce((sum, pour) => sum + Number(pour.ounces || 0), 0).toFixed(1);
  els.bottleAlerts.textContent = openedAlerts.length;

  els.pourList.innerHTML = pours.length
    ? [...pours]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((pour) => {
          const bottle = bottles.find((item) => item.id === pour.bottleId);
          return `
            <article class="pour-item">
              <div>
                <strong>${escapeHtml(bottle?.name || "Unknown bottle")}</strong>
                <span>${formatDate(pour.date)} · ${Number(pour.ounces || 0).toFixed(1)} oz · Rating ${numberOrDash(pour.rating)}</span>
              </div>
              <p>${escapeHtml(pour.occasion || "Pour session")}</p>
              <p>${escapeHtml(pour.notes || "No notes logged.")}</p>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">No pours logged yet. Hit "Log Pour" to start tracking your sessions.</div>`;
}

function openPourForm(selectedId = "") {
  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  els.pourBottle.innerHTML = owned.length
    ? owned
        .map((bottle) => `<option value="${escapeHtml(bottle.id)}">${escapeHtml(bottle.name)} · ${escapeHtml(bottle.distillery)}</option>`)
        .join("")
    : `<option value="">No bottles available</option>`;
 els.pourDate.value = new Date().toISOString().slice(0, 10);
  els.pourBottle.value = selectedId || owned[0]?.id || "";
  els.pourOunces.value = "1.5";
  els.pourRating.value = "";
  els.pourOccasion.value = "";
  els.pourNotes.value = "";
  els.pourDialog.showModal();
}

function savePour(event) {
  event.preventDefault();
  if (!els.pourBottle.value) return;

  pours = [
    {
      id: crypto.randomUUID(),
      bottleId: els.pourBottle.value,
      date: els.pourDate.value || new Date().toISOString().slice(0, 10),
      ounces: Number(els.pourOunces.value || 1.5),
      rating: Number(els.pourRating.value || 0),
      occasion: els.pourOccasion.value.trim(),
      notes: els.pourNotes.value.trim(),
    },
    ...pours,
  ];
  persistPours();
  els.pourDialog.close();
  render();
}

function deleteLastPour() {
  pours = pours.slice(1);
  persistPours();
  els.pourDialog.close();
  render();
}

function analyzePours() {
  if (!pours.length) {
    els.pourAnalysis.innerHTML = aiMessage("No pours logged yet. Log a few sessions and I can analyze your habits.");
    return;
  }

  const byBottle = new Map();
  pours.forEach((pour) => byBottle.set(pour.bottleId, (byBottle.get(pour.bottleId) || 0) + 1));
  const favoriteId = [...byBottle.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const favorite = bottles.find((bottle) => bottle.id === favoriteId);
  const avgOunces = pours.reduce((sum, pour) => sum + Number(pour.ounces || 0), 0) / pours.length;
  els.pourAnalysis.innerHTML = aiMessage(
    `Pour analysis: your most repeated bottle is ${escapeHtml(favorite?.name || "unknown")}. Average pour size is ${avgOunces.toFixed(1)} oz, and your logged notes suggest ${topFlavorText() || "your preferred profile"} is driving the shelf.`,
  );
}

function renderAiTools() {
  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  const options = [`<option value="">— Select a bottle —</option>`]
    .concat(
      owned.map(
        (bottle) =>
          `<option value="${escapeHtml(bottle.id)}">${escapeHtml(bottle.name)} · ${escapeHtml(bottle.distillery)}</option>`,
      ),
    )
    .join("");

  const previousA = els.compareA.value;
  const previousB = els.compareB.value;
  els.compareA.innerHTML = options;
  els.compareB.innerHTML = options;
  els.compareA.value = previousA;
  els.compareB.value = previousB;

  if (!els.assistantMessages.innerHTML) {
    appendAssistantMessage(
      "assistant",
      `Dispatch ready. What's the call tonight? I can pick the right bottle by mood, occasion, flavor profile, or tier.`,
    );
  }
}

function runAiTool(action) {
  if (action === "compare") {
    els.compareOutput.innerHTML = renderBottleComparison();
  }
}

function sendAssistantMessage(event) {
  event?.preventDefault();
  const prompt = els.assistantPrompt.value.trim();
  if (!prompt) return;

  appendAssistantMessage("user", prompt);
  els.assistantPrompt.value = "";
  appendAssistantMessage("assistant", routeAssistantPrompt(prompt));
}

function routeAssistantPrompt(prompt) {
  const intent = prompt.toLowerCase();
  if (intent.includes("buy") || intent.includes("missing") || intent.includes("add")) {
    return renderBuyRecommendations();
  }
  if (intent.includes("tasting") || intent.includes("note") || intent.includes("nose") || intent.includes("palate")) {
    return renderTastingNote(prompt);
  }
  if (intent.includes("compare") || intent.includes("versus") || intent.includes(" vs ")) {
    return renderComparisonFromPrompt(prompt);
  }
  if (intent.includes("vibe") || intent.includes("tonight") || intent.includes("mood") || intent.includes("sip")) {
    return renderDispatchPick(prompt);
  }
  return renderExpertAnswer(prompt);
}

function appendAssistantMessage(role, html) {
  const message = document.createElement("div");
  message.className = `assistant-message ${role}`;
  message.innerHTML = role === "user" ? `<p>${escapeHtml(html)}</p>` : html;
  els.assistantMessages.append(message);
  els.assistantMessages.scrollTop = els.assistantMessages.scrollHeight;
}

function renderExpertAnswer(prompt) {
  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  const highRated = [...owned].sort((a, b) => Number(b.rating) - Number(a.rating))[0];
  const highProof = [...owned].filter((bottle) => Number(bottle.proof) >= 110).sort((a, b) => Number(b.rating) - Number(a.rating))[0];
  const ryeGap = !owned.some((bottle) => bottle.type === "Rye");
  const question = prompt.trim() || "What should I try next based on my collection?";
  const recommendation = highProof || highRated || owned[0];

  if (!recommendation) {
    return aiMessage("Add a few bottles first and I can make collection-aware recommendations.");
  }

  return aiMessage(
    `For "${escapeHtml(question)}", I would start with ${escapeHtml(recommendation.name)}. It fits your current profile because your cabinet leans toward ${topFlavorText()} and ${labelCategory(recommendation.category).toLowerCase()} pours. ${
      ryeGap ? "You are light on rye, so a good rye would round out the bar." : "You already have rye represented, so compare proof and mood before pouring."
    }`,
  );
}

function renderBuyRecommendations() {
  const ownedNames = new Set(bottles.map((bottle) => bottle.name.toLowerCase()));
  const ownedTypes = new Set(bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status)).map((bottle) => bottle.type));
  const picks = aiBottleLibrary
    .filter((bottle) => !ownedNames.has(bottle.name.toLowerCase()))
    .map((bottle) => ({
      ...bottle,
      score:
        (Number(bottle.proof) >= 100 ? 2 : 0) +
        (ownedTypes.has(bottle.type) ? 1 : 2) +
        (bottle.flavors.some((flavor) => topFlavorText().includes(flavor)) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return picks.length
    ? picks
        .map(
          (pick) => `
            <div class="ai-pick">
              <strong>${escapeHtml(pick.name)}</strong>
              <span>${escapeHtml(pick.distillery)} · ${escapeHtml(pick.type)} · ${numberOrDash(pick.proof)} proof · about ${money(pick.price)}</span>
            </div>
          `,
        )
        .join("")
    : aiMessage("Your catalog has every starter recommendation covered.");
}

function renderTastingNote(input) {
  const text = input.trim();
  const owned = bottles.filter((bottle) => bottle.status === "open");
  const bottle = owned.sort((a, b) => Number(b.rating) - Number(a.rating))[0] || bottles[0];
  if (!bottle && !text) return aiMessage("Open a bottle or describe what you are tasting, and I will build a note.");

  const descriptors = text || bottle.flavors.join(", ");
  return aiMessage(
    `Professional note: ${escapeHtml(bottle?.name || "This pour")} opens with ${escapeHtml(descriptors)} on the nose. The palate carries ${escapeHtml((bottle?.flavors || ["oak", "caramel", "spice"]).slice(0, 3).join(", "))}, with a finish that reads ${Number(bottle?.proof || 90) >= 110 ? "warm, bold, and lingering" : "balanced, easy, and clean"}. Suggested rating range: ${Number(bottle?.rating || 8).toFixed(1)}-${Math.min(10, Number(bottle?.rating || 8) + 0.4).toFixed(1)}.`,
  );
}

function renderDispatchPick(prompt) {
  const vibe = prompt.toLowerCase();
  const open = bottles.filter((bottle) => bottle.status === "open");
  let candidates = open.length ? open : bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  if (vibe.includes("special") || vibe.includes("reserve")) {
    candidates = candidates.filter((bottle) => bottle.pourStyle === "special" || bottle.pourTier === "reserve" || bottle.coreBar);
  }
  if (vibe.includes("vip")) candidates = candidates.filter((bottle) => bottle.pourTier === "vip");
  if (vibe.includes("crowd")) candidates = candidates.filter((bottle) => bottle.pourTier === "crowd");
  if (vibe.includes("strong") || vibe.includes("proof")) candidates = candidates.filter((bottle) => Number(bottle.proof) >= 100);
  if (vibe.includes("chill") || vibe.includes("easy")) candidates = candidates.filter((bottle) => Number(bottle.proof) < 110);

  const pick = candidates.sort((a, b) => Number(b.rating) - Number(a.rating))[0] || bottles[0];
  return pick
    ? aiMessage(`Dispatch pick: pour ${escapeHtml(pick.name)}. It gives you ${escapeHtml(pick.flavors.slice(0, 3).join(", "))}, lands at ${numberOrDash(pick.proof)} proof, and fits a ${labelPourTier(pick.pourTier).toLowerCase()} / ${labelPourStyle(pick.pourStyle).toLowerCase()} moment.`)
    : aiMessage("Add inventory first and Dispatch can pick from your shelf.");
}

function renderBottleComparison() {
  const a = bottles.find((bottle) => bottle.id === els.compareA.value);
  const b = bottles.find((bottle) => bottle.id === els.compareB.value);
  if (!a || !b) return aiMessage("Select two bottles to compare.");
  if (a.id === b.id) return aiMessage("Choose two different bottles for a useful comparison.");

  return `
    <div class="compare-result">
      <div><strong>${escapeHtml(a.name)}</strong><span>${numberOrDash(a.proof)} proof · ${labelPourStyle(a.pourStyle)} · ${escapeHtml(a.flavors.join(", "))}</span></div>
      <div><strong>${escapeHtml(b.name)}</strong><span>${numberOrDash(b.proof)} proof · ${labelPourStyle(b.pourStyle)} · ${escapeHtml(b.flavors.join(", "))}</span></div>
      <p>${escapeHtml(a.name)} is ${Number(a.proof) > Number(b.proof) ? "the bolder proof play" : "the softer side-by-side pour"}, while ${escapeHtml(b.name)} brings ${Number(b.rating) > Number(a.rating) ? "the higher logged rating" : "a useful contrast in profile"}.</p>
    </div>
  `;
}

function renderComparisonFromPrompt(prompt) {
  const named = bottles.filter((bottle) => prompt.toLowerCase().includes(bottle.name.toLowerCase()));
  if (named.length >= 2) {
    const [a, b] = named;
    return `
      <div class="compare-result">
        <div><strong>${escapeHtml(a.name)}</strong><span>${numberOrDash(a.proof)} proof · ${labelPourStyle(a.pourStyle)} · ${escapeHtml(a.flavors.join(", "))}</span></div>
        <div><strong>${escapeHtml(b.name)}</strong><span>${numberOrDash(b.proof)} proof · ${labelPourStyle(b.pourStyle)} · ${escapeHtml(b.flavors.join(", "))}</span></div>
        <p>${escapeHtml(a.name)} reads ${Number(a.proof) > Number(b.proof) ? "bolder and hotter" : "softer and more measured"} next to ${escapeHtml(b.name)}. I would pour them side-by-side from lower proof to higher proof.</p>
      </div>
    `;
  }
  return aiMessage("Tell me two bottle names, or use the comparison selectors below.");
}

function topFlavorText() {
  const counts = new Map();
  bottles.flatMap((bottle) => bottle.flavors || []).forEach((flavor) => counts.set(flavor, (counts.get(flavor) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([flavor]) => flavor)
    .join(", ");
}

function aiMessage(text) {
  return `<p>${text}</p>`;
}

function openBottleQuick(id) {
  const bottle = bottles.find((item) => item.id === id);
  if (!bottle) return;
  els.quickBottleDetail.innerHTML = `
    <div class="form-head">
      <div>
        <p>Quick view</p>
        <h2>${escapeHtml(bottle.name)}</h2>
      </div>
      <button class="icon-button" id="closeQuickBottle" type="button" aria-label="Close">×</button>
    </div>
    <div class="quick-detail-grid">
      <img class="quick-detail-photo" src="${bottleImage(bottle)}" alt="${escapeHtml(bottle.name)} bottle" />
      <div>
        <span class="status-pill ${bottle.status}">${labelStatus(bottle.status)}</span>
        <p>${escapeHtml(bottle.distillery)} · ${escapeHtml(bottle.type)} · ${escapeHtml(bottle.region || "Unknown region")}</p>
        <div class="bottle-meta">
          <div><span>Proof</span><strong>${numberOrDash(bottle.proof)}</strong></div>
          <div><span>Paid</span><strong>${money(bottle.price || 0)}</strong></div>
          <div><span>Rating</span><strong>${numberOrDash(bottle.rating)}</strong></div>
        </div>
        <div class="shelf-line">
          <span>${escapeHtml(bottle.shelf || "Main bar")}</span>
          <span>${labelFillLevel(bottle.fillLevel)}</span>
          <span>${labelBottleSize(bottle.bottleSize)}</span>
          ${bottle.ageStatement ? `<span>${escapeHtml(bottle.ageStatement)}</span>` : ""}
          ${bottle.storeLocation ? `<span>${escapeHtml(bottle.storeLocation)}</span>` : ""}
          <span>${labelCategory(bottle.category)}</span>
          <span>${labelPourStyle(bottle.pourStyle)}</span>
          <span>${labelPourTier(bottle.pourTier)}</span>
        </div>
      </div>
      <div class="bottle-radar">${renderBottleFlavorRadar(bottle)}</div>
    </div>
    <p>${escapeHtml(bottle.notes || "No notes yet.")}</p>
    <div class="photo-source-panel">
      <span>Find actual bottle photo</span>
      ${renderPhotoSourceLinks(bottle)}
    </div>
    <div class="form-actions">
      <button class="secondary-action" id="quickEditBottle" type="button">Edit Bottle</button>
      <button class="primary-action" id="quickLogPour" type="button">Log Pour</button>
    </div>
  `;
  els.quickBottleDialog.showModal();
  document.querySelector("#closeQuickBottle").addEventListener("click", () => els.quickBottleDialog.close());
  document.querySelector("#quickEditBottle").addEventListener("click", () => {
    els.quickBottleDialog.close();
    openForm(id);
  });
  document.querySelector("#quickLogPour").addEventListener("click", () => {
    els.quickBottleDialog.close();
    openPourForm(id);
  });
}

function bottleImage(bottle) {
  if (bottle.imageUrl) return bottle.imageUrl;
  const curatedImage = getCuratedBottleImage(bottle);
  if (curatedImage) return curatedImage;
  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
}

async function fetchBottlePhotos() {
  els.fetchBottlePhotos.textContent = "Fetching...";
  els.fetchBottlePhotos.disabled = true;
  let updated = 0;

  for (const bottle of bottles) {
    if (bottle.imageUrl) continue;
    const imageUrl = await findPublicBottleImage(bottle);
    if (imageUrl) {
      bottle.imageUrl = imageUrl;
      updated += 1;
    }
  }

  persist();
  render();
  els.fetchBottlePhotos.disabled = false;
  els.fetchBottlePhotos.textContent = updated ? `Fetched ${updated}` : "Fetch Photos";
}

async function findPublicBottleImage(bottle) {
  const query = encodeURIComponent(`${bottle.name} ${bottle.distillery} whiskey bottle`);
  const sources = [
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=5`,
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json&origin=*`,
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source);
      const data = await response.json();
      const image = source.includes("openfoodfacts")
        ? data.products?.find((product) => product.image_front_url || product.image_url)
        : Object.values(data.query?.pages || {}).find((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url);
      const url = image?.image_front_url || image?.image_url || image?.imageinfo?.[0]?.thumburl || image?.imageinfo?.[0]?.url;
      if (url && isLikelyImageUrl(url)) return url;
    } catch {
      // Public image APIs can rate-limit or block CORS; keep the local fallback intact.
    }
  }

  return "";
}

function googleImageSearchUrl(bottle) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${bottle.name} ${bottle.distillery} bottle`)}`;
}

function photoSourceLinks(bottle) {
  const photoQuery = `${bottle.name} ${bottle.distillery} bottle`;
  const shoppingQuery = `${bottle.name} ${bottle.distillery}`;
  return [
    ["Google", googleImageSearchUrl(bottle)],
    ["Bing", `https://www.bing.com/images/search?q=${encodeURIComponent(photoQuery)}`],
    ["DuckDuckGo", `https://duckduckgo.com/?q=${encodeURIComponent(photoQuery)}&iax=images&ia=images`],
    ["Total Wine", `https://www.totalwine.com/search/all?text=${encodeURIComponent(shoppingQuery)}`],
    ["Web", `https://www.google.com/search?q=${encodeURIComponent(`${photoQuery} official bottle photo`)}`],
  ];
}

function renderPhotoSourceLinks(bottle, variant = "") {
  const classes = variant === "compact" ? "photo-source-links is-compact" : "photo-source-links";
  return `
    <div class="${classes}">
      ${photoSourceLinks(bottle)
        .map(([label, href]) => `<a class="secondary-action" href="${href}" target="_blank" rel="noreferrer">${label}</a>`)
        .join("")}
    </div>
  `;
}

function isLikelyImageUrl(url) {
  return /^https?:\/\//.test(url) && !url.includes("svg");
}

function openForm(id = "") {
  const bottle = typeof id === "object" ? id : bottles.find((item) => item.id === id);
  const isExisting = typeof id === "string" && Boolean(id);
  els.formTitle.textContent = isExisting ? "Edit Bottle" : "Add Bottle";
  els.deleteBottle.classList.toggle("is-hidden", !isExisting);

  fields.id.value = bottle?.id || "";
  fields.name.value = bottle?.name || "";
  fields.distillery.value = bottle?.distillery || "";
  fields.type.value = bottle?.type || "Bourbon";
  fields.region.value = bottle?.region || "";
  fields.imageUrl.value = bottle?.imageUrl || "";
  fields.proof.value = bottle?.proof || "";
  fields.price.value = bottle?.price || "";
  fields.rating.value = bottle?.rating || "";
  fields.status.value = bottle?.status || "sealed";
  fields.ageStatement.value = bottle?.ageStatement || "";
  fields.storeLocation.value = bottle?.storeLocation || "";
  fields.shelf.value = bottle?.shelf || "Main bar";
  fields.quantity.value = bottle?.quantity || 1;
  fields.fillLevel.value = bottle?.fillLevel || "full";
  fields.openedDate.value = bottle?.openedDate || "";
  fields.category.value = bottle?.category || "daily";
  fields.pourStyle.value = bottle?.pourStyle || "daily";
  fields.pourTier.value = normalizePourTier(bottle?.pourTier || "crowd");
  fields.bottleSize.value = String(bottle?.bottleSize || 750);
  fields.coreBar.checked = Boolean(bottle?.coreBar);
  fields.priority.value = bottle?.priority || 3;
  fields.flavors.value = bottle?.flavors.join(", ") || "";
  fields.notes.value = bottle?.notes || "";

  els.bottleDialog.showModal();
  fields.name.focus();
  renderBottleSuggestions();
  updateFormPhotoTools();
}

function renderBottleSuggestions() {
  const query = fields.name.value.trim();
  if (query.length < 2 || fields.id.value) {
    clearBottleSuggestions();
    return;
  }

  const matches = getBottleSuggestions(query);
  if (!matches.length) {
    els.aiSuggestions.innerHTML = `
      <div class="ai-empty">
        No close match yet. Keep typing, or save it manually.
      </div>
    `;
    return;
  }

  els.aiSuggestions.innerHTML = `
    <div class="ai-label">Bottle matches</div>
    ${matches
      .map(
        (bottle, index) => `
          <button class="ai-suggestion" type="button" data-suggestion="${index}">
            <img src="${bottleImage(bottle)}" alt="" />
            <span>
              <strong>${escapeHtml(bottle.name)}</strong>
              <em>${escapeHtml(bottle.distillery)} · ${escapeHtml(bottle.type)} · ${numberOrDash(bottle.proof)} proof · ${labelBottleSize(bottle.bottleSize)}</em>
            </span>
          </button>
        `,
      )
      .join("")}
  `;

  els.aiSuggestions.querySelectorAll("[data-suggestion]").forEach((button) => {
    button.addEventListener("click", () => applyBottleSuggestion(matches[Number(button.dataset.suggestion)]));
  });
}

function getBottleSuggestions(query) {
  const inventoryMatches = bottles.map((bottle) => ({
    ...bottle,
    source: "inventory",
  }));
  const library = [...inventoryMatches, ...aiBottleLibrary];
  const seen = new Set();

  return library
    .map((bottle) => ({
      ...bottle,
      score: scoreBottleMatch(query, bottle),
    }))
    .filter((bottle) => bottle.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .filter((bottle) => {
      const key = `${bottle.name}-${bottle.distillery}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function scoreBottleMatch(query, bottle) {
  const target = `${bottle.name} ${bottle.distillery} ${bottle.type} ${bottle.region}`.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  let score = 0;

  if (bottle.name.toLowerCase().startsWith(normalizedQuery)) score += 80;
  if (bottle.name.toLowerCase().includes(normalizedQuery)) score += 55;
  if (bottle.distillery.toLowerCase().includes(normalizedQuery)) score += 30;
  words.forEach((word) => {
    if (target.includes(word)) score += 14;
  });

  score += fuzzySubsequenceScore(normalizedQuery, bottle.name.toLowerCase());
  return score;
}

function fuzzySubsequenceScore(query, target) {
  let score = 0;
  let cursor = 0;

  for (const char of query) {
    const index = target.indexOf(char, cursor);
    if (index === -1) continue;
    score += index === cursor ? 3 : 1;
    cursor = index + 1;
  }

  return score >= query.length ? score : 0;
}

function applyBottleSuggestion(bottle) {
  const imageUrl = bottle.imageUrl || getCuratedBottleImage(bottle);
  fields.name.value = bottle.name || "";
  fields.distillery.value = bottle.distillery || "";
  fields.type.value = bottle.type || "Bourbon";
  fields.region.value = bottle.region || "";
  fields.proof.value = bottle.proof || "";
  fields.price.value = bottle.price || "";
  fields.flavors.value = bottle.flavors?.join(", ") || "";
  fields.category.value = bottle.category || defaultCategory(bottle);
  fields.pourStyle.value = bottle.pourStyle || "daily";
  fields.pourTier.value = normalizePourTier(bottle.pourTier || "crowd");
  fields.bottleSize.value = String(bottle.bottleSize || 750);
  fields.imageUrl.value = imageUrl;
  if (!fields.notes.value.trim()) {
    fields.notes.value = "Matched from AI bottle suggestions.";
  }
  clearBottleSuggestions();
  updateFormPhotoTools(bottle);
  queueAutoFormPhotoSearch(100);
  fields.status.focus();
}

function getFormBottleDraft(seed = {}) {
  const name = fields.name.value.trim() || seed.name || "";
  const distillery = fields.distillery.value.trim() || seed.distillery || "";
  const seedDraft = {
    name,
    distillery,
    type: fields.type.value || seed.type || "Bourbon",
    imageUrl: fields.imageUrl.value.trim() || seed.imageUrl || "",
  };

  const curatedImage = getCuratedBottleImage(seedDraft);
  return {
    ...seedDraft,
    imageUrl: seedDraft.imageUrl || curatedImage,
  };
}

function updateFormPhotoTools(seed = {}) {
  const draft = getFormBottleDraft(seed);
  const hasName = draft.name.length > 1;
  els.formPhotoName.textContent = hasName ? `${draft.name}${draft.distillery ? ` · ${draft.distillery}` : ""}` : "Start typing a bottle name";
  els.formPhotoPreview.src = hasName ? bottleImage(draft) : "";
  els.formPhotoPreview.classList.toggle("is-empty", !hasName);
  els.formPhotoLinks.innerHTML = hasName
    ? photoSourceLinks(draft)
        .slice(0, 4)
        .map(([label, href]) => `<a class="secondary-action" href="${href}" target="_blank" rel="noreferrer">${label}</a>`)
        .join("")
    : "";
}

function queueAutoFormPhotoSearch(delay = 700) {
  window.clearTimeout(formPhotoTimer);
  const draft = getFormBottleDraft();
  if (fields.imageUrl.value.trim() || draft.name.length < 4) return;

  formPhotoTimer = window.setTimeout(() => {
    autoFindFormPhoto({ quiet: true });
  }, delay);
}

async function autoFindFormPhoto(options = {}) {
  const quiet = Boolean(options.quiet);
  const draft = getFormBottleDraft();
  if (!draft.name) {
    els.formPhotoName.textContent = "Enter a bottle name first";
    return;
  }

  if (!quiet) els.formPhotoName.textContent = "Looking for public bottle photo...";
  const imageUrl = await findPublicBottleImage(draft);
  if (imageUrl) {
    fields.imageUrl.value = imageUrl;
    updateFormPhotoTools({ ...draft, imageUrl });
    return;
  }

  if (!quiet) els.formPhotoName.textContent = "No public photo found. Use a source link.";
  updateFormPhotoTools(draft);
}

function uploadBottlePhoto(event) {
  const [file] = event.target.files;
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    els.formPhotoName.textContent = "Choose an image file.";
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    fields.imageUrl.value = reader.result;
    updateFormPhotoTools({ imageUrl: reader.result });
    els.formPhotoName.textContent = file.name.replace(/\.[^.]+$/, "") || "Uploaded bottle photo";
  });
  reader.readAsDataURL(file);
}

function clearBottleSuggestions() {
  els.aiSuggestions.innerHTML = "";
}

function openScanner() {
  els.scanResult.innerHTML = "";
  els.manualBarcode.value = "";
  els.scannerStatus.textContent = supportsBarcodeScanner()
    ? "Start the camera and center the barcode in the frame."
    : "Camera barcode scanning is not supported in this browser. Enter a UPC or upload a clear label photo.";
  els.scannerDialog.showModal();
}

async function startScanner() {
  if (!supportsBarcodeScanner()) {
    els.scannerStatus.textContent = "This browser does not support live barcode scanning yet.";
    return;
  }

  try {
    barcodeDetector ||= new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
    });
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    els.scannerVideo.srcObject = scannerStream;
    await els.scannerVideo.play();
    els.scannerStatus.textContent = "Scanning... hold the barcode steady inside the frame.";
    scannerTimer = window.setInterval(scanVideoFrame, 700);
  } catch (error) {
    els.scannerStatus.textContent = "Camera access was unavailable. You can still enter the barcode manually.";
  }
}

async function scanVideoFrame() {
  if (!barcodeDetector || !els.scannerVideo.videoWidth) return;

  try {
    const codes = await barcodeDetector.detect(els.scannerVideo);
    if (codes.length) {
      lookupBarcode(codes[0].rawValue);
    }
  } catch {
    els.scannerStatus.textContent = "Scanner paused. Try a brighter label angle or enter the barcode manually.";
  }
}

async function scanUploadedImage(event) {
  const [file] = event.target.files;
  if (!file) return;

  if (!supportsBarcodeScanner()) {
    els.scannerStatus.textContent = "Image barcode scanning is not supported in this browser.";
    return;
  }

  try {
    barcodeDetector ||= new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
    });
    const bitmap = await createImageBitmap(file);
    const codes = await barcodeDetector.detect(bitmap);
    if (codes.length) {
      lookupBarcode(codes[0].rawValue);
    } else {
      els.scannerStatus.textContent = "No barcode found in that image. Try a closer, sharper label photo.";
    }
  } catch {
    els.scannerStatus.textContent = "Could not scan that image. Enter the UPC manually instead.";
  } finally {
    event.target.value = "";
  }
}

function lookupBarcode(rawCode) {
  const code = normalizeBarcode(rawCode);
  if (!code) {
    els.scannerStatus.textContent = "Enter a barcode to look up.";
    return;
  }

  stopScanner();
  els.manualBarcode.value = code;
  const match = bottleCatalog[code] || bottleCatalog[code.slice(1)];
  if (match) {
    els.scannerStatus.textContent = `Found ${match.name}.`;
    els.scanResult.innerHTML = `
      <strong>${escapeHtml(match.name)}</strong>
      <span>${escapeHtml(match.distillery)} · ${escapeHtml(match.type)} · ${numberOrDash(match.proof)} proof</span>
      <button class="primary-action" id="addScannedBottle" type="button">Add to Inventory</button>
    `;
    document.querySelector("#addScannedBottle").addEventListener("click", () => {
      closeScanner();
      openForm({
        ...match,
        id: "",
        rating: "",
        status: "sealed",
        shelf: "Main bar",
        quantity: 1,
        fillLevel: "full",
        bottleSize: 750,
        openedDate: "",
        category: defaultCategory(match),
        pourStyle: "daily",
        pourTier: "crowd",
        coreBar: false,
        priority: 3,
        notes: `Scanned barcode ${code}.`,
      });
    });
    return;
  }

  els.scannerStatus.textContent = "Barcode captured, but it is not in the local catalog yet.";
  els.scanResult.innerHTML = `
    <strong>Unknown bottle</strong>
    <span>Barcode ${escapeHtml(code)} is ready to attach to a new inventory entry.</span>
    <button class="primary-action" id="addUnknownBottle" type="button">Add Manually</button>
  `;
  document.querySelector("#addUnknownBottle").addEventListener("click", () => {
    closeScanner();
    openForm({
      id: "",
      name: "",
      distillery: "",
      type: "Bourbon",
      region: "",
      proof: "",
      price: "",
      rating: "",
      status: "sealed",
      shelf: "Main bar",
      quantity: 1,
      fillLevel: "full",
      bottleSize: 750,
      openedDate: "",
      category: "daily",
      pourStyle: "daily",
      pourTier: "crowd",
      coreBar: false,
      priority: 3,
      flavors: [],
      notes: `Scanned barcode ${code}.`,
    });
  });
}

function closeScanner() {
  stopScanner();
  els.scannerDialog.close();
}

function stopScanner() {
  if (scannerTimer) {
    window.clearInterval(scannerTimer);
    scannerTimer = undefined;
  }
  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = undefined;
  }
  els.scannerVideo.srcObject = null;
}

function supportsBarcodeScanner() {
  return "BarcodeDetector" in window && navigator.mediaDevices?.getUserMedia;
}

function normalizeBarcode(value) {
  return String(value || "").replace(/\D/g, "");
}

async function saveBottle(event) {
  event.preventDefault();
  const id = fields.id.value || crypto.randomUUID();
  const bottle = {
    id,
    name: fields.name.value.trim(),
    distillery: fields.distillery.value.trim(),
    type: fields.type.value,
    region: fields.region.value.trim(),
    imageUrl: fields.imageUrl.value.trim(),
    proof: Number(fields.proof.value || 0),
    price: Number(fields.price.value || 0),
    rating: Number(fields.rating.value || 0),
    status: fields.status.value,
    ageStatement: fields.ageStatement.value.trim(),
    storeLocation: fields.storeLocation.value.trim(),
    shelf: fields.shelf.value.trim() || "Main bar",
    quantity: Number(fields.quantity.value || 1),
    fillLevel: fields.fillLevel.value,
    bottleSize: Number(fields.bottleSize.value || 750),
    openedDate: fields.openedDate.value,
    category: fields.category.value,
    pourStyle: fields.pourStyle.value,
    pourTier: normalizePourTier(fields.pourTier.value),
    coreBar: fields.coreBar.checked,
    priority: Number(fields.priority.value || 3),
    flavors: fields.flavors.value
      .split(",")
      .map((flavor) => flavor.trim().toLowerCase())
      .filter(Boolean),
    notes: fields.notes.value.trim(),
  };
  bottle.imageUrl = bottle.imageUrl || getCuratedBottleImage(bottle);
  if (!bottle.imageUrl) {
    const submitButton = els.bottleForm.querySelector('button[type="submit"]');
    const originalText = submitButton?.textContent;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Finding photo...";
    }
    bottle.imageUrl = await findPublicBottleImage(bottle);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }

  bottles = bottles.some((item) => item.id === id)
    ? bottles.map((item) => (item.id === id ? bottle : item))
    : [bottle, ...bottles];

  persist();
  els.bottleDialog.close();
  render();
}

function deleteBottle() {
  const id = fields.id.value;
  if (!id) return;
  bottles = bottles.filter((bottle) => bottle.id !== id);
  persist();
  els.bottleDialog.close();
  render();
}

function toggleBottle(id) {
  bottles = bottles.map((bottle) => {
    if (bottle.id !== id) return bottle;
    const nextStatus = bottle.status === "open" ? "sealed" : "open";
    return {
      ...bottle,
      status: nextStatus,
      fillLevel: nextStatus === "open" && bottle.fillLevel === "full" ? "three-quarter" : bottle.fillLevel,
      openedDate:
        nextStatus === "open" && !bottle.openedDate ? new Date().toISOString().slice(0, 10) : bottle.openedDate,
    };
  });
  persist();
  render();
}

function exportCollection() {
  const backup = {
    app: "Fully Involved Pour",
    exportedAt: new Date().toISOString(),
    bottles,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `fully-involved-pour-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importCollection(event) {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const imported = Array.isArray(payload) ? payload : payload.bottles;
    if (!Array.isArray(imported)) throw new Error("Invalid backup");
    bottles = imported.map((bottle) => normalizeBottle({ ...bottle, id: bottle.id || crypto.randomUUID() }));
    persist();
    render();
  } catch {
    alert("That backup file could not be imported.");
  } finally {
    event.target.value = "";
  }
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function numberOrDash(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toLocaleString() : "—";
}

function labelStatus(status) {
  return {
    open: "Open",
    sealed: "Sealed",
    finished: "Finished",
    wishlist: "Wish List",
    "buy-next": "Buy Next",
  }[status];
}

function labelFillLevel(level) {
  return {
    full: "Full",
    "three-quarter": "3/4",
    half: "1/2",
    low: "Low",
    empty: "Empty",
  }[level || "full"];
}

function labelCategory(category) {
  return {
    daily: "Daily",
    "high-proof": "High Proof",
    wheated: "Wheated",
    rye: "Rye",
    "special-occasion": "Special Occasion",
    finished: "Finished",
    showstopper: "Showstopper",
    "crowd-pleaser": "Crowd Pleaser",
    other: "Other",
  }[category || "daily"];
}

function labelPourStyle(style) {
  return {
    daily: "Daily",
    share: "Share",
    special: "Special",
    cocktail: "Cocktail",
  }[style || "daily"];
}

function labelBottleSize(size) {
  const value = Number(size || 750);
  if (value === 1000) return "1 L";
  if (value === 1750) return "1.75 L";
  return `${value} ML`;
}

function labelPourTier(tier) {
  return {
    crowd: "Crowd Pour",
    reserve: "Reserve Pour",
    vip: "VIP Pour",
  }[normalizePourTier(tier)];
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderDistilleryOptions();
render();
