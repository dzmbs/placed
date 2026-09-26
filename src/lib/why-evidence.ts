// Research snapshot: 27 September 2026. Preserve original amounts in conversion notes.
// A website counter or creator statement is not an independent payment audit.
export type SaleEvidence = {
  id: string;
  creator: string;
  surface: string;
  amount: string;
  amountNote?: string;
  exchangeRateSource?: string;
  basis: string;
  timing: string;
  timingNote: string;
  note: string;
  website?: string;
  post?: string;
  result?: string;
  resultLabel?: string;
  screenshot?: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  featuredNote?: string;
};

export const sales: SaleEvidence[] = [
  {
    id: 'solana',
    creator: 'Solana × Mallow',
    surface: '9 placements on a profile picture',
    amount: '$166,946.50',
    basis: 'Auction-site result',
    timing: '24-hour auction',
    timingNote: '1–2 Sep 2026; anti-sniping extensions applied.',
    note: 'Winning bids for one week of logo display. Proceeds went to Nepal flood relief; the site publishes donation transaction links.',
    website: 'https://nepal.mallow.art/',
    post: 'https://x.com/solana/status/2094775606475124877',
    result:
      'https://solanacompass.com/news/solana-sells-nine-logo-zones-for-nepal-flood-relief-raising-166k-in-usdc',
    resultLabel: 'Recap',
    screenshot: '/evidence/solana-nepal.png',
    featuredImage: '/evidence/solana-nepal-supplied.png',
    featuredImageAlt: 'Sponsor placements on the Solana profile picture for the Nepal Relief Fund.',
  },
  {
    id: 'marc',
    creator: 'Marc Lou',
    surface: '15 body placements for a HYROX race',
    amount: '$112,000',
    basis: 'Creator-reported payment',
    timing: '8–11 Sep · about 3 days',
    timingNote: 'Launch on 8 Sep; close at 00:00 UTC on 11 Sep (about 58 hours).',
    note: 'Temporary sponsor tattoos for the 19 Sep race. The launch described 10 muscles; the final campaign had 15 zones. Use the final $112,000 site total.',
    website: 'https://hyrox.marclou.com/',
    post: 'https://x.com/marclou/status/2097326512169222407',
    result: 'https://weirdrevenue.com/projects/sponsormybody',
    resultLabel: 'Timeline',
    screenshot: '/evidence/marc-hyrox.png',
    featuredImage: '/evidence/marc-hyrox-supplied.png',
    featuredImageAlt: 'Marc Lou’s HYROX sponsorship page, showing sponsor placements on his body.',
  },
  {
    id: 'vanshika',
    creator: 'Vanshika',
    surface: '13 placements on a TOKEN2049 dress',
    amount: '$9,200',
    basis: 'Creator report + website total',
    timing: 'Under 48 hours',
    timingNote: 'Launched 12 Sep; sold-out announcement 14 Sep 2026.',
    note: 'The creator explicitly reports the amount and elapsed time. The fully loaded campaign site also shows $9,200 and all 13 spots sold; its initial loading state shows $0.',
    website: 'https://token2049.vanshu.fun/',
    post: 'https://x.com/vanshuETH/status/2098766183726227823',
    result: 'https://x.com/vanshuETH/status/2099413220641669280',
    resultLabel: 'Sold-out post',
    screenshot: '/evidence/vanshika-result.png',
    featuredImage: '/evidence/vanshika-dress.png',
    featuredImageAlt:
      'Vanshika’s TOKEN2049 dress, with front and back sponsorship placements and asking prices.',
  },
  {
    id: 'vincent',
    creator: 'Vincent / VynseDev',
    surface: 'MacBook, interior & accessories',
    amount: '€7,955',
    basis: 'Website-reported total',
    timing: '14 days advertised; sales continued',
    timingNote: 'Launched 26 Aug; bid history runs through 23 Sep (28 days). Total checked 27 Sep.',
    note: 'The original 10 lid spots expanded to 20. The site labels this “raised” but says winners were contacted for payment. This is not a verified 14-day cash total. Euros are the original currency.',
    website: 'https://brandmymac.com/',
    post: 'https://x.com/VynseDev/status/2092544016315306400',
    result: 'https://brandmymac.com/#spots',
    resultLabel: 'Bid history',
    screenshot: '/evidence/brand-my-mac.png',
  },
  {
    id: 'winny',
    creator: 'Winny / winternet',
    surface: 'Ironman kit, bike & helmet',
    amount: '$5,750',
    basis: 'Website commitments',
    timing: 'Recorded within 22 days',
    timingNote: '26 Aug launch (UTC) → 17 Sep indexed total; exact sell-out time is not published.',
    note: 'The live site shows all 22 placements sold and labels the total “Committed.” The launch offered 11. Covers training and races, including Dec 2026 and Q2 2027.',
    website: 'https://www.negativesplit.space/',
    post: 'https://x.com/winternet/status/2092720263976886372',
    result: 'https://sponsorme.emilylai.com/campaigns/winternet',
    resultLabel: 'Dated snapshot',
  },
  {
    id: 'riri',
    creator: 'Riri / realririfish',
    surface: 'TOKEN2049 outfit',
    amount: '$3,250',
    basis: 'Earlier index snapshot only',
    timing: '17–21 Sep · 4 days to snapshot',
    timingNote: 'Sale deadline: 21 Sep, 23:59 Singapore time. Final total is not published.',
    note: 'The index recorded $3,250 on 21 Sep. On 27 Sep the loaded site shows 7 of 13 spots claimed, with no total. The index also has conflicting stale notes; $3,250 is not a verified final raise.',
    website: 'https://ririfish.xyz/',
    post: 'https://x.com/realririfish/status/2100631098518851730',
    result: 'https://sponsorme.emilylai.com/campaigns/realririfish',
    resultLabel: 'Dated snapshot',
    featuredImage: '/evidence/riri-outfit.png',
    featuredImageAlt:
      'Riri’s TOKEN2049 outfit showing numbered sponsorship placements on the front and back.',
    featuredNote: 'Earlier snapshot; the final amount raised is not published.',
  },
  {
    id: 'vana',
    creator: 'Vana / coinempress',
    surface: '18 placements on a suitcase',
    amount: '$2,500',
    basis: 'Website commitments',
    timing: '20 days since launch at capture',
    timingNote: '7–27 Sep observed; site lists sales closing 29 Sep or at sell-out.',
    note: 'The site shows $2,500 committed, 13 sold, one held, and four available. The held $175 spot is not included. This is an observation window, not a measured time to sell out.',
    website: 'https://www.coinempress.xyz/token2049',
    post: 'https://x.com/coinempress/status/2096943568208146499',
    result: 'https://token2049-suitcase.vercel.app/',
    resultLabel: 'Original sale URL',
  },
  {
    id: 'fabiano',
    creator: 'Fabiano',
    surface: '7 placements on an X banner',
    amount: '$1,650',
    basis: 'Leading bids, not settled revenue',
    timing: '3-day advertised auction',
    timingNote: '29 Aug launch (UTC); closing date stated as 1 Sep. Display lasts 30 days.',
    note: 'The site reports committed leading bids, with a 20% USDC deposit requirement and the balance due from winners. It does not establish collection of the full $1,650.',
    website: 'https://bidonmybanner.com/',
    post: 'https://x.com/FabianoSolana/status/2093716324312596838',
  },
  {
    id: 'forehead',
    creator: 'Wilfred / Will Baron',
    surface: 'Forehead advertising, shared by Nate',
    amount: 'Not disclosed',
    basis: 'Offer / interest, no verified sale',
    timing: 'Sale duration not established',
    timingNote:
      'March 2026 coverage; Nate’s linked post is 1 Apr. One week was the offered ad term.',
    note: 'Reported asking prices were $300–$600 per spot per week. MrBeast expressed interest. Neither the linked post nor the reporting establishes an amount paid or a completed deal.',
    post: 'https://x.com/thenathanlopes/status/2039244752240156852',
    result: 'https://whatstrending.com/video/mrbeast-is-allegedly-buying-forehead-ad-space/',
    resultLabel: 'Reporting',
  },
  {
    id: 'bonnie',
    creator: 'Bonnie Blue',
    surface: 'Newborn naming rights / “BetBolt”',
    amount: '$1.59 million',
    amountNote: 'Approximate USD equivalent of £1.2 million at 1 GBP = 1.3246 USD on 25 Sep 2026.',
    exchangeRateSource: 'https://www.exchangerates.org.uk/historical/GBP/25_09_2026',
    basis: 'Unverified winning-bid claim',
    timing: 'Duration not established',
    timingNote:
      'Result announced 22 Sep; reporting dated 23 Sep 2026. No reliable opening time found.',
    note: 'Blue announced this amount for the name “BetBolt.” Payment is not independently confirmed. The original site now shows a promotional image. This is an adjacent naming-rights story, rather than an ad-slot campaign.',
    website: 'https://bonnieblue.io/',
    result: 'https://www.ibtimes.co.uk/bonnie-blue-baby-naming-auction-betbolt-1821405',
    resultLabel: 'Reporting',
    screenshot: '/evidence/bonnie-reported-auction.png',
    featuredImage: '/evidence/bonnie-blue.png',
    featuredImageAlt:
      'User-supplied photos of Bonnie Blue holding her newborn and during pregnancy.',
    featuredNote: 'Naming-rights example. Payment is not independently confirmed.',
  },
];
