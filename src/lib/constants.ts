/**
 * Site-wide configuration constants.
 * AB Entertainment — Black & Gold brand palette:
 *   Primary:   #0A0A0A (rich black)
 *   Surface:   #111111
 *   Gold:      #C9A84C (signature gold)
 *   Gold Lt:   #D4B65C
 *   Text:      rgba(255,255,255,0.5)
 */

export const SITE_CONFIG = {
  name: 'AB Entertainment',
  tagline: "Melbourne's Premier Indian & Marathi Performing Arts Experience",
  description: '6+ Events, 25+ Team, 25,000+ Audience Reach — Digital footprint across Australia and New Zealand',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://abentertainment.com.au',
  contact: {
    phone: '(+61) 430082646',
    email: 'abhi@abentertainment.com.au',
    address: {
      city: 'Melbourne',
      state: 'VIC',
      country: 'Australia',
    },
  },
  social: {
    instagram: 'https://instagram.com/abentertainment_events/',
    facebook: 'https://facebook.com/ABEntertainmentAU',
  },
  colors: {
    primary: '#0A0A0A',
    surface: '#111111',
    gold: '#C9A84C',
    goldLight: '#D4B65C',
    textMuted: 'rgba(255,255,255,0.4)',
    white: '#FFFFFF',
    overlayDark: 'rgba(0, 0, 0, 0.75)',
  },
};

export const FOUR_PILLARS = [
  {
    title: 'Networking',
    description: 'Promoting community members through business meets',
    icon: 'network',
  },
  {
    title: 'Heritage Bequest',
    description: 'Transferring the rich heritage to the next generation',
    icon: 'heritage',
  },
  {
    title: 'Cultural Kaleidoscope',
    description: 'Platform to promote diversity, literature, drama, movies & events of Indian culture',
    icon: 'culture',
  },
  {
    title: 'Community Building',
    description: 'Bringing together the Indian diaspora in Melbourne through shared cultural experiences',
    icon: 'community',
  },
];

export const ABOUT_CONTENT = {
  title: 'About AB Entertainment',
  tagline: 'Where Every Detail is Meticulously Crafted to Create Unforgettable Experiences',
  description: 'AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let\'s turn your dreams into reality.',
  team: 'The creative minds behind our event company. With a blend of artistic vision and entrepreneurial spirit, they\'ve crafted unforgettable experiences that captivate audiences. Meet the driving force behind our productions, whose passion for storytelling and commitment to excellence set the stage for unforgettable moments.',
  pastEvents: 'Relive the magic of our past events! Take a journey through our archives and discover the unforgettable moments we\'ve created together. From mesmerizing performances to heart-warming encounters, each event reflects our dedication to excellence and passion for entertainment and get ready to be inspired for what\'s to come.',
  sections: [
    {
      heading: 'Our Story',
      body: [
        'AB Entertainment was born from a vision to bring authentic Indian and Marathi cultural experiences to Melbourne. What began as a passionate initiative has grown into one of Australia\'s most respected platforms for subcontinental performing arts.',
        'With 6+ major events, a 25+ member team, and over 25,000 audience reach, our digital footprint extends across Australia and New Zealand.',
      ],
    },
    {
      heading: 'Our Mission',
      body: [
        'To celebrate and showcase the rich tapestry of Indian and Marathi performing arts to diverse audiences across Melbourne and beyond.',
        'Every event we curate is a carefully orchestrated blend of tradition and contemporary interpretation, honoring classical forms while embracing innovation.',
      ],
    },
    {
      heading: 'Artistic Philosophy',
      body: [
        'We believe in the transformative power of authentic cultural expression. Our artists are meticulously selected from both established masters and emerging talent.',
        'From classical Hindustani and Carnatic music to contemporary Marathi theatre, from intricate dance forms to folk storytelling traditions, AB Entertainment presents the full spectrum.',
      ],
    },
    {
      heading: 'Community Impact',
      body: [
        'Beyond performances, AB Entertainment serves as a cultural hub. We offer masterclasses, workshops, and mentorship programs.',
        'We partner with schools, cultural institutions, and community organizations to ensure these magnificent art forms remain vibrant for generations to come.',
      ],
    },
  ],
};

export const TEAM_MEMBERS = [
  {
    name: 'Abhijit Kadam',
    role: 'President & CEO',
    image: '/images/team/abhijit-kadam.jpg',
    bio: 'The visionary leader behind AB Entertainment, Abhijit brings strategic direction and business acumen to every production. His commitment to excellence and passion for Indian cultural arts drives the company\'s mission to deliver world-class entertainment experiences in Melbourne.',
  },
  {
    name: 'Vrushali Deshpande',
    role: 'Founder & Director',
    image: '/images/team/vrushali-deshpande.jpg',
    bio: 'As the creative force and founder of AB Entertainment, Vrushali\'s artistic vision and deep understanding of Marathi and Indian performing arts has been instrumental in establishing the company as Melbourne\'s premier cultural entertainment brand.',
  },
];

export const NAVIGATION = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Events', href: '/events' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Sponsors', href: '/sponsors' },
  { label: 'Contact', href: '/contact' },
];

export const STATS = [
  { value: '6+', label: 'Events' },
  { value: '25+', label: 'Team Members' },
  { value: '25,000+', label: 'Audience Reach' },
  { value: '2', label: 'Countries' },
];

export const PAST_EVENTS = [
  'Punha Sahi re Sahi',
  'Shyamachi Aai',
  'Jar Tar chi Gosht',
  'Sankarshan via Spruha',
  'Tendlya',
  'Niyam V Ati Lagu, Melbourne',
];

export const UPCOMING_EVENTS = [
  'Shrimant Damodar Pant',
  'Arya Ambekar Live in Concert',
  'Shikayla Gelo Ek!',
  'Varvarche Vadhu Var',
];
