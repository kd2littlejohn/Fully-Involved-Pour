import type { DistillerySeed } from '../types'

// Smaller established whiskey-producing countries not broken out into
// their own file — grouped here rather than one-file-per-country to avoid
// a long tail of near-empty seed files.
export const OTHER_DISTILLERY_SEEDS: DistillerySeed[] = [
  // --- Germany ---
  { name: 'Slyrs Distillery', aliases: ['Slyrs'], city: 'Schliersee', stateProvince: 'Bavaria', country: 'Germany', verified: true, status: 'active' },
  { name: 'St. Kilian Distillers', aliases: ['St. Kilian'], city: 'Rüdenau', stateProvince: 'Bavaria', country: 'Germany', verified: true, status: 'active' },
  { name: 'Fleischmann Distillery', aliases: ['Blaue Maus'], city: 'Eggolsheim', stateProvince: 'Bavaria', country: 'Germany', verified: false, status: 'active' },

  // --- Sweden ---
  { name: 'Mackmyra Distillery', aliases: ['Mackmyra'], city: 'Valbo', stateProvince: 'Gävleborg', country: 'Sweden', verified: true, status: 'active' },
  { name: 'High Coast Distillery', aliases: ['Box Distillery'], city: 'Bjärtrå', stateProvince: 'Västernorrland', country: 'Sweden', verified: true, status: 'active' },
  { name: 'Smögen Whisky', aliases: ['Smögen'], city: 'Hunnebostrand', country: 'Sweden', verified: true, status: 'active' },
  { name: 'Spirit of Hven Distillery', aliases: ['Hven Distillery'], city: 'Hven', country: 'Sweden', verified: true, status: 'active' },

  // --- Finland ---
  { name: 'Teerenpeli Distillery', aliases: ['Teerenpeli'], city: 'Lahti', country: 'Finland', verified: true, status: 'active' },
  { name: 'Kyrö Distillery Company', aliases: ['Kyrö'], city: 'Isokyrö', country: 'Finland', verified: true, status: 'active' },

  // --- Netherlands ---
  { name: 'Zuidam Distillers', aliases: ['Millstone'], city: 'Baarle-Nassau', country: 'Netherlands', verified: true, status: 'active' },

  // --- Denmark ---
  { name: 'Stauning Whisky', aliases: ['Stauning'], city: 'Skjern', stateProvince: 'Jutland', country: 'Denmark', verified: true, status: 'active' },
  { name: 'Braunstein Distillery', aliases: ['Braunstein'], city: 'Køge', country: 'Denmark', verified: true, status: 'active' },

  // --- Switzerland ---
  { name: 'Locher Brewery', aliases: ['Säntis Malt'], city: 'Appenzell', country: 'Switzerland', verified: true, status: 'active' },
  { name: 'Langatun Distillery', aliases: ['Langatun'], city: 'Langenthal', country: 'Switzerland', verified: true, status: 'active' },

  // --- South Africa ---
  { name: 'James Sedgwick Distillery', aliases: ['James Sedgwick'], city: 'Wellington', stateProvince: 'Western Cape', country: 'South Africa', verified: true, parentCompany: 'Distell', status: 'active' },

  // --- New Zealand ---
  { name: 'Cardrona Distillery', aliases: ['Cardrona'], city: 'Cardrona', stateProvince: 'Otago', country: 'New Zealand', verified: true, status: 'active' },
  { name: 'Willowbank Distillery', aliases: ['New Zealand Whisky Collection'], city: 'Dunedin', stateProvince: 'Otago', country: 'New Zealand', verified: false, status: 'closed' },

  // --- Israel ---
  { name: 'Milk & Honey Distillery', aliases: ['M&H'], city: 'Tel Aviv', country: 'Israel', verified: true, status: 'active' },

  // --- Austria ---
  { name: 'Waldviertler Roggenhof Distillery', aliases: ['J.H. Distillery', 'Roggenhof'], city: 'Roggenreith', country: 'Austria', verified: true, status: 'active' },

  // --- Belgium ---
  { name: 'Radermacher Distillery', aliases: ['The Belgian Owl'], city: 'Grâce-Hollogne', country: 'Belgium', verified: false, status: 'active' },

  // --- Spain ---
  { name: 'Destilerías y Crianza del Whisky', aliases: ['DYC'], city: 'Palazuelos de Eresma', stateProvince: 'Segovia', country: 'Spain', verified: false, status: 'active' },

  // --- Czech Republic ---
  { name: 'Rudolf Jelinek Distillery', aliases: ['Gold Cock'], city: 'Vizovice', country: 'Czech Republic', verified: false, status: 'active' },

  // --- Liechtenstein ---
  { name: 'Telser Distillery', aliases: ['Telsington'], city: 'Triesen', country: 'Liechtenstein', verified: false, status: 'active' },
]
