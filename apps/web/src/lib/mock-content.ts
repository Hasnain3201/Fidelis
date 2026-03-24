export type EventItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  dateLabel: string;
  timeLabel: string;
  zipCode: string;
  location: string;
  venue: string;
  price: string;
  image: string;
  tags: string[];
  badge?: string;
};

export type VenueItem = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  location: string;
  image: string;
  tags: string[];
  badge?: string;
};

export type ArtistItem = {
  id: string;
  name: string;
  location: string;
  description: string;
  image: string;
  tags: string[];
  badge?: string;
};

export const EVENT_ITEMS: EventItem[] = [
  {
    id: "evt-jazz-night",
    title: "Jazz Night with The Jazz Collective",
    subtitle: "Live Music",
    description: "An evening of smooth jazz standards and original compositions.",
    dateLabel: "Wed, Feb 14",
    timeLabel: "8:00 PM",
    zipCode: "78701",
    location: "Austin, TX",
    venue: "The Blue Note Lounge",
    price: "$15 cover",
    image:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
    tags: ["Live Music", "Jazz", "Indoor"],
    badge: "SOLD OUT",
  },
  {
    id: "evt-sunset-riders",
    title: "Summer Concert Series: The Midnight Riders",
    subtitle: "Concert",
    description: "Rock out under the stars with Austin's favorite classic rock band.",
    dateLabel: "Fri, Feb 20",
    timeLabel: "7:00 PM",
    zipCode: "78702",
    location: "Austin, TX",
    venue: "Sunset Amphitheater",
    price: "$25",
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80",
    tags: ["Concert", "Classic Rock", "Outdoor"],
    badge: "Ticket",
  },
  {
    id: "evt-comedy-marcus",
    title: "Comedy Night: Marcus Cole Live",
    subtitle: "Comedy Show",
    description: "Get ready to laugh as Marcus Cole brings his hilarious observational comedy.",
    dateLabel: "Thu, Feb 22",
    timeLabel: "9:00 PM",
    zipCode: "85001",
    location: "Phoenix, AZ",
    venue: "Laughing Cactus Comedy",
    price: "$20 cover",
    image:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
    tags: ["Comedy Show", "Indoor", "Tickets"],
    badge: "Ticket",
  },
  {
    id: "evt-underground-dj-pulse",
    title: "Underground: DJ Pulse",
    subtitle: "DJ Set",
    description: "Deep house and techno all night long. Prepare for an immersive dance floor.",
    dateLabel: "Sat, Feb 24",
    timeLabel: "10:00 PM",
    zipCode: "77002",
    location: "Houston, TX",
    venue: "Warehouse 54",
    price: "$20 cover",
    image:
      "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=900&q=80",
    tags: ["DJ Set", "Dance Party", "House"],
  },
  {
    id: "evt-neon-nights",
    title: "Neon Nights",
    subtitle: "DJ Set",
    description: "An 80s themed night with neon lights, retro decor, and DJ sets.",
    dateLabel: "Sat, Mar 2",
    timeLabel: "11:00 PM",
    zipCode: "33139",
    location: "Miami, FL",
    venue: "The Velvet Room",
    price: "$30",
    image:
      "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=900&q=80",
    tags: ["DJ Set", "Retro", "Nightlife"],
  },
  {
    id: "evt-folk-vine",
    title: "Folk & Vine",
    subtitle: "Acoustic",
    description: "An acoustic evening featuring folk melodies and singer-songwriters.",
    dateLabel: "Sun, Mar 3",
    timeLabel: "7:30 PM",
    zipCode: "97205",
    location: "Portland, OR",
    venue: "Community Hall",
    price: "$18",
    image:
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80",
    tags: ["Acoustic", "Indie", "Folk"],
  },
  {
    id: "evt-rhythm-section",
    title: "Rhythm Section",
    subtitle: "Band",
    description: "R&B and soul band bringing smooth grooves and powerful vocals.",
    dateLabel: "Fri, Mar 8",
    timeLabel: "9:30 PM",
    zipCode: "30303",
    location: "Atlanta, GA",
    venue: "Soul Stage",
    price: "$22",
    image:
      "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=80",
    tags: ["R&B", "Soul", "Band"],
  },
  {
    id: "evt-luna-rose",
    title: "Luna Rose Live",
    subtitle: "Indie Pop",
    description: "Dreamy vocals, melodic hooks, and a high-energy late evening set.",
    dateLabel: "Thu, Mar 14",
    timeLabel: "8:30 PM",
    zipCode: "60601",
    location: "Chicago, IL",
    venue: "Skylight Venue",
    price: "$24",
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
    tags: ["Indie Pop", "Live", "Night"],
  },
  {
    id: "evt-cosmic-vibes",
    title: "Cosmic Vibes",
    subtitle: "Electronic",
    description: "Reggae and electronic fusion night with immersive visuals.",
    dateLabel: "Sat, Mar 16",
    timeLabel: "10:30 PM",
    zipCode: "92101",
    location: "San Diego, CA",
    venue: "Moonlight Hall",
    price: "$19",
    image:
      "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80",
    tags: ["Electronic", "Reggae", "Visuals"],
  },
];

export const VENUE_ITEMS: VenueItem[] = [
  {
    id: "ven-blue-note",
    name: "The Blue Note Lounge",
    tagline: "Legendary jazz venue in the heart of downtown.",
    description: "A legendary jazz venue in the heart of downtown, featuring world-class performances.",
    location: "Austin, TX",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Parking", "Live Stage"],
    badge: "Club/Nightclub",
  },
  {
    id: "ven-sunset",
    name: "Sunset Amphitheater",
    tagline: "Music under the stars.",
    description: "An outdoor concert venue with stunning views and incredible acoustics.",
    location: "Austin, TX",
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Parking"],
    badge: "Outdoor Venue",
  },
  {
    id: "ven-velvet-room",
    name: "The Velvet Room",
    tagline: "Elegant nightlife in the city.",
    description: "A cozy and modern space featuring top DJs and curated live sets.",
    location: "Dallas, TX",
    image:
      "https://images.unsplash.com/photo-1566737236500-c8ac43014a8e?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Live Stage"],
    badge: "Bar/Pub",
  },
  {
    id: "ven-warehouse54",
    name: "Warehouse 54",
    tagline: "The underground sound.",
    description: "A converted warehouse space hosting EDM nights, underground DJs, and pop-ups.",
    location: "Houston, TX",
    image:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
    tags: ["Parking"],
    badge: "Club/Nightclub",
  },
  {
    id: "ven-laughing-cactus",
    name: "Laughing Cactus Comedy",
    tagline: "Laugh in the desert.",
    description: "The southwest's premier comedy destination featuring national headliners.",
    location: "Phoenix, AZ",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Live Stage"],
    badge: "Theater",
  },
  {
    id: "ven-rustic-barn",
    name: "The Rustic Barn",
    tagline: "Country music and good times.",
    description: "An authentic barn venue featuring live country music and line dancing.",
    location: "Nashville, TN",
    image:
      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Parking"],
    badge: "Bar/Pub",
  },
  {
    id: "ven-gallery42",
    name: "Gallery 42",
    tagline: "Art meets sound.",
    description: "A contemporary art gallery that transforms into an intimate music venue by night.",
    location: "Denver, CO",
    image:
      "https://images.unsplash.com/photo-1497032205916-ac775f0649ae?auto=format&fit=crop&w=900&q=80",
    tags: ["Live Stage"],
    badge: "Gallery",
  },
  {
    id: "ven-beachside",
    name: "Beachside Brewery",
    tagline: "Craft beer and live sound.",
    description: "A beachfront brewery with an outdoor stage and rotating local bands.",
    location: "San Diego, CA",
    image:
      "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Live Stage"],
    badge: "Brewery/Winery",
  },
  {
    id: "ven-grand-theater",
    name: "The Grand Theater",
    tagline: "Historic elegance.",
    description: "A beautifully restored 1920 theater hosting concerts, recitals, and talks.",
    location: "Chicago, IL",
    image:
      "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Live Stage"],
    badge: "Concert Hall",
  },
  {
    id: "ven-neon-heights",
    name: "Neon Heights",
    tagline: "Retro vibes, modern beats.",
    description: "An 80s-themed club where live sets and DJ nights run late.",
    location: "Miami, FL",
    image:
      "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=900&q=80",
    tags: ["Parking"],
    badge: "Club/Nightclub",
  },
  {
    id: "ven-folk-vine",
    name: "Folk & Vine",
    tagline: "Acoustic and intimate.",
    description: "A cozy wine bar featuring folk musicians and singer-songwriter showcases.",
    location: "Portland, OR",
    image:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Live Stage"],
    badge: "Brewery/Winery",
  },
  {
    id: "ven-rhythm-room",
    name: "The Rhythm Room",
    tagline: "Where every beat matters.",
    description: "A legendary R&B and soul venue with rotating local and national performers.",
    location: "Atlanta, GA",
    image:
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=900&q=80",
    tags: ["Food", "Live Stage"],
    badge: "Club/Nightclub",
  },
];

export const ARTIST_ITEMS: ArtistItem[] = [
  {
    id: "art-midnight-riders",
    name: "The Midnight Riders",
    location: "Austin, TX",
    description: "A high-energy rock band bringing classic anthems and original tracks.",
    image:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80",
    tags: ["Rock", "Classic Rock", "Studio"],
    badge: "Band",
  },
  {
    id: "art-dj-pulse",
    name: "DJ Pulse",
    location: "Houston, TX",
    description: "Electronic music producer and DJ specializing in house and techno.",
    image:
      "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=900&q=80",
    tags: ["EDM", "House", "Techno"],
    badge: "DJ",
  },
  {
    id: "art-sarah-mitchell",
    name: "Sarah Mitchell",
    location: "Nashville, TN",
    description: "Singer-songwriter with a soulful voice blending folk and country.",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
    tags: ["Country", "Acoustic"],
    badge: "Solo Artist",
  },
  {
    id: "art-marcus-cole",
    name: "Marcus Cole",
    location: "Phoenix, AZ",
    description: "Stand-up comedian known for observational humor and crowd interaction.",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80",
    tags: ["Comedy", "Stand-up"],
    badge: "Comedian",
  },
  {
    id: "art-jazz-collective",
    name: "The Jazz Collective",
    location: "Austin, TX",
    description: "A rotating ensemble of jazz musicians bringing classic standards to life.",
    image:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
    tags: ["Jazz", "Blues", "Soul"],
    badge: "Band",
  },
  {
    id: "art-neon-dreams",
    name: "Neon Dreams",
    location: "Miami, FL",
    description: "Synth-wave duo creating nostalgic 80s-inspired electronic music.",
    image:
      "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=900&q=80",
    tags: ["EDM", "Synthwave", "Duo"],
    badge: "Band",
  },
  {
    id: "art-rhythm-section",
    name: "Rhythm Section",
    location: "Atlanta, GA",
    description: "R&B and soul band bringing smooth grooves and dynamic live vocals.",
    image:
      "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=80",
    tags: ["R&B", "Soul", "Live"],
    badge: "Band",
  },
  {
    id: "art-amazing-mondo",
    name: "The Amazing Mondo",
    location: "Las Vegas, NV",
    description: "Master illusionist and stage performer mixing wonder and entertainment.",
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80",
    tags: ["Magic", "Variety", "Stage"],
    badge: "Magician",
  },
  {
    id: "art-cosmic-vibes",
    name: "Cosmic Vibes",
    location: "San Diego, CA",
    description: "Reggae and world music band bringing positive energy and melody.",
    image:
      "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?auto=format&fit=crop&w=900&q=80",
    tags: ["Reggae", "World", "Live"],
    badge: "Band",
  },
  {
    id: "art-steel-city-tribute",
    name: "Steel City Tribute",
    location: "Chicago, IL",
    description: "Classic rock cover band delivering stadium-ready anthems.",
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
    tags: ["Rock", "Cover Band"],
    badge: "Cover Band",
  },
  {
    id: "art-luna-rose",
    name: "Luna Rose",
    location: "Portland, OR",
    description: "Indie-pop artist with heartfelt lyrics and soaring melodies.",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    tags: ["Indie", "Pop", "Alternative"],
    badge: "Solo Artist",
  },
  {
    id: "art-mystic-maya",
    name: "Mystic Maya",
    location: "Denver, CO",
    description: "Dynamic vocalist with cinematic arrangements and atmospheric live sets.",
    image:
      "https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=80",
    tags: ["Psychic", "Alternative"],
    badge: "Psychic",
  },
];
