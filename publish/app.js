const STORAGE_KEY = "cellar-ledger-bottles";
const POUR_STORAGE_KEY = "cellar-ledger-pours";
const GREETING_MODE_KEY = "fip-greeting-mode"; // "username" | "custom"
const GREETING_NAME_KEY = "fip-greeting-name"; // free-form name used only in the Home greeting
const CUSTOM_LIBRARY_KEY = "fip-custom-library";
const ASSISTANT_HISTORY_KEY = "fip-assistant-history";
const INFINITY_STORAGE_KEY = "fip-infinity-bottles";

const INFINITY_NAME_IDEAS = [
  "The Neverending Pour",
  "Groundhog Barrel",
  "Whatever's Left",
  "The Melting Pot",
  "Last Call Reserve",
  "Franken-Batch",
  "The Continuum",
  "Bottomless Barrel",
  "Odds & Ends Reserve",
  "The Kitchen Sink",
  "Perpetual Blend",
  "The Long Goodbye",
  "Sunday Leftovers",
  "The Collective",
  "Shelf Scraps Reserve",
  "Second Life Batch",
  "The Loop",
  "Waste Not Reserve",
  "The Remainder",
  "Barrel of Misfits",
  "House Blend No. 1",
  "The Understudy",
  "Dregs & Legends",
  "The Unfinished Business",
];

const firebaseConfig = {
  apiKey: "AIzaSyDJ6BpySxmM7bvZQYmLh0kmkPB18qxt47Q",
  authDomain: "fully-involved-pour.firebaseapp.com",
  projectId: "fully-involved-pour",
  storageBucket: "fully-involved-pour.firebasestorage.app",
  messagingSenderId: "801004541737",
  appId: "1:801004541737:web:f878996b8d7dc333b14938",
};

let auth;
let db;
let storage;
let cloudFunctions;
let currentUser = null;
let currentProfile = null;

if (typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage ? firebase.storage() : undefined;
  cloudFunctions = firebase.functions ? firebase.functions() : undefined;
}

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
  "088110438017": {
    name: "Bulleit Bourbon",
    distillery: "Bulleit",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 28,
    flavors: ["maple", "oak", "nutmeg"],
  },
  "080686413132": {
    name: "Eagle Rare 10 Year",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 35,
    flavors: ["leather", "toffee", "orange"],
  },
  "080686005380": {
    name: "Blanton's Original Single Barrel",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 93,
    price: 65,
    flavors: ["caramel", "honey", "citrus", "oak"],
  },
  "080686316127": {
    name: "Weller Special Reserve",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 28,
    flavors: ["wheat", "caramel", "vanilla"],
  },
  "080686390585": {
    name: "Weller Antique 107",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 107,
    price: 35,
    flavors: ["wheat", "brown sugar", "oak", "spice"],
  },
  "080686200029": {
    name: "E.H. Taylor Small Batch",
    distillery: "Buffalo Trace",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 45,
    flavors: ["leather", "vanilla", "oak", "mint"],
  },
  "036508101007": {
    name: "Knob Creek Small Batch",
    distillery: "Jim Beam",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 32,
    flavors: ["caramel", "oak", "smoke", "vanilla"],
  },
  "036508540004": {
    name: "Jim Beam White Label",
    distillery: "Jim Beam",
    type: "Bourbon",
    region: "Kentucky",
    proof: 80,
    price: 18,
    flavors: ["corn", "vanilla", "oak"],
  },
  "036508120009": {
    name: "Basil Hayden's",
    distillery: "Jim Beam",
    type: "Bourbon",
    region: "Kentucky",
    proof: 80,
    price: 38,
    flavors: ["pepper", "cinnamon", "honey"],
  },
  "082000241208": {
    name: "Wild Turkey 101",
    distillery: "Wild Turkey",
    type: "Bourbon",
    region: "Kentucky",
    proof: 101,
    price: 26,
    flavors: ["caramel", "oak", "spice", "vanilla"],
  },
  "082000241307": {
    name: "Wild Turkey Rare Breed",
    distillery: "Wild Turkey",
    type: "Bourbon",
    region: "Kentucky",
    proof: 116.8,
    price: 45,
    flavors: ["oak", "cherry", "leather", "clove"],
  },
  "082000200007": {
    name: "Russell's Reserve 10 Year",
    distillery: "Wild Turkey",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90,
    price: 35,
    flavors: ["caramel", "vanilla", "oak"],
  },
  "088004025308": {
    name: "Woodford Reserve Double Oaked",
    distillery: "Woodford Reserve",
    type: "Bourbon",
    region: "Kentucky",
    proof: 90.4,
    price: 50,
    flavors: ["caramel", "toasted oak", "dark fruit"],
  },
  "080432100182": {
    name: "Old Forester 100 Proof",
    distillery: "Old Forester",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 28,
    flavors: ["clove", "caramel", "orange peel"],
  },
  "080432186100": {
    name: "Old Forester Statesman",
    distillery: "Old Forester",
    type: "Bourbon",
    region: "Kentucky",
    proof: 95,
    price: 50,
    flavors: ["toffee", "tobacco", "oak"],
  },
  "080686817111": {
    name: "Elijah Craig Small Batch",
    distillery: "Heaven Hill",
    type: "Bourbon",
    region: "Kentucky",
    proof: 94,
    price: 30,
    flavors: ["vanilla", "nutmeg", "oak"],
  },
  "080686817241": {
    name: "Henry McKenna 10 Year Bottled in Bond",
    distillery: "Heaven Hill",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 40,
    flavors: ["caramel", "oak", "baking spice"],
  },
  "080686817357": {
    name: "Evan Williams Black Label",
    distillery: "Heaven Hill",
    type: "Bourbon",
    region: "Kentucky",
    proof: 86,
    price: 16,
    flavors: ["vanilla", "caramel", "corn"],
  },
  "087116014109": {
    name: "1792 Small Batch",
    distillery: "Barton 1792",
    type: "Bourbon",
    region: "Kentucky",
    proof: 93.7,
    price: 30,
    flavors: ["brown sugar", "oak", "pepper"],
  },
  "087116014208": {
    name: "1792 Bottled in Bond",
    distillery: "Barton 1792",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 32,
    flavors: ["caramel", "vanilla", "oak", "spice"],
  },
  "036508700309": {
    name: "Larceny Small Batch",
    distillery: "Heaven Hill",
    type: "Bourbon",
    region: "Kentucky",
    proof: 92,
    price: 28,
    flavors: ["wheat", "caramel", "honey"],
  },
  "082000700105": {
    name: "Michter's US*1 Bourbon",
    distillery: "Michter's",
    type: "Bourbon",
    region: "Kentucky",
    proof: 91.4,
    price: 48,
    flavors: ["caramel", "vanilla", "oak"],
  },
  "082000700204": {
    name: "Michter's 10 Year Bourbon",
    distillery: "Michter's",
    type: "Bourbon",
    region: "Kentucky",
    proof: 94.4,
    price: 150,
    flavors: ["leather", "dark cherry", "oak", "spice"],
  },
  "850001234567": {
    name: "Angel's Envy Bourbon",
    distillery: "Angel's Envy",
    type: "Bourbon",
    region: "Kentucky",
    proof: 86.6,
    price: 50,
    flavors: ["port wine", "vanilla", "caramel"],
  },
  "850007654321": {
    name: "New Riff Bottled in Bond",
    distillery: "New Riff",
    type: "Bourbon",
    region: "Kentucky",
    proof: 100,
    price: 40,
    flavors: ["rye spice", "citrus", "oak"],
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
  "bulleit bourbon-bulleit":
    "https://images.ctfassets.net/awz4vj3h97d6/5kAcTq3PMSt24Yis9e7Cmi/f0af05bc8061697cc003a239048ce238/bulleit-bourbon.jpg",
  "eagle rare 10 year-buffalo trace":
    "https://cms.buffalotracedistillery.com/wp-content/uploads/2025/11/EAGLE_-RARE_10_BOTTLE.png",
  "blanton's original single barrel-buffalo trace":
    "https://cms.buffalotracedistillery.com/wp-content/uploads/2025/12/BLANTONS.png",
  "weller special reserve-buffalo trace":
    "https://cms.buffalotracedistillery.com/wp-content/uploads/2025/11/WELLER-SPECIAL-RESERVE-PACKSHOT-PRODUCT-e1764158017233.png",
  "weller antique 107-buffalo trace":
    "https://cms.buffalotracedistillery.com/wp-content/uploads/2025/11/WELLER_ANTIQUE_BOTTLE.png",
  "e.h. taylor small batch-buffalo trace":
    "https://cms.buffalotracedistillery.com/wp-content/uploads/2025/11/E.H.TAYLOR_SMALL_BATCH_BOTTLE.png",
  "knob creek small batch-jim beam":
    "https://cdn.caskers.com/catalog/product/cache/4f6989790ecdd0e389055fabaf312a4d/k/n/knob-creek-9-year-old-small-batch-bourbon-whiskey-1.jpg",
  "jim beam white label-jim beam":
    "https://upload.wikimedia.org/wikipedia/commons/e/e5/Jim_Beam_White_Label.jpg",
  "basil hayden's-jim beam":
    "https://assets.liquidcommerce.co/catalog/img/aecda8d3-dd9e-4b6b-9d0b-87d41121db15.jpg",
  "wild turkey 101-wild turkey":
    "https://assets.liquidcommerce.co/catalog/img/f35c35ce-4f3f-4fa2-8edd-2f153aa20b41.jpg",
  "wild turkey rare breed-wild turkey":
    "https://assets.liquidcommerce.co/catalog/img/4159c6af-0cfc-405d-8adf-15239b6248c8.jpg",
  "russell's reserve 10 year-wild turkey":
    "https://assets.liquidcommerce.co/catalog/img/95f8f910-87e1-4957-90c9-2f0d5c276ae8.jpg",
  "woodford reserve double oaked-woodford reserve":
    "https://www.woodfordreserve.com/wp-content/uploads/2019/12/1.png",
  "old forester 100 proof-old forester":
    "https://www.oldforester.com/wp-content/uploads/2019/06/Old-Fo-100-Bottle.png",
  "old forester statesman-old forester":
    "https://www.oldforester.com/wp-content/uploads/2019/06/old-forester-statesman-bourbon1.png",
  "elijah craig small batch-heaven hill":
    "https://heavenhilldistillery.com/images/brands/detail/ec.png",
  "henry mckenna 10 year bottled in bond-heaven hill":
    "https://heavenhilldistillery.com/images/brands/detail/mckena-4708.png",
  "evan williams black label-heaven hill":
    "https://evanwilliams.com/images/bottles/ew-black-20.png?ver=2",
  "1792 small batch-barton 1792":
    "https://1792bourbon.com/img/1792-bottle-sm.png",
  "1792 bottled in bond-barton 1792":
    "https://1792bourbon.com/img/1792-Bottled-In-Bond-Bottle-Straight-On.png",
  "larceny small batch-heaven hill":
    "https://larcenybourbon.com/images/sb-bottle.png",
  "michter's us*1 bourbon-michter's":
    "https://michters.com/wp-content/uploads/2025/01/BOURB750_418x1378100_2023.jpg",
  "michter's 10 year bourbon-michter's":
    "https://michters.com/wp-content/uploads/2026/02/10YrBBN_2025_491x1378_300dpi-1.jpg",
  "angel's envy bourbon-angel's envy":
    "https://assets.liquidcommerce.co/catalog/images/Untitled_design_-_2026-04-30T082119.908.png",
  "new riff bottled in bond-new riff":
    "https://newriffdistilling.com/wp-content/uploads/2026/02/New-Riff_BIB_Bourbon_WBB.webp",
};

const distilleryMashBills = {
  "buffalo trace": { corn: 90, ryeWheat: 8, malted: 2 },
  "maker's mark": { corn: 70, ryeWheat: 16, malted: 14 },
  "wild turkey": { corn: 75, ryeWheat: 13, malted: 12 },
  "woodford reserve": { corn: 72, ryeWheat: 18, malted: 10 },
  "jim beam": { corn: 77, ryeWheat: 13, malted: 10 },
  "heaven hill": { corn: 78, ryeWheat: 10, malted: 12 },
};

const wheatedMashBill = { corn: 75, ryeWheat: 20, malted: 5 };

function suggestMashBill(name, distillery) {
  const distilleryKey = String(distillery || "").toLowerCase();
  const nameText = String(name || "").toLowerCase();
  const isWheated = /weller|pappy|fitzgerald|wheat/.test(nameText);
  if (distilleryKey === "buffalo trace" && isWheated) return wheatedMashBill;
  return distilleryMashBills[distilleryKey] || null;
}

const distilleryProfiles = {
  "buffalo trace": {
    location: "Frankfort, Kentucky",
    founded: "Distillery site dates to 1773; operating as Buffalo Trace since 1999",
    blurb: "One of the oldest continuously operating distilleries in the U.S., home to Eagle Rare, Blanton's, Weller, and E.H. Taylor.",
  },
  "wild turkey": {
    location: "Lawrenceburg, Kentucky",
    founded: "1869 (Ripy Brothers); Wild Turkey brand since the 1940s",
    blurb: "Known for a bold, high-proof house style under longtime master distiller Jimmy Russell.",
  },
  "heaven hill": {
    location: "Bardstown / Louisville, Kentucky",
    founded: "1935",
    blurb: "One of the largest family-owned distilleries in the U.S., producing Evan Williams, Elijah Craig, Larceny, and Henry McKenna.",
  },
  "jim beam": {
    location: "Clermont, Kentucky",
    founded: "1795 (Beam family)",
    blurb: "The world's best-selling bourbon brand, still run by descendants of the founding Beam family.",
  },
  "woodford reserve": {
    location: "Versailles, Kentucky",
    founded: "Historic distillery site from 1812; Woodford Reserve brand since 1996",
    blurb: "Uses copper pot stills and a triple-distillation process at one of Kentucky's most scenic distilleries.",
  },
  "old forester": {
    location: "Louisville, Kentucky",
    founded: "1870 by George Garvin Brown",
    blurb: "The first bourbon brand sold exclusively in sealed glass bottles, owned by Brown-Forman.",
  },
  "four roses": {
    location: "Lawrenceburg, Kentucky",
    founded: "1888",
    blurb: "Famous for blending 10 distinct bourbon recipes from 2 mash bills and 5 proprietary yeast strains.",
  },
  "barton 1792": {
    location: "Bardstown, Kentucky",
    founded: "Distillery site dates to 1879",
    blurb: "One of Bardstown's oldest distilleries, producing the 1792 line under the Sazerac Company.",
  },
  "michter's": {
    location: "Louisville, Kentucky",
    founded: "Brand revived in the 1990s; current distillery opened 2015",
    blurb: "Focuses on small-batch, single-barrel releases with no age statement on some core bottlings.",
  },
  "angel's envy": {
    location: "Louisville, Kentucky",
    founded: "2010 by Lincoln Henderson",
    blurb: "Known for finishing bourbon in port wine barrels for added depth and sweetness.",
  },
  "new riff": {
    location: "Newport, Kentucky",
    founded: "2014",
    blurb: "A newer craft distillery committed to bottled-in-bond, non-chill-filtered whiskey.",
  },
  "maker's mark": {
    location: "Loretto, Kentucky",
    founded: "1953 by Bill Samuels Sr.",
    blurb: "A wheated bourbon recognizable by its hand-dipped red wax seal.",
  },
  bulleit: {
    location: "Shelbyville / Louisville, Kentucky",
    founded: "Brand revived in 1987 by Tom Bulleit",
    blurb: "A high-rye bourbon with roots tracing back to the historic Stitzel-Weller area.",
  },
  "redwood empire": {
    location: "Sonoma County, California",
    founded: "2014",
    blurb: "A California distillery aging whiskey in a markedly different climate than Kentucky.",
  },
  ardbeg: {
    location: "Isle of Islay, Scotland",
    founded: "1815",
    blurb: "Known for intensely peated, smoky single malt Scotch whisky.",
  },
  "asw distillery": {
    location: "Atlanta, Georgia",
    founded: "2013",
    blurb: "One of the South's pioneering craft distilleries, producing the Fiddler bourbon and Resurgens rye lines.",
  },
  "old fourth distillery": {
    location: "Atlanta, Georgia",
    founded: "2015",
    blurb: "An Atlanta craft distillery making small-batch bourbon and rye in the Old Fourth Ward neighborhood.",
  },
  "cathead distillery": {
    location: "Jackson, Mississippi",
    founded: "2010",
    blurb: "Mississippi's first legal distillery since Prohibition, known mainly for vodka and gin alongside its bourbon.",
  },
  "john emerald distilling co.": {
    location: "Opelika, Alabama",
    founded: "2014",
    blurb: "A small Alabama distillery producing handcrafted bourbon and seasonal spirits.",
  },
  "donner-peltier distillers": {
    location: "Thibodaux, Louisiana",
    founded: "2012",
    blurb: "A Louisiana distillery known for Oryza, a rye whiskey made with locally grown rice in the mash.",
  },
  "high wire distilling": {
    location: "Charleston, South Carolina",
    founded: "2013",
    blurb: "A Charleston distillery reviving heirloom Southern grains like Jimmy Red corn for its whiskey.",
  },
  "defiant whisky": {
    location: "Bostic, North Carolina",
    founded: "2005",
    blurb: "A North Carolina distillery producing an American single malt aged in the Blue Ridge foothills.",
  },
  "doc porter's distillery": {
    location: "Charlotte, North Carolina",
    founded: "2015",
    blurb: "A Charlotte craft distillery making small-batch bourbon, rye, and vodka.",
  },
  "st. augustine distillery": {
    location: "St. Augustine, Florida",
    founded: "2014",
    blurb: "Florida's oldest city's craft distillery, producing bourbon and rye finished in the Florida humidity.",
  },
  balcones: {
    location: "Waco, Texas",
    founded: "2008",
    blurb: "The first legal whisky distillery in Texas since Prohibition, known for its Texas Single Malt.",
  },
  westland: {
    location: "Seattle, Washington",
    founded: "2010",
    blurb: "A pioneer of the American single malt category, using Pacific Northwest barley and peated malt.",
  },
  "stranahan's": {
    location: "Denver, Colorado",
    founded: "2004",
    blurb: "Colorado's oldest legal whiskey distillery, aging a malted-barley whiskey at mile-high altitude.",
  },
  "high west": {
    location: "Park City, Utah",
    founded: "2006",
    blurb: "Utah's first legal distillery since 1870, best known for blending sourced and house-made rye and bourbon.",
  },
  "smooth ambler": {
    location: "Maxwelton, West Virginia",
    founded: "2009",
    blurb: "An Appalachian distillery blending its own distillate with sourced barrels under the Old Scout label.",
  },
  whistlepig: {
    location: "Shoreham, Vermont",
    founded: "2007",
    blurb: "A Vermont farm distillery that built the modern craft-rye category, aging on a working farmstead.",
  },
  "chattanooga whiskey": {
    location: "Chattanooga, Tennessee",
    founded: "2011",
    blurb: "Tennessee's first legal distillery in the city since Prohibition, using an unusual five-grain bourbon mash bill.",
  },
  "castle & key": {
    location: "Frankfort, Kentucky",
    founded: "2018 (distillery site dates to 1887)",
    blurb: "A restored 19th-century distillery campus (formerly Old Taylor) revived as a modern craft producer.",
  },
  "rabbit hole": {
    location: "Louisville, Kentucky",
    founded: "2018",
    blurb: "A Louisville distillery known for unconventional grain bills and wine-cask finishes.",
  },
  "jefferson's": {
    location: "Louisville, Kentucky",
    founded: "1997",
    blurb: "A blending house founded by Trey Zoeller, known for aging bourbon barrels at sea aboard cargo ships.",
  },
  "james e. pepper": {
    location: "Lexington, Kentucky",
    founded: "Brand dates to 1780; distillery rebuilt in 2017",
    blurb: "One of America's oldest bourbon brands, revived with a new distillery on its historic Lexington site.",
  },
  "old elk": {
    location: "Fort Collins, Colorado",
    founded: "2015",
    blurb: "A Colorado distillery founded by New Belgium Brewing co-founder Curt Richardson, known for wheated bourbon.",
  },
  "milam & greene": {
    location: "Blanco, Texas",
    founded: "2019",
    blurb: "A Texas Hill Country distillery known for triple-cask maturation and a female-led founding team.",
  },
  hillrock: {
    location: "Ancram, New York",
    founded: "2011",
    blurb: "A Hudson Valley estate distillery that grows its own grain and uses a solera aging system.",
  },
  "a. smith bowman": {
    location: "Fredericksburg, Virginia",
    founded: "1935 (current distillery since 1988)",
    blurb: "Virginia's oldest continuously operating distillery, known for the John J. Bowman single barrel line.",
  },
  reservoir: {
    location: "Richmond, Virginia",
    founded: "2008",
    blurb: "A Richmond craft distillery producing 100% straight bourbon, rye, and wheat whiskies in small batches.",
  },
  "smoke wagon": {
    location: "Las Vegas, Nevada",
    founded: "2017",
    blurb: "A Las Vegas whiskey house blending sourced barrels into bold, high-proof small-batch bourbons.",
  },
  starlight: {
    location: "Starlight, Indiana",
    founded: "2013 (Huber family farm dates to 1843)",
    blurb: "A sixth-generation family farm distillery producing bourbon and rye alongside its orchard and winery.",
  },
  "limestone branch": {
    location: "Lebanon, Kentucky",
    founded: "2011",
    blurb: "Founded by Beam-family descendants Steve and Paul Beam, best known for reviving the Yellowstone brand.",
  },
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
  "Cathead Distillery",
  "Chattanooga Whiskey",
  "Cooper's Craft",
  "Coppercraft",
  "Crown Royal",
  "Dalmore",
  "Deanston",
  "Defiant Whisky",
  "Doc Porter's Distillery",
  "Donner-Peltier Distillers",
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
  "High Wire Distilling",
  "Hillrock",
  "Jack Daniel's",
  "James E. Pepper",
  "Jameson",
  "Jefferson's",
  "Jim Beam",
  "John Emerald Distilling Co.",
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
  "Old Fourth Distillery",
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
  "St. Augustine Distillery",
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
  const normalized = normalizeLegacyBottle({
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
    favorite: false,
    legacyShelf: false,
    legacyShelfReason: "",
    priority: 3,
    rating: 0,
    price: 0,
    msrp: 0,
    mashBillCorn: 0,
    mashBillRyeWheat: 0,
    mashBillMalted: 0,
    proof: 0,
    region: "",
    notes: "",
    flavors: [],
    gallery: [],
    ...bottle,
    flavors: Array.isArray(bottle.flavors) ? bottle.flavors : [],
    gallery: Array.isArray(bottle.gallery) ? bottle.gallery : [],
    notes: bottle.notes || "",
  });

  // Bottles saved before multi-category tagging only had a single `category` string;
  // migrate those into a one-item `categories` array and keep `category` as the primary
  // tag so every older read-path (filters, chips, search) still works unchanged.
  const categories = Array.isArray(normalized.categories) && normalized.categories.length
    ? normalized.categories
    : [normalized.category || "daily"];
  normalized.categories = categories;
  normalized.category = categories[0];
  return normalized;
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

// User-uploaded photos, loaded from Firestore at startup. Every photo a signed-in
// user uploads is published here automatically (see shareBottlePhoto) so it shows
// up for every visitor without a code deploy. Falls back behind the hand-curated
// list below since those are pre-verified.
const sharedCuratedImages = new Map();

function curatedImageKey(name, distillery) {
  return `${name || ""}-${distillery || ""}`.toLowerCase();
}

async function loadSharedBottlePhotos() {
  if (!db) return;
  try {
    const snap = await db.collection("sharedBottlePhotos").get();
    snap.forEach((doc) => {
      const imageUrl = doc.data()?.imageUrl;
      if (imageUrl) sharedCuratedImages.set(doc.id, imageUrl);
    });
    if (sharedCuratedImages.size) render();
  } catch (error) {
    console.error("Failed to load shared bottle photos", error);
  }
}

async function shareBottlePhoto(bottle) {
  if (!currentUser || !db || !bottle.imageUrl) return;
  const key = curatedImageKey(bottle.name, bottle.distillery).replaceAll("/", "-");
  const statusEl = document.querySelector("#quickPhotoStatus");
  try {
    await db.collection("sharedBottlePhotos").doc(key).set({
      name: bottle.name,
      distillery: bottle.distillery,
      imageUrl: bottle.imageUrl,
      submittedBy: currentUser.uid,
      submittedAt: Date.now(),
    });
    sharedCuratedImages.set(key, bottle.imageUrl);
    if (statusEl) statusEl.textContent = "✓ Shared with everyone";
  } catch (error) {
    console.error("Failed to share bottle photo", error);
    if (statusEl) statusEl.textContent = "Could not share this photo. Try again.";
  }
}

function getCuratedBottleImage(bottle) {
  const exactKey = curatedImageKey(bottle.name, bottle.distillery);
  if (curatedBottleImages[exactKey]) return curatedBottleImages[exactKey];
  if (sharedCuratedImages.has(exactKey)) return sharedCuratedImages.get(exactKey);

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

// A bottle can carry several category tags (e.g. Wheated + Showstopper); the form's
// picker is a set of toggle buttons rather than a single-value <select>.
function getSelectedCategoryTags() {
  return [...els.categoryPicker.querySelectorAll(".category-tag-btn.is-selected")].map(
    (button) => button.dataset.categoryTag,
  );
}

function setSelectedCategoryTags(categories) {
  const selected = new Set((categories?.length ? categories : ["daily"]).filter(Boolean));
  els.categoryPicker.querySelectorAll(".category-tag-btn").forEach((button) => {
    button.classList.toggle("is-selected", selected.has(button.dataset.categoryTag));
  });
}

function bottleCategories(bottle) {
  return bottle?.categories?.length ? bottle.categories : [bottle?.category || "daily"];
}

function isStorePick(bottle) {
  return bottleCategories(bottle).includes("store-pick");
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

const southernDistilleryLibrary = [
  { name: "ASW Fiddler Bourbon", distillery: "ASW Distillery", type: "Bourbon", region: "Georgia", proof: 90, price: 40, flavors: ["caramel", "oak", "fruit", "spice"] },
  { name: "ASW Resurgens Rye", distillery: "ASW Distillery", type: "Rye", region: "Georgia", proof: 92, price: 45, flavors: ["rye spice", "citrus", "oak", "honey"] },
  { name: "Old Fourth Bourbon", distillery: "Old Fourth Distillery", type: "Bourbon", region: "Georgia", proof: 92, price: 45, flavors: ["caramel", "oak", "vanilla", "spice"] },
  { name: "Old Fourth Rye", distillery: "Old Fourth Distillery", type: "Rye", region: "Georgia", proof: 96, price: 45, flavors: ["rye spice", "oak", "citrus", "pepper"] },

  { name: "Cathead Bourbon", distillery: "Cathead Distillery", type: "Bourbon", region: "Mississippi", proof: 80, price: 30, flavors: ["corn", "caramel", "vanilla", "oak"] },

  { name: "John Emerald Bourbon", distillery: "John Emerald Distilling Co.", type: "Bourbon", region: "Alabama", proof: 90, price: 40, flavors: ["caramel", "oak", "honey", "spice"] },

  { name: "Oryza Rye Whiskey", distillery: "Donner-Peltier Distillers", type: "Rye", region: "Louisiana", proof: 90, price: 50, flavors: ["rice grain", "spice", "oak", "citrus"] },

  { name: "High Wire New Southern Revival Bourbon", distillery: "High Wire Distilling", type: "Bourbon", region: "South Carolina", proof: 96, price: 50, flavors: ["corn", "caramel", "oak", "spice"] },
  { name: "High Wire Jimmy Red Corn Whiskey", distillery: "High Wire Distilling", type: "American Whiskey", region: "South Carolina", proof: 90, price: 55, flavors: ["sweet corn", "oak", "spice", "honey"] },

  { name: "Defiant American Single Malt", distillery: "Defiant Whisky", type: "American Whiskey", region: "North Carolina", proof: 90, price: 45, flavors: ["malt", "honey", "oak", "fruit"] },
  { name: "Doc Porter's Bourbon", distillery: "Doc Porter's Distillery", type: "Bourbon", region: "North Carolina", proof: 90, price: 40, flavors: ["caramel", "oak", "vanilla", "spice"] },

  { name: "St. Augustine Bourbon", distillery: "St. Augustine Distillery", type: "Bourbon", region: "Florida", proof: 80, price: 40, flavors: ["caramel", "oak", "vanilla", "honey"] },
  { name: "St. Augustine New World Reserve Rye", distillery: "St. Augustine Distillery", type: "Rye", region: "Florida", proof: 90, price: 45, flavors: ["rye spice", "citrus", "oak", "honey"] },

  { name: "Blue Note Uncut Barrel Proof Bourbon", distillery: "Blue Note", type: "Bourbon", region: "Tennessee", proof: 113, price: 60, flavors: ["brown sugar", "dark fruit", "oak", "baking spice"] },

  { name: "Silver Springs Sweet Rye Whiskey", distillery: "J.W. Kelly & Co.", type: "Rye", region: "Tennessee", proof: 110, price: 55, flavors: ["molasses", "toffee", "caramel", "cinnamon"] },
  { name: "J.W. Kelly Old Milford Straight Bourbon", distillery: "J.W. Kelly & Co.", type: "Bourbon", region: "Tennessee", proof: 90, price: 45, flavors: ["oak", "vanilla", "white pepper", "toffee"] },
];

const craftWhiskeyLibrary = [
  { name: "Balcones Baby Blue", distillery: "Balcones", type: "American Whiskey", region: "Texas", proof: 90, price: 45, flavors: ["blue corn", "caramel", "honey", "oak"] },
  { name: "Balcones Rumble", distillery: "Balcones", type: "American Whiskey", region: "Texas", proof: 100, price: 55, flavors: ["mesquite", "honey", "caramel", "spice"] },
  { name: "Balcones Pot Still Bourbon", distillery: "Balcones", type: "Bourbon", region: "Texas", proof: 92, price: 50, flavors: ["caramel", "corn", "oak", "vanilla"] },
  { name: "Balcones Texas Rye 100", distillery: "Balcones", type: "Rye", region: "Texas", proof: 100, price: 50, flavors: ["rye spice", "citrus", "oak", "pepper"] },
  { name: "Balcones True Blue Cask Strength", distillery: "Balcones", type: "American Whiskey", region: "Texas", proof: 122, price: 70, flavors: ["blue corn", "caramel", "heat", "oak"] },

  { name: "Westland Peated", distillery: "Westland", type: "American Single Malt", region: "Washington", proof: 92, price: 80, flavors: ["smoke", "malt", "honey", "oak"] },
  { name: "Westland Garryana", distillery: "Westland", type: "American Single Malt", region: "Washington", proof: 116, price: 150, flavors: ["malt", "dark fruit", "oak", "spice"] },
  { name: "Westland Sherry Wood", distillery: "Westland", type: "American Single Malt", region: "Washington", proof: 92, price: 90, flavors: ["sherry", "dried fruit", "malt", "oak"] },

  { name: "Stranahan's Blue Peak", distillery: "Stranahan's", type: "American Single Malt", region: "Colorado", proof: 94, price: 45, flavors: ["malt", "honey", "oak", "apple"] },
  { name: "Stranahan's Diamond Peak", distillery: "Stranahan's", type: "American Single Malt", region: "Colorado", proof: 94, price: 55, flavors: ["malt", "caramel", "oak", "citrus"] },
  { name: "Stranahan's Sherry Cask", distillery: "Stranahan's", type: "American Single Malt", region: "Colorado", proof: 94, price: 90, flavors: ["sherry", "dark fruit", "malt", "oak"] },

  { name: "High West Double Rye", distillery: "High West", type: "Rye", region: "Utah", proof: 92, price: 45, flavors: ["rye spice", "mint", "citrus", "oak"] },
  { name: "High West Rendezvous Rye", distillery: "High West", type: "Rye", region: "Utah", proof: 92, price: 55, flavors: ["rye spice", "oak", "caramel", "citrus"] },
  { name: "High West Campfire", distillery: "High West", type: "American Whiskey", region: "Utah", proof: 92, price: 60, flavors: ["smoke", "caramel", "spice", "oak"] },
  { name: "High West American Prairie Bourbon", distillery: "High West", type: "Bourbon", region: "Utah", proof: 92, price: 45, flavors: ["caramel", "corn", "oak", "vanilla"] },

  { name: "Smooth Ambler Old Scout Bourbon", distillery: "Smooth Ambler", type: "Bourbon", region: "West Virginia", proof: 100, price: 45, flavors: ["caramel", "corn", "oak", "vanilla"] },
  { name: "Smooth Ambler Old Scout Rye", distillery: "Smooth Ambler", type: "Rye", region: "West Virginia", proof: 100, price: 45, flavors: ["rye spice", "citrus", "oak", "pepper"] },
  { name: "Smooth Ambler Contradiction", distillery: "Smooth Ambler", type: "Bourbon", region: "West Virginia", proof: 100, price: 40, flavors: ["brown sugar", "spice", "oak", "vanilla"] },
  { name: "Smooth Ambler Big Level Wheated Bourbon", distillery: "Smooth Ambler", type: "Bourbon", region: "West Virginia", proof: 100, price: 45, flavors: ["wheat", "honey", "oak", "vanilla"] },

  { name: "WhistlePig 10 Year Rye", distillery: "WhistlePig", type: "Rye", region: "Vermont", proof: 100, price: 80, flavors: ["rye spice", "oak", "vanilla", "fruit"] },
  { name: "WhistlePig PiggyBack 6 Year Rye", distillery: "WhistlePig", type: "Rye", region: "Vermont", proof: 100, price: 50, flavors: ["rye spice", "citrus", "vanilla", "oak"] },
  { name: "WhistlePig FarmStock Rye", distillery: "WhistlePig", type: "Rye", region: "Vermont", proof: 86, price: 65, flavors: ["rye spice", "grain", "oak", "honey"] },
  { name: "WhistlePig Boss Hog", distillery: "WhistlePig", type: "Rye", region: "Vermont", proof: 128, price: 300, flavors: ["rye spice", "dark fruit", "oak", "heat"] },

  { name: "Chattanooga Whiskey 91 Proof Bourbon", distillery: "Chattanooga Whiskey", type: "Bourbon", region: "Tennessee", proof: 91, price: 40, flavors: ["caramel", "honey", "oak", "spice"] },
  { name: "Chattanooga Whiskey Cask 111", distillery: "Chattanooga Whiskey", type: "Bourbon", region: "Tennessee", proof: 111, price: 55, flavors: ["oak", "caramel", "spice", "heat"] },
  { name: "Chattanooga Whiskey 1816 Reserve", distillery: "Chattanooga Whiskey", type: "Bourbon", region: "Tennessee", proof: 92, price: 60, flavors: ["caramel", "dried fruit", "oak", "vanilla"] },

  { name: "Castle & Key Small Batch Bourbon", distillery: "Castle & Key", type: "Bourbon", region: "Kentucky", proof: 105, price: 45, flavors: ["caramel", "oak", "vanilla", "spice"] },
  { name: "Castle & Key Restoration Rye", distillery: "Castle & Key", type: "Rye", region: "Kentucky", proof: 92, price: 45, flavors: ["rye spice", "citrus", "mint", "oak"] },
  { name: "Castle & Key Bottled in Bond Bourbon", distillery: "Castle & Key", type: "Bourbon", region: "Kentucky", proof: 100, price: 55, flavors: ["caramel", "oak", "vanilla", "honey"] },

  { name: "Rabbit Hole Cavehill Bourbon", distillery: "Rabbit Hole", type: "Bourbon", region: "Kentucky", proof: 95, price: 45, flavors: ["caramel", "dried fruit", "oak", "vanilla"] },
  { name: "Rabbit Hole Dareringer", distillery: "Rabbit Hole", type: "Bourbon", region: "Kentucky", proof: 93, price: 60, flavors: ["sherry", "dark fruit", "caramel", "oak"] },
  { name: "Rabbit Hole Heigold", distillery: "Rabbit Hole", type: "Bourbon", region: "Kentucky", proof: 94, price: 55, flavors: ["caramel", "spice", "oak", "fruit"] },
  { name: "Rabbit Hole Boxergrail", distillery: "Rabbit Hole", type: "Rye", region: "Kentucky", proof: 95, price: 55, flavors: ["rye spice", "sherry", "citrus", "oak"] },

  { name: "Jefferson's Very Small Batch", distillery: "Jefferson's", type: "Bourbon", region: "Kentucky", proof: 82.3, price: 35, flavors: ["caramel", "vanilla", "oak", "honey"] },
  { name: "Jefferson's Ocean", distillery: "Jefferson's", type: "Bourbon", region: "Kentucky", proof: 90, price: 65, flavors: ["sea salt", "caramel", "oak", "vanilla"] },
  { name: "Jefferson's Reserve Very Old", distillery: "Jefferson's", type: "Bourbon", region: "Kentucky", proof: 90.2, price: 50, flavors: ["caramel", "dried fruit", "oak", "spice"] },
  { name: "Jefferson's Rye", distillery: "Jefferson's", type: "Rye", region: "Kentucky", proof: 84, price: 35, flavors: ["rye spice", "citrus", "oak", "honey"] },

  { name: "James E. Pepper 1776 Straight Bourbon", distillery: "James E. Pepper", type: "Bourbon", region: "Kentucky", proof: 100, price: 30, flavors: ["caramel", "rye spice", "oak", "vanilla"] },
  { name: "James E. Pepper 1776 Straight Rye", distillery: "James E. Pepper", type: "Rye", region: "Kentucky", proof: 100, price: 32, flavors: ["rye spice", "citrus", "oak", "pepper"] },
  { name: "James E. Pepper 1776 Barrel Proof Rye", distillery: "James E. Pepper", type: "Rye", region: "Kentucky", proof: 120, price: 55, flavors: ["rye spice", "oak", "heat", "citrus"] },

  { name: "Old Elk Wheated Bourbon", distillery: "Old Elk", type: "Bourbon", region: "Colorado", proof: 86, price: 55, flavors: ["wheat", "honey", "vanilla", "oak"] },
  { name: "Old Elk Straight Bourbon", distillery: "Old Elk", type: "Bourbon", region: "Colorado", proof: 94, price: 60, flavors: ["caramel", "oak", "spice", "fruit"] },
  { name: "Old Elk Cask Strength Wheated Bourbon", distillery: "Old Elk", type: "Bourbon", region: "Colorado", proof: 116, price: 90, flavors: ["wheat", "caramel", "oak", "heat"] },

  { name: "Milam & Greene Triple Cask Bourbon", distillery: "Milam & Greene", type: "Bourbon", region: "Texas", proof: 90, price: 55, flavors: ["caramel", "oak", "vanilla", "spice"] },
  { name: "Milam & Greene Port Cask Finished", distillery: "Milam & Greene", type: "Bourbon", region: "Texas", proof: 90, price: 65, flavors: ["port wine", "dark fruit", "caramel", "oak"] },
  { name: "Milam & Greene Straight Rye", distillery: "Milam & Greene", type: "Rye", region: "Texas", proof: 90, price: 55, flavors: ["rye spice", "citrus", "oak", "honey"] },

  { name: "Hillrock Solera Aged Bourbon", distillery: "Hillrock", type: "Bourbon", region: "New York", proof: 92, price: 90, flavors: ["caramel", "dried fruit", "oak", "spice"] },
  { name: "Hillrock Double Cask Rye", distillery: "Hillrock", type: "Rye", region: "New York", proof: 92, price: 90, flavors: ["rye spice", "dark fruit", "oak", "honey"] },
  { name: "Hillrock Single Malt", distillery: "Hillrock", type: "American Single Malt", region: "New York", proof: 92, price: 100, flavors: ["malt", "honey", "oak", "dried fruit"] },

  { name: "Bowman Brothers Small Batch", distillery: "A. Smith Bowman", type: "Bourbon", region: "Virginia", proof: 90, price: 30, flavors: ["caramel", "oak", "vanilla", "spice"] },
  { name: "John J. Bowman Single Barrel", distillery: "A. Smith Bowman", type: "Bourbon", region: "Virginia", proof: 100, price: 50, flavors: ["caramel", "leather", "oak", "dark fruit"] },
  { name: "Abraham Bowman Limited Edition", distillery: "A. Smith Bowman", type: "Bourbon", region: "Virginia", proof: 100, price: 80, flavors: ["caramel", "dark fruit", "oak", "spice"] },

  { name: "Reservoir Straight Bourbon", distillery: "Reservoir", type: "Bourbon", region: "Virginia", proof: 92, price: 45, flavors: ["caramel", "oak", "vanilla", "spice"] },
  { name: "Reservoir Straight Rye", distillery: "Reservoir", type: "Rye", region: "Virginia", proof: 92, price: 45, flavors: ["rye spice", "citrus", "oak", "pepper"] },
  { name: "Reservoir Straight Wheat Whiskey", distillery: "Reservoir", type: "American Whiskey", region: "Virginia", proof: 92, price: 45, flavors: ["wheat", "honey", "oak", "vanilla"] },

  { name: "Smoke Wagon Small Batch Bourbon", distillery: "Smoke Wagon", type: "Bourbon", region: "Nevada", proof: 96, price: 45, flavors: ["caramel", "oak", "vanilla", "spice"] },
  { name: "Smoke Wagon Uncut Unfiltered", distillery: "Smoke Wagon", type: "Bourbon", region: "Nevada", proof: 118, price: 65, flavors: ["dark fruit", "oak", "caramel", "heat"] },
  { name: "Smoke Wagon 7 Year Small Batch", distillery: "Smoke Wagon", type: "Bourbon", region: "Nevada", proof: 100, price: 55, flavors: ["caramel", "oak", "leather", "spice"] },

  { name: "Starlight Carriage House Bourbon", distillery: "Starlight", type: "Bourbon", region: "Indiana", proof: 92, price: 40, flavors: ["caramel", "corn", "oak", "vanilla"] },
  { name: "Starlight Rye", distillery: "Starlight", type: "Rye", region: "Indiana", proof: 92, price: 40, flavors: ["rye spice", "oak", "citrus", "pepper"] },
  { name: "Starlight 111 Cask Strength Bourbon", distillery: "Starlight", type: "Bourbon", region: "Indiana", proof: 111, price: 55, flavors: ["caramel", "oak", "spice", "heat"] },

  { name: "Yellowstone Select", distillery: "Limestone Branch", type: "Bourbon", region: "Kentucky", proof: 93, price: 35, flavors: ["caramel", "oak", "spice", "dried fruit"] },
  { name: "Yellowstone Bottled in Bond", distillery: "Limestone Branch", type: "Bourbon", region: "Kentucky", proof: 100, price: 50, flavors: ["caramel", "oak", "vanilla", "spice"] },
  { name: "Yellowstone Limited Edition", distillery: "Limestone Branch", type: "Bourbon", region: "Kentucky", proof: 101, price: 90, flavors: ["caramel", "dark fruit", "oak", "spice"] },
];

aiBottleLibrary.push(...expandedWhiskeyLibrary, ...expressionLineupLibrary, ...southernDistilleryLibrary, ...craftWhiskeyLibrary);
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
let infinityBottles = loadInfinityBottles();
let customLibrary = loadCustomLibrary();
let assistantHistory = loadAssistantHistory();
let activeFilter = "all";
let activeCategory = "all";
let activePourStyle = "all";
let activeProofBand = "all";
let activeFlavorFilter = null;
let selectionMode = false;
const selectedIds = new Set();
let activeView = "dashboard";
let previousViewBeforeFaceoff = "compare";
let faceoffPair = null;
const VIEW_MODE_KEY = "fip-view-mode";
let cardView = localStorage.getItem(VIEW_MODE_KEY) === "card";

const els = {
  bottleGrid: document.querySelector("#bottleGrid"),
  collectionPreviewRow: document.querySelector("#collectionPreviewRow"),
  collectionPreviewViewAll: document.querySelector("#collectionPreviewViewAll"),
  homeHeroBrowse: document.querySelector("#homeHeroBrowse"),
  homeHeroLogPour: document.querySelector("#homeHeroLogPour"),
  headerSearchButton: document.querySelector("#headerSearchButton"),
  profileView: document.querySelector("#profileView"),
  aboutView: document.querySelector("#aboutView"),
  bottleDetailView: document.querySelector("#bottleDetailView"),
  profileBottleCount: document.querySelector("#profileBottleCount"),
  profilePourCount: document.querySelector("#profilePourCount"),
  profileBottleKills: document.querySelector("#profileBottleKills"),
  profileFavoriteDistillery: document.querySelector("#profileFavoriteDistillery"),
  profileFavoriteProof: document.querySelector("#profileFavoriteProof"),
  profileCollectionValue: document.querySelector("#profileCollectionValue"),
  profileFlavorTags: document.querySelector("#profileFlavorTags"),
  profileFavoriteCompanion: document.querySelector("#profileFavoriteCompanion"),
  profileLegacyShelf: document.querySelector("#profileLegacyShelf"),
  homeGreeting: document.querySelector("#homeGreeting"),
  continueStoryCard: document.querySelector("#continueStoryCard"),
  continueStoryBody: document.querySelector("#continueStoryBody"),
  collectionSnapshotGrid: document.querySelector("#collectionSnapshotGrid"),
  recentPourStories: document.querySelector("#recentPourStories"),
  journeyInsightsGrid: document.querySelector("#journeyInsightsGrid"),
  noteList: document.querySelector("#noteList"),
  flavorList: document.querySelector("#flavorList"),
  flavorBottleList: document.querySelector("#flavorBottleList"),
  flavorRadar: document.querySelector("#flavorRadar"),
  cadenceDowBars: document.querySelector("#cadenceDowBars"),
  cadenceDowAxis: document.querySelector("#cadenceDowAxis"),
  cadenceMonthBars: document.querySelector("#cadenceMonthBars"),
  cadenceMonthAxis: document.querySelector("#cadenceMonthAxis"),
  seasonMoodBoard: document.querySelector("#seasonMoodBoard"),
  shelfList: document.querySelector("#shelfList"),
  coreBarHighlight: document.querySelector("#coreBarHighlight"),
  topRatedHighlight: document.querySelector("#topRatedHighlight"),
  pourStreakHighlight: document.querySelector("#pourStreakHighlight"),
  recommendation: document.querySelector("#recommendation"),
  recentActivity: document.querySelector("#recentActivity"),
  dashboardAssistantForm: document.querySelector("#dashboardAssistantForm"),
  dashboardAssistantPrompt: document.querySelector("#dashboardAssistantPrompt"),
  spinReel: document.querySelector("#spinReel"),
  spinNumber: document.querySelector("#spinNumber"),
  spinRandomNumber: document.querySelector("#spinRandomNumber"),
  spinBottleButton: document.querySelector("#spinBottleButton"),
  spinLogPour: document.querySelector("#spinLogPour"),
  resultCount: document.querySelector("#resultCount"),
  inventoryRatio: document.querySelector("#inventoryRatio"),
  totalBottles: document.querySelector("#totalBottles"),
  totalBottlesMeta: document.querySelector("#totalBottlesMeta"),
  openBottles: document.querySelector("#openBottles"),
  averageRating: document.querySelector("#averageRating"),
  estimatedValue: document.querySelector("#estimatedValue"),
  coreBarCount: document.querySelector("#coreBarCount"),
  coreScoreDisplay: document.querySelector("#coreScoreDisplay"),
  buyNextCount: document.querySelector("#buyNextCount"),
  topDistillery: document.querySelector("#topDistillery"),
  topDistilleryMeta: document.querySelector("#topDistilleryMeta"),
  openedSealed: document.querySelector("#openedSealed"),
  openedSealedMeta: document.querySelector("#openedSealedMeta"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  viewModeToggle: document.querySelector("#viewModeToggle"),
  bottleDialog: document.querySelector("#bottleDialog"),
  bottleForm: document.querySelector("#bottleForm"),
  formTitle: document.querySelector("#formTitle"),
  deleteBottle: document.querySelector("#deleteBottle"),
  saveAndAddAnother: document.querySelector("#saveAndAddAnother"),
  addAnotherStatus: document.querySelector("#addAnotherStatus"),
  collectionView: document.querySelector("#collectionView"),
  viewEyebrow: document.querySelector("#viewEyebrow"),
  viewTitle: document.querySelector("#viewTitle"),
  viewBanner: document.querySelector("#viewBanner"),
  viewAddButton: document.querySelector("#viewAddButton"),
  wishlistQuickAdd: document.querySelector("#wishlistQuickAdd"),
  wishlistQuickName: document.querySelector("#wishlistQuickName"),
  wishlistQuickSuggestions: document.querySelector("#wishlistQuickSuggestions"),
  toggleSelect: document.querySelector("#toggleSelect"),
  selectBar: document.querySelector("#selectBar"),
  selectCount: document.querySelector("#selectCount"),
  selectDelete: document.querySelector("#selectDelete"),
  selectCancel: document.querySelector("#selectCancel"),
  buyNextSuggest: document.querySelector("#buyNextSuggest"),
  dashboardView: document.querySelector("#dashboardView"),
  tastingView: document.querySelector("#tastingView"),
  pourLogView: document.querySelector("#pourLogView"),
  infinityView: document.querySelector("#infinityView"),
  infinityGrid: document.querySelector("#infinityGrid"),
  infinityDialog: document.querySelector("#infinityDialog"),
  infinityDetail: document.querySelector("#infinityDetail"),
  pourDialog: document.querySelector("#pourDialog"),
  pourWizard: document.querySelector("#pourWizard"),
  pourWizardTitle: document.querySelector("#pourWizardTitle"),
  pwDeleteEntry: document.querySelector("#pwDeleteEntry"),
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
  aiSuggestions: document.querySelector("#aiSuggestions"),
  aiFillDistillery: document.querySelector("#aiFillDistillery"),
  formAiTastingNote: document.querySelector("#formAiTastingNote"),
  scanLabelAction: document.querySelector("#scanLabelAction"),
  scanLabelText: document.querySelector("#scanLabelText"),
  labelScanInput: document.querySelector("#labelScanInput"),
  assistantMessages: document.querySelector("#assistantMessages"),
  assistantPrompt: document.querySelector("#assistantPrompt"),
  assistantForm: document.querySelector("#assistantForm"),
  compareA: document.querySelector("#compareA"),
  compareB: document.querySelector("#compareB"),
  compareOutput: document.querySelector("#compareOutput"),
  viewFullFaceoff: document.querySelector("#viewFullFaceoff"),
  compareView: document.querySelector("#compareView"),
  faceoffView: document.querySelector("#faceoffView"),
  faceoffBody: document.querySelector("#faceoffBody"),
  shareFaceoff: document.querySelector("#shareFaceoff"),
  closeFaceoff: document.querySelector("#closeFaceoff"),
  quickBottleDialog: document.querySelector("#quickBottleDialog"),
  quickBottleDetail: document.querySelector("#quickBottleDetail"),
  photoZoomDialog: document.querySelector("#photoZoomDialog"),
  photoZoomImage: document.querySelector("#photoZoomImage"),
  libraryDialog: document.querySelector("#libraryDialog"),
  librarySearch: document.querySelector("#librarySearch"),
  libraryList: document.querySelector("#libraryList"),
  formPhotoPanel: document.querySelector("#formPhotoPanel"),
  formPhotoPreview: document.querySelector("#formPhotoPreview"),
  formPhotoName: document.querySelector("#formPhotoName"),
  selectedBottlePreview: document.querySelector("#selectedBottlePreview"),
  selectedBottleImage: document.querySelector("#selectedBottleImage"),
  selectedBottleLabel: document.querySelector("#selectedBottleLabel"),
  photoUpload: document.querySelector("#photoUpload"),
  distilleryOptions: document.querySelector("#distilleryOptions"),
  categoryPicker: document.querySelector("#categoryPicker"),
  importActionLabel: document.querySelector("#importActionLabel"),
  signInButton: document.querySelector("#signInButton"),
  accountAvatarBadge: document.querySelector("#accountAvatarBadge"),
  accountInitials: document.querySelector("#accountInitials"),
  accountMenu: document.querySelector("#accountMenu"),
  accountMenuName: document.querySelector("#accountMenuName"),
  accountMenuEmail: document.querySelector("#accountMenuEmail"),
  appShell: document.querySelector("#appShell"),
  welcomeScreen: document.querySelector("#welcomeScreen"),
  hero: document.querySelector(".hero"),
  welcomeAddBottle: document.querySelector("#welcomeAddBottle"),
  welcomeSignIn: document.querySelector("#welcomeSignIn"),
  usernameDialog: document.querySelector("#usernameDialog"),
  usernameInput: document.querySelector("#usernameInput"),
  usernameError: document.querySelector("#usernameError"),
  saveUsername: document.querySelector("#saveUsername"),
  greetingModeUsername: document.querySelector("#greetingModeUsername"),
  greetingModeCustom: document.querySelector("#greetingModeCustom"),
  greetingNameInput: document.querySelector("#greetingNameInput"),
  friendsDrawer: document.querySelector("#friendsDrawer"),
  friendsBackdrop: document.querySelector("#friendsBackdrop"),
  friendsToggle: document.querySelector("#friendsToggle"),
  closeFriendsDrawer: document.querySelector("#closeFriendsDrawer"),
  followUsernameInput: document.querySelector("#followUsernameInput"),
  followButton: document.querySelector("#followButton"),
  followError: document.querySelector("#followError"),
  friendList: document.querySelector("#friendList"),
  followerList: document.querySelector("#followerList"),
  friendsBadge: document.querySelector("#friendsBadge"),
  followingCount: document.querySelector("#followingCount"),
  followerCount: document.querySelector("#followerCount"),
  friendInventoryDialog: document.querySelector("#friendInventoryDialog"),
  friendInventoryDetail: document.querySelector("#friendInventoryDetail"),
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
  msrp: document.querySelector("#msrp"),
  mashBillCorn: document.querySelector("#mashBillCorn"),
  mashBillRyeWheat: document.querySelector("#mashBillRyeWheat"),
  mashBillMalted: document.querySelector("#mashBillMalted"),
  rating: document.querySelector("#rating"),
  status: document.querySelector("#status"),
  ageStatement: document.querySelector("#ageStatement"),
  storeLocation: document.querySelector("#storeLocation"),
  shelf: document.querySelector("#shelf"),
  quantity: document.querySelector("#quantity"),
  fillLevel: document.querySelector("#fillLevel"),
  openedDate: document.querySelector("#openedDate"),
  pourStyle: document.querySelector("#pourStyle"),
  pourTier: document.querySelector("#pourTier"),
  bottleSize: document.querySelector("#bottleSize"),
  priority: document.querySelector("#priority"),
  legacyShelf: document.querySelector("#legacyShelf"),
  legacyShelfReason: document.querySelector("#legacyShelfReason"),
  flavors: document.querySelector("#flavors"),
  notes: document.querySelector("#notes"),
};

document.querySelector("#openBottleForm").addEventListener("click", () => openForm());
document.querySelector("#inventoryAddBottle").addEventListener("click", () => openForm());
els.viewAddButton.addEventListener("click", () => openFormWithStatus(els.viewAddButton.dataset.status));
els.wishlistQuickAdd.addEventListener("submit", (event) => {
  event.preventDefault();
  addWishlistItem(els.wishlistQuickName.value);
});
els.wishlistQuickName.addEventListener("input", renderWishlistQuickSuggestions);
els.wishlistQuickName.addEventListener("focus", renderWishlistQuickSuggestions);
els.toggleSelect.addEventListener("click", () => setSelectionMode(!selectionMode));
els.selectCancel.addEventListener("click", () => setSelectionMode(false));
els.selectDelete.addEventListener("click", bulkDeleteSelected);
document.querySelector("#closeDialog").addEventListener("click", () => els.bottleDialog.close());
document.querySelector("#openLibrary").addEventListener("click", openLibrary);
document.querySelector("#closeLibrary").addEventListener("click", () => els.libraryDialog.close());
document.querySelector("#newInfinityBottle").addEventListener("click", createInfinityBottle);
document.querySelector("#closePhotoZoom").addEventListener("click", () => els.photoZoomDialog.close());
els.photoZoomDialog.addEventListener("click", (event) => {
  if (event.target === els.photoZoomDialog) els.photoZoomDialog.close();
});
els.categoryPicker.addEventListener("click", (event) => {
  const button = event.target.closest(".category-tag-btn");
  if (!button) return;
  button.classList.toggle("is-selected");
});
els.flavorList.addEventListener("click", (event) => {
  const bar = event.target.closest(".flavor-bar");
  if (!bar) return;
  activeFlavorFilter = activeFlavorFilter === bar.dataset.flavor ? null : bar.dataset.flavor;
  renderFlavorMap();
});
els.flavorBottleList.addEventListener("click", (event) => {
  if (event.target.closest("[data-clear-flavor-filter]")) {
    activeFlavorFilter = null;
    renderFlavorMap();
    return;
  }
  const item = event.target.closest("[data-flavor-bottle]");
  if (item) openBottleQuick(item.dataset.flavorBottle);
});
document.querySelector("#openPourForm").addEventListener("click", () => openPourForm());
document.querySelector("#closePourDialog").addEventListener("click", () => els.pourDialog.close());
document.querySelector("#analyzePours").addEventListener("click", analyzePours);
els.searchInput.addEventListener("input", render);
els.librarySearch.addEventListener("input", renderLibrary);
function switchProfileTab(tab) {
  document.querySelectorAll("#profileTabs [data-profile-tab]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.profileTab === tab));
  document.querySelectorAll("[data-profile-tab-panel]").forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.profileTabPanel !== tab);
  });
}
document.querySelectorAll("#profileTabs [data-profile-tab]").forEach((tabButton) => {
  tabButton.addEventListener("click", () => switchProfileTab(tabButton.dataset.profileTab));
});
let currentPourTab = "sessions";

function switchPourStoriesTab(tab) {
  currentPourTab = tab;
  document.querySelectorAll("#pourStoriesTabs [data-story-tab]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.storyTab === tab));
  document.querySelectorAll("[data-story-tab-panel]").forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.storyTabPanel !== tab);
  });
  updateNavActiveStates(activeView);
}
document.querySelectorAll("#pourStoriesTabs [data-story-tab]").forEach((tabButton) => {
  tabButton.addEventListener("click", () => switchPourStoriesTab(tabButton.dataset.storyTab));
});
els.seasonMoodBoard?.addEventListener("click", (event) => {
  const chip = event.target.closest(".mini-flavor-chip[data-flavor]");
  if (!chip) return;
  activeFlavorFilter = activeFlavorFilter === chip.dataset.flavor ? null : chip.dataset.flavor;
  switchProfileTab("radar");
  renderFlavorMap();
});
const SORT_KEY = "fip-sort";
const savedSort = localStorage.getItem(SORT_KEY);
if (savedSort && [...els.sortSelect.options].some((option) => option.value === savedSort)) {
  els.sortSelect.value = savedSort;
}
els.sortSelect.addEventListener("change", () => {
  localStorage.setItem(SORT_KEY, els.sortSelect.value);
  render();
});
els.viewModeToggle?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-mode]");
  if (!button) return;
  cardView = button.dataset.viewMode === "card";
  localStorage.setItem(VIEW_MODE_KEY, cardView ? "card" : "list");
  render();
});
els.bottleForm.addEventListener("submit", saveBottle);
els.deleteBottle.addEventListener("click", deleteBottle);
els.saveAndAddAnother.addEventListener("click", saveBottleAndAddAnother);
document.querySelector("#buildTastingNote").addEventListener("click", buildGuidedTastingNote);
document.querySelector("#aiTastingNote").addEventListener("click", generateAiTastingNote);
els.aiFillDistillery.addEventListener("click", fillDistilleryWithAi);
els.formAiTastingNote.addEventListener("click", generateAiFormTastingNote);
els.spinBottleButton.addEventListener("click", spinForBottle);
els.spinRandomNumber.addEventListener("click", () => {
  els.spinNumber.value = 1 + Math.floor(Math.random() * 30);
});
els.spinLogPour.addEventListener("click", () => openPourForm(els.spinLogPour.dataset.bottleId || ""));
document.querySelector("#saveTastingNote").addEventListener("click", saveGuidedTastingNote);
document.querySelector("#logTastingPour").addEventListener("click", logGuidedTastingPour);
document.querySelector("#exportCollection").addEventListener("click", exportCollection);
document.querySelector("#importCollectionButton").addEventListener("click", () => document.querySelector("#importFile").click());
document.querySelector("#importFile").addEventListener("change", importCollection);
document.querySelector("#downloadImportTemplate").addEventListener("click", downloadImportTemplate);
document.querySelector("#refreshAiTools").addEventListener("click", renderAiTools);
document.querySelector("#clearAssistantChat").addEventListener("click", clearAssistantChat);
els.assistantForm.addEventListener("submit", sendAssistantMessage);
els.dashboardAssistantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  askFromDashboard();
});
document.querySelectorAll("[data-dashboard-prompt]").forEach((button) => {
  button.addEventListener("click", () => askFromDashboard(button.dataset.dashboardPrompt));
});
document.querySelectorAll("[data-assistant-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    els.assistantPrompt.value = button.dataset.assistantPrompt;
    sendAssistantMessage();
  });
});
document.querySelectorAll("[data-ai-action]").forEach((button) => {
  button.addEventListener("click", () => runAiTool(button.dataset.aiAction));
});
els.viewFullFaceoff.addEventListener("click", () => openFaceoffView(els.compareA.value, els.compareB.value));
els.closeFaceoff.addEventListener("click", closeFaceoffView);
els.shareFaceoff.addEventListener("click", shareFaceoffCard);
els.compareA.addEventListener("change", () => els.viewFullFaceoff.classList.add("is-hidden"));
els.compareB.addEventListener("change", () => els.viewFullFaceoff.classList.add("is-hidden"));
function applyMashBillSuggestion() {
  const hasMashBillEntered = fields.mashBillCorn.value || fields.mashBillRyeWheat.value || fields.mashBillMalted.value;
  if (hasMashBillEntered) return;
  const suggestion = suggestMashBill(fields.name.value, fields.distillery.value);
  if (!suggestion) return;
  fields.mashBillCorn.value = suggestion.corn;
  fields.mashBillRyeWheat.value = suggestion.ryeWheat;
  fields.mashBillMalted.value = suggestion.malted;
}

fields.name.addEventListener("input", () => {
  renderBottleSuggestions();
  updateFormPhotoTools();
  applyMashBillSuggestion();
});
fields.name.addEventListener("focus", renderBottleSuggestions);
fields.distillery.addEventListener("input", () => {
  updateFormPhotoTools();
  applyMashBillSuggestion();
});
fields.imageUrl.addEventListener("input", updateFormPhotoTools);
els.photoUpload.addEventListener("change", uploadBottlePhoto);
els.labelScanInput.addEventListener("change", scanBottleLabel);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".name-field")) {
    clearBottleSuggestions();
  }
  if (!event.target.closest(".wishlist-name-field")) {
    clearWishlistQuickSuggestions();
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

// Maps every underlying activeView value to the top-level nav tab it lives under,
// since Inventory and Collections each fan out into several legacy view states.
// "pour-log" is deliberately absent - Reviews and Journal share that one activeView
// and are disambiguated by which Pour Stories tab is currently open (see below).
const NAV_GROUPS = {
  dashboard: "dashboard",
  collection: "collection",
  "core-bar": "collection",
  opened: "collection",
  finished: "collection",
  compare: "collection",
  faceoff: "collection",
  infinity: "collection",
  "pour-log": "pour-log",
  "buy-next": "discover",
  wishlist: "discover",
  profile: "profile",
  about: "profile",
  "bottle-detail": "collection",
};

function updateNavActiveStates(view) {
  const group = NAV_GROUPS[view] || view;
  document
    .querySelectorAll(".nav-item[data-view]")
    .forEach((item) => item.classList.toggle("is-active", (NAV_GROUPS[item.dataset.view] || item.dataset.view) === group));
  document
    .querySelectorAll(".sub-nav-item[data-view]")
    .forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
}

function navigateToView(view) {
  activeView = view;
  updateNavActiveStates(view);
  const viewFilters = {
    wishlist: "wishlist",
    "core-bar": "core-bar",
    "buy-next": "buy-next",
    opened: "open",
    finished: "finished",
    dashboard: "all",
    collection: "all",
  };
  if (viewFilters[view]) {
    activeFilter = viewFilters[view];
    syncFilterButtons("[data-filter]", "filter", activeFilter);
  }
  render();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    navigateToView(button.dataset.view);
    if (button.dataset.navTab) switchPourStoriesTab(button.dataset.navTab);
    if (window.matchMedia("(max-width: 640px)").matches) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
});

// ---------------------------------------------------------------------------
// The Compass — the app's interactive core feature.
//
// Four cardinal pillars ring a center glass. Tapping a point expands its detail
// panel of sub-actions, each of which routes into a real part of the app so the
// compass is a live launcher, not just a diagram. Positions use compass bearings
// (N/E/S/W) to mirror the brand mark: Experience north, Reflect east, Share
// south, Discover west.
// ---------------------------------------------------------------------------
const COMPASS_ICONS = {
  discover:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 4 L13.4 10.6 L20 12 L13.4 13.4 L12 20 L10.6 13.4 L4 12 L10.6 10.6 Z" /></svg>',
  experience:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3h7c.2 2.5-.3 5.7-2.2 8-.6.8-.8 1.4-.8 2.4v3.1h-1v-3.1c0-1-.2-1.6-.8-2.4-1.9-2.3-2.4-5.5-2.2-8Z" /><path d="M9 19h6" /></svg>',
  reflect:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-1.8-1.4-4.8-1.4-7.5-.5v13c2.7-.9 5.7-.9 7.5.5 1.8-1.4 4.8-1.4 7.5-.5v-13C16.8 4.6 13.8 4.6 12 6Z" /><path d="M12 6v13" /></svg>',
  share:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.2" r="2.6" /><path d="M6.5 19.3c0-3 2.5-5.1 5.5-5.1s5.5 2.1 5.5 5.1" /><circle cx="4.8" cy="9.4" r="1.9" /><path d="M2 18.3c0-2.1 1.3-3.7 2.9-4.2" /><circle cx="19.2" cy="9.4" r="1.9" /><path d="M22 18.3c0-2.1-1.3-3.7-2.9-4.2" /></svg>',
};

const COMPASS_PILLARS = [
  {
    key: "experience",
    dir: "n",
    label: "Experience",
    tagline: "Start a pour · Live in the moment",
    links: [
      { label: "Start a Pour Story", run: () => { navigateToView("pour-log"); openPourForm(); } },
      { label: "Open Bottles", run: () => navigateToView("opened") },
      { label: "Your Collection", run: () => navigateToView("collection") },
    ],
  },
  {
    key: "reflect",
    dir: "e",
    label: "Reflect",
    tagline: "Record notes · Remember stories",
    links: [
      { label: "Past Pour Stories", run: () => { navigateToView("pour-log"); switchPourStoriesTab("sessions"); } },
      { label: "Tasting Notes", run: () => { navigateToView("pour-log"); switchPourStoriesTab("notes"); } },
      { label: "Compare Bottles", run: () => navigateToView("compare") },
      { label: "Infinity Bottle", run: () => navigateToView("infinity") },
    ],
  },
  {
    key: "share",
    dir: "s",
    label: "Share",
    tagline: "Share with friends · Inspire others",
    links: [
      { label: "Friends", run: () => els.friendsToggle?.click() },
      { label: "Your Profile", run: () => navigateToView("profile") },
    ],
  },
  {
    key: "discover",
    dir: "w",
    label: "Discover",
    tagline: "Find new bottles · Expand your palate",
    links: [
      { label: "Buy Next", run: () => navigateToView("buy-next") },
      { label: "Wish List", run: () => navigateToView("wishlist") },
      { label: "Whiskey Library", run: () => document.querySelector("#discoverLibraryButton")?.click() },
    ],
  },
];

let activeCompassPillar = null;

function buildCompass() {
  const mount = document.querySelector("#homeCompass");
  if (!mount || mount.dataset.built === "true") return;

  const points = COMPASS_PILLARS.map(
    (pillar) => `
      <button class="compass-point compass-point--${pillar.dir}" data-compass-point="${pillar.key}"
        type="button" aria-expanded="false" aria-controls="compassDetail">
        <span class="compass-point-icon" aria-hidden="true">${COMPASS_ICONS[pillar.key]}</span>
        <span class="compass-point-text">
          <strong>${pillar.label}</strong>
          <span>${pillar.tagline}</span>
        </span>
      </button>`,
  ).join("");

  mount.innerHTML = `
    <div class="compass-stage" role="group" aria-label="Compass points">
      <div class="compass-ring" aria-hidden="true">
        <span class="compass-ray compass-ray--n"></span>
        <span class="compass-ray compass-ray--e"></span>
        <span class="compass-ray compass-ray--s"></span>
        <span class="compass-ray compass-ray--w"></span>
      </div>
      <button class="compass-core" id="compassCore" type="button" aria-label="Fully Involved Pour">
        <span class="compass-core-glass" aria-hidden="true">\u{1F943}</span>
      </button>
      ${points}
    </div>
    <div class="compass-detail" id="compassDetail" aria-live="polite"></div>`;

  mount.dataset.built = "true";

  mount.querySelectorAll("[data-compass-point]").forEach((button) => {
    button.addEventListener("click", () => toggleCompassPillar(button.dataset.compassPoint));
  });
  mount.querySelector("#compassCore")?.addEventListener("click", () => setCompassPillar(null));
  renderCompassDetail();
}

function toggleCompassPillar(key) {
  setCompassPillar(activeCompassPillar === key ? null : key);
}

function setCompassPillar(key) {
  activeCompassPillar = key;
  const mount = document.querySelector("#homeCompass");
  if (!mount) return;
  mount.classList.toggle("is-open", Boolean(key));
  mount.querySelectorAll("[data-compass-point]").forEach((button) => {
    const isActive = button.dataset.compassPoint === key;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-expanded", isActive ? "true" : "false");
  });
  renderCompassDetail();
}

function renderCompassDetail() {
  const panel = document.querySelector("#compassDetail");
  if (!panel) return;
  const pillar = COMPASS_PILLARS.find((item) => item.key === activeCompassPillar);
  if (!pillar) {
    panel.innerHTML = "";
    panel.classList.remove("is-visible");
    return;
  }
  const links = pillar.links
    .map(
      (link, index) =>
        `<button class="compass-link" data-compass-link="${index}" type="button">${escapeHtml(link.label)}</button>`,
    )
    .join("");
  panel.innerHTML = `
    <div class="compass-detail-head">
      <span class="compass-detail-icon" aria-hidden="true">${COMPASS_ICONS[pillar.key]}</span>
      <div>
        <strong>${escapeHtml(pillar.label)}</strong>
        <span>${escapeHtml(pillar.tagline)}</span>
      </div>
    </div>
    <div class="compass-link-row">${links}</div>`;
  panel.classList.add("is-visible");
  panel.querySelectorAll("[data-compass-link]").forEach((button) => {
    button.addEventListener("click", () => {
      const link = pillar.links[Number(button.dataset.compassLink)];
      link?.run();
    });
  });
}

buildCompass();

els.homeHeroBrowse?.addEventListener("click", () => navigateToView("collection"));
els.collectionPreviewViewAll?.addEventListener("click", () => navigateToView("collection"));

els.homeHeroLogPour?.addEventListener("click", () => {
  navigateToView("pour-log");
  openPourForm();
});

els.headerSearchButton?.addEventListener("click", () => {
  navigateToView("collection");
  els.searchInput?.focus();
});

document.querySelector("#discoverLibraryButton")?.addEventListener("click", () => openLibrary());

function loadBottles() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  try {
    return JSON.parse(saved).map(normalizeBottle);
  } catch {
    return [];
  }
}

const CORE_BAR_THRESHOLD = 65;

function bottlePoursFor(bottleId) {
  return pours.filter((pour) => pour.bottleId === bottleId);
}

function computeCoreBarScore(bottle) {
  if (["wishlist", "buy-next"].includes(bottle.status)) return 0;

  const bottlePourList = bottlePoursFor(bottle.id);
  const pourCount = bottlePourList.length;
  const maxPourCount = Math.max(1, ...bottles.map((item) => bottlePoursFor(item.id).length));

  const ratingScore = Number(bottle.rating || 0) / 10;
  const pourScore = pourCount / maxPourCount;
  const rebuyScore = Number(bottle.quantity || 1) > 1 ? 1 : 0;

  const valueRatio = bottle.price > 0 && bottle.rating > 0 ? Number(bottle.rating) / Number(bottle.price) : 0;
  const maxValueRatio = Math.max(
    0.0001,
    ...bottles.map((item) => (item.price > 0 && item.rating > 0 ? Number(item.rating) / Number(item.price) : 0)),
  );
  const valueScore = valueRatio / maxValueRatio;

  // A pour counts as "shared" if the occasion says so, or a companion was logged
  // (anything other than drinking alone).
  const recommendedPours = bottlePourList.filter(
    (pour) =>
      /shar|recommend|friend|gift|impress/i.test(pour.occasion || "") ||
      (pour.companion && !/solo|alone|myself|no one/i.test(pour.companion)),
  ).length;
  const recommendScore = pourCount ? recommendedPours / pourCount : 0;

  let weighted = ratingScore * 0.3 + pourScore * 0.25 + rebuyScore * 0.15 + valueScore * 0.15 + recommendScore * 0.15;
  if (pourCount === 0) weighted *= 0.4;

  return Math.round(weighted * 100);
}

function syncCoreBarScores() {
  const newlyEarned = [];
  bottles = bottles.map((bottle) => {
    const score = computeCoreBarScore(bottle);
    const earned = score >= CORE_BAR_THRESHOLD;
    const updated = { ...bottle, coreBarScore: score, coreBar: earned };
    if (earned && !bottle.coreBar) newlyEarned.push(updated);
    return updated;
  });
  return newlyEarned;
}

function showDispatchUpdate(bottle) {
  if (!els.assistantMessages) return;
  const bubble = document.createElement("div");
  bubble.className = "assistant-message assistant dispatch-update";
  bubble.innerHTML = `<p>🔥 Dispatch Update<br><strong>${escapeHtml(bottle.name)}</strong> has earned a place on your Core Bar.</p>`;
  els.assistantMessages.appendChild(bubble);
  els.assistantMessages.scrollTop = els.assistantMessages.scrollHeight;
}

function persist() {
  const newlyEarned = syncCoreBarScores();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bottles));
  pushCloudData();
  newlyEarned.forEach(showDispatchUpdate);
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

function loadInfinityBottles() {
  const saved = localStorage.getItem(INFINITY_STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.map((entry) => ({ additions: [], notes: "", ...entry }))
      : [];
  } catch {
    return [];
  }
}

function persistInfinityBottles() {
  localStorage.setItem(INFINITY_STORAGE_KEY, JSON.stringify(infinityBottles));
  pushCloudData();
}

function loadCustomLibrary() {
  const saved = localStorage.getItem(CUSTOM_LIBRARY_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadAssistantHistory() {
  const saved = localStorage.getItem(ASSISTANT_HISTORY_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
      : [];
  } catch {
    return [];
  }
}

function persistAssistantHistory() {
  // Keep the last 10 exchanges (20 turns) — enough context for a natural conversation
  // without the payload growing without bound.
  assistantHistory = assistantHistory.slice(-20);
  localStorage.setItem(ASSISTANT_HISTORY_KEY, JSON.stringify(assistantHistory));
}

function clearAssistantChat() {
  assistantHistory = [];
  localStorage.removeItem(ASSISTANT_HISTORY_KEY);
  els.assistantMessages.innerHTML = "";
  appendAssistantMessage(
    "assistant",
    aiMessage("Dispatch ready. What's the call tonight? I can pick the right bottle by mood, occasion, flavor profile, or tier."),
  );
}

function persistPours() {
  localStorage.setItem(POUR_STORAGE_KEY, JSON.stringify(pours));
  const newlyEarned = syncCoreBarScores();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bottles));
  pushCloudData();
  newlyEarned.forEach(showDispatchUpdate);
}

function userDocRef(uid) {
  return db.collection("users").doc(uid);
}

async function pullCloudData(uid) {
  try {
    const snap = await userDocRef(uid).get();
    if (snap.exists) {
      const data = snap.data();
      bottles = (data.bottles || []).map(normalizeBottle);
      pours = data.pours || [];
      infinityBottles = (data.infinityBottles || []).map((entry) => ({ additions: [], notes: "", ...entry }));
      currentProfile = {
        username: data.username || "",
        greetingMode: data.greetingMode || "",
        greetingName: data.greetingName || "",
      };
      // Hydrate the local greeting preference from the cloud so it follows across devices.
      if (data.greetingMode) localStorage.setItem(GREETING_MODE_KEY, data.greetingMode);
      if (data.greetingName !== undefined) localStorage.setItem(GREETING_NAME_KEY, data.greetingName || "");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bottles));
      localStorage.setItem(POUR_STORAGE_KEY, JSON.stringify(pours));
      localStorage.setItem(INFINITY_STORAGE_KEY, JSON.stringify(infinityBottles));
      // Merge the cloud's learned library with anything learned locally before sign-in.
      let libraryChanged = false;
      (data.customLibrary || []).forEach((entry) => {
        if (learnBottleEntry(entry)) libraryChanged = true;
      });
      if (libraryChanged) renderDistilleryOptions();
      persistCustomLibrary();
    } else {
      currentProfile = { username: "" };
      await userDocRef(uid).set({ bottles, pours, infinityBottles, customLibrary, username: "", updatedAt: Date.now() });
    }
    syncCoreBarScores();
    updateAccountUI();
    render();
    refreshFriendsBadge();
    if (!currentProfile.username) openUsernameSetup();
  } catch (error) {
    console.error("Cloud sync failed to load", error);
  }
}

async function pushCloudData() {
  if (!currentUser || !db) return;
  try {
    await userDocRef(currentUser.uid).set(
      {
        bottles,
        pours,
        infinityBottles,
        customLibrary,
        username: currentProfile?.username || "",
        greetingMode: localStorage.getItem(GREETING_MODE_KEY) || "username",
        greetingName: localStorage.getItem(GREETING_NAME_KEY) || "",
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Cloud sync failed to save", error);
  }
}

function libraryKey(name, distillery) {
  return `${(name || "").trim()}-${(distillery || "").trim()}`.toLowerCase();
}

// Record a newly-seen bottle name/distillery into the growing local library (mutates
// in memory only — caller decides whether/when to persist). Returns true if it learned
// something new, so a bottle that already exists in the curated or custom library is a
// harmless no-op.
function learnBottleEntry(bottle) {
  const name = (bottle?.name || "").trim();
  if (name.length < 2) return false;
  const distillery = (bottle?.distillery || "").trim();
  let changed = false;

  const key = libraryKey(name, distillery);
  const alreadyKnown =
    aiBottleLibrary.some((entry) => libraryKey(entry.name, entry.distillery) === key) ||
    customLibrary.some((entry) => libraryKey(entry.name, entry.distillery) === key);
  if (!alreadyKnown) {
    customLibrary.push({
      name,
      distillery,
      type: bottle.type || "Bourbon",
      region: bottle.region || "",
      proof: Number(bottle.proof || 0),
      price: Number(bottle.price || 0),
      flavors: Array.isArray(bottle.flavors) ? bottle.flavors : [],
      imageUrl: bottle.imageUrl || "",
      learnedAt: Date.now(),
    });
    changed = true;
  }

  if (distillery && !availableDistilleries.some((known) => known.toLowerCase() === distillery.toLowerCase())) {
    availableDistilleries.push(distillery);
    availableDistilleries.sort((a, b) => a.localeCompare(b));
    changed = true;
  }

  return changed;
}

// Learn a bottle just added/saved by the user, so it (and its distillery) become
// suggestible for future adds even if this exact bottle is later edited or deleted.
function learnBottle(bottle) {
  if (!learnBottleEntry(bottle)) return;
  renderDistilleryOptions();
  persistCustomLibrary();
}

function persistCustomLibrary() {
  localStorage.setItem(CUSTOM_LIBRARY_KEY, JSON.stringify(customLibrary));
  pushCloudData();
}

function normalizeUsername(value) {
  // Preserve the capitalization the user typed; only strip disallowed characters.
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "");
}

// Case-insensitive key used for uniqueness and lookups so "Bob" and "bob" are the same handle.
function usernameKey(value) {
  return normalizeUsername(value).toLowerCase();
}

function syncGreetingFields() {
  const customActive = els.greetingModeCustom?.checked;
  if (els.greetingNameInput) {
    els.greetingNameInput.classList.toggle("is-hidden", !customActive);
    if (customActive) els.greetingNameInput.focus();
  }
}

function openUsernameSetup() {
  els.usernameError.textContent = "";
  els.usernameInput.value = currentProfile?.username || "";
  const mode = localStorage.getItem(GREETING_MODE_KEY) || "username";
  els.greetingModeUsername.checked = mode !== "custom";
  els.greetingModeCustom.checked = mode === "custom";
  els.greetingNameInput.value = localStorage.getItem(GREETING_NAME_KEY) || "";
  syncGreetingFields();
  els.usernameDialog.showModal();
}

// The greeting name lives in localStorage (so it works signed-out too) and, when
// signed in, rides along to the cloud profile. Separate from the social username.
function saveGreetingPreference() {
  const mode = els.greetingModeCustom?.checked ? "custom" : "username";
  localStorage.setItem(GREETING_MODE_KEY, mode);
  localStorage.setItem(GREETING_NAME_KEY, (els.greetingNameInput?.value || "").trim());
  if (currentProfile) {
    currentProfile = { ...currentProfile, greetingMode: mode, greetingName: (els.greetingNameInput?.value || "").trim() };
  }
  if (currentUser) pushCloudData();
  renderHomeGreeting();
}

async function claimUsername(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (username.length < 3 || username.length > 20) {
    els.usernameError.textContent = "Username must be 3-20 characters (letters, numbers, underscore).";
    return;
  }
  if (!currentUser) return;
  try {
    const key = usernameKey(username);
    const usernameRef = db.collection("usernames").doc(key);
    const existing = await usernameRef.get();
    if (existing.exists && existing.data().uid !== currentUser.uid) {
      els.usernameError.textContent = "That username is already taken.";
      return;
    }
    const previousKey = usernameKey(currentProfile?.username);
    const batch = db.batch();
    batch.set(usernameRef, { uid: currentUser.uid, username });
    batch.set(userDocRef(currentUser.uid), { username }, { merge: true });
    batch.set(db.collection("profiles").doc(currentUser.uid), { username });
    if (previousKey && previousKey !== key) {
      batch.delete(db.collection("usernames").doc(previousKey));
    }
    await batch.commit();
    currentProfile = { ...currentProfile, username };
    updateAccountUI();
    els.usernameDialog.close();
  } catch (error) {
    console.error("Username claim failed", error);
    els.usernameError.textContent = "Could not save that username. Try again.";
  }
}

let following = [];
let followers = [];

function followDocId(followerUid, followingUid) {
  return `${followerUid}_${followingUid}`;
}

async function loadFollowing() {
  if (!currentUser || !db) return;
  try {
    const snap = await db.collection("follows").where("followerUid", "==", currentUser.uid).get();
    following = snap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error("Failed to load following list", error);
  }
}

async function loadFollowers() {
  if (!currentUser || !db) return;
  try {
    const snap = await db.collection("follows").where("followingUid", "==", currentUser.uid).get();
    followers = snap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error("Failed to load followers list", error);
  }
}

async function followUsername(rawUsername) {
  els.followError.textContent = "";
  const key = usernameKey(rawUsername);
  if (!key || !currentUser) {
    els.followError.textContent = "Enter a username to follow.";
    return;
  }
  try {
    const usernameSnap = await db.collection("usernames").doc(key).get();
    if (!usernameSnap.exists) {
      els.followError.textContent = "No user found with that username.";
      return;
    }
    const targetUid = usernameSnap.data().uid;
    if (targetUid === currentUser.uid) {
      els.followError.textContent = "You can't follow yourself.";
      return;
    }
    await db
      .collection("follows")
      .doc(followDocId(currentUser.uid, targetUid))
      .set({
        followerUid: currentUser.uid,
        followerUsername: currentProfile?.username || "",
        followingUid: targetUid,
        followingUsername: usernameSnap.data().username || normalizeUsername(rawUsername),
        createdAt: Date.now(),
      });
    els.followUsernameInput.value = "";
    await renderFriendList();
  } catch (error) {
    console.error("Follow failed", error);
    els.followError.textContent = "Could not follow that user. Try again.";
  }
}

async function unfollowUser(targetUid) {
  if (!currentUser) return;
  try {
    await db.collection("follows").doc(followDocId(currentUser.uid, targetUid)).delete();
    await renderFriendList();
  } catch (error) {
    console.error("Unfollow failed", error);
  }
}

async function lookupProfileUsername(uid, fallback) {
  if (!db) return fallback || "Unknown";
  try {
    const snap = await db.collection("profiles").doc(uid).get();
    if (snap.exists && snap.data().username) return snap.data().username;
  } catch (error) {
    console.error("Profile lookup failed", error);
  }
  return fallback || "Unknown";
}

const FRIENDS_SEEN_KEY = "cellar-ledger-friends-seen";

async function loadMySalutesCount() {
  if (!currentUser || !db) return 0;
  const summary = await loadReactionsFor(currentUser.uid);
  let total = 0;
  summary.forEach((entry) => {
    total += entry.count;
  });
  return total;
}

function readFriendsSeenTotals() {
  try {
    return JSON.parse(localStorage.getItem(FRIENDS_SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}

function markFriendsSeen(totals) {
  localStorage.setItem(FRIENDS_SEEN_KEY, JSON.stringify(totals));
  els.friendsBadge.classList.add("is-hidden");
}

async function refreshFriendsBadge() {
  if (!currentUser || !els.friendsBadge) return;
  const [followerCount, saluteCount] = await Promise.all([
    loadFollowers().then(() => followers.length),
    loadMySalutesCount(),
  ]);
  const seen = readFriendsSeenTotals();
  const unseen = Math.max(0, followerCount - (seen.followers || 0)) + Math.max(0, saluteCount - (seen.salutes || 0));
  if (unseen > 0) {
    els.friendsBadge.textContent = unseen;
    els.friendsBadge.classList.remove("is-hidden");
  } else {
    els.friendsBadge.classList.add("is-hidden");
  }
}

async function renderFriendList() {
  await Promise.all([loadFollowing(), loadFollowers()]);

  const [followingNames, followerNames] = await Promise.all([
    Promise.all(following.map((entry) => lookupProfileUsername(entry.followingUid, entry.followingUsername))),
    Promise.all(followers.map((entry) => lookupProfileUsername(entry.followerUid, entry.followerUsername))),
  ]);

  els.followingCount.textContent = following.length;
  els.followerCount.textContent = followers.length;

  els.friendList.innerHTML = following.length
    ? following
        .map(
          (entry, index) => `
            <div class="friend-item">
              <strong>${escapeHtml(followingNames[index])}</strong>
              <div class="friend-item-actions">
                <button class="secondary-action" data-view-friend="${escapeHtml(entry.followingUid)}" data-friend-name="${escapeHtml(followingNames[index])}" type="button">View</button>
                <button class="secondary-action" data-unfollow="${escapeHtml(entry.followingUid)}" type="button">Unfollow</button>
              </div>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">You're not following anyone yet. Follow a friend by username above.</div>`;

  els.followerList.innerHTML = followers.length
    ? followers
        .map(
          (entry, index) => `
            <div class="friend-item">
              <strong>${escapeHtml(followerNames[index])}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">No one follows you yet.</div>`;

  els.friendList.querySelectorAll("[data-view-friend]").forEach((button) => {
    button.addEventListener("click", () => viewFriendInventory(button.dataset.viewFriend, button.dataset.friendName));
  });
  els.friendList.querySelectorAll("[data-unfollow]").forEach((button) => {
    button.addEventListener("click", () => unfollowUser(button.dataset.unfollow));
  });

  const saluteCount = await loadMySalutesCount();
  markFriendsSeen({ followers: followers.length, salutes: saluteCount });
}

function reactionDocId(ownerUid, bottleId, reactorUid) {
  return `${ownerUid}_${bottleId}_${reactorUid}`;
}

async function loadReactionsFor(ownerUid) {
  const summary = new Map();
  if (!db) return summary;
  try {
    const snap = await db.collection("reactions").where("ownerUid", "==", ownerUid).get();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const entry = summary.get(data.bottleId) || { count: 0, reactedByMe: false };
      entry.count += 1;
      if (currentUser && data.reactorUid === currentUser.uid) entry.reactedByMe = true;
      summary.set(data.bottleId, entry);
    });
  } catch (error) {
    console.error("Failed to load reactions", error);
  }
  return summary;
}

async function toggleSalute(ownerUid, bottleId, username) {
  if (!currentUser || !db) return;
  const ref = db.collection("reactions").doc(reactionDocId(ownerUid, bottleId, currentUser.uid));
  try {
    const existing = await ref.get();
    if (existing.exists) {
      await ref.delete();
    } else {
      await ref.set({
        ownerUid,
        bottleId,
        reactorUid: currentUser.uid,
        reactorUsername: currentProfile?.username || "",
        emoji: "🫡",
        createdAt: Date.now(),
      });
    }
    viewFriendInventory(ownerUid, username);
  } catch (error) {
    console.error("Salute failed", error);
  }
}

async function viewFriendInventory(targetUid, username) {
  try {
    const snap = await userDocRef(targetUid).get();
    const data = snap.exists ? snap.data() : { bottles: [] };
    const friendBottles = (data.bottles || []).map(normalizeBottle);
    const reactions = await loadReactionsFor(targetUid);
    els.friendInventoryDetail.innerHTML = `
      <div class="form-head">
        <div>
          <p>Friend's cabinet</p>
          <h2>${escapeHtml(username)}</h2>
        </div>
        <button class="icon-button" id="closeFriendInventory" type="button" aria-label="Close">×</button>
      </div>
      ${
        friendBottles.length
          ? `<div class="friend-bottle-list">${friendBottles
              .map((bottle) => {
                const reaction = reactions.get(bottle.id) || { count: 0, reactedByMe: false };
                return `
                  <div class="friend-bottle-item">
                    <img class="friend-bottle-photo" src="${bottleImage(bottle)}" alt="${escapeHtml(bottle.name)} bottle" />
                    <div class="friend-bottle-body">
                      <div class="friend-bottle-head">
                        <strong>${escapeHtml(bottle.name)}</strong>
                        <span class="status-pill ${bottle.status}">${labelStatus(bottle.status)}</span>
                      </div>
                      <span>${escapeHtml(bottle.distillery)} · ${escapeHtml(bottle.type)} · ${escapeHtml(bottle.region || "Unknown region")}</span>
                      <div class="flavor-row">
                        ${bottle.flavors.slice(0, 4).map((flavor) => `<span class="flavor-chip">${escapeHtml(flavor)}</span>`).join("")}
                      </div>
                      <div class="shelf-line">
                        <span>${numberOrDash(bottle.proof)} proof</span>
                        ${bottle.rating ? `<span>Rating ${numberOrDash(bottle.rating)}</span>` : ""}
                        ${bottleCategories(bottle).map((category) => `<span>${labelCategory(category)}</span>`).join("")}
                        <span>${labelPourStyle(bottle.pourStyle)}</span>
                        <span>${labelPourTier(bottle.pourTier)}</span>
                      </div>
                      <button class="salute-button${reaction.reactedByMe ? " is-saluted" : ""}" data-salute="${escapeHtml(bottle.id)}" type="button">
                        🫡 ${reaction.count > 0 ? reaction.count : "Salute"}
                      </button>
                    </div>
                  </div>
                `;
              })
              .join("")}</div>`
          : `<div class="empty-state">${escapeHtml(username)} hasn't added any bottles yet.</div>`
      }
    `;
    els.friendInventoryDialog.showModal();
    document.querySelector("#closeFriendInventory").addEventListener("click", () => els.friendInventoryDialog.close());
    els.friendInventoryDetail.querySelectorAll("[data-salute]").forEach((button) => {
      button.addEventListener("click", () => toggleSalute(targetUid, button.dataset.salute, username));
    });
  } catch (error) {
    console.error("Failed to load friend inventory", error);
  }
}

function computeInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function updateAccountUI() {
  if (currentUser) {
    els.signInButton.classList.add("is-hidden");
    els.accountAvatarBadge.classList.remove("is-hidden");
    const displayName = currentProfile?.username || currentUser.displayName || currentUser.email || "Signed in";
    els.accountInitials.textContent = computeInitials(displayName);
    if (els.accountMenuName) els.accountMenuName.textContent = displayName;
    if (els.accountMenuEmail) els.accountMenuEmail.textContent = currentUser.email || "";
  } else {
    els.signInButton.classList.remove("is-hidden");
    els.accountAvatarBadge.classList.add("is-hidden");
    closeAccountMenu();
  }
}

function closeAccountMenu() {
  els.accountMenu?.classList.add("is-hidden");
  els.accountAvatarBadge?.setAttribute("aria-expanded", "false");
}

function toggleAccountMenu() {
  if (!els.accountMenu) return;
  const willOpen = els.accountMenu.classList.contains("is-hidden");
  els.accountMenu.classList.toggle("is-hidden", !willOpen);
  els.accountAvatarBadge?.setAttribute("aria-expanded", String(willOpen));
}

let wasSignedIn = false;

if (auth) {
  auth.onAuthStateChanged((user) => {
    const isSignOut = !user && wasSignedIn;
    currentUser = user;
    wasSignedIn = !!user;
    updateAccountUI();
    if (user) {
      pullCloudData(user.uid);
    } else if (isSignOut) {
      bottles = [];
      pours = [];
      currentProfile = null;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(POUR_STORAGE_KEY);
      localStorage.removeItem(FRIENDS_SEEN_KEY);
      els.friendsBadge?.classList.add("is-hidden");
      render();
    }
  });
} else if (els.signInButton) {
  els.signInButton.disabled = true;
  els.signInButton.textContent = "Sign-in unavailable";
}

function signInWithGoogle() {
  if (!auth) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((error) => {
    console.error("Sign-in failed", error);
  });
}

els.signInButton?.addEventListener("click", signInWithGoogle);
els.welcomeSignIn?.addEventListener("click", signInWithGoogle);
els.welcomeAddBottle?.addEventListener("click", () => openForm());

els.accountAvatarBadge?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});

// Close the account menu on any outside click or Escape.
document.addEventListener("click", (event) => {
  if (els.accountMenu && !els.accountMenu.classList.contains("is-hidden") && !event.target.closest(".account-menu-wrap")) {
    closeAccountMenu();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAccountMenu();
});

document.querySelector("#accountMenuJourney")?.addEventListener("click", () => {
  closeAccountMenu();
  navigateToView("profile");
});
document.querySelector("#accountMenuEditName")?.addEventListener("click", () => {
  closeAccountMenu();
  openUsernameSetup();
});
document.querySelector("#accountMenuFriends")?.addEventListener("click", () => {
  closeAccountMenu();
  els.friendsToggle?.click();
});
document.querySelector("#accountMenuAbout")?.addEventListener("click", () => {
  closeAccountMenu();
  navigateToView("about");
});
document.querySelector("#accountMenuSignOut")?.addEventListener("click", () => {
  closeAccountMenu();
  auth?.signOut();
});

els.saveUsername?.addEventListener("click", saveAccountSettings);
els.greetingModeUsername?.addEventListener("change", syncGreetingFields);
els.greetingModeCustom?.addEventListener("change", syncGreetingFields);
els.followButton?.addEventListener("click", () => followUsername(els.followUsernameInput.value));

async function saveAccountSettings() {
  saveGreetingPreference();
  // A signed-in user must have a valid username; claimUsername validates, saves,
  // and closes the dialog (or shows an inline error). Signed-out users just keep
  // the greeting preference and close.
  if (currentUser) {
    await claimUsername(els.usernameInput.value);
  } else {
    els.usernameDialog.close();
  }
}

document.querySelector("#profileEditUsername")?.addEventListener("click", () => openUsernameSetup());
document.querySelector("#profileFriendsButton")?.addEventListener("click", () => els.friendsToggle?.click());
document.querySelector("#profileSignOut")?.addEventListener("click", () => auth?.signOut());

function openFriendsDrawer() {
  els.friendsDrawer.classList.add("is-open");
  els.friendsBackdrop.classList.remove("is-hidden");
  renderFriendList();
}

function closeFriendsDrawerFn() {
  els.friendsDrawer.classList.remove("is-open");
  els.friendsBackdrop.classList.add("is-hidden");
}

els.friendsToggle?.addEventListener("click", openFriendsDrawer);
els.closeFriendsDrawer?.addEventListener("click", closeFriendsDrawerFn);
els.friendsBackdrop?.addEventListener("click", closeFriendsDrawerFn);

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
      activeFilter === "recent" ||
      (activeFilter === "owned" && !["wishlist", "buy-next"].includes(bottle.status)) ||
      (activeFilter === "finished" && (bottle.status === "finished" || bottle.fillLevel === "empty")) ||
      (activeFilter === "ready-tonight" && bottle.status === "open" && bottle.fillLevel !== "empty") ||
      bottle.status === activeFilter ||
      (activeFilter === "core-bar" && bottle.coreBar) ||
      (activeFilter === "favorites" && bottle.favorite);
    const matchesCategory = activeCategory === "all" || bottleCategories(bottle).includes(activeCategory);
    const matchesPour = activePourStyle === "all" || bottle.pourStyle === activePourStyle;
    const matchesProof = activeProofBand === "all" || proofBandFor(bottle.proof) === activeProofBand;
    const haystack = [
      bottle.name,
      bottle.distillery,
      bottle.type,
      bottle.region,
      bottle.ageStatement,
      bottle.storeLocation,
      bottle.shelf,
      bottleCategories(bottle).join(" "),
      bottle.pourStyle,
      bottle.notes,
      bottle.flavors.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return matchesFilter && matchesCategory && matchesPour && matchesProof && haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    // On Buy Next, order the shortlist by priority so the ones you move up rise to the top.
    if (activeView === "buy-next") {
      const priorityGap = Number(a.priority || 3) - Number(b.priority || 3);
      if (priorityGap !== 0) return priorityGap;
      return a.name.localeCompare(b.name);
    }
    // Recently Added: newest first, falling back to insertion order (new bottles are prepended).
    if (activeFilter === "recent") {
      const recencyGap = Number(b.createdAt || 0) - Number(a.createdAt || 0);
      if (recencyGap !== 0) return recencyGap;
      return bottles.indexOf(a) - bottles.indexOf(b);
    }
    const sort = els.sortSelect.value;
    if (sort === "custom") return compareCustomOrder(a, b);
    if (sort === "rating") return Number(b.rating) - Number(a.rating);
    if (sort === "value") return Number(b.price) - Number(a.price);
    if (sort === "proof") return Number(b.proof) - Number(a.proof);
    return a.name.localeCompare(b.name);
  });
}

// "My order": bottles with an assigned order come first in that order; the rest
// keep their insertion order until the user arranges them.
function compareCustomOrder(a, b) {
  const ao = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
  const bo = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return bottles.indexOf(a) - bottles.indexOf(b);
}

// Move a bottle one slot up/down within the current view and persist the new order.
function moveBottleOrder(id, direction) {
  const visible = visibleBottles();
  const vIdx = visible.findIndex((bottle) => bottle.id === id);
  const targetId = visible[vIdx + direction]?.id;
  if (vIdx < 0 || !targetId) return;

  const ordered = [...bottles].sort(compareCustomOrder);
  const item = ordered.splice(ordered.findIndex((bottle) => bottle.id === id), 1)[0];
  const targetIdx = ordered.findIndex((bottle) => bottle.id === targetId);
  ordered.splice(direction > 0 ? targetIdx + 1 : targetIdx, 0, item);
  ordered.forEach((bottle, index) => {
    bottle.order = index;
  });

  persist();
  render();
}

function updateWelcomeVisibility() {
  const showWelcome = !currentUser && bottles.length === 0;
  els.welcomeScreen.classList.toggle("is-hidden", !showWelcome);
  els.appShell.classList.toggle("is-hidden", showWelcome);
}

const VIEW_META = {
  collection: { eyebrow: "Inventory", title: "Your cabinet", theme: "", banner: "" },
  "core-bar": {
    eyebrow: "Core Bar",
    title: "Earned the Core Bar 🔥",
    theme: "view-core-bar",
    banner: "🔥 The proven shelf. Bottles earn their spot with a Core Bar Score of 65+ from ratings, pours, and rebuys.",
  },
  "buy-next": {
    eyebrow: "Buy Next",
    title: "On the hunt 🎯",
    theme: "view-buy-next",
    banner: "🎯 Your shopping shortlist — plus picks suggested from what you already pour.",
    addStatus: "buy-next",
    addLabel: "＋ Add to Buy Next",
  },
  wishlist: {
    eyebrow: "Wish List",
    title: "Someday bottles ☆",
    theme: "view-wishlist",
    banner: "☆ Dream drams and unicorns. No pressure, just aspiration.",
    addStatus: "wishlist",
    addLabel: "＋ Add to Wish List",
  },
  opened: { eyebrow: "Opened", title: "Open bottles", theme: "", banner: "" },
  finished: { eyebrow: "Finished", title: "Finished bottles", theme: "", banner: "" },
};

function applyViewIdentity() {
  const meta = VIEW_META[activeView] || VIEW_META.collection;
  els.viewEyebrow.textContent = meta.eyebrow;
  els.viewTitle.textContent = meta.title;
  els.collectionView.className = `bottle-section ${meta.theme}`.trim();
  els.viewBanner.textContent = meta.banner;
  els.viewBanner.classList.toggle("is-hidden", !meta.banner);

  if (meta.addStatus) {
    els.viewAddButton.textContent = meta.addLabel;
    els.viewAddButton.dataset.status = meta.addStatus;
    els.viewAddButton.classList.remove("is-hidden");
  } else {
    els.viewAddButton.classList.add("is-hidden");
  }
}

function render() {
  updateWelcomeVisibility();
  const shown = visibleBottles();
  els.hero.classList.toggle("is-hidden", bottles.length > 0);
  applyViewIdentity();
  renderBuyNextSuggestions();
  renderWishlistQuickAdd();
  const inventoryToolsVisible = ["collection", "opened", "finished"].includes(activeView);
  document
    .querySelectorAll(".inventory-overview, .toolbar, .quick-filters, .filter-shell, .stats-grid")
    .forEach((section) => section.classList.toggle("is-hidden", !inventoryToolsVisible));
  // Leaving an inventory view drops selection mode so the bulk bar can't linger.
  if (selectionMode && !inventoryToolsVisible) {
    selectionMode = false;
    selectedIds.clear();
    els.toggleSelect.textContent = "Select";
    els.toggleSelect.classList.remove("is-selected");
  }
  const collectionVisible = !["pour-log", "infinity", "dashboard", "compare", "faceoff", "profile", "about", "bottle-detail"].includes(activeView);
  els.collectionView.classList.toggle("is-hidden", !collectionVisible);
  els.dashboardView.classList.toggle("is-hidden", activeView !== "dashboard");
  els.pourLogView.classList.toggle("is-hidden", activeView !== "pour-log");
  els.infinityView.classList.toggle("is-hidden", activeView !== "infinity");
  els.compareView.classList.toggle("is-hidden", activeView !== "compare");
  els.faceoffView.classList.toggle("is-hidden", activeView !== "faceoff");
  els.profileView.classList.toggle("is-hidden", activeView !== "profile");
  els.aboutView.classList.toggle("is-hidden", activeView !== "about");
  els.bottleDetailView.classList.toggle("is-hidden", activeView !== "bottle-detail");
  if (activeView === "faceoff") renderFaceoffView();
  if (activeView === "bottle-detail") renderBottleDetailView();
  if (activeView === "infinity") renderInfinityGrid();
  if (activeView === "profile") renderProfile();

  const collectionGroupViews = ["collection", "core-bar", "opened", "finished", "compare", "infinity", "faceoff"];
  document.querySelector("#collectionSubNav")?.classList.toggle("is-hidden", !collectionGroupViews.includes(activeView));
  document.querySelector("#discoverSubNav")?.classList.toggle("is-hidden", !["buy-next", "wishlist"].includes(activeView));

  renderStats();
  renderCollectionPreview();
  renderCards(shown);
  renderFlavorMap();
  renderPourCadence();
  renderSeasonalMoodBoard();
  renderShelfMap();
  renderCoreBarHighlight();
  renderTopRatedHighlight();
  renderPourStreakHighlight();
  renderRecommendation();
  renderHomeGreeting();
  renderContinueStoryCard();
  renderCollectionSnapshot();
  renderRecentPourStories();
  renderJourneyInsights();
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
  const shownOwnedCount = visibleBottles()
    .filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status))
    .reduce((sum, bottle) => sum + Number(bottle.quantity || 1), 0);
  els.inventoryRatio.textContent = `${shownOwnedCount} of ${bottleCount} bottles`;
}

function renderCards(shown) {
  els.resultCount.textContent = `${shown.length} shown`;
  els.viewModeToggle?.querySelectorAll("[data-view-mode]").forEach((button) => {
    button.classList.toggle("is-selected", (button.dataset.viewMode === "card") === cardView);
  });
  els.bottleGrid.classList.toggle("selecting", selectionMode);
  updateSelectBar();

  if (!shown.length) {
    const viewEmptyMessages = {
      "core-bar": "No bottles have earned the Core Bar yet. Rate, pour, and rebuy — the ones that prove themselves show up here.",
      wishlist: "Your wish list is empty. Add a bottle with status Wish List to start the hunt.",
      "buy-next": "Nothing on the shortlist yet. Add bottles with status Buy Next, or grab a suggestion above.",
    };
    const viewEmpty = viewEmptyMessages[activeView];
    els.bottleGrid.innerHTML = viewEmpty
      ? `<div class="empty-state">${viewEmpty}</div>`
      : bottles.length
      ? `<div class="empty-state">No bottles match the current search and filters.</div>`
      : `
        <div class="empty-state first-run-nudge">
          <p>Your cabinet is empty. Add your first bottle to start tracking pours, ratings, and your Core Bar.</p>
          <div class="first-run-actions">
            <button class="primary-action" id="firstRunAddBottle" type="button">Add Bottle</button>
          </div>
        </div>
      `;
    document.querySelector("#firstRunAddBottle")?.addEventListener("click", () => openForm());
    return;
  }

  const isBuyNext = activeView === "buy-next";
  const customOrder = !isBuyNext && !selectionMode && els.sortSelect.value === "custom";

  if (cardView) {
    els.bottleGrid.classList.remove("catalog-view");
    els.bottleGrid.innerHTML = shown
      .map((bottle, index) => renderBottleTile(bottle, index, shown.length, isBuyNext, customOrder))
      .join("");
  } else {
    els.bottleGrid.classList.add("catalog-view");
    els.bottleGrid.innerHTML = `
      <div class="catalog-list">
        ${shown
          .map(
            (bottle, index) => `
          <div class="catalog-row${bottle.coreBar ? " is-core" : ""}${selectionMode && selectedIds.has(bottle.id) ? " is-selected" : ""}" data-quick="${bottle.id}">
            ${
              selectionMode
                ? `<span class="select-check${selectedIds.has(bottle.id) ? " is-checked" : ""}" aria-hidden="true">✓</span>`
                : `<span class="catalog-index">${String(index + 1).padStart(2, "0")}</span>`
            }
            ${bottleThumb(bottle)}
            <div class="catalog-main">
              <h3>${escapeHtml(bottle.name)}</h3>
              <p>${escapeHtml([bottle.distillery, bottle.region].filter(Boolean).join(" · ") || "No details yet")}</p>
              <div class="catalog-tag${bottle.coreBar ? " is-core" : ""}">
                ${bottle.coreBar ? "🔥 Core Bar" : escapeHtml(labelStatus(bottle.status))}${Number(bottle.proof) > 0 ? ` · ${numberOrDash(bottle.proof)}pf` : ""}
              </div>
              ${journeyStatusBadge(bottle)}
              ${isStorePick(bottle) ? `<span class="store-pick-pill">🏪 Store Pick</span>` : ""}
            </div>
            ${renderBottleRowActions(bottle, index, shown.length, isBuyNext, customOrder)}
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  bindBottleActions();
}

// Where a bottle sits on its own arc, from unopened to finished — shown as a small
// badge on every card so the collection reads as a set of journeys, not just stock.
function journeyStatus(bottle) {
  if (["wishlist", "buy-next"].includes(bottle.status)) return null;
  if (bottle.status === "finished" || bottle.fillLevel === "empty") return { emoji: "⚫", label: "Bottle Kill" };
  if (bottle.status === "sealed") return { emoji: "🟢", label: "New" };
  if (["half", "low"].includes(bottle.fillLevel)) return { emoji: "🟠", label: "Peak" };
  return { emoji: "🟡", label: "Opening Up" };
}

function journeyStatusBadge(bottle) {
  const status = journeyStatus(bottle);
  return status ? `<span class="journey-status-badge" title="${escapeHtml(status.label)}">${status.emoji} ${escapeHtml(status.label)}</span>` : "";
}

// Shared right-side action markup (priority/rating/favorite/mark-owned/reorder) used by
// both the list rows and the card tiles, so the two layouts never drift out of parity.
function renderBottleRowActions(bottle, index, total, isBuyNext, customOrder) {
  if (isBuyNext) {
    return `
      <div class="catalog-right">
        <strong class="catalog-priority">${escapeHtml(priorityLabel(bottle.priority).split(" ")[0])}</strong>
        <span>${bottle.price ? money(bottle.price) : ""}</span>
      </div>
      ${renderPriorityControlCompact(bottle)}
    `;
  }
  return `
    <div class="catalog-right">
      <strong class="catalog-rating${Number(bottle.rating) > 0 ? "" : " is-empty"}">${numberOrDash(bottle.rating)}</strong>
      <span>${bottle.price ? money(bottle.price) : ""}</span>
    </div>
    ${
      customOrder
        ? renderMoveControl(bottle, index, total)
        : bottle.status === "wishlist"
          ? `<button class="catalog-own-btn" data-mark-owned="${bottle.id}" type="button" title="Mark as owned">✓ Got it</button>`
          : `<button class="catalog-fav${bottle.favorite ? " is-fav" : ""}" data-favorite="${bottle.id}" type="button" aria-label="${bottle.favorite ? "Remove from favorites" : "Add to favorites"}">♥</button>`
    }
  `;
}

function renderBottleTile(bottle, index, total, isBuyNext, customOrder) {
  const isSelected = selectionMode && selectedIds.has(bottle.id);
  return `
    <article class="bottle-tile${bottle.coreBar ? " is-core" : ""}${isSelected ? " is-selected" : ""}" data-quick="${bottle.id}">
      ${selectionMode ? `<span class="select-check tile-select-check${isSelected ? " is-checked" : ""}" aria-hidden="true">✓</span>` : ""}
      ${bottle.coreBar ? `<div class="tile-core-ribbon">🔥 Core Bar</div>` : ""}
      ${bottleThumb(bottle, "tile-photo")}
      <div class="tile-body">
        <h3>${escapeHtml(bottle.name)}</h3>
        <p>${escapeHtml([bottle.distillery, bottle.region].filter(Boolean).join(" · ") || "No details yet")}</p>
        <div class="catalog-tag${bottle.coreBar ? " is-core" : ""}">
          ${bottle.coreBar ? "🔥 Core Bar" : escapeHtml(labelStatus(bottle.status))}${Number(bottle.proof) > 0 ? ` · ${numberOrDash(bottle.proof)}pf` : ""}
        </div>
        ${journeyStatusBadge(bottle)}
        ${isStorePick(bottle) ? `<span class="store-pick-pill">🏪 Store Pick</span>` : ""}
        <div class="tile-footer">
          ${renderBottleRowActions(bottle, index, total, isBuyNext, customOrder)}
        </div>
      </div>
    </article>
  `;
}

let buyNextPicks = [];

function computeBuyNextSuggestions() {
  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  if (!owned.length) return [];

  const haveNames = new Set(bottles.map((bottle) => bottle.name.toLowerCase()));
  const distilleryCount = {};
  const flavorCount = {};
  const typeCount = {};
  owned.forEach((bottle) => {
    distilleryCount[bottle.distillery] = (distilleryCount[bottle.distillery] || 0) + 1;
    typeCount[bottle.type] = (typeCount[bottle.type] || 0) + 1;
    (bottle.flavors || []).forEach((flavor) => {
      flavorCount[flavor] = (flavorCount[flavor] || 0) + 1;
    });
  });

  const perDistillery = {};
  return aiBottleLibrary
    .filter((candidate) => !haveNames.has(candidate.name.toLowerCase()))
    .map((candidate) => {
      let score = 0;
      const reasons = [];
      const fromSame = distilleryCount[candidate.distillery] || 0;
      if (fromSame) {
        score += Math.min(fromSame, 3) * 12;
        reasons.push(`you own ${fromSame} bottle${fromSame === 1 ? "" : "s"} from ${candidate.distillery}`);
      }
      const overlap = (candidate.flavors || []).filter((flavor) => flavorCount[flavor]);
      if (overlap.length) {
        score += overlap.length * 8;
        reasons.push(`matches your ${overlap.slice(0, 2).join(" & ")} profile`);
      }
      if (typeCount[candidate.type]) score += 4;
      return { ...candidate, score, reason: reasons[0] || "" };
    })
    .filter((candidate) => candidate.score >= 12)
    .sort((a, b) => b.score - a.score)
    .filter((candidate) => {
      perDistillery[candidate.distillery] = (perDistillery[candidate.distillery] || 0) + 1;
      return perDistillery[candidate.distillery] <= 2;
    })
    .slice(0, 6);
}

function renderBuyNextSuggestions() {
  if (activeView !== "buy-next") {
    els.buyNextSuggest.classList.add("is-hidden");
    els.buyNextSuggest.innerHTML = "";
    return;
  }

  buyNextPicks = computeBuyNextSuggestions();
  els.buyNextSuggest.classList.remove("is-hidden");

  if (!buyNextPicks.length) {
    els.buyNextSuggest.innerHTML = `
      <div class="suggest-head"><span>Suggested for you</span></div>
      <p class="suggest-empty">Add a few bottles to your inventory and suggestions based on what you pour will show up here.</p>
    `;
    return;
  }

  els.buyNextSuggest.innerHTML = `
    <div class="suggest-head"><span>Suggested for you</span><em>based on your inventory</em></div>
    <div class="suggest-grid">
      ${buyNextPicks
        .map(
          (pick, index) => `
            <article class="suggest-card" data-suggest-quick="${index}" role="button" tabindex="0" title="View details">
              <img class="suggest-photo" src="${bottleImage(pick)}" alt="${escapeHtml(pick.name)} bottle" />
              <h4>${escapeHtml(pick.name)}</h4>
              <p>${escapeHtml(pick.distillery)} · ${escapeHtml(pick.type)} · ${numberOrDash(pick.proof)} proof${pick.price ? ` · ~${money(pick.price)}` : ""}</p>
              ${pick.reason ? `<em>Because ${escapeHtml(pick.reason)}</em>` : ""}
              <button class="secondary-action" type="button" data-suggest-add="${index}">＋ Add to Buy Next</button>
            </article>
          `,
        )
        .join("")}
    </div>
  `;

  els.buyNextSuggest.querySelectorAll("[data-suggest-quick]").forEach((card) => {
    const open = () => openSuggestionQuick(Number(card.dataset.suggestQuick));
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-suggest-add]")) return;
      open();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  els.buyNextSuggest.querySelectorAll("[data-suggest-add]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      addPickToBuyNext(buyNextPicks[Number(button.dataset.suggestAdd)]);
    });
  });
}

function renderWishlistQuickAdd() {
  const isWishlist = activeView === "wishlist";
  els.wishlistQuickAdd.classList.toggle("is-hidden", !isWishlist);
  if (!isWishlist) clearWishlistQuickSuggestions();
}

// Accepts a plain typed name (manual entry) or a matched bottle object from the
// suggestions dropdown, in which case the known distillery/type/proof/flavors carry over.
function addWishlistItem(input) {
  const seed = typeof input === "string" ? { name: input } : input || {};
  const name = (seed.name || "").trim();
  if (!name) return;
  const imageUrl = seed.imageUrl || getCuratedBottleImage(seed) || "";
  const bottle = normalizeBottle({
    id: crypto.randomUUID(),
    name,
    distillery: seed.distillery || "",
    type: seed.type || "Bourbon",
    region: seed.region || "",
    proof: seed.proof || 0,
    price: seed.price || 0,
    msrp: seed.price || 0,
    flavors: seed.flavors || [],
    imageUrl,
    status: "wishlist",
    createdAt: Date.now(),
  });
  bottles = [bottle, ...bottles];
  persist();
  learnBottle(bottle);
  els.wishlistQuickName.value = "";
  clearWishlistQuickSuggestions();
  render();
  els.wishlistQuickName.focus();
}

function renderWishlistQuickSuggestions() {
  const query = els.wishlistQuickName.value.trim();
  if (query.length < 2) {
    clearWishlistQuickSuggestions();
    return;
  }

  const matches = getBottleSuggestions(query);
  if (!matches.length) {
    els.wishlistQuickSuggestions.innerHTML = `
      <div class="ai-empty">Not in the library yet — hit Add to save "${escapeHtml(query)}" manually.</div>
    `;
    return;
  }

  els.wishlistQuickSuggestions.innerHTML = `
    <div class="ai-label">Bottle matches</div>
    ${matches
      .map(
        (bottle, index) => `
          <button class="ai-suggestion" type="button" data-wishlist-suggestion="${index}">
            <img src="${bottleImage(bottle)}" alt="" />
            <span>
              <strong>${escapeHtml(bottle.name)}</strong>
              <em>${escapeHtml(bottle.distillery)} · ${escapeHtml(bottle.type)} · ${numberOrDash(bottle.proof)} proof</em>
            </span>
          </button>
        `,
      )
      .join("")}
  `;

  els.wishlistQuickSuggestions.querySelectorAll("[data-wishlist-suggestion]").forEach((button) => {
    button.addEventListener("click", () => addWishlistItem(matches[Number(button.dataset.wishlistSuggestion)]));
  });
}

function clearWishlistQuickSuggestions() {
  els.wishlistQuickSuggestions.innerHTML = "";
}

function addPickToBuyNext(pick) {
  if (!pick) return;
  const bottle = normalizeBottle({
    id: crypto.randomUUID(),
    name: pick.name,
    distillery: pick.distillery,
    type: pick.type,
    region: pick.region || "",
    proof: pick.proof || 0,
    price: pick.price || 0,
    msrp: pick.price || 0,
    flavors: pick.flavors || [],
    status: "buy-next",
    createdAt: Date.now(),
  });
  bottles = [bottle, ...bottles];
  persist();
  render();
}

function openSuggestionQuick(index) {
  const pick = buyNextPicks[index];
  if (!pick) return;
  const flavors = (pick.flavors || []).slice(0, 6);
  els.quickBottleDetail.innerHTML = `
    <div class="form-head">
      <div>
        <p>Suggested pick</p>
        <h2>${escapeHtml(pick.name)}</h2>
      </div>
      <button class="icon-button" id="closeSuggestionQuick" type="button" aria-label="Close">×</button>
    </div>

    <div class="quick-detail-grid">
      <img class="quick-detail-photo" src="${bottleImage(pick)}" alt="${escapeHtml(pick.name)} bottle" />
      <div>
        <span class="status-pill buy-next">Suggested for you</span>
        <p>${escapeHtml(pick.distillery)} · ${escapeHtml(pick.type)} · ${escapeHtml(pick.region || "Unknown region")}</p>
        <div class="bottle-meta">
          <div><span>Proof</span><strong>${numberOrDash(pick.proof)}</strong></div>
          <div><span>Est. Price</span><strong>${pick.price ? money(pick.price) : "—"}</strong></div>
        </div>
        ${pick.reason ? `<p class="suggest-reason">Because ${escapeHtml(pick.reason)}</p>` : ""}
        ${flavors.length ? `<div class="flavor-row">${flavors.map((flavor) => `<span class="flavor-chip">${escapeHtml(flavor)}</span>`).join("")}</div>` : ""}
      </div>
    </div>

    <div class="photo-source-panel">
      <span>Find actual bottle photo</span>
      ${renderPhotoSourceLinks(pick)}
    </div>
    <div class="form-actions">
      <button class="primary-action" id="quickAddBuyNext" type="button">＋ Add to Buy Next</button>
    </div>
  `;
  els.quickBottleDialog.showModal();
  document.querySelector("#closeSuggestionQuick").addEventListener("click", () => els.quickBottleDialog.close());
  document.querySelector("#quickAddBuyNext").addEventListener("click", () => {
    addPickToBuyNext(pick);
    els.quickBottleDialog.close();
  });
}

function renderPriorityControl(bottle) {
  const priority = Number(bottle.priority || 3);
  return `
    <div class="priority-control" role="group" aria-label="Buy Next priority">
      <button class="priority-move" type="button" data-priority-up="${bottle.id}" aria-label="Move up (raise priority)" ${priority <= 1 ? "disabled" : ""}>▲</button>
      <span class="priority-tag">${priorityLabel(bottle.priority)}</span>
      <button class="priority-move" type="button" data-priority-down="${bottle.id}" aria-label="Move down (lower priority)" ${priority >= 5 ? "disabled" : ""}>▼</button>
    </div>
  `;
}

function renderPriorityControlCompact(bottle) {
  const priority = Number(bottle.priority || 3);
  return `
    <div class="priority-control compact" role="group" aria-label="Buy Next priority">
      <button class="priority-move" type="button" data-priority-up="${bottle.id}" aria-label="Move up (raise priority)" ${priority <= 1 ? "disabled" : ""}>▲</button>
      <button class="priority-move" type="button" data-priority-down="${bottle.id}" aria-label="Move down (lower priority)" ${priority >= 5 ? "disabled" : ""}>▼</button>
    </div>
  `;
}

function renderMoveControl(bottle, index, total) {
  return `
    <div class="priority-control compact" role="group" aria-label="Reorder">
      <button class="priority-move" type="button" data-move-up="${bottle.id}" aria-label="Move up" ${index <= 0 ? "disabled" : ""}>▲</button>
      <button class="priority-move" type="button" data-move-down="${bottle.id}" aria-label="Move down" ${index >= total - 1 ? "disabled" : ""}>▼</button>
    </div>
  `;
}

function changeBottlePriority(id, delta) {
  let moved = false;
  bottles = bottles.map((bottle) => {
    if (bottle.id !== id) return bottle;
    const next = Math.min(5, Math.max(1, Number(bottle.priority || 3) + delta));
    if (next === Number(bottle.priority || 3)) return bottle;
    moved = true;
    return { ...bottle, priority: next };
  });
  if (!moved) return;
  persist();
  render();
}

function renderCardChips(bottle) {
  const chips = [];
  if ((bottle.shelf || "Main bar") !== "Main bar") chips.push(escapeHtml(bottle.shelf));
  if ((bottle.fillLevel || "full") !== "full") {
    const fill = labelFillLevel(bottle.fillLevel);
    chips.push(/^\d/.test(fill) ? `${fill} full` : fill);
  }
  if (Number(bottle.quantity || 1) > 1) chips.push(`Qty ${Number(bottle.quantity)}`);
  if (Number(bottle.bottleSize || 750) !== 750) chips.push(labelBottleSize(bottle.bottleSize));
  if (bottle.ageStatement) chips.push(escapeHtml(bottle.ageStatement));
  if (bottle.storeLocation) chips.push(escapeHtml(bottle.storeLocation));
  if ((bottle.category || "daily") !== "daily") chips.push(labelCategory(bottle.category));
  if ((bottle.pourStyle || "daily") !== "daily") chips.push(labelPourStyle(bottle.pourStyle));
  if (normalizePourTier(bottle.pourTier) !== "crowd") chips.push(labelPourTier(bottle.pourTier));
  if (!chips.length) return "";
  return `<div class="shelf-line">${chips.map((chip) => `<span>${chip}</span>`).join("")}</div>`;
}

function bindBottleActions() {
  document.querySelectorAll("[data-quick]").forEach((item) => {
    item.addEventListener("click", () => {
      if (selectionMode) {
        toggleSelected(item.dataset.quick);
        return;
      }
      openBottleQuick(item.dataset.quick);
    });
  });

  // Tapping the bottle photo itself blows it up instead of opening the full quick view.
  // In selection mode, leave the tap alone so it still toggles that row's checkbox.
  document.querySelectorAll("img.catalog-thumb").forEach((img) => {
    img.addEventListener("click", (event) => {
      if (selectionMode) return;
      event.stopPropagation();
      openPhotoZoom(img.src, img.alt);
    });
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

  document.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(button.dataset.favorite);
    });
  });

  document.querySelectorAll("[data-priority-up]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      changeBottlePriority(button.dataset.priorityUp, -1);
    });
  });

  document.querySelectorAll("[data-priority-down]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      changeBottlePriority(button.dataset.priorityDown, 1);
    });
  });

  document.querySelectorAll("[data-move-up]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      moveBottleOrder(button.dataset.moveUp, -1);
    });
  });

  document.querySelectorAll("[data-move-down]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      moveBottleOrder(button.dataset.moveDown, 1);
    });
  });

  document.querySelectorAll("[data-mark-owned]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      markBottleOwned(button.dataset.markOwned);
    });
  });
}

// Move a wish list bottle into the collection as owned (sealed) — one tap, no form.
function markBottleOwned(id) {
  let moved = false;
  bottles = bottles.map((bottle) => {
    if (bottle.id !== id || bottle.status !== "wishlist") return bottle;
    moved = true;
    return { ...bottle, status: "sealed" };
  });
  if (!moved) return;
  persist();
  render();
}

function changeBottleStatus(id, status) {
  if (!STATUS_OPTIONS.includes(status)) return;
  let changed = false;
  bottles = bottles.map((bottle) => {
    if (bottle.id !== id || bottle.status === status) return bottle;
    changed = true;
    // Changing status from the header is a bulk action — it applies to every individual
    // bottle in this entry, so any per-bottle overrides below are cleared.
    const next = { ...bottle, status };
    delete next.units;
    return next;
  });
  if (!changed) return;
  persist();
  render();
  openBottleQuick(id);
}

// Per-unit status/fill tracking for entries with quantity > 1. Units aren't stored until
// someone edits one individually — until then they're derived from the entry's own status/fillLevel.
const UNIT_STATUS_OPTIONS = ["sealed", "open", "finished"];

function getBottleUnits(bottle) {
  const quantity = Math.max(1, Number(bottle.quantity) || 1);
  const stored = Array.isArray(bottle.units) ? bottle.units : [];
  return Array.from({ length: quantity }, (_, index) => ({
    status: stored[index]?.status || bottle.status,
    fillLevel: stored[index]?.fillLevel || bottle.fillLevel || "full",
  }));
}

function updateBottleUnit(id, index, patch) {
  bottles = bottles.map((bottle) => {
    if (bottle.id !== id) return bottle;
    const units = getBottleUnits(bottle).map((unit, unitIndex) =>
      unitIndex === index ? { ...unit, ...patch } : unit,
    );
    const aggregateStatus = units.some((unit) => unit.status === "open")
      ? "open"
      : units.some((unit) => unit.status === "sealed")
        ? "sealed"
        : "finished";
    return { ...bottle, units, status: aggregateStatus, fillLevel: units[0].fillLevel };
  });
  persist();
  render();
  openBottleQuick(id);
}

function renderBottleUnitsBlock(bottle) {
  if (["wishlist", "buy-next"].includes(bottle.status)) return "";
  const quantity = Math.max(1, Number(bottle.quantity) || 1);
  if (quantity <= 1) return "";
  const units = getBottleUnits(bottle);
  return `
    <div class="unit-list">
      <p class="unit-list-heading">${quantity} bottles in this entry — track each one</p>
      ${units
        .map(
          (unit, index) => `
        <div class="unit-card">
          <div class="unit-card-head">
            ${bottleThumb(bottle, "unit-card-thumb")}
            <div class="unit-card-info">
              <h4>${escapeHtml(bottle.name)}</h4>
              <p>${escapeHtml(bottle.type)} · Bottle ${index + 1} of ${quantity}</p>
            </div>
          </div>
          <div class="unit-card-pills">
            <select class="status-pill status-pill-select ${unit.status}" data-unit-status="${index}" aria-label="Status for bottle ${index + 1}">
              ${UNIT_STATUS_OPTIONS.map(
                (status) => `<option value="${status}" ${unit.status === status ? "selected" : ""}>${labelStatus(status)}</option>`,
              ).join("")}
            </select>
            <select class="type-pill unit-fill-select" data-unit-fill="${index}" aria-label="Fill level for bottle ${index + 1}">
              ${["full", "three-quarter", "half", "low", "empty"].map(
                (level) => `<option value="${level}" ${unit.fillLevel === level ? "selected" : ""}>${labelFillLevel(level)}</option>`,
              ).join("")}
            </select>
            <span class="type-pill">${labelBottleSize(bottle.bottleSize)}</span>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function setSelectionMode(on) {
  selectionMode = on;
  if (!on) selectedIds.clear();
  els.toggleSelect.textContent = on ? "Cancel" : "Select";
  els.toggleSelect.classList.toggle("is-selected", on);
  render();
}

function toggleSelected(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  render();
}

function updateSelectBar() {
  const count = selectedIds.size;
  els.selectBar.classList.toggle("is-hidden", !selectionMode);
  els.selectCount.textContent = `${count} selected`;
  els.selectDelete.disabled = count === 0;
  els.selectDelete.textContent = count > 0 ? `Delete ${count}` : "Delete";
}

function bulkDeleteSelected() {
  const count = selectedIds.size;
  if (!count) return;
  if (!confirm(`Delete ${count} bottle${count === 1 ? "" : "s"}? This can't be undone.`)) return;
  bottles = bottles.filter((bottle) => !selectedIds.has(bottle.id));
  persist();
  setSelectionMode(false);
}

function toggleFavorite(id) {
  bottles = bottles.map((bottle) =>
    bottle.id === id ? { ...bottle, favorite: !bottle.favorite } : bottle
  );
  persist();
  render();
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
    .filter((bottle) => !owned.has(`${bottle.name}-${bottle.distillery}`.toLowerCase()))
    .filter((bottle) => {
      const haystack = `${bottle.name} ${bottle.distillery} ${bottle.type} ${bottle.region} ${bottle.flavors.join(" ")}`.toLowerCase();
      return !query || haystack.includes(query);
    })
    .slice(0, 80);

  els.libraryList.innerHTML = matches.length
    ? matches
        .map(
          (bottle, index) => `
            <article class="library-item">
              <img class="library-photo" src="${bottleImage(bottle)}" alt="${escapeHtml(bottle.name)} bottle" />
              <div>
                <strong>${escapeHtml(bottle.name)}</strong>
                <span>${escapeHtml(bottle.distillery)} · ${escapeHtml(bottle.type)} · ${numberOrDash(bottle.proof)} proof · ${money(bottle.price)}</span>
              </div>
              ${renderPhotoSourceLinks(bottle, "compact")}
              <button class="secondary-action" type="button" data-library-index="${index}">Add</button>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">${query ? "No library bottles match that search." : "You already own every bottle in the library."}</div>`;

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
  const profileBottles = bottles.filter((bottle) => bottle.status !== "wishlist");
  const counts = new Map();
  profileBottles.flatMap((bottle) => bottle.flavors).forEach((flavor) => counts.set(flavor, (counts.get(flavor) || 0) + 1));

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top[0]?.[1] || 1;

  // Clicking a flavor bar isn't useful once it's no longer one of the top ones shown.
  if (activeFlavorFilter && !top.some(([flavor]) => flavor === activeFlavorFilter)) {
    activeFlavorFilter = null;
  }

  els.flavorList.innerHTML = top.length
    ? top
        .map(
          ([flavor, count]) => `
            <button class="flavor-bar${flavor === activeFlavorFilter ? " is-active" : ""}" data-flavor="${escapeHtml(flavor)}" type="button">
              <span>${escapeHtml(flavor)}</span>
              <i style="width: ${Math.max(18, (count / max) * 100)}%"></i>
              <strong>${count}</strong>
            </button>
          `,
        )
        .join("")
    : `<div class="empty-state">Add flavor tags to build your profile.</div>`;

  if (!activeFlavorFilter) {
    els.flavorBottleList.innerHTML = "";
    return;
  }

  const matches = profileBottles.filter((bottle) => bottle.flavors.includes(activeFlavorFilter));
  els.flavorBottleList.innerHTML = `
    <div class="flavor-bottle-list-head">
      <span>${matches.length} bottle${matches.length === 1 ? "" : "s"} with "${escapeHtml(activeFlavorFilter)}"</span>
      <button data-clear-flavor-filter type="button">Clear ×</button>
    </div>
    ${matches
      .map(
        (bottle) => `
          <button class="flavor-bottle-item" data-flavor-bottle="${escapeHtml(bottle.id)}" type="button">
            <strong>${escapeHtml(bottle.name)}</strong>
            <span>${escapeHtml(bottle.distillery)} · ${numberOrDash(bottle.proof)} proof</span>
          </button>
        `,
      )
      .join("")}
  `;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEASON_DEFS = [
  { name: "Spring", months: [2, 3, 4], color: "var(--spring)" },
  { name: "Summer", months: [5, 6, 7], color: "var(--summer)" },
  { name: "Fall", months: [8, 9, 10], color: "var(--fall)" },
  { name: "Winter", months: [11, 0, 1], color: "var(--winter)" },
];

// Parsed at noon local time, same trick formatDate() uses, so a date-only string
// never shifts a day off when the browser's timezone is behind UTC.
function pourDateParts(pour) {
  const date = new Date(`${pour.date}T12:00:00`);
  return { dow: date.getDay(), month: date.getMonth() };
}

function renderMiniBars(barsEl, axisEl, data) {
  const max = Math.max(...data.map((d) => d.value), 1);
  barsEl.innerHTML = data
    .map(
      (d) => `
        <div class="mini-bar-col">
          <div class="mini-bar ${d.value > 0 && d.value === max ? "is-peak" : ""}" style="height:${Math.max(4, Math.round((d.value / max) * 100))}%" title="${d.label}: ${d.value} pour${d.value === 1 ? "" : "s"}"></div>
        </div>
      `,
    )
    .join("");
  axisEl.innerHTML = data.map((d) => `<span>${escapeHtml(d.label[0])}</span>`).join("");
}

// Cadence tab on the Profile card: which day of the week and which month pours
// cluster around, derived straight from the Pour Log's own dates.
function renderPourCadence() {
  if (!els.cadenceDowBars) return;
  if (!pours.length) {
    els.cadenceDowBars.innerHTML = `<div class="empty-state">Log a pour to see when you drink most.</div>`;
    els.cadenceDowAxis.innerHTML = "";
    els.cadenceMonthBars.innerHTML = "";
    els.cadenceMonthAxis.innerHTML = "";
    return;
  }

  const dowCounts = new Array(7).fill(0);
  const monthCounts = new Array(12).fill(0);
  pours.forEach((pour) => {
    if (!pour.date) return;
    const { dow, month } = pourDateParts(pour);
    dowCounts[dow] += 1;
    monthCounts[month] += 1;
  });

  // Display Monday-first even though Date#getDay() counts Sunday-first.
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];
  const dowData = dowOrder.map((index) => ({ label: DOW_LABELS[index], value: dowCounts[index] }));
  const monthData = MONTH_LABELS.map((label, index) => ({ label, value: monthCounts[index] }));

  renderMiniBars(els.cadenceDowBars, els.cadenceDowAxis, dowData);
  renderMiniBars(els.cadenceMonthBars, els.cadenceMonthAxis, monthData);
}

// Seasons tab on the Profile card: each logged pour's bottle contributes its
// flavor tags to whichever season the pour's date falls in.
function renderSeasonalMoodBoard() {
  if (!els.seasonMoodBoard) return;
  const seasonFlavorCounts = SEASON_DEFS.map(() => new Map());
  pours.forEach((pour) => {
    if (!pour.date) return;
    const bottle = bottles.find((item) => item.id === pour.bottleId);
    if (!bottle?.flavors?.length) return;
    const { month } = pourDateParts(pour);
    const seasonIndex = SEASON_DEFS.findIndex((season) => season.months.includes(month));
    if (seasonIndex === -1) return;
    const counts = seasonFlavorCounts[seasonIndex];
    bottle.flavors.forEach((flavor) => counts.set(flavor, (counts.get(flavor) || 0) + 1));
  });

  if (!seasonFlavorCounts.some((counts) => counts.size > 0)) {
    els.seasonMoodBoard.innerHTML = `<div class="empty-state">Log a few pours to build a seasonal flavor mood board.</div>`;
    return;
  }

  els.seasonMoodBoard.innerHTML = SEASON_DEFS.map((season, index) => {
    const top = [...seasonFlavorCounts[index].entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const chips = top.length
      ? top
          .map(
            ([flavor], i) =>
              `<button class="mini-flavor-chip${i === 0 ? " is-lead" : ""}" data-flavor="${escapeHtml(flavor)}" type="button">${escapeHtml(flavor)}</button>`,
          )
          .join("")
      : `<span class="mini-flavor-chip">no pours yet</span>`;
    return `
      <div class="mini-season-row" style="--season-color:${season.color}">
        <span class="mini-season-dot"></span>
        <span class="mini-season-name">${season.name}</span>
        <span class="mini-season-chips">${chips}</span>
      </div>
    `;
  }).join("");
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
            <div class="shelf-item" data-shelf="${escapeHtml(shelf)}" role="button" tabindex="0">
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

  els.shelfList.querySelectorAll("[data-shelf]").forEach((item) => {
    const open = () => {
      els.searchInput.value = item.dataset.shelf;
      navigateToView("collection");
    };
    item.addEventListener("click", open);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function renderCollectionPreview() {
  if (!els.collectionPreviewRow) return;
  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  const picks = [...owned]
    .sort((a, b) => {
      const rank = (bottle) => (bottle.coreBar ? 2 : bottle.favorite ? 1 : 0);
      return rank(b) - rank(a) || Number(b.rating || 0) - Number(a.rating || 0);
    })
    .slice(0, 8);

  els.collectionPreviewRow.innerHTML = picks.length
    ? picks
        .map((bottle) => {
          const badge = bottle.coreBar ? "🔥" : bottle.favorite ? "⭐" : "";
          return `
            <article class="collection-preview-card" data-quick="${bottle.id}" role="button" tabindex="0">
              ${badge ? `<span class="collection-preview-badge" aria-hidden="true">${badge}</span>` : ""}
              ${bottleThumb(bottle, "preview-thumb")}
              <strong>${escapeHtml(bottle.name)}</strong>
              <span>${escapeHtml(bottle.distillery || "")}</span>
              <span>${numberOrDash(bottle.proof)} proof</span>
            </article>
          `;
        })
        .join("")
    : `<p class="collection-preview-empty">Add a bottle to start building your collection.</p>`;
}

function proofRangeLabel(proof) {
  const value = Number(proof || 0);
  if (!value) return null;
  const bandStart = Math.floor(value / 10) * 10;
  return `${bandStart}-${bandStart + 9.9}`;
}

function renderProfile() {
  if (!els.profileView) return;
  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));

  els.profileBottleCount.textContent = owned.reduce((sum, bottle) => sum + Number(bottle.quantity || 1), 0);
  els.profilePourCount.textContent = pours.length;
  els.profileBottleKills.textContent = owned.filter(
    (bottle) => bottle.status === "finished" || bottle.fillLevel === "empty",
  ).length;

  const distilleries = new Map();
  owned.forEach((bottle) => {
    if (!bottle.distillery) return;
    distilleries.set(bottle.distillery, (distilleries.get(bottle.distillery) || 0) + Number(bottle.quantity || 1));
  });
  const topDistillery = [...distilleries.entries()].sort((a, b) => b[1] - a[1])[0];
  els.profileFavoriteDistillery.textContent = topDistillery ? topDistillery[0] : "—";

  const proofBands = new Map();
  owned.forEach((bottle) => {
    const label = proofRangeLabel(bottle.proof);
    if (label) proofBands.set(label, (proofBands.get(label) || 0) + 1);
  });
  const topProofBand = [...proofBands.entries()].sort((a, b) => b[1] - a[1])[0];
  els.profileFavoriteProof.textContent = topProofBand ? `${topProofBand[0]} proof` : "—";

  const companions = new Map();
  pours.forEach((pour) => {
    const name = (pour.companion || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    companions.set(key, { name, count: (companions.get(key)?.count || 0) + 1 });
  });
  const topCompanion = [...companions.values()].sort((a, b) => b.count - a.count)[0];
  els.profileFavoriteCompanion.textContent = topCompanion ? topCompanion.name : "—";

  const value = owned.reduce((sum, bottle) => sum + Number(bottle.price || 0) * Number(bottle.quantity || 1), 0);
  els.profileCollectionValue.textContent = money(value);

  const flavorCounts = new Map();
  owned.flatMap((bottle) => bottle.flavors).forEach((flavor) => flavorCounts.set(flavor, (flavorCounts.get(flavor) || 0) + 1));
  const topFlavors = [...flavorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  els.profileFlavorTags.innerHTML = topFlavors.length
    ? topFlavors.map(([flavor]) => `<span class="flavor-chip">${escapeHtml(flavor)}</span>`).join("")
    : `<div class="empty-state">Add flavor tags to your bottles to build your palate profile.</div>`;

  renderProfileLegacyShelf();
}

// Bottles kept not for score, but for the moment they marked - a shelf next to,
// not instead of, the highest-rated bottles.
function renderProfileLegacyShelf() {
  if (!els.profileLegacyShelf) return;
  const legacyBottles = bottles.filter((bottle) => bottle.legacyShelf);

  els.profileLegacyShelf.innerHTML = legacyBottles.length
    ? legacyBottles
        .map(
          (bottle) => `
            <article class="legacy-shelf-card" data-quick="${bottle.id}" role="button" tabindex="0">
              ${bottleThumb(bottle, "preview-thumb")}
              <strong>${escapeHtml(bottle.name)}</strong>
              <span>${escapeHtml(bottle.legacyShelfReason || bottle.distillery || "")}</span>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">Star a bottle's Legacy Shelf box (in Edit Bottle) to keep the ones that mattered here.</div>`;

  els.profileLegacyShelf.querySelectorAll("[data-quick]").forEach((card) => {
    card.addEventListener("click", () => openBottleQuick(card.dataset.quick));
  });
}

function renderCoreBarHighlight() {
  const earned = bottles
    .filter((bottle) => bottle.coreBar)
    .sort((a, b) => (b.coreBarScore || 0) - (a.coreBarScore || 0));

  if (!earned.length) {
    els.coreBarHighlight.innerHTML = "";
    return;
  }

  els.coreBarHighlight.innerHTML = `
    <div class="core-bar-highlight-card">
      <div class="section-heading">
        <div>
          <p>Permanent shelf</p>
          <h2>🔥 Core Bar</h2>
        </div>
        <span>${earned.length} earned</span>
      </div>
      <div class="core-bar-highlight-list">
        ${earned
          .map(
            (bottle) => `
              <div class="core-bar-highlight-item" data-quick="${bottle.id}">
                <div>
                  <strong>${escapeHtml(bottle.name)}</strong>
                  <span>${escapeHtml(bottle.distillery)}</span>
                </div>
                <span class="core-bar-highlight-score">${bottle.coreBarScore ?? ""}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;

  els.coreBarHighlight.querySelectorAll("[data-quick]").forEach((item) => {
    item.addEventListener("click", () => openBottleQuick(item.dataset.quick));
  });
}

function ratingTag(rating) {
  if (rating >= 9) return { label: "Highly Recommended", className: "tag-highly-recommended" };
  if (rating >= 7.5) return { label: "Worth Trying", className: "tag-worth-trying" };
  return { label: "Rated", className: "tag-rated" };
}

function renderTopRatedHighlight() {
  const rated = bottles
    .filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status) && Number(bottle.rating) > 0)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 3);

  if (!rated.length) {
    els.topRatedHighlight.innerHTML = "";
    return;
  }

  els.topRatedHighlight.innerHTML = `
    <div class="top-rated-highlight-card">
      <div class="section-heading">
        <div>
          <p>Your favorites</p>
          <h2>⭐ Top Rated Bottles</h2>
        </div>
      </div>
      <div class="top-rated-highlight-list">
        ${rated
          .map((bottle) => {
            const tag = ratingTag(Number(bottle.rating));
            return `
              <div class="top-rated-highlight-item" data-quick="${bottle.id}">
                <div>
                  <strong>${escapeHtml(bottle.name)}</strong>
                  <span>${escapeHtml(bottle.distillery)}</span>
                  <span class="rating-tag ${tag.className}">${tag.label}</span>
                </div>
                <span class="top-rated-highlight-score">${numberOrDash(bottle.rating)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  els.topRatedHighlight.querySelectorAll("[data-quick]").forEach((item) => {
    item.addEventListener("click", () => openBottleQuick(item.dataset.quick));
  });
}

function computePourStreak() {
  if (!pours.length) return 0;
  const dateSet = new Set(pours.map((pour) => pour.date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mostRecent = [...dateSet].sort().pop();
  const mostRecentDate = new Date(`${mostRecent}T00:00:00`);
  const diffDays = Math.round((today - mostRecentDate) / 86400000);
  if (diffDays > 1) return 0;

  let streak = 0;
  const cursor = new Date(mostRecentDate);
  while (dateSet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function countBottlesOpenedThisMonth() {
  const now = new Date();
  return bottles.filter((bottle) => {
    if (!bottle.openedDate) return false;
    const opened = new Date(`${bottle.openedDate}T00:00:00`);
    return opened.getFullYear() === now.getFullYear() && opened.getMonth() === now.getMonth();
  }).length;
}

function renderPourStreakHighlight() {
  const streak = computePourStreak();
  const openedThisMonth = countBottlesOpenedThisMonth();

  if (!streak && !openedThisMonth) {
    els.pourStreakHighlight.innerHTML = "";
    return;
  }

  els.pourStreakHighlight.innerHTML = `
    <div class="pour-streak-card">
      <div>
        <strong>🔥 ${streak}</strong>
        <span>day pour streak</span>
      </div>
      <div>
        <strong>${openedThisMonth}</strong>
        <span>${openedThisMonth === 1 ? "bottle" : "bottles"} opened this month</span>
      </div>
    </div>
  `;
}

function renderRecommendation() {
  const candidates = bottles
    .filter((bottle) => bottle.status === "open" && Number(bottle.rating) > 0)
    .sort((a, b) => Number(b.rating) - Number(a.rating));
  const pick = candidates[0] || bottles.find((bottle) => bottle.status === "open");

  els.recommendation.innerHTML = pick
    ? `<div data-quick="${escapeHtml(pick.id)}" role="button" tabindex="0"><strong>${escapeHtml(pick.name)}</strong><span>${escapeHtml(pick.type)} · ${numberOrDash(pick.proof)} proof · ${escapeHtml(pick.flavors.slice(0, 3).join(", "))}</span></div>`
    : `<span>Open a bottle to get a recommendation.</span>`;

  const target = els.recommendation.querySelector("[data-quick]");
  if (target) {
    const open = () => openBottleQuick(target.dataset.quick);
    target.addEventListener("click", open);
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  }
}

// The name to greet the user by on Home. When they've chosen a custom greeting
// name it wins; otherwise fall back to their username / Google display name.
function resolveGreetingName() {
  const mode = localStorage.getItem(GREETING_MODE_KEY) || "username";
  if (mode === "custom") {
    return (localStorage.getItem(GREETING_NAME_KEY) || "").trim();
  }
  return currentProfile?.username || currentUser?.displayName || "";
}

function renderHomeGreeting() {
  if (!els.homeGreeting) return;
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const name = resolveGreetingName();
  els.homeGreeting.textContent = name ? `Good ${timeOfDay}, ${name}.` : `Good ${timeOfDay}.`;
}

function renderContinueStoryCard() {
  if (!els.continueStoryCard) return;
  const open = bottles.filter((bottle) => bottle.status === "open");
  const lastPourTime = new Map();
  pours.forEach((pour) => {
    const time = new Date(`${pour.date}T12:00:00`).getTime();
    if (Number.isFinite(time) && (!lastPourTime.has(pour.bottleId) || time > lastPourTime.get(pour.bottleId))) {
      lastPourTime.set(pour.bottleId, time);
    }
  });
  const candidate = [...open].sort((a, b) => (lastPourTime.get(b.id) || Number(b.createdAt) || 0) - (lastPourTime.get(a.id) || Number(a.createdAt) || 0))[0];

  if (!candidate) {
    els.continueStoryCard.classList.add("is-hidden");
    return;
  }
  els.continueStoryCard.classList.remove("is-hidden");

  const daysOpen = candidate.openedDate
    ? Math.max(0, Math.round((Date.now() - new Date(`${candidate.openedDate}T12:00:00`).getTime()) / 86400000))
    : null;

  els.continueStoryBody.innerHTML = `
    ${bottleThumb(candidate, "preview-thumb")}
    <div class="continue-story-info">
      <strong>${escapeHtml(candidate.name)}</strong>
      <span>${escapeHtml(candidate.distillery || "")}</span>
      <div class="continue-story-stats">
        <div><span>Current Score</span><strong>${numberOrDash(candidate.rating)}</strong></div>
        <div><span>Days Open</span><strong>${daysOpen === null ? "—" : daysOpen}</strong></div>
        <div><span>Journey Stage</span><strong>${journeyStatus(candidate)?.emoji || ""} ${escapeHtml(journeyStatus(candidate)?.label || "—")}</strong></div>
      </div>
      <button class="primary-action" data-quick="${candidate.id}" type="button">Continue Pour Story</button>
    </div>
  `;
  els.continueStoryBody.querySelectorAll("[data-quick]").forEach((item) => {
    item.addEventListener("click", () => openBottleQuick(item.dataset.quick));
  });
}

function renderCollectionSnapshot() {
  if (!els.collectionSnapshotGrid) return;
  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  const rated = owned.filter((bottle) => Number(bottle.rating) > 0);
  const avgScore = rated.length ? rated.reduce((sum, bottle) => sum + Number(bottle.rating), 0) / rated.length : 0;

  const distilleries = new Map();
  owned.forEach((bottle) => {
    if (!bottle.distillery) return;
    distilleries.set(bottle.distillery, (distilleries.get(bottle.distillery) || 0) + Number(bottle.quantity || 1));
  });
  const topDistillery = [...distilleries.entries()].sort((a, b) => b[1] - a[1])[0];

  const proofBands = new Map();
  owned.forEach((bottle) => {
    const label = proofRangeLabel(bottle.proof);
    if (label) proofBands.set(label, (proofBands.get(label) || 0) + 1);
  });
  const topProofBand = [...proofBands.entries()].sort((a, b) => b[1] - a[1])[0];

  const journeyCounts = new Map();
  owned.forEach((bottle) => {
    const status = journeyStatus(bottle);
    if (status) journeyCounts.set(status.label, (journeyCounts.get(status.label) || 0) + 1);
  });
  const journeySummary = [...journeyCounts.entries()].map(([label, count]) => `${count} ${label}`).join(" · ") || "—";

  els.collectionSnapshotGrid.innerHTML = `
    <article><span>Bottle Count</span><strong>${owned.reduce((sum, bottle) => sum + Number(bottle.quantity || 1), 0)}</strong></article>
    <article><span>Average Score</span><strong>${avgScore ? avgScore.toFixed(1) : "—"}</strong></article>
    <article><span>Favorite Distillery</span><strong>${topDistillery ? escapeHtml(topDistillery[0]) : "—"}</strong></article>
    <article><span>Favorite Proof Range</span><strong>${topProofBand ? topProofBand[0] : "—"}</strong></article>
    <article><span>Current Journey</span><strong class="journey-summary">${journeySummary}</strong></article>
  `;
}

function renderRecentPourStories() {
  if (!els.recentPourStories) return;
  const stories = [...pours]
    .map((pour) => {
      const bottle = bottles.find((item) => item.id === pour.bottleId);
      const time = new Date(`${pour.date}T12:00:00`).getTime();
      return bottle && Number.isFinite(time) ? { pour, bottle, time } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.time - a.time)
    .slice(0, 6);

  els.recentPourStories.innerHTML = stories.length
    ? stories
        .map(
          ({ pour, bottle }) => `
            <div class="pour-story-item" data-quick="${bottle.id}" role="button" tabindex="0">
              <div>
                <strong>${escapeHtml(bottle.name)}</strong>
                <span>${escapeHtml(pour.memory || pour.notes || pour.occasion || "Logged a pour")} · ${timeAgo(new Date(`${pour.date}T12:00:00`).getTime())}</span>
              </div>
              <span class="pour-story-score">${numberOrDash(pour.rating || bottle.rating)}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">No pour stories yet. Log a pour to start your journal.</div>`;

  els.recentPourStories.querySelectorAll("[data-quick]").forEach((item) => {
    item.addEventListener("click", () => openBottleQuick(item.dataset.quick));
  });
}

function renderJourneyInsights() {
  if (!els.journeyInsightsGrid) return;
  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  const documentedStories =
    pours.filter((pour) => pour.memory?.trim() || pour.notes?.trim() || pour.occasion?.trim()).length +
    owned.filter((bottle) => bottle.notes?.trim()).length;

  const proofBands = new Map();
  owned.forEach((bottle) => {
    const label = proofRangeLabel(bottle.proof);
    if (label) proofBands.set(label, (proofBands.get(label) || 0) + 1);
  });
  const topProofBand = [...proofBands.entries()].sort((a, b) => b[1] - a[1])[0];

  els.journeyInsightsGrid.innerHTML = `
    <article><span>You've shared</span><strong>${pours.length} pours</strong></article>
    <article><span>You've documented</span><strong>${documentedStories} stories</strong></article>
    <article><span>Favorite proof</span><strong>${topProofBand ? topProofBand[0] : "—"}</strong></article>
  `;
}

function askFromDashboard(promptText) {
  const text = (promptText ?? els.dashboardAssistantPrompt.value).trim();
  if (!text) return;
  els.dashboardAssistantPrompt.value = "";
  navigateToView("pour-log");
  switchPourStoriesTab("assistant");
  els.assistantPrompt.value = text;
  sendAssistantMessage();
}

let spinInProgress = false;

function spinForBottle() {
  if (spinInProgress) return;
  const eligible = bottles.filter((bottle) => ["open", "sealed"].includes(bottle.status) && bottle.fillLevel !== "empty");
  if (!eligible.length) {
    els.spinReel.innerHTML = `<div class="spin-reel-empty">No sealed or open bottles to spin for. Crack one open or add to your cabinet first.</div>`;
    return;
  }

  // Your number just sets how many times the wheel flips -- it never maps to a specific bottle.
  let rounds = Math.floor(Number(els.spinNumber.value));
  if (!Number.isFinite(rounds) || rounds < 1) {
    rounds = 1 + Math.floor(Math.random() * 30);
  }
  rounds = Math.min(rounds, 50);
  els.spinNumber.value = rounds;

  spinInProgress = true;
  els.spinBottleButton.disabled = true;
  els.spinLogPour.classList.add("is-hidden");
  els.spinReel.classList.add("is-spinning");

  let tickCount = 0;

  function tick() {
    tickCount += 1;
    const isFinal = tickCount >= rounds;
    // The bottle stays hidden behind a mystery card until the very last flip reveals it.
    const winner = isFinal ? eligible[Math.floor(Math.random() * eligible.length)] : null;
    renderSpinFrame(winner, tickCount, rounds, isFinal);
    if (isFinal) {
      finishSpin(winner);
      return;
    }
    // Ease from a fast flicker to a slow crawl as it approaches your number.
    const progress = tickCount / rounds;
    const delay = 50 + progress * progress * 210;
    setTimeout(tick, delay);
  }
  tick();
}

function renderSpinFrame(bottle, tickNumber, totalTicks, isFinal) {
  els.spinReel.innerHTML = `
    <div class="spin-reel-item${isFinal ? " is-final" : ""}"${isFinal ? ` data-quick="${escapeHtml(bottle.id)}" role="button" tabindex="0"` : ""}>
      <div class="spin-number">Spin ${tickNumber} <span>of ${totalTicks}</span></div>
      ${isFinal ? bottleThumb(bottle) : `<div class="spin-mystery" aria-hidden="true">🥃</div>`}
      ${
        isFinal
          ? `<strong>${escapeHtml(bottle.name)}</strong><span>${escapeHtml(bottle.distillery)} · ${numberOrDash(bottle.proof)} proof</span>`
          : `<span class="spin-mystery-label">???</span>`
      }
    </div>
  `;

  const target = els.spinReel.querySelector("[data-quick]");
  if (target) {
    const open = () => openBottleQuick(target.dataset.quick);
    target.addEventListener("click", open);
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  }
}

function finishSpin(winner) {
  els.spinReel.classList.remove("is-spinning");
  els.spinBottleButton.disabled = false;
  els.spinBottleButton.textContent = "🎰 Spin Again";
  els.spinLogPour.dataset.bottleId = winner.id;
  els.spinLogPour.classList.remove("is-hidden");
  spinInProgress = false;
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
    return null;
  }

  const nose = els.tastingNose.value.trim() || bottle.flavors.slice(0, 2).join(", ");
  const palate = els.tastingPalate.value.trim() || bottle.flavors.slice(1, 4).join(", ");
  const finish =
    els.tastingFinish.value.trim() ||
    (Number(bottle.proof) >= 110 ? "warm, lingering proof with oak and spice" : "balanced, clean, and approachable");
  const scoreValue = els.tastingScore.value ? Number(els.tastingScore.value) : 0;
  const score = scoreValue ? ` Rating: ${scoreValue.toFixed(1)}/10.` : "";
  const text = `${bottle.name} opens with ${nose} on the nose. The palate brings ${palate}, leading into a finish of ${finish}.${score}`;
  els.generatedTastingNote.textContent = text;
  return { text, nose, palate, finish, score: scoreValue };
}

async function generateAiTastingNote() {
  const bottle = bottles.find((item) => item.id === els.tastingBottle.value);
  if (!bottle) {
    els.generatedTastingNote.textContent = "Choose a bottle first.";
    return;
  }
  if (!currentUser || !cloudFunctions) {
    els.generatedTastingNote.textContent = "Sign in with Google to use AI tasting notes.";
    return;
  }

  els.generatedTastingNote.textContent = "Asking the sommelier...";
  try {
    const callable = cloudFunctions.httpsCallable("generateTastingProfile");
    const result = await callable({
      bottleName: bottle.name,
      distillery: bottle.distillery,
      type: bottle.type,
      proof: bottle.proof,
      flavors: bottle.flavors,
    });
    const profile = result.data || {};
    els.tastingNose.value = profile.nose || "";
    els.tastingPalate.value = profile.palate || "";
    els.tastingFinish.value = profile.finish || "";
    if (Array.isArray(profile.flavors) && profile.flavors.length) {
      bottle.flavors = [...new Set([...(bottle.flavors || []), ...profile.flavors])];
      persist();
    }
    buildGuidedTastingNote();
    render();
  } catch (error) {
    console.error("AI tasting note failed", error);
    els.generatedTastingNote.textContent = "Could not generate an AI tasting note. Try again.";
  }
}

function saveGuidedTastingNote() {
  const note = buildGuidedTastingNote();
  if (!note) return;
  bottles = bottles.map((bottle) => {
    if (bottle.id !== els.tastingBottle.value) return bottle;
    return {
      ...bottle,
      notes: note.text,
      tastingNote: { nose: note.nose, palate: note.palate, finish: note.finish, score: note.score },
      rating: Number(note.score || bottle.rating || 0),
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
      notes: note.text,
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
          const storyChips = [
            pour.companion ? `👥 ${escapeHtml(pour.companion)}` : "",
            pour.location ? `📍 ${escapeHtml(pour.location)}` : "",
            pour.mood ? `✨ ${escapeHtml(pour.mood)}` : "",
            pour.wouldBuyAgain ? "🔁 Would buy again" : "",
          ].filter(Boolean);
          const fipScore = Number(pour.rating);
          const tier = fipScore > 0 ? fipTier(fipScore) : null;
          return `
            <article class="pour-item">
              ${bottle ? bottleThumb(bottle, "pour-item-thumb") : `<div class="catalog-thumb catalog-thumb-empty pour-item-thumb" aria-hidden="true">?</div>`}
              <div class="pour-item-body">
                <div class="pour-item-head">
                  <div>
                    <strong>${escapeHtml(bottle?.name || "Unknown bottle")}</strong>
                    <span>${formatDate(pour.date)} · ${Number(pour.ounces || 0).toFixed(1)} oz</span>
                  </div>
                  <div class="pour-item-actions">
                    ${tier ? `<span class="pour-item-score ${tier.className}" title="${escapeHtml(tier.label)}">${fipScore.toFixed(1)}</span>` : ""}
                    <button class="icon-button" data-edit-pour="${escapeHtml(pour.id)}" type="button" aria-label="Edit pour">✎</button>
                    <button class="icon-button" data-delete-pour="${escapeHtml(pour.id)}" type="button" aria-label="Delete pour">×</button>
                  </div>
                </div>
                <p>${escapeHtml(pour.occasion || "Pour session")}</p>
                <p>${escapeHtml(pour.notes || "No notes logged.")}</p>
                ${pour.memory ? `<p class="pour-memory">"${escapeHtml(pour.memory)}"</p>` : ""}
                ${storyChips.length ? `<div class="pour-story-chips">${storyChips.map((chip) => `<span>${chip}</span>`).join("")}</div>` : ""}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">No pours logged yet. Hit "Log Pour" to start tracking your sessions.</div>`;

  els.pourList.querySelectorAll("[data-edit-pour]").forEach((button) => {
    button.addEventListener("click", () => openPourForm("", button.dataset.editPour));
  });
  els.pourList.querySelectorAll("[data-delete-pour]").forEach((button) => {
    button.addEventListener("click", () => deletePourEntry(button.dataset.deletePour));
  });
}

function deletePourEntry(id) {
  if (!confirm("Delete this pour entry?")) return;
  pours = pours.filter((pour) => pour.id !== id);
  persistPours();
  render();
}

// Pour editing flows through the FIP wizard's pourDraft; see openPourForm.
// ---- FIP Rating: the weighted tasting rubric behind every Pour Story ----
// The 0–10 FIP score is the sum of five weighted components, captured through a
// 5-step wizard (Session → Nose → Palate → Finish → Summary).
const FIP_MAX = { nose: 2.5, palate: 3.5, finish: 2, complexity: 1, value: 1 };
const NOSE_AROMAS = [
  "Brown Sugar", "Vanilla", "Oak", "Caramel", "Cherry", "Honey",
  "Cinnamon", "Orange Peel", "Leather", "Baking Spice", "Toffee", "Other",
];
const PALATE_FLAVORS = [
  "Caramel", "Vanilla", "Dark Fruit", "Oak", "Baking Spice", "Char",
  "Honey", "Nutmeg", "Rye Spice", "Toffee", "Black Pepper", "Other",
];
const BUY_AGAIN_VALUE = { yes: 1, maybe: 0.5, no: 0 };

// The FIP tier bands shown on the rating-scale legend.
function fipTier(score) {
  if (score >= 9.5) return { label: "Hall of Fame", className: "tier-hall-of-fame", blurb: "Exceptional. A pour to remember." };
  if (score >= 9.0) return { label: "Fully Involved", className: "tier-fully-involved", blurb: "Outstanding. Top shelf." };
  if (score >= 8.0) return { label: "Working Fire", className: "tier-working-fire", blurb: "Very good. Would buy again." };
  if (score >= 7.0) return { label: "First Due", className: "tier-first-due", blurb: "Good. Solid pour." };
  if (score >= 6.0) return { label: "Routine Call", className: "tier-routine-call", blurb: "Average. Not bad." };
  return { label: "False Alarm", className: "tier-false-alarm", blurb: "Below average." };
}

// Live wizard draft. `editingId` non-null means we're editing an existing pour.
let pourDraft = null;
const PW = (id) => document.querySelector(`#${id}`);

function blankDraft() {
  return {
    editingId: null,
    step: 1,
    bottleId: "",
    date: new Date().toISOString().slice(0, 10),
    ounces: 1.5,
    location: "",
    companion: "",
    occasion: "",
    glass: "",
    weather: "",
    mood: "",
    sessionNotes: "",
    nose: 0,
    noseAromas: [],
    noseNotes: "",
    palate: 0,
    palateFlavors: [],
    palateNotes: "",
    finish: 0,
    finishNotes: "",
    complexity: 0,
    value: 0,
    buyAgain: "yes",
    summaryNotes: "",
  };
}

function draftFromPour(pour) {
  const fip = pour.fip || {};
  return {
    editingId: pour.id,
    step: 1,
    bottleId: pour.bottleId || "",
    date: pour.date || new Date().toISOString().slice(0, 10),
    ounces: pour.ounces ?? 1.5,
    location: pour.location || "",
    companion: pour.companion || "",
    occasion: pour.occasion || "",
    glass: pour.glass || "",
    weather: pour.weather || "",
    mood: pour.mood || "",
    sessionNotes: pour.notes || "",
    nose: Number(fip.nose || 0),
    noseAromas: Array.isArray(fip.noseAromas) ? [...fip.noseAromas] : [],
    noseNotes: fip.noseNotes || "",
    palate: Number(fip.palate || 0),
    palateFlavors: Array.isArray(fip.palateFlavors) ? [...fip.palateFlavors] : [],
    palateNotes: fip.palateNotes || "",
    finish: Number(fip.finish || 0),
    finishNotes: fip.finishNotes || "",
    complexity: Number(fip.complexity || 0),
    value: Number(fip.value ?? (pour.wouldBuyAgain ? 1 : 0)),
    buyAgain: pour.buyAgain || (pour.wouldBuyAgain ? "yes" : "no"),
    summaryNotes: pour.memory || "",
  };
}

function openPourForm(selectedId = "", pourId = "") {
  const editing = pourId ? pours.find((pour) => pour.id === pourId) : null;
  // A fresh add resumes an unsaved draft if one was stashed via "Save Draft".
  pourDraft = editing ? draftFromPour(editing) : loadPourDraft() || blankDraft();

  const owned = bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
  const optionBottles = [...owned];
  if (editing && editing.bottleId && !optionBottles.some((b) => b.id === editing.bottleId)) {
    const original = bottles.find((b) => b.id === editing.bottleId);
    if (original) optionBottles.unshift(original);
  }
  PW("pwBottle").innerHTML = optionBottles.length
    ? optionBottles
        .map((bottle) => `<option value="${escapeHtml(bottle.id)}">${escapeHtml(bottle.name)} · ${escapeHtml(bottle.distillery)}</option>`)
        .join("")
    : `<option value="">No bottles available</option>`;

  if (!pourDraft.bottleId) pourDraft.bottleId = selectedId || optionBottles[0]?.id || "";

  els.pourWizardTitle.textContent = editing ? "Edit Pour Story" : "Add Pour Story";
  els.pwDeleteEntry.classList.toggle("is-hidden", !editing);

  hydrateWizardFromDraft();
  renderPourWizardChips();
  pwGoToStep(1);
  pwUpdateScores();

  if (!els.pourDialog.open) els.pourDialog.showModal();
}

// Push the draft object into every wizard input.
function hydrateWizardFromDraft() {
  const d = pourDraft;
  PW("pwBottle").value = d.bottleId;
  PW("pwDate").value = d.date;
  PW("pwLocation").value = d.location;
  PW("pwCompanion").value = d.companion;
  PW("pwOccasion").value = d.occasion;
  PW("pwGlass").value = d.glass;
  PW("pwWeather").value = d.weather;
  PW("pwMood").value = d.mood;
  PW("pwOunces").value = d.ounces;
  PW("pwSessionNotes").value = d.sessionNotes;
  PW("pwNose").value = d.nose;
  PW("pwNoseNotes").value = d.noseNotes;
  PW("pwPalate").value = d.palate;
  PW("pwPalateNotes").value = d.palateNotes;
  PW("pwFinish").value = d.finish;
  PW("pwFinishNotes").value = d.finishNotes;
  PW("pwComplexity").value = d.complexity;
  PW("pwValue").value = d.value;
  PW("pwBuyAgain").value = d.buyAgain;
  PW("pwSummaryNotes").value = d.summaryNotes;
}

function renderPourWizardChips() {
  const chipMarkup = (list, selected) =>
    list
      .map(
        (name) =>
          `<button class="pour-wizard-chip${selected.includes(name) ? " is-selected" : ""}" data-chip="${escapeHtml(name)}" type="button">${escapeHtml(name)}</button>`,
      )
      .join("");
  PW("pwNoseChips").innerHTML = chipMarkup(NOSE_AROMAS, pourDraft.noseAromas);
  PW("pwPalateChips").innerHTML = chipMarkup(PALATE_FLAVORS, pourDraft.palateFlavors);
}

function pwGoToStep(step) {
  pourDraft.step = step;
  els.pourWizard.querySelectorAll("[data-step-panel]").forEach((panel) => {
    panel.classList.toggle("is-hidden", Number(panel.dataset.stepPanel) !== step);
  });
  els.pourWizard.querySelectorAll("[data-step-dot]").forEach((dot) => {
    const n = Number(dot.dataset.stepDot);
    dot.classList.toggle("is-active", n === step);
    dot.classList.toggle("is-done", n < step);
  });
  if (step === 5) renderPourSummary();
  els.pourWizard.scrollTop = 0;
}

function fipTotal() {
  const d = pourDraft;
  return Number((d.nose + d.palate + d.finish + d.complexity + d.value).toFixed(1));
}

// Refresh the per-step score readouts as sliders move.
function pwUpdateScores() {
  const d = pourDraft;
  PW("pwNoseScoreDisplay").innerHTML = `<strong>${d.nose.toFixed(1)}</strong> / 2.5`;
  PW("pwPalateScoreDisplay").innerHTML = `<strong>${d.palate.toFixed(1)}</strong> / 3.5`;
  PW("pwFinishScoreDisplay").innerHTML = `<strong>${d.finish.toFixed(1)}</strong> / 2.0`;
}

function renderPourSummary() {
  const d = pourDraft;
  const bottle = bottles.find((b) => b.id === d.bottleId);
  PW("pwSummaryBottle").innerHTML = bottle
    ? `${bottleThumb(bottle, "pour-summary-thumb")}
       <div>
         <strong>${escapeHtml(bottle.name)}</strong>
         <span>${escapeHtml(bottle.distillery || "")}</span>
         <span>${formatDate(d.date)}${d.companion ? ` · ${escapeHtml(d.companion)}` : ""}${d.glass ? ` · ${escapeHtml(d.glass)}` : ""}</span>
       </div>`
    : `<strong>No bottle selected</strong>`;

  const setBar = (id, value, max) => {
    const el = PW(id);
    if (el) el.style.width = `${Math.round((value / max) * 100)}%`;
  };
  setBar("pwBarNose", d.nose, FIP_MAX.nose);
  setBar("pwBarPalate", d.palate, FIP_MAX.palate);
  setBar("pwBarFinish", d.finish, FIP_MAX.finish);
  PW("pwOutNose").textContent = `${d.nose.toFixed(1)} / 2.5`;
  PW("pwOutPalate").textContent = `${d.palate.toFixed(1)} / 3.5`;
  PW("pwOutFinish").textContent = `${d.finish.toFixed(1)} / 2.0`;
  PW("pwOutComplexity").textContent = `${d.complexity.toFixed(1)} / 1.0`;
  PW("pwOutValue").textContent = `${d.value.toFixed(1)} / 1.0`;

  const total = fipTotal();
  PW("pwFipScore").textContent = total.toFixed(1);
  const tier = fipTier(total);
  PW("pwTier").className = `pour-summary-tier ${tier.className}`;
  PW("pwTier").innerHTML = `<strong>${tier.label}</strong><span>${tier.blurb}</span>`;
}

function savePourStory() {
  const d = pourDraft;
  if (!d.bottleId) {
    pwGoToStep(1);
    return;
  }
  const total = fipTotal();
  const entry = {
    id: d.editingId || crypto.randomUUID(),
    bottleId: d.bottleId,
    date: d.date || new Date().toISOString().slice(0, 10),
    ounces: Number(d.ounces || 1.5),
    rating: total,
    occasion: d.occasion.trim(),
    notes: d.sessionNotes.trim(),
    companion: d.companion.trim(),
    location: d.location.trim(),
    mood: d.mood.trim(),
    glass: d.glass.trim(),
    weather: d.weather.trim(),
    memory: d.summaryNotes.trim(),
    buyAgain: d.buyAgain,
    wouldBuyAgain: d.buyAgain === "yes",
    fip: {
      nose: d.nose,
      palate: d.palate,
      finish: d.finish,
      complexity: d.complexity,
      value: d.value,
      total,
      noseAromas: [...d.noseAromas],
      palateFlavors: [...d.palateFlavors],
      noseNotes: d.noseNotes.trim(),
      palateNotes: d.palateNotes.trim(),
      finishNotes: d.finishNotes.trim(),
    },
  };

  if (d.editingId) {
    pours = pours.map((pour) => (pour.id === d.editingId ? entry : pour));
  } else {
    pours = [entry, ...pours];
  }
  pourDraft = null;
  clearPourDraft();
  persistPours();
  els.pourDialog.close();
  render();
}

function deletePourFromWizard() {
  if (!pourDraft?.editingId) return;
  if (!confirm("Delete this pour story?")) return;
  pours = pours.filter((pour) => pour.id !== pourDraft.editingId);
  pourDraft = null;
  persistPours();
  els.pourDialog.close();
  render();
}

// --- Draft persistence (Save Draft) ---
const POUR_DRAFT_KEY = "fip-pour-draft";

function savePourDraftToStorage() {
  syncDraftFromInputs();
  if (pourDraft.editingId) return; // don't stash drafts of existing entries
  localStorage.setItem(POUR_DRAFT_KEY, JSON.stringify(pourDraft));
  els.pourDialog.close();
}

function clearPourDraft() {
  localStorage.removeItem(POUR_DRAFT_KEY);
}

function loadPourDraft() {
  const raw = localStorage.getItem(POUR_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Pull current input values back into the draft object (before nav/save/draft).
function syncDraftFromInputs() {
  const d = pourDraft;
  if (!d) return;
  d.bottleId = PW("pwBottle").value;
  d.date = PW("pwDate").value;
  d.location = PW("pwLocation").value;
  d.companion = PW("pwCompanion").value;
  d.occasion = PW("pwOccasion").value;
  d.glass = PW("pwGlass").value;
  d.weather = PW("pwWeather").value;
  d.mood = PW("pwMood").value;
  d.ounces = PW("pwOunces").value;
  d.sessionNotes = PW("pwSessionNotes").value;
  d.nose = Number(PW("pwNose").value);
  d.noseNotes = PW("pwNoseNotes").value;
  d.palate = Number(PW("pwPalate").value);
  d.palateNotes = PW("pwPalateNotes").value;
  d.finish = Number(PW("pwFinish").value);
  d.finishNotes = PW("pwFinishNotes").value;
  d.complexity = Number(PW("pwComplexity").value);
  d.value = Number(PW("pwValue").value);
  d.buyAgain = PW("pwBuyAgain").value;
  d.summaryNotes = PW("pwSummaryNotes").value;
}

// --- Wizard event wiring ---
els.pourWizard.querySelectorAll("[data-goto]").forEach((button) => {
  button.addEventListener("click", () => {
    syncDraftFromInputs();
    pwGoToStep(Number(button.dataset.goto));
  });
});
els.pourWizard.querySelectorAll("[data-step-dot]").forEach((dot) => {
  dot.addEventListener("click", () => {
    syncDraftFromInputs();
    pwGoToStep(Number(dot.dataset.stepDot));
  });
});
["pwNose", "pwPalate", "pwFinish", "pwComplexity", "pwValue"].forEach((id) => {
  PW(id)?.addEventListener("input", () => {
    syncDraftFromInputs();
    pwUpdateScores();
    if (pourDraft.step === 5) renderPourSummary();
  });
});
PW("pwBottle")?.addEventListener("change", () => {
  syncDraftFromInputs();
  if (pourDraft.step === 5) renderPourSummary();
});
[PW("pwNoseChips"), PW("pwPalateChips")].forEach((container) => {
  container?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-chip]");
    if (!chip) return;
    const name = chip.dataset.chip;
    const list = container.id === "pwNoseChips" ? pourDraft.noseAromas : pourDraft.palateFlavors;
    const idx = list.indexOf(name);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(name);
    chip.classList.toggle("is-selected");
  });
});
PW("pwSaveStory")?.addEventListener("click", () => {
  syncDraftFromInputs();
  savePourStory();
});
els.pwDeleteEntry?.addEventListener("click", deletePourFromWizard);
PW("savePourDraft")?.addEventListener("click", savePourDraftToStorage);

// ---- Infinity Bottle ----
// A blending bottle the user keeps topping off with leftover pours over time.
// Unlike `bottles`, these aren't products with a catalog entry — just a name,
// an addition log, and whatever flavor data the logged source bottles carry.

function renderInfinityGrid() {
  if (!els.infinityGrid) return;
  if (!infinityBottles.length) {
    els.infinityGrid.innerHTML = `<div class="empty-state">No infinity bottles yet. Start one from your next near-empty pour.</div>`;
    return;
  }

  els.infinityGrid.innerHTML = infinityBottles
    .map((infinity) => {
      const stats = computeInfinityStats(infinity);
      return `
        <article class="infinity-card" data-infinity="${escapeHtml(infinity.id)}" role="button" tabindex="0">
          <h3>${escapeHtml(infinity.name)}</h3>
          <p>${stats.additionCount} addition${stats.additionCount === 1 ? "" : "s"} · ${stats.totalOunces.toFixed(1)} oz · ${stats.daysAging}d aging</p>
          ${infinity.notes ? `<p class="infinity-card-notes">${escapeHtml(infinity.notes)}</p>` : ""}
        </article>
      `;
    })
    .join("");

  els.infinityGrid.querySelectorAll("[data-infinity]").forEach((card) => {
    const open = () => openInfinityDetail(card.dataset.infinity);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function computeInfinityStats(infinity) {
  const additions = infinity.additions || [];
  const totalOunces = additions.reduce((sum, entry) => sum + (Number(entry.ounces) || 0), 0);
  const daysAging = Math.max(0, Math.floor((Date.now() - (infinity.createdAt || Date.now())) / 86400000));
  const hasUnknownProofEntries = additions.some((entry) => !(Number(entry.sourceProof) > 0));
  return {
    additionCount: additions.length,
    totalOunces,
    daysAging,
    blendProof: computeInfinityBlendProof(additions),
    hasUnknownProofEntries,
  };
}

// Volume-weighted average proof across every addition that has a known proof (i.e. was
// logged against a real inventory bottle) — freeform "typed a name" entries have no known
// proof and are simply excluded from the average rather than dragging it toward 0.
function computeInfinityBlendProof(additions) {
  let weightedSum = 0;
  let knownOunces = 0;
  additions.forEach((entry) => {
    const proof = Number(entry.sourceProof);
    const ounces = Number(entry.ounces) || 0;
    if (proof > 0 && ounces > 0) {
      weightedSum += proof * ounces;
      knownOunces += ounces;
    }
  });
  return knownOunces ? weightedSum / knownOunces : null;
}

// Only additions logged against a real inventory bottle carry flavor tags (snapshotted
// at add-time), so a freeform "typed a name" entry simply doesn't weigh in the blend profile.
function getInfinityBlendItems(infinity) {
  return (infinity.additions || [])
    .filter((entry) => Array.isArray(entry.sourceFlavors) && entry.sourceFlavors.length)
    .map((entry) => ({ flavors: entry.sourceFlavors, notes: "", type: "", category: "" }));
}

function randomInfinityName() {
  const used = new Set(infinityBottles.map((infinity) => infinity.name));
  const available = INFINITY_NAME_IDEAS.filter((name) => !used.has(name));
  const pool = available.length ? available : INFINITY_NAME_IDEAS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createInfinityBottle() {
  const infinity = {
    id: crypto.randomUUID(),
    name: randomInfinityName(),
    notes: "",
    createdAt: Date.now(),
    additions: [],
  };
  infinityBottles = [infinity, ...infinityBottles];
  persistInfinityBottles();
  renderInfinityGrid();
  openInfinityDetail(infinity.id, "log");
}

function renderInfinityRadar(items) {
  const axes = flavorAxes();
  const scores = axes.map((axis) => scoreFlavorAxis(items, axis));
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
  const labels = axes
    .map((axis, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
      return `<text x="${center + Math.cos(angle) * 105}" y="${center + Math.sin(angle) * 105}" text-anchor="middle" dominant-baseline="middle">${axis.label}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 240 240" role="img" aria-label="Infinity blend flavor profile">
      ${rings}
      <polygon points="${points.join(" ")}" class="radar-shape"></polygon>
      ${labels}
    </svg>
  `;
}

// Ranks currently-open bottles as candidates for the next addition: near-empty
// bottles score highest (that's the whole point — use up the dregs), and a bottle
// that fills whatever flavor axis the blend is currently lightest on gets a boost.
function computeInfinitySuggestions(infinity) {
  const openBottles = bottles.filter((bottle) => bottle.status === "open");
  if (!openBottles.length) return [];

  const blendItems = getInfinityBlendItems(infinity);
  let weakestAxis = null;
  if (blendItems.length) {
    const axes = flavorAxes();
    const scores = axes.map((axis) => scoreFlavorAxis(blendItems, axis));
    weakestAxis = axes[scores.indexOf(Math.min(...scores))];
  }

  const fillUrgency = { empty: 4, low: 3, half: 2, "three-quarter": 1, full: 0 };
  return openBottles
    .map((bottle) => {
      const urgency = fillUrgency[bottle.fillLevel] ?? 1;
      const complement = weakestAxis ? scoreFlavorAxis([bottle], weakestAxis) : 0;
      let reason = "open and ready to pour in";
      if (complement > 0 && weakestAxis) reason = `adds ${weakestAxis.label.toLowerCase()} notes this blend is light on`;
      if (urgency >= 3) reason = "almost empty — good one to top off from";
      return { bottle, score: urgency * 3 + complement * 2, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function renderInfinitySuggestions(infinity) {
  const picks = computeInfinitySuggestions(infinity);
  if (!picks.length) {
    return `
      <div class="infinity-suggestions">
        <span class="section-label">What to Add Next</span>
        <div class="empty-state">Open a bottle in your inventory to get suggestions here.</div>
      </div>
    `;
  }
  return `
    <div class="infinity-suggestions">
      <span class="section-label">What to Add Next</span>
      <div class="suggest-grid">
        ${picks
          .map(
            (pick) => `
          <article class="suggest-card" data-infinity-add="${escapeHtml(pick.bottle.id)}" role="button" tabindex="0" title="Log this pour">
            <img class="suggest-photo" src="${bottleImage(pick.bottle)}" alt="${escapeHtml(pick.bottle.name)} bottle" />
            <h4>${escapeHtml(pick.bottle.name)}</h4>
            <p>${escapeHtml(pick.bottle.distillery)} · ${labelFillLevel(pick.bottle.fillLevel)}</p>
            <em>${escapeHtml(pick.reason)}</em>
          </article>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function availableInfinitySourceBottles() {
  return bottles.filter((bottle) => !["wishlist", "buy-next"].includes(bottle.status));
}

// One row of the "Add to Blend" form — a single ingredient (source + amount). The
// form can hold several of these so one blending session can log every pour at once.
function renderInfinityIngredientRow(preselectBottleId) {
  const availableBottles = availableInfinitySourceBottles();
  return `
    <div class="infinity-ingredient-row" data-row>
      <select class="infinity-row-source" aria-label="Source bottle">
        <option value="">Type a name instead…</option>
        ${availableBottles
          .map(
            (bottle) =>
              `<option value="${escapeHtml(bottle.id)}" ${bottle.id === preselectBottleId ? "selected" : ""}>${escapeHtml(bottle.name)} — ${escapeHtml(bottle.distillery)}</option>`,
          )
          .join("")}
      </select>
      <input class="infinity-row-freename" type="text" placeholder="Or type a name" aria-label="Ingredient name" />
      <input class="infinity-row-ounces" type="number" min="0" step="0.01" placeholder="oz" aria-label="Ounces" />
      <button class="icon-button infinity-row-remove" type="button" aria-label="Remove ingredient">×</button>
    </div>
  `;
}

function renderInfinityLogTab(infinity, preselectBottleId) {
  const additions = [...(infinity.additions || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return `
    <form class="infinity-add-form" id="infinityAddForm">
      <div class="infinity-ingredient-rows" id="infinityIngredientRows">
        ${renderInfinityIngredientRow(preselectBottleId)}
      </div>
      <button class="secondary-action" id="infinityAddRow" type="button">+ Add Another Ingredient</button>

      <div class="form-grid">
        <label>
          Date
          <input type="date" id="infinityEntryDate" value="${new Date().toISOString().slice(0, 10)}" />
        </label>
        <label>
          Notes
          <input type="text" id="infinityEntryNotes" placeholder="Optional, applies to everything added now" />
        </label>
      </div>
      <button class="primary-action" type="submit">+ Add to Blend</button>
    </form>

    <div class="infinity-log-list">
      ${
        additions.length
          ? additions
              .map(
                (entry) => `
          <div class="infinity-log-item">
            <div>
              <strong>${escapeHtml(entry.sourceName || "Unnamed pour")}</strong>
              <span>${entry.date ? formatDate(entry.date) : "No date"} · ${Number(entry.ounces || 0).toFixed(2)} oz</span>
              ${entry.notes ? `<p>${escapeHtml(entry.notes)}</p>` : ""}
            </div>
            <button class="icon-button" data-delete-infinity-entry="${escapeHtml(entry.id)}" type="button" aria-label="Delete entry">×</button>
          </div>
        `,
              )
              .join("")
          : `<div class="empty-state">No additions logged yet.</div>`
      }
    </div>
  `;
}

// Re-assigning .onclick (rather than addEventListener) keeps this idempotent — safe
// to call again every time a row is added without stacking duplicate listeners.
function bindInfinityRowRemove() {
  document.querySelectorAll(".infinity-row-remove").forEach((button) => {
    button.onclick = () => {
      const rows = document.querySelectorAll("#infinityIngredientRows [data-row]");
      if (rows.length <= 1) return;
      button.closest("[data-row]").remove();
    };
  });
}

function openInfinityDetail(id, tab, preselectBottleId) {
  const infinity = infinityBottles.find((item) => item.id === id);
  if (!infinity) return;
  const activeTab = tab || els.infinityDetail.querySelector("[data-itab].is-active")?.dataset.itab || "overview";
  const stats = computeInfinityStats(infinity);
  const blendItems = getInfinityBlendItems(infinity);

  els.infinityDetail.innerHTML = `
    <div class="form-head">
      <div>
        <p>Infinity Bottle</p>
        <h2>${escapeHtml(infinity.name)}</h2>
      </div>
      <button class="icon-button" id="closeInfinityDetail" type="button" aria-label="Close">×</button>
    </div>

    <div class="quick-tabs" role="tablist">
      <button class="quick-tab${activeTab === "overview" ? " is-active" : ""}" data-itab="overview" type="button">Overview</button>
      <button class="quick-tab${activeTab === "log" ? " is-active" : ""}" data-itab="log" type="button">Log</button>
    </div>

    <div class="quick-tab-panel${activeTab === "overview" ? "" : " is-hidden"}" data-itab-panel="overview">
      <label class="infinity-name-field">
        Name
        <div class="infinity-name-row">
          <input type="text" id="infinityNameInput" value="${escapeHtml(infinity.name)}" />
          <button class="secondary-action" id="infinityShuffleName" type="button" title="Suggest a name">🎲</button>
        </div>
      </label>

      ${renderInfinityDecanter(stats.totalOunces)}

      <div class="bottle-meta infinity-meta">
        <div><span>Total Added</span><strong>${stats.totalOunces.toFixed(1)} oz</strong></div>
        <div><span>Additions</span><strong>${stats.additionCount}</strong></div>
        <div><span>Aging</span><strong>${stats.daysAging}d</strong></div>
        <div><span>Est. Proof</span><strong>${stats.blendProof ? stats.blendProof.toFixed(1) : "—"}</strong></div>
      </div>
      ${
        stats.blendProof && stats.hasUnknownProofEntries
          ? `<p class="infinity-proof-note">Estimate excludes ingredients not linked to an inventory bottle.</p>`
          : ""
      }

      <div class="bottle-radar">
        ${blendItems.length ? renderInfinityRadar(blendItems) : `<div class="empty-state">Log an addition to see this blend's flavor profile.</div>`}
      </div>

      <label>
        Notes
        <textarea id="infinityNotesInput" rows="3" placeholder="Tasting notes, what's working, what to try next…">${escapeHtml(infinity.notes || "")}</textarea>
      </label>

      ${renderInfinitySuggestions(infinity)}

      <div class="form-actions">
        <button class="secondary-action" id="deleteInfinityBottle" type="button">Delete Infinity Bottle</button>
      </div>
    </div>

    <div class="quick-tab-panel${activeTab === "log" ? "" : " is-hidden"}" data-itab-panel="log">
      ${renderInfinityLogTab(infinity, preselectBottleId)}
    </div>
  `;

  if (!els.infinityDialog.open) els.infinityDialog.showModal();

  document.querySelector("#closeInfinityDetail").addEventListener("click", () => els.infinityDialog.close());
  els.infinityDetail.querySelectorAll("[data-itab]").forEach((tabButton) => {
    tabButton.addEventListener("click", () => openInfinityDetail(id, tabButton.dataset.itab));
  });

  document.querySelector("#infinityNameInput")?.addEventListener("change", (event) => {
    renameInfinityBottle(id, event.target.value);
  });
  document.querySelector("#infinityShuffleName")?.addEventListener("click", () => {
    document.querySelector("#infinityNameInput").value = randomInfinityName();
  });
  document.querySelector("#infinityNotesInput")?.addEventListener("change", (event) => {
    updateInfinityNotes(id, event.target.value);
  });
  document.querySelector("#deleteInfinityBottle")?.addEventListener("click", () => deleteInfinityBottleConfirm(id));

  els.infinityDetail.querySelectorAll("[data-infinity-add]").forEach((card) => {
    card.addEventListener("click", () => openInfinityDetail(id, "log", card.dataset.infinityAdd));
  });

  bindInfinityRowRemove();
  document.querySelector("#infinityAddRow")?.addEventListener("click", () => {
    document.querySelector("#infinityIngredientRows").insertAdjacentHTML("beforeend", renderInfinityIngredientRow());
    bindInfinityRowRemove();
  });

  document.querySelector("#infinityAddForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitInfinityEntry(id);
  });

  els.infinityDetail.querySelectorAll("[data-delete-infinity-entry]").forEach((button) => {
    button.addEventListener("click", () => deleteInfinityEntry(id, button.dataset.deleteInfinityEntry));
  });
}

function renameInfinityBottle(id, name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  infinityBottles = infinityBottles.map((infinity) => (infinity.id === id ? { ...infinity, name: trimmed } : infinity));
  persistInfinityBottles();
  renderInfinityGrid();
}

function updateInfinityNotes(id, notes) {
  infinityBottles = infinityBottles.map((infinity) => (infinity.id === id ? { ...infinity, notes } : infinity));
  persistInfinityBottles();
}

function deleteInfinityBottleConfirm(id) {
  if (!confirm("Delete this infinity bottle and its whole addition log? This can't be undone.")) return;
  infinityBottles = infinityBottles.filter((infinity) => infinity.id !== id);
  persistInfinityBottles();
  els.infinityDialog.close();
  renderInfinityGrid();
}

// One submit can log several ingredients at once (one blending session, several
// pours) — every filled row becomes its own addition, all sharing the form's date/notes.
function submitInfinityEntry(id) {
  const date = document.querySelector("#infinityEntryDate").value || new Date().toISOString().slice(0, 10);
  const notes = document.querySelector("#infinityEntryNotes").value.trim();

  const rows = [...document.querySelectorAll("#infinityIngredientRows [data-row]")];
  const entries = [];
  let hadIncompleteRow = false;

  rows.forEach((row) => {
    const sourceSelect = row.querySelector(".infinity-row-source");
    const freeName = row.querySelector(".infinity-row-freename").value.trim();
    const ounces = Number(row.querySelector(".infinity-row-ounces").value || 0);
    const sourceBottle = sourceSelect.value ? bottles.find((bottle) => bottle.id === sourceSelect.value) : null;
    const sourceName = sourceBottle ? sourceBottle.name : freeName;

    if (ounces <= 0 && !sourceName) return; // a fully blank row is just an unused slot, not an error
    if (ounces <= 0 || !sourceName) {
      hadIncompleteRow = true;
      return;
    }

    entries.push({
      id: crypto.randomUUID(),
      date,
      ounces,
      notes,
      sourceBottleId: sourceBottle?.id || null,
      sourceName,
      sourceFlavors: sourceBottle?.flavors || [],
      sourceProof: sourceBottle?.proof || null,
    });
  });

  if (!entries.length) {
    alert(hadIncompleteRow ? "Each ingredient needs both a name and an ounce amount." : "Add at least one ingredient.");
    return;
  }
  if (hadIncompleteRow && !confirm("One row is missing a name or ounces and will be skipped. Add the rest anyway?")) {
    return;
  }

  infinityBottles = infinityBottles.map((infinity) =>
    infinity.id === id ? { ...infinity, additions: [...entries, ...(infinity.additions || [])] } : infinity,
  );
  persistInfinityBottles();
  renderInfinityGrid();
  openInfinityDetail(id, "log");
}

// A decanter that visually fills as ounces accumulate, scaled to whichever standard
// bottle size the current total is closest to (375ml/750ml/1L/1.75L).
// Squared, faceted crystal decanter (wide angular body, short neck, tall block
// stopper) rather than a rounded flask — modeled on a reference decanter photo.
function renderInfinityDecanter(totalOunces) {
  const tiers = [
    { oz: 12.7, label: "375ml" },
    { oz: 25.4, label: "750ml" },
    { oz: 33.8, label: "1L" },
    { oz: 59.2, label: "1.75L" },
  ];
  const tier = tiers.find((t) => totalOunces <= t.oz) || tiers[tiers.length - 1];
  const fillPercent = Math.max(0, Math.min(100, (totalOunces / tier.oz) * 100));
  const bodyTop = 72;
  const bodyBottom = 190;
  const maxFillHeight = bodyBottom - bodyTop;
  const fillHeight = (maxFillHeight * fillPercent) / 100;
  const fillY = (bodyBottom - fillHeight).toFixed(1);
  // Neck bottom -> shoulder facet -> straight sides -> rounded base corners -> back
  // up the left side -> Z closes with the mirrored shoulder facet on the left.
  const bodyPath =
    "M48,55 L72,55 L106,72 L106,178 C106,185 100,190 92,190 L28,190 C20,190 14,185 14,178 L14,72 Z";

  return `
    <div class="infinity-decanter">
      <svg viewBox="0 0 120 200" role="img" aria-label="${totalOunces.toFixed(1)} ounces added, about ${Math.round(fillPercent)}% of a ${tier.label} bottle">
        <defs>
          <clipPath id="decanterClip"><path d="${bodyPath}"></path></clipPath>
        </defs>
        <rect class="decanter-fill" x="0" y="${fillY}" width="120" height="${fillHeight.toFixed(1)}" clip-path="url(#decanterClip)"></rect>
        <path class="decanter-outline" d="${bodyPath}"></path>
        <line class="decanter-facet" x1="40" y1="78" x2="40" y2="186"></line>
        <line class="decanter-facet" x1="80" y1="78" x2="80" y2="186"></line>
        <rect class="decanter-glass" x="48" y="30" width="24" height="26"></rect>
        <rect class="decanter-glass" x="42" y="22" width="36" height="10" rx="2"></rect>
        <rect class="decanter-glass" x="46" y="0" width="28" height="26" rx="2"></rect>
      </svg>
      <p class="infinity-decanter-caption">${totalOunces.toFixed(1)} oz · about ${Math.round(fillPercent)}% of a ${tier.label} bottle</p>
    </div>
  `;
}

function deleteInfinityEntry(id, entryId) {
  if (!confirm("Delete this addition from the log?")) return;
  infinityBottles = infinityBottles.map((infinity) =>
    infinity.id === id
      ? { ...infinity, additions: (infinity.additions || []).filter((entry) => entry.id !== entryId) }
      : infinity,
  );
  persistInfinityBottles();
  renderInfinityGrid();
  openInfinityDetail(id, "log");
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
    if (assistantHistory.length) {
      // Continue the conversation from last time instead of starting over.
      assistantHistory.forEach((turn) => {
        appendAssistantMessage(turn.role, turn.role === "user" ? turn.content : aiMessage(turn.content));
      });
    } else {
      appendAssistantMessage(
        "assistant",
        aiMessage("Dispatch ready. What's the call tonight? I can pick the right bottle by mood, occasion, flavor profile, or tier."),
      );
    }
  }
}

function runAiTool(action) {
  if (action === "compare") {
    els.compareOutput.innerHTML = renderBottleComparison();
    const validPair = els.compareA.value && els.compareB.value && els.compareA.value !== els.compareB.value;
    els.viewFullFaceoff.classList.toggle("is-hidden", !validPair);
  }
}

function openFaceoffView(aId, bId) {
  if (!aId || !bId || aId === bId) return;
  faceoffPair = { aId, bId };
  previousViewBeforeFaceoff = activeView;
  activeView = "faceoff";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeFaceoffView() {
  activeView = previousViewBeforeFaceoff || "compare";
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item.dataset.view === activeView));
  render();
}

function summarizeCollectionForAi() {
  if (!bottles.length) return "";
  return bottles
    .slice(0, 40)
    .map(
      (bottle) =>
        `${bottle.name} (${bottle.distillery}, ${bottle.type}, ${numberOrDash(bottle.proof)} proof, status: ${bottle.status}, rating: ${numberOrDash(bottle.rating)})`,
    )
    .join("\n");
}

async function askSommelierAi(prompt, history) {
  if (!currentUser || !cloudFunctions) return null;
  try {
    const callable = cloudFunctions.httpsCallable("askSommelier");
    const result = await callable({ prompt, history, collectionSummary: summarizeCollectionForAi() });
    return result.data?.reply || null;
  } catch (error) {
    console.error("AI sommelier call failed", error);
    return null;
  }
}

async function sendAssistantMessage(event) {
  event?.preventDefault();
  const prompt = els.assistantPrompt.value.trim();
  if (!prompt) return;

  appendAssistantMessage("user", prompt);
  els.assistantPrompt.value = "";

  if (currentUser && cloudFunctions) {
    const thinking = appendAssistantMessage("assistant", aiMessage("Thinking..."));
    const aiReply = await askSommelierAi(prompt, assistantHistory);
    if (aiReply) {
      thinking.innerHTML = aiMessage(aiReply);
      els.assistantMessages.scrollTop = els.assistantMessages.scrollHeight;
      assistantHistory.push({ role: "user", content: prompt }, { role: "assistant", content: aiReply });
      persistAssistantHistory();
      return;
    }
    thinking.remove();
  }

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
  return message;
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

function renderFaceoffView() {
  if (!faceoffPair) return;
  const a = bottles.find((bottle) => bottle.id === faceoffPair.aId);
  const b = bottles.find((bottle) => bottle.id === faceoffPair.bId);
  if (!a || !b) {
    els.faceoffBody.innerHTML = `<div class="empty-state">Select two bottles from Compare to start a Faceoff.</div>`;
    return;
  }

  const aScore = faceoffScore(a);
  const bScore = faceoffScore(b);
  const winner = aScore === bScore ? null : aScore > bScore ? a : b;
  const loser = winner ? (winner === a ? b : a) : null;
  const tags = winner ? bestForTags(winner, loser) : [];
  const profileA = faceoffFlavorProfile(a);
  const profileB = faceoffFlavorProfile(b);
  const similar = findSimilarFaceoffBottles(a, b);
  const pairKey = faceoffPairKey(a, b);

  els.faceoffBody.innerHTML = `
    <div class="faceoff-matchup">
      <div class="faceoff-side">
        <img src="${bottleImage(a)}" alt="${escapeHtml(a.name)} bottle" />
        <strong>${escapeHtml(a.name)}</strong>
        <span>${escapeHtml(a.distillery)}</span>
      </div>
      <span class="faceoff-vs">VS</span>
      <div class="faceoff-side">
        <img src="${bottleImage(b)}" alt="${escapeHtml(b.name)} bottle" />
        <strong>${escapeHtml(b.name)}</strong>
        <span>${escapeHtml(b.distillery)}</span>
      </div>
    </div>

    <div class="faceoff-section faceoff-winner">
      <p class="faceoff-eyebrow">Overall Winner</p>
      ${winner ? `<h3>🏆 ${escapeHtml(winner.name)}</h3>` : `<h3>Too close to call</h3>`}
      ${tags.length ? `<div class="faceoff-tag-row">${tags.map((tag) => `<span class="flavor-chip">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    </div>

    <div class="faceoff-section">
      <p class="faceoff-eyebrow">Scene Size-Up</p>
      <div class="faceoff-spec-table">
        <div class="faceoff-spec-row faceoff-spec-head"><span></span><span>${escapeHtml(a.name)}</span><span>${escapeHtml(b.name)}</span></div>
        <div class="faceoff-spec-row"><span>Proof</span><span>${numberOrDash(a.proof)}</span><span>${numberOrDash(b.proof)}</span></div>
        <div class="faceoff-spec-row"><span>Age</span><span>${escapeHtml(a.ageStatement || "NAS")}</span><span>${escapeHtml(b.ageStatement || "NAS")}</span></div>
        <div class="faceoff-spec-row"><span>MSRP</span><span>${money(a.msrp || a.price)}</span><span>${money(b.msrp || b.price)}</span></div>
        <div class="faceoff-spec-row"><span>Distillery</span><span>${escapeHtml(a.distillery)}</span><span>${escapeHtml(b.distillery)}</span></div>
      </div>
    </div>

    <div class="faceoff-section">
      <p class="faceoff-eyebrow">Flavor Comparison</p>
      <div class="faceoff-flavor-grid">
        <div></div><div>${escapeHtml(a.name)}</div><div>${escapeHtml(b.name)}</div>
        <div>Nose</div><div>${escapeHtml(profileA.nose)}</div><div>${escapeHtml(profileB.nose)}</div>
        <div>Palate</div><div>${escapeHtml(profileA.palate)}</div><div>${escapeHtml(profileB.palate)}</div>
        <div>Finish</div><div>${escapeHtml(profileA.finish)}</div><div>${escapeHtml(profileB.finish)}</div>
      </div>
    </div>

    <div class="faceoff-section">
      <p class="faceoff-eyebrow">Flavor Radar</p>
      <div class="faceoff-radar">
        ${renderFaceoffRadar(a, b)}
        <div class="faceoff-radar-legend">
          <span class="legend-a">${escapeHtml(a.name)}</span>
          <span class="legend-b">${escapeHtml(b.name)}</span>
        </div>
      </div>
    </div>

    <div class="faceoff-section">
      <p class="faceoff-eyebrow">AI Verdict</p>
      <p class="faceoff-verdict">${faceoffVerdict(a, b, winner)}</p>
    </div>

    <div class="faceoff-section">
      <p class="faceoff-eyebrow">Similar Bottles</p>
      ${
        similar.length
          ? `<div class="faceoff-similar-grid">${similar
              .map(
                (bottle) => `
                  <div class="faceoff-similar-card">
                    ${bottleThumb(bottle)}
                    <strong>${escapeHtml(bottle.name)}</strong>
                    <span>${escapeHtml(bottle.distillery)} · ${numberOrDash(bottle.proof)} proof</span>
                  </div>
                `,
              )
              .join("")}</div>`
          : `<div class="empty-state">Add more bottles to your collection to see suggestions.</div>`
      }
    </div>

    <div class="faceoff-section">
      <p class="faceoff-eyebrow">Community Ratings</p>
      <div id="faceoffVotes"></div>
    </div>

    <div class="faceoff-section">
      <p class="faceoff-eyebrow">Your Notes</p>
      <div class="faceoff-notes-grid">
        ${faceoffNotesHtml(a)}
        ${faceoffNotesHtml(b)}
      </div>
    </div>
  `;

  renderFaceoffVotes(pairKey, a, b);
  els.faceoffBody.querySelectorAll("[data-edit-notes]").forEach((button) => {
    button.addEventListener("click", () => openForm(button.dataset.editNotes));
  });
}

function faceoffScore(bottle) {
  const rating = Number(bottle.rating) || 0;
  const proof = Number(bottle.proof) || 0;
  return rating * 10 + Math.min(proof, 140) / 20;
}

function bestForTags(bottle, other) {
  const tags = [];
  const proof = Number(bottle.proof) || 0;
  const price = Number(bottle.price) || 0;
  const otherPrice = Number(other.price) || 0;
  const axes = flavorAxes();
  const scores = Object.fromEntries(axes.map((axis) => [axis.key, scoreFlavorAxis([bottle], axis)]));
  const topAxisKey = Object.entries(scores).sort((x, y) => y[1] - x[1])[0]?.[0];

  if (proof >= 110) tags.push("🔥 High Proof");
  if (price > 0 && (price <= 45 || (otherPrice > 0 && price < otherPrice * 0.75))) tags.push("💰 Value");
  if ((scores.oak > 0 || scores.spice > 0) && proof >= 95) tags.push("🥃 Cigar Pairing");
  if (proof < 95 && topAxisKey === "sweet") tags.push("🍯 Easy Sipper");
  if (Number(bottle.rating) >= 9) tags.push("⭐ Crowd Favorite");
  if (!tags.length) tags.push("🥃 Solid Pour");
  return tags.slice(0, 3);
}

function faceoffFlavorProfile(bottle) {
  const flavors = bottle.flavors.length ? bottle.flavors : ["oak", "caramel", "spice"];
  return {
    nose: flavors.slice(0, 2).join(" and "),
    palate: flavors.slice(0, 3).join(", "),
    finish: Number(bottle.proof) >= 110 ? "long, hot, and lingering" : "short-to-medium and easy",
  };
}

function renderFaceoffRadar(a, b) {
  const axes = flavorAxes();
  const scoresA = axes.map((axis) => scoreFlavorAxis([a], axis));
  const scoresB = axes.map((axis) => scoreFlavorAxis([b], axis));
  const max = Math.max(...scoresA, ...scoresB, 1);
  const center = 120;
  const radius = 82;
  const toPoints = (scores) =>
    scores
      .map((score, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
        const value = Math.max(0.14, score / max);
        return `${center + Math.cos(angle) * radius * value},${center + Math.sin(angle) * radius * value}`;
      })
      .join(" ");
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

  return `
    <svg viewBox="0 0 240 240" role="img" aria-label="Flavor radar comparing ${escapeHtml(a.name)} and ${escapeHtml(b.name)}">
      ${rings}
      ${spokes}
      <polygon points="${toPoints(scoresA)}" class="radar-shape radar-shape-a"></polygon>
      <polygon points="${toPoints(scoresB)}" class="radar-shape radar-shape-b"></polygon>
      ${labels}
    </svg>
  `;
}

function faceoffVerdict(a, b, winner) {
  const proofLead = Number(a.proof) > Number(b.proof) ? a : b;
  const proofTrail = proofLead === a ? b : a;
  const flavorOverlap = a.flavors.filter((flavor) => b.flavors.includes(flavor));
  const overlapText = flavorOverlap.length
    ? `They share notes of ${escapeHtml(flavorOverlap.slice(0, 3).join(", "))}, so the difference comes down to intensity and finish.`
    : `Their flavor profiles barely overlap, so this is a real study in contrast.`;
  const winnerText = winner
    ? `${escapeHtml(winner.name)} takes it${Number(winner.rating) > 0 ? ` on the strength of its ${Number(winner.rating).toFixed(1)} rating` : " on proof and profile alone"}, but ${escapeHtml(winner === a ? b.name : a.name)} is far from a runner-up.`
    : `Neither bottle has a logged rating yet, so call this one a coin flip until you pour both.`;
  return `${escapeHtml(proofLead.name)} runs the hotter pour at ${numberOrDash(proofLead.proof)} proof versus ${numberOrDash(proofTrail.proof)} for ${escapeHtml(proofTrail.name)}. ${overlapText} ${winnerText}`;
}

function findSimilarFaceoffBottles(a, b) {
  const ownedNames = new Set(bottles.map((bottle) => bottle.name.toLowerCase()));
  const flavorPool = new Set([...a.flavors, ...b.flavors].map((flavor) => flavor.toLowerCase()));
  const avgProof = (Number(a.proof) + Number(b.proof)) / 2;
  return aiBottleLibrary
    .filter((bottle) => !ownedNames.has(bottle.name.toLowerCase()))
    .map((bottle) => {
      const flavorOverlap = (bottle.flavors || []).filter((flavor) => flavorPool.has(flavor.toLowerCase())).length;
      const proofDistance = Math.abs(Number(bottle.proof || 0) - avgProof);
      const typeMatch = bottle.type === a.type || bottle.type === b.type ? 1 : 0;
      return { ...bottle, score: flavorOverlap * 3 + typeMatch * 2 - proofDistance / 20 };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 4);
}

function faceoffNotesHtml(bottle) {
  return `
    <div class="faceoff-notes-card">
      <strong>${escapeHtml(bottle.name)}</strong>
      <p>${bottle.notes ? escapeHtml(bottle.notes) : "No notes yet."}</p>
      <button class="secondary-action" data-edit-notes="${escapeHtml(bottle.id)}" type="button">Edit Notes</button>
    </div>
  `;
}

function faceoffPairKey(a, b) {
  const keyA = slugify(`${a.name}-${a.distillery}`);
  const keyB = slugify(`${b.name}-${b.distillery}`);
  return [keyA, keyB].sort().join("__");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function loadFaceoffVotes(pairKey) {
  const result = { aVotes: 0, bVotes: 0, myVote: null };
  if (!db) return result;
  try {
    const snap = await db.collection("faceoffVotes").where("pairKey", "==", pairKey).get();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.winner === "a") result.aVotes += 1;
      if (data.winner === "b") result.bVotes += 1;
      if (currentUser && data.voterUid === currentUser.uid) result.myVote = data.winner;
    });
  } catch (error) {
    console.error("Failed to load faceoff votes", error);
  }
  return result;
}

async function castFaceoffVote(pairKey, a, b, winnerSide) {
  if (!currentUser || !db) {
    alert("Sign in with Google to vote in the Faceoff.");
    return;
  }
  const ref = db.collection("faceoffVotes").doc(`${pairKey}_${currentUser.uid}`);
  try {
    await ref.set({
      pairKey,
      aName: a.name,
      bName: b.name,
      winner: winnerSide,
      voterUid: currentUser.uid,
      voterUsername: currentProfile?.username || "",
      createdAt: Date.now(),
    });
    renderFaceoffVotes(pairKey, a, b);
  } catch (error) {
    console.error("Faceoff vote failed", error);
  }
}

async function renderFaceoffVotes(pairKey, a, b) {
  const loadingTarget = document.querySelector("#faceoffVotes");
  if (!loadingTarget) return;
  loadingTarget.innerHTML = `<div class="empty-state">Loading community votes…</div>`;
  const votes = await loadFaceoffVotes(pairKey);
  // Re-query: the user may have navigated away and back while this awaited, replacing the node.
  const target = document.querySelector("#faceoffVotes");
  if (!target) return;
  const total = votes.aVotes + votes.bVotes;
  const aPct = total ? Math.round((votes.aVotes / total) * 100) : 50;
  const bPct = total ? 100 - aPct : 50;
  target.innerHTML = `
    <div class="faceoff-vote-bar"><i style="width: ${aPct}%"></i></div>
    <div class="faceoff-vote-row">
      <button class="secondary-action${votes.myVote === "a" ? " is-voted" : ""}" data-vote="a" type="button">🏆 ${escapeHtml(a.name)} (${votes.aVotes})</button>
      <button class="secondary-action${votes.myVote === "b" ? " is-voted" : ""}" data-vote="b" type="button">🏆 ${escapeHtml(b.name)} (${votes.bVotes})</button>
    </div>
    <span class="faceoff-vote-meta">${total ? `${total} pour${total === 1 ? "" : "s"} weighed in · ${aPct}% / ${bPct}%` : currentUser ? "Be the first to vote." : "Sign in to vote."}</span>
  `;
  target.querySelectorAll("[data-vote]").forEach((button) => {
    button.addEventListener("click", () => castFaceoffVote(pairKey, a, b, button.dataset.vote));
  });
}

function shareFaceoffCard() {
  if (!faceoffPair) return;
  const a = bottles.find((bottle) => bottle.id === faceoffPair.aId);
  const b = bottles.find((bottle) => bottle.id === faceoffPair.bId);
  if (!a || !b) return;
  const text = `🔥 Fireground Faceoff: ${a.name} vs ${b.name} — see who wins on Fully Involved Pour.`;
  if (navigator.share) {
    navigator.share({ title: "Fireground Faceoff", text, url: location.href }).catch(() => {});
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(`${text} ${location.href}`);
    alert("Faceoff link copied to clipboard.");
    return;
  }
  alert(text);
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

function renderTastingNoteBlock(bottle) {
  const note = bottle.tastingNote;
  if (!note || !(note.nose || note.palate || note.finish)) {
    return `<p>${escapeHtml(bottle.notes || "No notes yet.")}</p>`;
  }
  return `
    <div class="tasting-note-block">
      <span class="section-label">Tasting note</span>
      ${note.nose ? `<div><strong>Nose</strong><p>${escapeHtml(note.nose)}</p></div>` : ""}
      ${note.palate ? `<div><strong>Palate</strong><p>${escapeHtml(note.palate)}</p></div>` : ""}
      ${note.finish ? `<div><strong>Finish</strong><p>${escapeHtml(note.finish)}</p></div>` : ""}
      ${note.score ? `<div><strong>Score</strong><p>${Number(note.score).toFixed(1)}/10</p></div>` : ""}
    </div>
  `;
}

function renderDistilleryInfoBlock(bottle) {
  const profile = distilleryProfiles[String(bottle.distillery || "").toLowerCase()];
  if (!profile) return "";
  return `
    <div class="distillery-info-block">
      <span class="section-label">About ${escapeHtml(bottle.distillery)}</span>
      <p class="distillery-meta">${escapeHtml(profile.location)} · Founded ${escapeHtml(profile.founded)}</p>
      <p>${escapeHtml(profile.blurb)}</p>
    </div>
  `;
}

// A one-line mashbill descriptor for the spec table: the recipe percentages when
// present, otherwise the category tag (Wheated / Rye) the user assigned.
function mashBillSummary(bottle) {
  const corn = Number(bottle.mashBillCorn || 0);
  const ryeWheat = Number(bottle.mashBillRyeWheat || 0);
  const malted = Number(bottle.mashBillMalted || 0);
  if (corn || ryeWheat || malted) {
    return [corn ? `${corn}% Corn` : "", ryeWheat ? `${ryeWheat}% Rye/Wheat` : "", malted ? `${malted}% Malt` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  const categories = bottleCategories(bottle);
  if (categories.includes("wheated")) return "Wheated";
  if (categories.includes("rye")) return "Rye";
  return "";
}

function renderMashBillBlock(bottle) {
  const corn = Number(bottle.mashBillCorn || 0);
  const ryeWheat = Number(bottle.mashBillRyeWheat || 0);
  const malted = Number(bottle.mashBillMalted || 0);
  if (!corn && !ryeWheat && !malted) return "";
  return `
    <div class="mash-bill-block">
      <span class="section-label">Mash Bill</span>
      <div class="mash-bill-bars">
        <div class="mash-bill-bar"><span>Corn</span><strong>${corn}%</strong></div>
        <div class="mash-bill-bar"><span>Rye/Wheat</span><strong>${ryeWheat}%</strong></div>
        <div class="mash-bill-bar"><span>Malted Barley</span><strong>${malted}%</strong></div>
      </div>
    </div>
  `;
}

function openPhotoZoom(src, alt) {
  if (!src) return;
  els.photoZoomImage.src = src;
  els.photoZoomImage.alt = alt || "";
  els.photoZoomDialog.showModal();
}

// Pick the closest substitute already sitting on the user's own shelf (owned or open,
// not a wishlist/buy-next placeholder), so it's a pour they can reach for tonight.
function getAvailabilityAlternative(bottle) {
  return bottles
    .filter((candidate) => candidate.id !== bottle.id && !["wishlist", "buy-next"].includes(candidate.status))
    .map((candidate) => {
      const flavorOverlap = (candidate.flavors || []).filter((flavor) => (bottle.flavors || []).includes(flavor)).length;
      const typeMatch = candidate.type === bottle.type ? 1 : 0;
      const categoryMatch = bottleCategories(candidate).some((category) => bottleCategories(bottle).includes(category)) ? 1 : 0;
      const proofDistance = Math.abs(Number(candidate.proof || 0) - Number(bottle.proof || 0));
      return { ...candidate, score: flavorOverlap * 3 + typeMatch * 4 + categoryMatch * 2 - proofDistance / 30 };
    })
    .sort((a, b) => b.score - a.score)[0];
}

// Pick the closest flavor/type match from the full bottle library that the user doesn't
// already own, for when they want to shop for something that tastes similar.
function getProfileAlternative(bottle) {
  const ownedNames = new Set(bottles.map((item) => item.name.toLowerCase()));
  return aiBottleLibrary
    .filter((candidate) => candidate.name.toLowerCase() !== bottle.name.toLowerCase() && !ownedNames.has(candidate.name.toLowerCase()))
    .map((candidate) => {
      const flavorOverlap = (candidate.flavors || []).filter((flavor) => (bottle.flavors || []).includes(flavor)).length;
      const proofDistance = Math.abs(Number(candidate.proof || 0) - Number(bottle.proof || 0));
      const typeMatch = candidate.type === bottle.type ? 1 : 0;
      return { ...candidate, score: flavorOverlap * 3 + typeMatch * 2 - proofDistance / 20 };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function alternativeMatchReason(bottle, pick) {
  const overlap = (pick.flavors || []).filter((flavor) => (bottle.flavors || []).includes(flavor));
  if (overlap.length) return `shares ${overlap.slice(0, 2).join(" & ")} notes`;
  if (pick.type === bottle.type && pick.distillery === bottle.distillery) return `same ${pick.type} style from ${pick.distillery}`;
  if (pick.type === bottle.type) return `same ${pick.type} style`;
  if (pick.distillery === bottle.distillery) return `also from ${pick.distillery}`;
  return "closest match in the library";
}

function renderBottleAlternativesBlock(bottle, availabilityPick, profilePick) {
  if (!availabilityPick && !profilePick) return "";
  return `
    <div class="bottle-alternatives">
      <div class="suggest-head"><span>Suggested Alternatives</span></div>
      <div class="suggest-grid">
        ${
          availabilityPick
            ? `
          <article class="suggest-card" id="altOwnedCard" role="button" tabindex="0" title="View details">
            <span class="alt-card-label">📦 On Your Shelf</span>
            <img class="suggest-photo" src="${bottleImage(availabilityPick)}" alt="${escapeHtml(availabilityPick.name)} bottle" />
            <h4>${escapeHtml(availabilityPick.name)}</h4>
            <p>${escapeHtml(availabilityPick.distillery)} · ${escapeHtml(availabilityPick.type)}</p>
            <em>Already ${labelStatus(availabilityPick.status).toLowerCase()} — ${alternativeMatchReason(bottle, availabilityPick)}</em>
          </article>
        `
            : ""
        }
        ${
          profilePick
            ? `
          <article class="suggest-card" id="altLibraryCard" role="button" tabindex="0" title="View details">
            <span class="alt-card-label">🎯 Similar Profile</span>
            <img class="suggest-photo" src="${bottleImage(profilePick)}" alt="${escapeHtml(profilePick.name)} bottle" />
            <h4>${escapeHtml(profilePick.name)}</h4>
            <p>${escapeHtml(profilePick.distillery)} · ${escapeHtml(profilePick.type)}</p>
            <em>Not in your bar yet — ${alternativeMatchReason(bottle, profilePick)}</em>
          </article>
        `
            : ""
        }
      </div>
    </div>
  `;
}

function addAlternativeToWishlist(pick) {
  if (!pick) return;
  const bottle = normalizeBottle({
    id: crypto.randomUUID(),
    name: pick.name,
    distillery: pick.distillery || "",
    type: pick.type || "Bourbon",
    region: pick.region || "",
    proof: pick.proof || 0,
    price: pick.price || 0,
    msrp: pick.price || 0,
    flavors: pick.flavors || [],
    status: "wishlist",
    createdAt: Date.now(),
  });
  bottles = [bottle, ...bottles];
  persist();
  render();
}

function openAlternativeQuick(pick) {
  if (!pick) return;
  const flavors = (pick.flavors || []).slice(0, 6);
  els.quickBottleDetail.innerHTML = `
    <div class="form-head">
      <div>
        <p>Suggested alternative</p>
        <h2>${escapeHtml(pick.name)}</h2>
      </div>
      <button class="icon-button" id="closeAlternativeQuick" type="button" aria-label="Close">×</button>
    </div>

    <div class="quick-detail-grid">
      <img class="quick-detail-photo" src="${bottleImage(pick)}" alt="${escapeHtml(pick.name)} bottle" />
      <div>
        <span class="status-pill wishlist">Similar profile pick</span>
        <p>${escapeHtml(pick.distillery)} · ${escapeHtml(pick.type)} · ${escapeHtml(pick.region || "Unknown region")}</p>
        <div class="bottle-meta">
          <div><span>Proof</span><strong>${numberOrDash(pick.proof)}</strong></div>
          <div><span>Est. Price</span><strong>${pick.price ? money(pick.price) : "—"}</strong></div>
        </div>
        ${flavors.length ? `<div class="flavor-row">${flavors.map((flavor) => `<span class="flavor-chip">${escapeHtml(flavor)}</span>`).join("")}</div>` : ""}
      </div>
    </div>

    <div class="photo-source-panel">
      <span>Find actual bottle photo</span>
      ${renderPhotoSourceLinks(pick)}
    </div>
    <div class="form-actions">
      <button class="primary-action" id="quickAddAlternativeWishlist" type="button">＋ Add to Wishlist</button>
    </div>
  `;
  els.quickBottleDialog.showModal();
  document.querySelector("#closeAlternativeQuick").addEventListener("click", () => els.quickBottleDialog.close());
  document.querySelector("#quickAddAlternativeWishlist").addEventListener("click", () => {
    addAlternativeToWishlist(pick);
    els.quickBottleDialog.close();
  });
}

function formatEventDate(timestamp) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

// Every bottle's arc, built from real data we already have - when it was added,
// opened, each pour along the way, and whether it's been finished - rather than
// a fabricated narrative. No event with an unknown date gets a guessed one.
function renderBottleJourneyTimeline(bottle) {
  const events = [];
  if (Number(bottle.createdAt)) {
    events.push({ time: Number(bottle.createdAt), icon: "🛒", label: "Added to collection", meta: labelStatus(bottle.status) });
  }
  if (bottle.openedDate) {
    const time = new Date(`${bottle.openedDate}T12:00:00`).getTime();
    if (Number.isFinite(time)) events.push({ time, icon: "🔓", label: "Opened", meta: "" });
  }
  bottlePoursFor(bottle.id).forEach((pour) => {
    const time = new Date(`${pour.date}T12:00:00`).getTime();
    if (Number.isFinite(time)) {
      events.push({
        time,
        icon: "🥃",
        label: pour.memory || pour.notes || pour.occasion || "Poured",
        meta: [
          `${numberOrDash(pour.ounces)} oz`,
          Number(pour.rating) ? `${pour.rating}` : "",
          pour.companion ? `with ${pour.companion}` : "",
          pour.location || "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  });
  events.sort((a, b) => a.time - b.time);

  const isFinished = bottle.status === "finished" || bottle.fillLevel === "empty";
  if (isFinished) {
    events.push({ time: null, icon: "⚫", label: "Bottle Kill", meta: "Finished" });
  }

  const legacyBanner = bottle.legacyShelf
    ? `<div class="legacy-shelf-banner">⭐ On the Legacy Shelf${bottle.legacyShelfReason ? ` — ${escapeHtml(bottle.legacyShelfReason)}` : ""}</div>`
    : "";

  if (!events.length) {
    return `${legacyBanner}<div class="empty-state">No journey yet. Log a pour to start this bottle's story.</div>`;
  }

  return `
    ${legacyBanner}
    <div class="journey-timeline">
      ${events
        .map(
          (event) => `
            <div class="journey-timeline-item">
              <span class="journey-timeline-icon">${event.icon}</span>
              <div class="journey-timeline-body">
                <strong>${escapeHtml(event.label)}</strong>
                <span>${event.time ? formatEventDate(event.time) : ""}${event.meta ? ` · ${escapeHtml(event.meta)}` : ""}</span>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

// Photos beyond the single catalog shot — the Glencairn pour, the bottle share,
// the trip it came home from. Each entry is { url, caption }.
function renderBottleGallery(bottle) {
  const gallery = Array.isArray(bottle.gallery) ? bottle.gallery : [];
  const grid = gallery.length
    ? `<div class="bottle-gallery-grid">
        ${gallery
          .map(
            (photo, index) => `
              <figure class="bottle-gallery-item">
                <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || bottle.name)}" data-gallery-view="${index}" />
                <button class="bottle-gallery-remove" data-gallery-remove="${index}" type="button" aria-label="Remove photo">×</button>
                ${photo.caption ? `<figcaption>${escapeHtml(photo.caption)}</figcaption>` : ""}
              </figure>
            `,
          )
          .join("")}
      </div>`
    : `<div class="empty-state">No photos yet. Add the pour, the share, the moment — this bottle's gallery.</div>`;

  return `
    ${grid}
    <div class="quick-photo-upload-panel bottle-gallery-add">
      <span id="galleryPhotoStatus">Add a photo to this bottle's gallery</span>
      <label class="upload-photo-action">
        Add Photo
        <input id="galleryPhotoUpload" type="file" accept="image/*" />
      </label>
    </div>
  `;
}

// ---- Full-page Bottle Details (mockup screens 3-4) ----
let detailBottleId = null;
let detailReturnView = "collection";
let detailTab = "overview";

// Entry point used by every bottle card / activity row: open the detail page.
function openBottleQuick(id) {
  if (!bottles.some((b) => b.id === id)) return;
  detailBottleId = id;
  detailTab = "overview";
  if (activeView !== "bottle-detail") detailReturnView = activeView;
  navigateToView("bottle-detail");
}

// The bottle's "current score" is the most recent pour's FIP score, else its own rating.
function bottleCurrentScore(bottle) {
  const bottlePours = bottlePoursFor(bottle.id)
    .filter((p) => Number(p.rating) > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (bottlePours.length) return Number(bottlePours[0].rating);
  return Number(bottle.rating) || 0;
}

function daysBetween(fromDate) {
  const t = new Date(`${fromDate}T12:00:00`).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

// Per-bottle Pour Stories timeline (mockup screen 4): each pour with its FIP score.
function renderBottlePourTimeline(bottle) {
  const entries = bottlePoursFor(bottle.id).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!entries.length) {
    return `<div class="empty-state">No pour stories yet. Add one to start this bottle's timeline.</div>`;
  }
  return `
    <div class="bottle-pour-timeline">
      ${entries
        .map((pour) => {
          const score = Number(pour.rating);
          const tier = score > 0 ? fipTier(score) : null;
          const label = pour.occasion || pour.memory || pour.notes || "Pour";
          return `
            <div class="bottle-pour-timeline-item" data-story-edit="${escapeHtml(pour.id)}" role="button" tabindex="0">
              <div class="bottle-pour-timeline-dot"></div>
              <div class="bottle-pour-timeline-body">
                <span class="bottle-pour-timeline-date">${formatDate(pour.date)}</span>
                <strong>${escapeHtml(label)}</strong>
                ${pour.memory && pour.memory !== label ? `<span>${escapeHtml(pour.memory)}</span>` : ""}
              </div>
              ${tier ? `<span class="bottle-pour-timeline-score ${tier.className}">${score.toFixed(1)}</span>` : ""}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderBottleDetailView() {
  const bottle = bottles.find((item) => item.id === detailBottleId);
  if (!bottle) {
    navigateToView(detailReturnView);
    return;
  }
  const score = bottleCurrentScore(bottle);
  const tier = score > 0 ? fipTier(score) : null;
  const stage = journeyStatus(bottle);
  const daysOpen = bottle.openedDate ? daysBetween(bottle.openedDate) : null;
  const tab = (name) => `bottle-detail-tab${detailTab === name ? " is-active" : ""}`;
  const panel = (name) => `bottle-detail-panel${detailTab === name ? "" : " is-hidden"}`;

  els.bottleDetailView.innerHTML = `
    <div class="bottle-detail-top">
      <button class="icon-button" id="bottleDetailBack" type="button" aria-label="Back">←</button>
      <span class="bottle-detail-crumb">${escapeHtml(bottle.name)}</span>
      <button class="secondary-action" id="bottleDetailEdit" type="button">Edit</button>
    </div>

    <div class="bottle-detail-hero">
      <img class="bottle-detail-photo" src="${bottleImage(bottle)}" alt="${escapeHtml(bottle.name)} bottle" />
      <div class="bottle-detail-hero-side">
        <div class="bottle-detail-score-ring ${tier ? tier.className : ""}">
          <strong>${score > 0 ? score.toFixed(1) : "—"}</strong>
          <span>FIP SCORE</span>
        </div>
        <div class="bottle-detail-status">
          <select class="status-pill status-pill-select ${bottle.status}" id="detailStatusSelect" aria-label="Bottle status">
            ${STATUS_OPTIONS.map(
              (status) => `<option value="${status}" ${bottle.status === status ? "selected" : ""}>${labelStatus(status)}</option>`,
            ).join("")}
          </select>
          ${
            bottle.openedDate
              ? `<div class="bottle-detail-opened"><span>Opened</span><strong>${daysOpen === 0 ? "today" : `${daysOpen} day${daysOpen === 1 ? "" : "s"} ago`}</strong><em>${formatDate(bottle.openedDate)}</em></div>`
              : ""
          }
          ${stage ? `<div class="bottle-detail-stage"><span>Journey Stage</span><strong>${stage.emoji} ${escapeHtml(stage.label)}</strong></div>` : ""}
        </div>
      </div>
    </div>

    <h1 class="bottle-detail-name">${escapeHtml(bottle.name)}</h1>
    <p class="bottle-detail-type">${escapeHtml([bottle.distillery, bottle.type, bottle.region].filter(Boolean).join(" · ") || "Whiskey")}</p>

    <div class="bottle-detail-specrow">
      <div><strong>${numberOrDash(bottle.proof)}</strong><span>Proof</span></div>
      <div><strong>${bottle.ageStatement ? escapeHtml(bottle.ageStatement) : "NAS"}</strong><span>Age</span></div>
      <div><strong>${bottle.msrp ? money(bottle.msrp) : "N/A"}</strong><span>MSRP</span></div>
      <div><strong>${escapeHtml(bottle.distillery || "—")}</strong><span>Distillery</span></div>
    </div>

    <div class="bottle-detail-tabs" role="tablist">
      <button class="${tab("overview")}" data-dtab="overview" type="button">Overview</button>
      <button class="${tab("stories")}" data-dtab="stories" type="button">Pour Stories</button>
      <button class="${tab("journey")}" data-dtab="journey" type="button">Journey</button>
      <button class="${tab("gallery")}" data-dtab="gallery" type="button">Gallery</button>
      <button class="${tab("compare")}" data-dtab="compare" type="button">Compare</button>
    </div>

    <div class="${panel("overview")}" data-dpanel="overview">
      ${bottle.coreBar ? `<div class="core-bar-banner">🔥 Earned a place on the Core Bar · Score ${bottle.coreBarScore ?? ""}</div>` : ""}
      <table class="bottle-detail-specs">
        <tbody>
          <tr><th>Mashbill</th><td>${escapeHtml(mashBillSummary(bottle) || "—")}</td></tr>
          <tr><th>Age Statement</th><td>${bottle.ageStatement ? escapeHtml(bottle.ageStatement) : "—"}</td></tr>
          <tr><th>Proof</th><td>${numberOrDash(bottle.proof)}</td></tr>
          <tr><th>Distillery</th><td>${escapeHtml(bottle.distillery || "—")}</td></tr>
          <tr><th>Region</th><td>${escapeHtml(bottle.region || "—")}</td></tr>
          <tr><th>Store</th><td>${escapeHtml(bottle.storeLocation || "—")}</td></tr>
          <tr><th>Current Value</th><td>${bottle.msrp ? money(bottle.msrp) : "—"}</td></tr>
          <tr><th>Price Paid</th><td>${bottle.price ? money(bottle.price) : "—"}</td></tr>
        </tbody>
      </table>
      ${renderBottleUnitsBlock(bottle)}
      ${renderDistilleryInfoBlock(bottle)}
    </div>

    <div class="${panel("stories")}" data-dpanel="stories">
      <div class="bottle-detail-stories-head">
        <h3>Pour Stories</h3>
        <button class="secondary-action" id="detailAddStory" type="button">+ Add Story</button>
      </div>
      ${renderBottlePourTimeline(bottle)}
    </div>

    <div class="${panel("journey")}" data-dpanel="journey">
      ${renderBottleJourneyTimeline(bottle)}
    </div>

    <div class="${panel("gallery")}" data-dpanel="gallery">
      ${renderBottleGallery(bottle)}
    </div>

    <div class="${panel("compare")}" data-dpanel="compare">
      <p class="bottle-detail-compare-lead">Put ${escapeHtml(bottle.name)} head-to-head with another bottle.</p>
      <button class="primary-action" id="detailCompare" type="button">Open Compare →</button>
    </div>

    <div class="bottle-detail-actions">
      <label class="upload-photo-action">
        ${bottle.imageUrl ? "Replace Photo" : "Add Photo"}
        <input id="detailPhotoUpload" type="file" accept="image/*" />
      </label>
      ${
        bottle.status === "wishlist"
          ? `<button class="primary-action" id="detailMarkOwned" type="button">✓ Mark as Owned</button>`
          : `<button class="primary-action" id="detailLogPour" type="button">Log Pour</button>`
      }
    </div>
  `;

  const id = bottle.id;
  document.querySelector("#bottleDetailBack").addEventListener("click", () => navigateToView(detailReturnView));
  document.querySelector("#bottleDetailEdit").addEventListener("click", () => openForm(id));
  document.querySelector("#detailStatusSelect").addEventListener("change", (event) => changeBottleStatus(id, event.target.value));
  document.querySelector("#detailAddStory")?.addEventListener("click", () => openPourForm(id));
  document.querySelector("#detailLogPour")?.addEventListener("click", () => openPourForm(id));
  document.querySelector("#detailMarkOwned")?.addEventListener("click", () => markBottleOwned(id));
  document.querySelector("#detailCompare")?.addEventListener("click", () => navigateToView("compare"));
  document.querySelector("#detailPhotoUpload")?.addEventListener("change", (event) => uploadQuickBottlePhoto(event, id));
  document.querySelector("#galleryPhotoUpload")?.addEventListener("change", (event) => uploadGalleryPhoto(event, id));
  els.bottleDetailView.querySelectorAll("[data-gallery-remove]").forEach((button) => {
    button.addEventListener("click", () => removeGalleryPhoto(id, Number(button.dataset.galleryRemove)));
  });
  els.bottleDetailView.querySelectorAll("[data-gallery-view]").forEach((img) => {
    img.addEventListener("click", () => window.open(img.src, "_blank", "noopener"));
  });
  els.bottleDetailView.querySelectorAll("[data-story-edit]").forEach((item) => {
    const open = () => openPourForm("", item.dataset.storyEdit);
    item.addEventListener("click", open);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
  els.bottleDetailView.querySelectorAll("[data-dtab]").forEach((tabButton) => {
    tabButton.addEventListener("click", () => {
      detailTab = tabButton.dataset.dtab;
      els.bottleDetailView.querySelectorAll("[data-dtab]").forEach((btn) => btn.classList.toggle("is-active", btn === tabButton));
      els.bottleDetailView.querySelectorAll("[data-dpanel]").forEach((p) => p.classList.toggle("is-hidden", p.dataset.dpanel !== detailTab));
    });
  });
}

function bottleImage(bottle) {
  if (bottle.imageUrl) return bottle.imageUrl;
  const curatedImage = getCuratedBottleImage(bottle);
  if (curatedImage) return curatedImage;
  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
}

// A real photo when we have one, otherwise a clean initial tile instead of a blank box.
function bottleThumb(bottle, extraClass = "") {
  const cls = `catalog-thumb${extraClass ? ` ${extraClass}` : ""}`;
  const image = bottle.imageUrl || getCuratedBottleImage(bottle);
  if (image) {
    return `<img class="${cls}" src="${image}" alt="${escapeHtml(bottle.name)} bottle" />`;
  }
  const initial = (bottle.name || "?").trim().charAt(0).toUpperCase() || "?";
  return `<div class="${cls} catalog-thumb-empty" aria-hidden="true">${escapeHtml(initial)}</div>`;
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

function openForm(id = "") {
  const bottle = typeof id === "object" ? id : bottles.find((item) => item.id === id);
  const isExisting = typeof id === "string" && Boolean(id);
  els.formTitle.textContent = isExisting ? "Edit Bottle" : "Add Bottle";
  els.deleteBottle.classList.toggle("is-hidden", !isExisting);
  els.saveAndAddAnother.classList.toggle("is-hidden", isExisting);
  window.clearTimeout(addAnotherStatusTimer);
  els.addAnotherStatus.textContent = "";
  formPhotoWasUploaded = false;

  fields.id.value = bottle?.id || "";
  fields.name.value = bottle?.name || "";
  fields.distillery.value = bottle?.distillery || "";
  fields.type.value = bottle?.type || "Bourbon";
  fields.region.value = bottle?.region || "";
  fields.imageUrl.value = bottle?.imageUrl || "";
  fields.proof.value = bottle?.proof || "";
  fields.price.value = bottle?.price || "";
  fields.msrp.value = bottle?.msrp || "";
  fields.mashBillCorn.value = bottle?.mashBillCorn || "";
  fields.mashBillRyeWheat.value = bottle?.mashBillRyeWheat || "";
  fields.mashBillMalted.value = bottle?.mashBillMalted || "";
  fields.rating.value = bottle?.rating || "";
  fields.status.value = bottle?.status || "sealed";
  fields.ageStatement.value = bottle?.ageStatement || "";
  fields.storeLocation.value = bottle?.storeLocation || "";
  fields.shelf.value = bottle?.shelf || "Main bar";
  fields.quantity.value = bottle?.quantity || 1;
  fields.fillLevel.value = bottle?.fillLevel || "full";
  fields.openedDate.value = bottle?.openedDate || "";
  setSelectedCategoryTags(bottle ? bottleCategories(bottle) : ["daily"]);
  fields.pourStyle.value = bottle?.pourStyle || "daily";
  fields.pourTier.value = normalizePourTier(bottle?.pourTier || "crowd");
  fields.bottleSize.value = String(bottle?.bottleSize || 750);
  fields.priority.value = bottle?.priority || 3;
  fields.legacyShelf.checked = Boolean(bottle?.legacyShelf);
  fields.legacyShelfReason.value = bottle?.legacyShelfReason || "";
  fields.flavors.value = bottle?.flavors.join(", ") || "";
  fields.notes.value = bottle?.notes || "";

  if (isExisting && bottle) {
    const score = computeCoreBarScore(bottle);
    els.coreScoreDisplay.textContent = score >= CORE_BAR_THRESHOLD ? `${score} — Earned 🔥` : score;
  } else {
    els.coreScoreDisplay.textContent = "Calculated after you save";
  }

  if (!els.bottleDialog.open) els.bottleDialog.showModal();
  fields.name.focus();
  renderBottleSuggestions();
  updateFormPhotoTools();
}

// Open a blank Add Bottle form with the status preset (e.g. from the Wish List / Buy Next views).
function openFormWithStatus(status) {
  openForm();
  if (status) fields.status.value = status;
}

let aiBottleLookupTimer;

function queueAiBottleLookup(query) {
  window.clearTimeout(aiBottleLookupTimer);
  if (!currentUser || !cloudFunctions || query.length < 4) return;
  aiBottleLookupTimer = window.setTimeout(() => runAiBottleLookup(query), 900);
}

async function runAiBottleLookup(query) {
  if (fields.name.value.trim() !== query) return;
  els.aiSuggestions.innerHTML = `<div class="ai-empty">✨ Asking AI about "${escapeHtml(query)}"...</div>`;
  try {
    const info = await fetchAiBottleInfo(query);
    if (fields.name.value.trim() !== query) return;
    if (!info.known) {
      els.aiSuggestions.innerHTML = `<div class="ai-empty">No close match yet. Keep typing, or save it manually.</div>`;
      return;
    }
    applyAiBottleInfo(info);
    els.aiSuggestions.innerHTML = `<div class="ai-empty">✨ AI filled in ${escapeHtml(info.distillery || "details")} for this bottle.</div>`;
  } catch (error) {
    console.error("AI bottle lookup failed", error);
    if (fields.name.value.trim() === query) {
      els.aiSuggestions.innerHTML = `<div class="ai-empty">No close match yet. Keep typing, or save it manually.</div>`;
    }
  }
}

async function fetchAiBottleInfo(bottleName) {
  const callable = cloudFunctions.httpsCallable("lookupBottleInfo");
  const result = await callable({ bottleName });
  return result.data || {};
}

function applyAiBottleInfo(info) {
  if (!fields.distillery.value.trim() && info.distillery) fields.distillery.value = info.distillery;
  if (info.type) fields.type.value = info.type;
  if (!fields.region.value.trim() && info.region) fields.region.value = info.region;
  if (!fields.proof.value && info.proof) fields.proof.value = info.proof;
  updateFormPhotoTools();
}

async function fillDistilleryWithAi() {
  const query = fields.name.value.trim();
  if (query.length < 3) {
    alert("Enter a bottle name first.");
    return;
  }
  if (!currentUser || !cloudFunctions) {
    alert("Sign in with Google to use AI auto-fill.");
    return;
  }

  const button = els.aiFillDistillery;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "...";
  try {
    const info = await fetchAiBottleInfo(query);
    if (!info.known) {
      els.aiSuggestions.innerHTML = `<div class="ai-empty">AI doesn't recognize "${escapeHtml(query)}". Fill in the details manually.</div>`;
      return;
    }
    applyAiBottleInfo(info);
    els.aiSuggestions.innerHTML = `<div class="ai-empty">✨ AI filled in ${escapeHtml(info.distillery || "details")} for this bottle.</div>`;
  } catch (error) {
    console.error("AI distillery fill failed", error);
    els.aiSuggestions.innerHTML = `<div class="ai-empty">Could not reach the AI lookup. Try again.</div>`;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function generateAiFormTastingNote() {
  const name = fields.name.value.trim();
  if (!name) {
    alert("Enter a bottle name first.");
    return;
  }
  if (!currentUser || !cloudFunctions) {
    alert("Sign in with Google to use AI tasting notes.");
    return;
  }

  const button = els.formAiTastingNote;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Asking the sommelier...";
  try {
    const typedFlavors = fields.flavors.value
      .split(",")
      .map((flavor) => flavor.trim())
      .filter(Boolean);
    const callable = cloudFunctions.httpsCallable("generateTastingProfile");
    const result = await callable({
      bottleName: name,
      distillery: fields.distillery.value.trim(),
      type: fields.type.value,
      proof: Number(fields.proof.value) || 0,
      flavors: typedFlavors,
    });
    const profile = result.data || {};
    if (!profile.nose && !profile.palate && !profile.finish) {
      alert("Could not generate an AI tasting note. Try again.");
      return;
    }

    const noteText = `Nose: ${profile.nose || "—"}. Palate: ${profile.palate || "—"}. Finish: ${profile.finish || "—"}.`;
    const existingNotes = fields.notes.value.trim();
    fields.notes.value = existingNotes ? `${existingNotes}\n\n${noteText}` : noteText;

    if (Array.isArray(profile.flavors) && profile.flavors.length) {
      fields.flavors.value = [...new Set([...typedFlavors, ...profile.flavors])].join(", ");
    }
  } catch (error) {
    console.error("AI tasting note failed", error);
    alert("Could not generate an AI tasting note. Try again.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
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
    queueAiBottleLookup(query);
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

const MATCH_CONFIDENCE_THRESHOLD = 30;

function getBottleSuggestions(query) {
  const inventoryMatches = bottles.map((bottle) => ({
    ...bottle,
    source: "inventory",
  }));
  const library = [...inventoryMatches, ...aiBottleLibrary, ...customLibrary];
  const seen = new Set();

  return library
    .map((bottle) => ({
      ...bottle,
      score: scoreBottleMatch(query, bottle),
    }))
    .filter((bottle) => bottle.score >= MATCH_CONFIDENCE_THRESHOLD)
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
  setSelectedCategoryTags(bottle.categories?.length ? bottle.categories : [bottle.category || defaultCategory(bottle)]);
  fields.pourStyle.value = bottle.pourStyle || "daily";
  fields.pourTier.value = normalizePourTier(bottle.pourTier || "crowd");
  fields.bottleSize.value = String(bottle.bottleSize || 750);
  fields.imageUrl.value = imageUrl;
  if (!fields.notes.value.trim()) {
    fields.notes.value = "Matched from AI bottle suggestions.";
  }
  clearBottleSuggestions();
  updateFormPhotoTools(bottle);
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
  const hasImage = Boolean(draft.imageUrl);
  els.formPhotoName.textContent = hasName
    ? `${draft.name}${draft.distillery ? ` · ${draft.distillery}` : ""}`
    : hasImage
      ? "Uploaded photo"
      : "Start typing a bottle name";
  els.formPhotoPreview.src = hasName || hasImage ? bottleImage(draft) : "";
  els.formPhotoPreview.classList.toggle("is-empty", !hasName && !hasImage);

  // Surface the selected bottle's picture at the top of the form once we have one.
  els.selectedBottlePreview.classList.toggle("is-empty", !hasImage);
  if (hasImage) {
    els.selectedBottleImage.src = draft.imageUrl;
    els.selectedBottleLabel.textContent = hasName
      ? `${draft.name}${draft.distillery ? ` · ${draft.distillery}` : ""}`
      : "Photo ready";
  } else {
    els.selectedBottleImage.removeAttribute("src");
    els.selectedBottleLabel.textContent = "";
  }
}

function isHeicFile(file) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function uploadFileToStorage(file, path) {
  const ref = storage.ref().child(path);
  await ref.put(file);
  return ref.getDownloadURL();
}

// Set once a fresh upload actually lands on the Add/Edit form, so buildAndPersistBottleFromForm
// knows to publish the photo on save instead of re-sharing whatever imageUrl was already there.
let formPhotoWasUploaded = false;

async function uploadBottlePhoto(event) {
  const [file] = event.target.files;
  if (!file) return;

  const looksLikeImage = file.type.startsWith("image/") || isHeicFile(file) || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || "");
  if (!looksLikeImage) {
    els.formPhotoName.textContent = "Choose an image file.";
    event.target.value = "";
    return;
  }

  const displayName = file.name.replace(/\.[^.]+$/, "") || "Uploaded bottle photo";
  els.formPhotoName.textContent = "Isolating bottle...";
  try {
    // Show the instant pixel crop right away so the upload never blocks.
    const { dataUrl } = await downscaleImageToJpeg(file, 1600, { stamp: true, isolate: true });
    const cropUrl = await storeBottlePhoto(dataUrl, file, "crop");
    fields.imageUrl.value = cropUrl;
    formPhotoWasUploaded = true;
    updateFormPhotoTools({ imageUrl: cropUrl });
    els.formPhotoName.textContent = displayName;

    // Progressively erase the background on the server and swap it in when ready.
    if (currentUser && cloudFunctions) {
      els.formPhotoName.textContent = `${displayName} · removing background…`;
      cutoutBottlePhoto(file)
        .then(async (cutoutDataUrl) => {
          if (!cutoutDataUrl || fields.imageUrl.value !== cropUrl) {
            els.formPhotoName.textContent = displayName;
            return;
          }
          const cutoutUrl = await storeBottlePhoto(cutoutDataUrl, file, "cutout");
          if (fields.imageUrl.value !== cropUrl) return;
          fields.imageUrl.value = cutoutUrl;
          updateFormPhotoTools({ imageUrl: cutoutUrl });
          els.formPhotoName.textContent = `${displayName} · background removed`;
        })
        .catch(() => {
          els.formPhotoName.textContent = displayName;
        });
    }
  } catch (error) {
    console.error("Photo upload failed", error);
    els.formPhotoName.textContent = "Could not process that photo. Try a different file.";
  } finally {
    event.target.value = "";
  }
}

async function storeBottlePhoto(dataUrl, file, tag) {
  if (currentUser && storage) {
    const blob = await (await fetch(dataUrl)).blob();
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    const path = `bottle-photos/${currentUser.uid}/${Date.now()}-${tag}-${base}.jpg`;
    return uploadFileToStorage(blob, path);
  }
  return dataUrl;
}

function setBottlePhoto(id, imageUrl) {
  bottles = bottles.map((bottle) => (bottle.id === id ? { ...bottle, imageUrl } : bottle));
  persist();
  render();
  const bottle = bottles.find((item) => item.id === id);
  if (bottle) shareBottlePhoto(bottle);
}

// Upload a photo directly from the Quick View for a bottle you already own — same
// crop + background-removal pipeline as the Add/Edit form's Upload Photo, but writes
// straight onto the saved bottle instead of a form draft.
async function uploadQuickBottlePhoto(event, id) {
  const [file] = event.target.files;
  if (!file) return;

  const statusEl = document.querySelector("#quickPhotoStatus");
  const looksLikeImage = file.type.startsWith("image/") || isHeicFile(file) || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || "");
  if (!looksLikeImage) {
    if (statusEl) statusEl.textContent = "Choose an image file.";
    event.target.value = "";
    return;
  }

  const isStillOpen = () => document.querySelector("#quickPhotoUpload") && els.quickBottleDialog.open;
  const displayName = file.name.replace(/\.[^.]+$/, "") || "Uploaded bottle photo";
  if (statusEl) statusEl.textContent = "Isolating bottle...";
  try {
    const { dataUrl } = await downscaleImageToJpeg(file, 1600, { stamp: true, isolate: true });
    const cropUrl = await storeBottlePhoto(dataUrl, file, "crop");
    setBottlePhoto(id, cropUrl);
    if (isStillOpen()) {
      document.querySelector("#quickBottleDetail .quick-detail-photo").src = cropUrl;
      document.querySelector("#quickPhotoStatus").textContent = displayName;
    }

    if (currentUser && cloudFunctions) {
      if (isStillOpen()) document.querySelector("#quickPhotoStatus").textContent = `${displayName} · removing background…`;
      cutoutBottlePhoto(file)
        .then(async (cutoutDataUrl) => {
          if (!cutoutDataUrl) return;
          const cutoutUrl = await storeBottlePhoto(cutoutDataUrl, file, "cutout");
          setBottlePhoto(id, cutoutUrl);
          if (isStillOpen()) {
            document.querySelector("#quickBottleDetail .quick-detail-photo").src = cutoutUrl;
            document.querySelector("#quickPhotoStatus").textContent = `${displayName} · background removed`;
          }
        })
        .catch(() => {
          if (isStillOpen()) document.querySelector("#quickPhotoStatus").textContent = displayName;
        });
    }
  } catch (error) {
    console.error("Photo upload failed", error);
    if (isStillOpen()) document.querySelector("#quickPhotoStatus").textContent = "Could not process that photo. Try a different file.";
  } finally {
    event.target.value = "";
  }
}

// Gallery photos are scene shots — the pour, the share, the campfire — so unlike the
// catalog photo they keep their background (no isolate/cutout), just downscaled + stored.
async function uploadGalleryPhoto(event, id) {
  const [file] = event.target.files;
  if (!file) return;

  const statusEl = document.querySelector("#galleryPhotoStatus");
  const looksLikeImage = file.type.startsWith("image/") || isHeicFile(file) || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || "");
  if (!looksLikeImage) {
    if (statusEl) statusEl.textContent = "Choose an image file.";
    event.target.value = "";
    return;
  }

  if (statusEl) statusEl.textContent = "Adding photo…";
  try {
    const { dataUrl } = await downscaleImageToJpeg(file, 1600, { stamp: false, isolate: false });
    const url = await storeBottlePhoto(dataUrl, file, "gallery");
    const caption = file.name.replace(/\.[^.]+$/, "") || "";
    bottles = bottles.map((bottle) =>
      bottle.id === id ? { ...bottle, gallery: [...(bottle.gallery || []), { url, caption }] } : bottle,
    );
    persist();
    render();
    if (els.quickBottleDialog.open) openBottleQuick(id);
  } catch (error) {
    console.error("Gallery upload failed", error);
    if (statusEl) statusEl.textContent = "Could not process that photo. Try a different file.";
  } finally {
    event.target.value = "";
  }
}

function removeGalleryPhoto(id, index) {
  bottles = bottles.map((bottle) => {
    if (bottle.id !== id) return bottle;
    const gallery = [...(bottle.gallery || [])];
    gallery.splice(index, 1);
    return { ...bottle, gallery };
  });
  persist();
  render();
  if (els.quickBottleDialog.open) openBottleQuick(id);
}

let brandLogoPromise;

function loadBrandLogo() {
  if (!brandLogoPromise) {
    brandLogoPromise = new Promise((resolve) => {
      const img = new Image();
      img.addEventListener("load", () => resolve(img));
      img.addEventListener("error", () => resolve(null));
      img.src = "assets/logo-badge-512.png";
    });
  }
  return brandLogoPromise;
}

async function stampBrandLogo(canvas) {
  const logo = await loadBrandLogo();
  if (!logo) return;
  const ctx = canvas.getContext("2d");
  const size = Math.round(Math.min(canvas.width, canvas.height) * 0.18);
  const margin = Math.round(size * 0.2);
  const cx = canvas.width - size / 2 - margin;
  const cy = canvas.height - size / 2 - margin;

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = "rgba(215, 138, 54, 0.9)";
  ctx.lineWidth = Math.max(2, size * 0.025);
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

async function downscaleImageToJpeg(file, maxDim = 1024, { stamp = false, isolate = false } = {}) {
  let sourceFile = file;
  if (isHeicFile(file) && window.heic2any) {
    const converted = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    sourceFile = Array.isArray(converted) ? converted[0] : converted;
  }
  const dataUrl = await readFileAsDataUrl(sourceFile);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Could not read image")));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  let canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  if (isolate) {
    const cropped = isolateBottleSubject(canvas);
    if (cropped) canvas = cropped;
  }
  if (stamp) await stampBrandLogo(canvas);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { dataUrl: jpegDataUrl, base64: jpegDataUrl.split(",")[1] };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Cut the bottle out of its background on the server (reliable on any device, incl.
// iOS), then place the cutout centered on a clean solid backdrop. Returns a JPEG data
// URL, or null on failure/timeout so the caller keeps the plain crop.
async function cutoutBottlePhoto(file) {
  if (!currentUser || !cloudFunctions) return null;
  try {
    const { dataUrl } = await downscaleImageToJpeg(file, 1024);
    const base64 = dataUrl.split(",")[1];
    const callable = cloudFunctions.httpsCallable("removeBottleBackground");
    const res = await withTimeout(callable({ imageBase64: base64 }), 90000);
    const outB64 = res?.data?.imageBase64;
    if (!outB64) return null;
    const cutoutBlob = await (await fetch(`data:image/png;base64,${outB64}`)).blob();
    return await compositeCutout(cutoutBlob);
  } catch (error) {
    console.warn("Server background removal unavailable; keeping cropped photo.", error);
    return null;
  }
}

async function compositeCutout(cutoutBlob) {
  const cutoutUrl = URL.createObjectURL(cutoutBlob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.addEventListener("load", () => resolve(i));
      i.addEventListener("error", reject);
      i.src = cutoutUrl;
    });
    const w = img.width;
    const h = img.height;
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(img, 0, 0);
    const data = tctx.getImageData(0, 0, w, h).data;

    let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 30) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return null;

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const outH = 900;
    const outW = Math.round((outH * 3) / 4);
    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const octx = out.getContext("2d");
    octx.fillStyle = "#17120d";
    octx.fillRect(0, 0, outW, outH);
    const margin = 0.86;
    const scale = Math.min((outW * margin) / cropW, (outH * margin) / cropH);
    const dw = cropW * scale;
    const dh = cropH * scale;
    octx.drawImage(tmp, minX, minY, cropW, cropH, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
    await stampBrandLogo(out);
    return out.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(cutoutUrl);
  }
}

// Auto-crop an uploaded photo down to just the bottle by finding the subject's
// bounding box (pixels that differ from the photo's background). Returns a new
// cropped canvas, or null when detection is uncertain so the caller keeps the original.
function isolateBottleSubject(srcCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  if (w < 40 || h < 40) return null;

  const ctx = srcCanvas.getContext("2d");
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  const s = Math.max(4, Math.round(Math.min(w, h) * 0.04));
  const avgRegion = (x0, y0) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + s; y++) {
      for (let x = x0; x < x0 + s; x++) {
        const i = (y * w + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    return [r / n, g / n, b / n];
  };
  const corners = [avgRegion(0, 0), avgRegion(w - s, 0), avgRegion(0, h - s), avgRegion(w - s, h - s)];
  const bg = [0, 1, 2].map((k) => corners.reduce((sum, c) => sum + c[k], 0) / corners.length);

  const threshold = 44;
  const colCount = new Array(w).fill(0);
  const rowCount = new Array(h).fill(0);
  let fgTotal = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > threshold) {
        colCount[x]++;
        rowCount[y]++;
        fgTotal++;
      }
    }
  }
  if (fgTotal < w * h * 0.02) return null;

  const colThresh = h * 0.03;
  const rowThresh = w * 0.03;
  let x0 = 0;
  while (x0 < w && colCount[x0] < colThresh) x0++;
  let x1 = w - 1;
  while (x1 > x0 && colCount[x1] < colThresh) x1--;
  let y0 = 0;
  while (y0 < h && rowCount[y0] < rowThresh) y0++;
  let y1 = h - 1;
  while (y1 > y0 && rowCount[y1] < rowThresh) y1--;

  const boxW = x1 - x0;
  const boxH = y1 - y0;
  if (boxW < w * 0.1 || boxH < h * 0.15) return null;
  if (boxW > w * 0.95 && boxH > h * 0.95) return null;

  const padX = Math.round(boxW * 0.08);
  const padY = Math.round(boxH * 0.06);
  const cx0 = Math.max(0, x0 - padX);
  const cy0 = Math.max(0, y0 - padY);
  const cropW = Math.min(w, x1 + padX) - cx0;
  const cropH = Math.min(h, y1 + padY) - cy0;

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  out.getContext("2d").drawImage(srcCanvas, cx0, cy0, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

async function scanBottleLabel(event) {
  const [file] = event.target.files;
  if (!file) return;
  event.target.value = "";

  if (!currentUser || !cloudFunctions) {
    alert("Sign in with Google to scan labels with AI.");
    return;
  }

  const originalText = els.scanLabelText.textContent;
  els.scanLabelAction.classList.add("is-busy");
  els.scanLabelText.textContent = "Reading label...";
  try {
    const { base64 } = await downscaleImageToJpeg(file);
    const callable = cloudFunctions.httpsCallable("scanBottleLabel");
    const result = await callable({ imageBase64: base64, mediaType: "image/jpeg" });
    const info = result.data || {};
    if (!info.found) {
      els.aiSuggestions.innerHTML = `<div class="ai-empty">Couldn't read a bottle label in that photo. Try a clearer, closer shot.</div>`;
      return;
    }

    if (!fields.name.value.trim() && info.name) fields.name.value = info.name;
    if (!fields.distillery.value.trim() && info.distillery) fields.distillery.value = info.distillery;
    if (info.type) fields.type.value = info.type;
    if (!fields.region.value.trim() && info.region) fields.region.value = info.region;
    if (!fields.proof.value && info.proof) fields.proof.value = info.proof;
    if (!fields.ageStatement.value.trim() && info.ageStatement) fields.ageStatement.value = info.ageStatement;
    if (!fields.msrp.value && info.msrp) fields.msrp.value = info.msrp;

    if (!fields.imageUrl.value.trim()) {
      try {
        const { dataUrl: stampedUrl } = await downscaleImageToJpeg(file, 1600, { stamp: true });
        if (storage) {
          const blob = await (await fetch(stampedUrl)).blob();
          const path = `bottle-photos/${currentUser.uid}/${Date.now()}-label-scan.jpg`;
          fields.imageUrl.value = await uploadFileToStorage(blob, path);
        } else {
          fields.imageUrl.value = stampedUrl;
        }
      } catch (photoError) {
        console.error("Label photo save failed", photoError);
      }
    }

    applyMashBillSuggestion();
    updateFormPhotoTools();
    els.aiSuggestions.innerHTML = `<div class="ai-empty">📷✨ Read the label: ${escapeHtml(info.name || "bottle")}${info.distillery ? ` — ${escapeHtml(info.distillery)}` : ""}. Check the details and save.</div>`;
  } catch (error) {
    console.error("Label scan failed", error);
    els.aiSuggestions.innerHTML = `<div class="ai-empty">Label scan failed. Check your connection and try again.</div>`;
  } finally {
    els.scanLabelAction.classList.remove("is-busy");
    els.scanLabelText.textContent = originalText;
  }
}

function clearBottleSuggestions() {
  els.aiSuggestions.innerHTML = "";
}

// Builds a bottle from the current form fields, saves it, and returns it plus whatever
// status it had before this save (used to decide whether to prompt "log a pour now?").
// Shared by the normal Save Bottle submit and Save & Add Another, so the two stay in sync.
function buildAndPersistBottleFromForm() {
  const id = fields.id.value || crypto.randomUUID();
  const previousStatus = bottles.find((item) => item.id === id)?.status;
  const categories = getSelectedCategoryTags();
  const bottle = {
    id,
    name: fields.name.value.trim(),
    distillery: fields.distillery.value.trim(),
    type: fields.type.value,
    region: fields.region.value.trim(),
    imageUrl: fields.imageUrl.value.trim(),
    proof: Number(fields.proof.value || 0),
    price: Number(fields.price.value || 0),
    msrp: Number(fields.msrp.value || 0),
    mashBillCorn: Number(fields.mashBillCorn.value || 0),
    mashBillRyeWheat: Number(fields.mashBillRyeWheat.value || 0),
    mashBillMalted: Number(fields.mashBillMalted.value || 0),
    rating: Number(fields.rating.value || 0),
    status: fields.status.value,
    ageStatement: fields.ageStatement.value.trim(),
    storeLocation: fields.storeLocation.value.trim(),
    shelf: fields.shelf.value.trim() || "Main bar",
    quantity: Number(fields.quantity.value || 1),
    fillLevel: fields.fillLevel.value,
    bottleSize: Number(fields.bottleSize.value || 750),
    openedDate: fields.openedDate.value,
    categories: categories.length ? categories : ["daily"],
    category: categories[0] || "daily",
    pourStyle: fields.pourStyle.value,
    pourTier: normalizePourTier(fields.pourTier.value),
    coreBar: false,
    priority: Number(fields.priority.value || 3),
    legacyShelf: fields.legacyShelf.checked,
    legacyShelfReason: fields.legacyShelfReason.value.trim(),
    flavors: fields.flavors.value
      .split(",")
      .map((flavor) => flavor.trim().toLowerCase())
      .filter(Boolean),
    notes: fields.notes.value.trim(),
  };
  bottle.imageUrl = bottle.imageUrl || getCuratedBottleImage(bottle);

  const existing = bottles.find((item) => item.id === id);
  if (existing) {
    bottle.createdAt = existing.createdAt || Date.now();
    bottles = bottles.map((item) => (item.id === id ? bottle : item));
  } else {
    bottle.createdAt = Date.now();
    bottles = [bottle, ...bottles];
  }

  persist();
  learnBottle(bottle);
  render();
  if (formPhotoWasUploaded && bottle.imageUrl) shareBottlePhoto(bottle);
  formPhotoWasUploaded = false;
  return { bottle, previousStatus };
}

function saveBottle(event) {
  event.preventDefault();
  const { bottle, previousStatus } = buildAndPersistBottleFromForm();
  els.bottleDialog.close();

  if (bottle.status === "open" && previousStatus !== "open" && confirm("This bottle is now open. Log a pour now?")) {
    openPourForm(bottle.id);
  }
}

let addAnotherStatusTimer;

// Saves the current bottle and immediately resets the form for the next one, keeping
// the dialog open for rapid back-to-back entry instead of closing after every bottle.
function saveBottleAndAddAnother() {
  if (!els.bottleForm.reportValidity()) return;
  const { bottle } = buildAndPersistBottleFromForm();
  openForm();
  window.clearTimeout(addAnotherStatusTimer);
  els.addAnotherStatus.textContent = `✓ Added "${bottle.name}" — keep going`;
  addAnotherStatusTimer = window.setTimeout(() => {
    els.addAnotherStatus.textContent = "";
  }, 4000);
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
  let justOpened = false;
  bottles = bottles.map((bottle) => {
    if (bottle.id !== id) return bottle;
    const nextStatus = bottle.status === "open" ? "sealed" : "open";
    justOpened = nextStatus === "open";
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
  if (justOpened && confirm("This bottle is now open. Log a pour now?")) {
    openPourForm(id);
  }
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

const IMPORT_FIELD_ALIASES = {
  name: ["name", "bottle", "bottle name", "product"],
  distillery: ["distillery", "brand", "producer", "maker"],
  type: ["type", "category", "spirit type", "spirit"],
  region: ["region", "location", "country"],
  proof: ["proof"],
  abv: ["abv", "alcohol", "alcohol by volume"],
  price: ["price", "cost", "paid", "price paid"],
  rating: ["rating", "score", "my rating"],
  status: ["status"],
  ageStatement: ["age statement", "age", "age years", "years"],
  storeLocation: ["store", "store location", "purchased at", "bought at"],
  shelf: ["shelf", "shelf location"],
  quantity: ["quantity", "qty", "count", "bottles owned"],
  bottleSize: ["bottle size", "size", "ml", "volume", "size ml"],
  notes: ["notes", "description", "comments", "tasting notes"],
  flavors: ["flavors", "flavor tags", "tags", "flavor profile"],
};

const IMPORT_STATUS_ALIASES = {
  owned: "sealed",
  sealed: "sealed",
  unopened: "sealed",
  "in collection": "sealed",
  opened: "open",
  open: "open",
  finished: "finished",
  empty: "finished",
  killed: "finished",
  wishlist: "wishlist",
  want: "wishlist",
  "want to buy": "wishlist",
  "buy next": "buy-next",
  "buy-next": "buy-next",
  hunting: "buy-next",
};

function normalizeImportKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rowValue(normalizedRow, field) {
  for (const alias of IMPORT_FIELD_ALIASES[field] || []) {
    if (normalizedRow[alias] !== undefined && normalizedRow[alias] !== "") return normalizedRow[alias];
  }
  return undefined;
}

function spreadsheetRowToBottle(row) {
  const normalizedRow = {};
  Object.entries(row).forEach(([key, value]) => {
    normalizedRow[normalizeImportKey(key)] = typeof value === "string" ? value.trim() : value;
  });

  const name = String(rowValue(normalizedRow, "name") || "").trim();
  if (!name) return null;

  const abv = rowValue(normalizedRow, "abv");
  const proofValue = rowValue(normalizedRow, "proof");
  const proof = proofValue !== undefined ? Number(proofValue) : abv !== undefined ? Number(abv) * 2 : 0;

  const rawStatus = normalizeImportKey(rowValue(normalizedRow, "status"));
  const status = IMPORT_STATUS_ALIASES[rawStatus] || "sealed";

  const flavorsRaw = rowValue(normalizedRow, "flavors");
  const flavors = flavorsRaw
    ? String(flavorsRaw)
        .split(/[,;]/)
        .map((flavor) => flavor.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    name,
    distillery: String(rowValue(normalizedRow, "distillery") || "").trim(),
    type: String(rowValue(normalizedRow, "type") || "Bourbon").trim(),
    region: String(rowValue(normalizedRow, "region") || "").trim(),
    proof: Number.isFinite(proof) ? proof : 0,
    price: Number(rowValue(normalizedRow, "price") || 0),
    rating: Number(rowValue(normalizedRow, "rating") || 0),
    status,
    ageStatement: String(rowValue(normalizedRow, "ageStatement") || "").trim(),
    storeLocation: String(rowValue(normalizedRow, "storeLocation") || "").trim(),
    shelf: String(rowValue(normalizedRow, "shelf") || "Main bar").trim(),
    quantity: Number(rowValue(normalizedRow, "quantity") || 1),
    bottleSize: Number(rowValue(normalizedRow, "bottleSize") || 750),
    notes: String(rowValue(normalizedRow, "notes") || "").trim(),
    flavors,
  };
}

// Dependency-free CSV parser (quoted fields, embedded commas/newlines/escaped quotes) so
// the common CSV/template path never pays for the Excel library below.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  if (!nonEmptyRows.length) return [];
  const [headerRow, ...dataRows] = nonEmptyRows;
  return dataRows.map((cells) => {
    const record = {};
    headerRow.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
}

// Real .xlsx/.xls files need a real parser (binary zip+XML format) — load it lazily so
// CSV/JSON imports, the common case, never download it.
let xlsxLoadPromise;
function loadXlsxLibrary() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxLoadPromise) {
    xlsxLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.mini.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load the Excel import library."));
      document.head.appendChild(script);
    });
  }
  return xlsxLoadPromise;
}

function parseSpreadsheetFile(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  return rows.map(spreadsheetRowToBottle).filter(Boolean);
}

async function importCollection(event) {
  const [file] = event.target.files;
  if (!file) return;

  const label = els.importActionLabel;
  const originalText = label?.textContent;
  try {
    const isJson = /\.json$/i.test(file.name) || file.type === "application/json";
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    let imported;

    if (isJson) {
      const payload = JSON.parse(await file.text());
      imported = Array.isArray(payload) ? payload : payload.bottles;
    } else if (isExcel) {
      if (label) label.textContent = "Loading Excel support...";
      await loadXlsxLibrary();
      if (label) label.textContent = "Importing...";
      imported = parseSpreadsheetFile(await file.arrayBuffer());
    } else {
      imported = parseCsv(await file.text()).map(spreadsheetRowToBottle).filter(Boolean);
    }

    if (!Array.isArray(imported) || !imported.length) throw new Error("Invalid backup");
    bottles = [...bottles, ...imported.map((bottle) => normalizeBottle({ ...bottle, id: bottle.id || crypto.randomUUID() }))];
    persist();
    render();
    alert(`Imported ${imported.length} bottle${imported.length === 1 ? "" : "s"}.`);
  } catch (error) {
    console.error("Import failed", error);
    alert("That file could not be imported. Make sure it's a CSV, Excel, or JSON export with a header row including at least a bottle name.");
  } finally {
    event.target.value = "";
    if (label) label.textContent = originalText;
  }
}

function downloadImportTemplate() {
  const headers = [
    "Name",
    "Distillery",
    "Type",
    "Region",
    "Proof",
    "Price",
    "Rating",
    "Status",
    "Age Statement",
    "Store Location",
    "Quantity",
    "Bottle Size",
    "Notes",
    "Flavors",
  ];
  const example = [
    "Eagle Rare 10 Year",
    "Buffalo Trace",
    "Bourbon",
    "Kentucky",
    "90",
    "35",
    "8.6",
    "Sealed",
    "10 years",
    "Total Wine",
    "1",
    "750",
    "Leather and toffee",
    "leather, toffee, orange",
  ];
  const csv = `${headers.join(",")}\n${example.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "fully-involved-pour-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
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

const STATUS_OPTIONS = ["sealed", "open", "finished", "buy-next", "wishlist"];

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
    "store-pick": "Store Pick",
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

function priorityLabel(priority) {
  return {
    1: "🔥 Must Try",
    2: "⭐ Highly Recommended",
    3: "🥃 Solid Choice",
    4: "📦 Collection Piece",
    5: "⌛ Save for Later",
  }[Number(priority)] || "🥃 Solid Choice";
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function timeAgo(timestamp) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatDate(new Date(timestamp).toISOString().slice(0, 10));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Re-seed the distillery datalist with anything learned in a previous session.
customLibrary.forEach((entry) => {
  const distillery = (entry.distillery || "").trim();
  if (distillery && !availableDistilleries.some((known) => known.toLowerCase() === distillery.toLowerCase())) {
    availableDistilleries.push(distillery);
  }
});
availableDistilleries.sort((a, b) => a.localeCompare(b));

renderDistilleryOptions();
syncCoreBarScores();
render();
loadSharedBottlePhotos();

// Home-screen shortcut deep links from the PWA manifest.
const launchAction = new URLSearchParams(window.location.search).get("action");
if (launchAction === "add-bottle") {
  openForm();
} else if (launchAction === "log-pour") {
  openPourForm();
}
